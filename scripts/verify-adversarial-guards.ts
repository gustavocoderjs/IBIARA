import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { customerTurn } from '../lib/agents/customer/service.ts';
import { draftReadiness } from '../lib/agents/customer/tools.ts';
import type { ChatProvider } from '../lib/agents/shared/neuralake.ts';
import { initialState } from '../lib/domain/fixtures.ts';
import { commandSchema } from '../lib/domain/commands.ts';
import { transact, type AggregateStore } from '../lib/domain/transaction.ts';
import { DomainError, type State } from '../lib/domain/types.ts';

// Controlled model responses exercise backend guards only. No HTTP, D1, secrets,
// NeuraLake client or external provider is used by this script.
class MemoryStore implements AggregateStore {
    rows = new Map<string, { revision: number; state: State }>();
    async read(owner: string) { return structuredClone(this.rows.get(owner) ?? null); }
    async insert(owner: string, state: State) {
        if (!this.rows.has(owner)) this.rows.set(owner, { revision: 0, state: structuredClone(state) });
    }
    async compareAndSwap(owner: string, revision: number, state: State) {
        if (this.rows.get(owner)?.revision !== revision) return false;
        this.rows.set(owner, { revision: revision + 1, state: structuredClone(state) });
        return true;
    }
}
const fake = (content: unknown): ChatProvider => ({ async complete() {
    return { content: JSON.stringify(content),
        usage: { mode: 'LOCAL_MOCK', model: 'controlled-response-no-network', tokens: null, cost: null } };
} });
const records: { id: string; status: 'PASS' | 'FAIL'; expected: string; observed: unknown; errors: string[] }[] = [];
async function check(id: string, expected: string, run: (observed: Record<string, unknown>) => Promise<void>) {
    const observed: Record<string, unknown> = {};
    try { await run(observed); records.push({ id, status: 'PASS', expected, observed, errors: [] }); }
    catch (error) { records.push({ id, status: 'FAIL', expected, observed,
        errors: [error instanceof Error ? error.message : String(error)] }); }
}
async function turn(store: MemoryStore, owner: string, message: string, provider: ChatProvider) {
    const version = (await store.read(owner))?.state.customerAgent?.version ?? 0;
    const key = `controlled_${crypto.randomUUID()}`;
    return customerTurn(store, owner, { message, expectedVersion: version }, key, key, provider);
}

for (const [field, invented] of [['budget', '50.00'], ['portions', 1], ['maxMinutes', 40]] as const) {
    await check(`reject_invented_${field}`, `${field} remains null when the person has not supplied it`, async observed => {
        const store = new MemoryStore(), owner = `synthetic_${field}_${crypto.randomUUID()}`;
        await turn(store, owner, 'quero bife', fake({ tool: 'propose_request',
            patch: { description: 'Bife', [field]: invented } }));
        const state = (await store.read(owner))!.state;
        observed.userMessage = 'quero bife';
        observed.controlledPatch = { description: 'Bife', [field]: invented };
        observed.draft = state.customerAgent!.draft;
        observed.orders = state.orders.length; observed.mandates = state.mandates.length;
        assert.equal(state.orders.length, 0); assert.equal(state.mandates.length, 0);
        assert.equal(state.customerAgent!.draft[field], null);
    });
}

await check('retain_declared_food_safety_concern', 'A location correction cannot retract a declared allergy', async observed => {
    const store = new MemoryStore(), owner = `synthetic_safety_${crypto.randomUUID()}`;
    await turn(store, owner, 'tenho alergia a ovo', fake({ tool: 'propose_request', patch: { foodSafetyConcern: true } }));
    const before = (await store.read(owner))!.state.customerAgent!.draft;
    assert.equal(before.foodSafetyConcern, true);
    await turn(store, owner, 'a entrega será no Butantã', fake({ tool: 'propose_request',
        patch: { zone: 'demo_butanta', foodSafetyConcern: false } }));
    const state = (await store.read(owner))!.state;
    observed.previousConcern = before.foodSafetyConcern;
    observed.userMessage = 'a entrega será no Butantã';
    observed.controlledPatch = { zone: 'demo_butanta', foodSafetyConcern: false };
    observed.currentConcern = state.customerAgent!.draft.foodSafetyConcern;
    observed.orders = state.orders.length;
    assert.equal(state.orders.length, 0);
    assert.equal(state.customerAgent!.draft.foodSafetyConcern, true);
});

await check('invalid_json_and_timeout_preserve_state', 'Malformed model output and timeout leave persisted state unchanged', async observed => {
    const outcomes = [];
    for (const code of ['PROVIDER_INVALID_OUTPUT', 'PROVIDER_TIMEOUT']) {
        const store = new MemoryStore(), owner = `synthetic_failure_${crypto.randomUUID()}`;
        await store.insert(owner, initialState(owner, new Date().toISOString()));
        const before = await store.read(owner);
        const provider: ChatProvider = { async complete() {
            if (code === 'PROVIDER_TIMEOUT') throw new DomainError(code, 'Simulated timeout; no network call', 503);
            return { content: 'not JSON', usage: { mode: 'LOCAL_MOCK', model: 'controlled-response-no-network', tokens: null, cost: null } };
        } };
        let rejected = false;
        try { await turn(store, owner, 'quero bife', provider); }
        catch (error) { rejected = error instanceof DomainError && error.code === code; }
        const after = await store.read(owner);
        assert.equal(rejected, true);
        assert.deepEqual(after, before);
        assert.equal(after!.state.orders.length, 0);
        outcomes.push({ simulatedError: code, rejected, stateUnchanged: true, orders: 0 });
    }
    observed.failures = outcomes;
});

await check('manual_purchase_respects_declared_allergy', 'A known unresolved allergy blocks manual mandate/RFQ/purchase as well as chat review', async observed => {
    const store = new MemoryStore(), owner = `synthetic_manual_${crypto.randomUUID()}`;
    await turn(store, owner, 'Quero um bife a cavalo até 50 reais, em 40 minutos no Butantã. Tenho alergia a ovo.',
        fake({ tool: 'propose_request', patch: { description: 'Bife a cavalo', budget: '50.00', portions: 1,
            maxMinutes: 40, zone: 'demo_butanta', excluded: ['ovo'], foodSafetyConcern: true } }));
    const afterChat = (await store.read(owner))!.state;
    assert.equal(afterChat.customerAgent!.draft.foodSafetyConcern, true);
    assert.equal(draftReadiness(afterChat.customerAgent!.draft, afterChat).ready, false);
    const stages: string[] = [];
    let blocked: string | null = null;
    const command = async (input: Record<string, unknown>) => {
        const key = `manual_${crypto.randomUUID()}`;
        return transact(store, owner, commandSchema.parse(input), key, key);
    };
    try {
        const authorization = await command({ type: 'mandate', scope: 'buyer', maxCents: 5000,
            description: 'Bife a cavalo', maxMinutes: 40, zone: 'demo_butanta', excluded: [], confirmed: true });
        stages.push('mandate accepted');
        const mandateId = (authorization.result as { mandateId: string }).mandateId;
        const quote = await command({ type: 'rfq', scope: 'buyer', mandateId });
        stages.push('RFQ accepted');
        const rfqId = (quote.result as { rfqId: string }).rfqId;
        await command({ type: 'negotiate', scope: 'buyer', rfqId });
        stages.push('negotiation completed');
    } catch (error) {
        if (!(error instanceof DomainError)) throw error;
        blocked = error.code;
    }
    const final = (await store.read(owner))!.state;
    observed.controlledScenario = 'Declared egg allergy retained in chat; manual request omits allergy/exclusions';
    observed.stages = stages; observed.blocked = blocked;
    observed.foodSafetyConcern = final.customerAgent!.draft.foodSafetyConcern;
    observed.orders = final.orders.map(order => ({ restaurant: order.merchantId,
        totalCents: order.totalCents, executionMode: order.executionMode }));
    observed.reservedEggs = final.restaurants.find(r => r.id === 'niko')!.stock.find(i => i.id === 'ovo')!.reserved;
    assert.equal(final.orders.length, 0);
    assert.ok(blocked, 'A safety refusal should be explicit');
});

const report = { execution: 'CONTROLLED_IN_MEMORY_SIMULATION', realLlmTest: false,
    externalProviderCalls: 0, serverCalls: 0, persistentUserDataChanged: false,
    at: new Date().toISOString(), status: records.every(record => record.status === 'PASS') ? 'PASS' : 'FAIL',
    passed: records.filter(record => record.status === 'PASS').length,
    failed: records.filter(record => record.status === 'FAIL').length, cases: records };
await mkdir(new URL('../outputs/', import.meta.url), { recursive: true });
await writeFile(new URL('../outputs/adversarial-guards.json', import.meta.url), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (report.failed) process.exitCode = 1;
