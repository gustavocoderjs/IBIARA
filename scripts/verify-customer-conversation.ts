// Opt-in real conversation test. All state is synthetic and discarded in memory.
// Eight turns, with at most one schema repair each. No commands authorize or buy food.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { type AggregateStore } from '../lib/domain/transaction.ts';
import { DomainError, type State } from '../lib/domain/types.ts';
import { cents } from '../lib/domain/money.ts';
import { customerTurn } from '../lib/agents/customer/service.ts';
import { initialState } from '../lib/domain/fixtures.ts';
import { ensureDemoMarket } from '../lib/domain/demo-market.ts';
import { publicMenu } from '../lib/agents/customer/menu.ts';
import { CUSTOMER_SYSTEM_PROMPT } from '../lib/agents/customer/prompt.ts';
import { agentDecisionSchema, customerDraftSchema, type AgentUsage } from '../lib/agents/customer/schemas.ts';
import { draftReadiness } from '../lib/agents/customer/tools.ts';
import { configForAgent, type AgentEnvironment } from '../lib/agents/shared/config.ts';
import { NeuraLakeChat, type ChatProvider, type ChatMessage } from '../lib/agents/shared/neuralake.ts';

if (!process.argv.includes('--live')) throw new Error('Pass --live explicitly; eight real turns may use up to sixteen provider calls.');
const env = Object.fromEntries(readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8')
    .split(/\r?\n/).filter(line => line.trim() && !line.trim().startsWith('#')).map(line => {
        const equal = line.indexOf('=');
        return [line.slice(0, equal).trim(), line.slice(equal + 1).trim()];
    })) as AgentEnvironment;
const secrets = Object.entries(env).filter(([key, value]) => key.endsWith('_API_KEY') && value).map(([, value]) => value!);
const redact = (text: string) => secrets.reduce((value, key) => value.replaceAll(key, '[REDACTED]'), text)
    .replace(/nlk-[a-z0-9_-]+/gi, '[REDACTED]');

class MemoryStore implements AggregateStore {
    private rows = new Map<string, { revision: number; state: State }>();
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

const messages = [
    'quero comer um bife',
    '40 reais 50 minutos',
    'sera no morumbi',
    'entao sera no butata',
    'nao, me passe os pratos disponiveis',
    'o que tem disponivel?',
    'prefiro o restaurante mais bem avaliado, mesmo que demore mais',
    'na verdade prefiro o menor preço',
];
const store = new MemoryStore(), owner = 'synthetic_natural_conversation';
const turns: Record<string, unknown>[] = [], usages: AgentUsage[] = [];
const diagnosticCompletions: { turn: number; content: string }[] = [];
const jsonCapability = process.argv.includes('--json-capability');
let capabilityHttpStatus: number | null = null;
let providerRequests = 0, activeTurn = 0, firstDescription: string | null = null;
try {
    const config = configForAgent(env, 'buyer');
    assert.equal(config.mode, 'live', 'Run with NEURALAKE_MODE=live.');
    assert.ok(!jsonCapability || process.argv.includes('--diagnose-region'), '--json-capability is limited to one --diagnose-region call.');
    const capabilityFetch: typeof fetch = async (input, init) => {
        assert.equal(typeof init?.body, 'string');
        const body = { ...JSON.parse(init!.body as string), response_format: { type: 'json_object' } };
        const response = await fetch(input, { ...init, body: JSON.stringify(body) });
        capabilityHttpStatus = response.status;
        return response;
    };
    const transport = new NeuraLakeChat(config, jsonCapability ? capabilityFetch : fetch);
    const provider: ChatProvider = { async complete(input) {
        providerRequests++;
        const completion = await transport.complete(input);
        diagnosticCompletions.push({ turn: activeTurn, content: completion.content });
        assert.equal(completion.usage.mode, 'NEURALAKE', 'No mock fallback is allowed.');
        usages.push(completion.usage);
        return completion;
    } };
    if (process.argv.includes('--diagnose-region')) {
        // One isolated diagnostic, not a successful replay of the eight-turn conversation.
        // Match the current service envelope: latest input/question, active-search flag and public menu.
        const at = new Date().toISOString(), state = initialState(owner, at);
        ensureDemoMarket(state, at);
        const lastQuestion = 'Esta demo atende somente a região de teste Butantã.';
        const diagnosticMessages: ChatMessage[] = [
            { role: 'system', content: CUSTOMER_SYSTEM_PROMPT },
            { role: 'user', content: JSON.stringify({ lastQuestion, hasActiveSearch: false,
                publicMenu: publicMenu(state, at), currentMessage: 'entao sera no butata' }) },
        ];
        const completion = await provider.complete(diagnosticMessages);
        let strictJson = false, schemaValid = false;
        try { const parsed = JSON.parse(completion.content); strictJson = true; schemaValid = agentDecisionSchema.safeParse(parsed).success; }
        catch { /* Report format rejection without transforming model output. */ }
        console.log(redact(JSON.stringify({ status: 'DIAGNOSTIC_ONLY', diagnostic: 'region-correction',
            jsonCapability, capabilityHttpStatus, strictJson, schemaValid,
            providerRequests, usage: completion.usage, rawSyntheticResponse: completion.content.slice(0, 2500),
            truncated: completion.content.length > 2500, fullConversationValidated: false,
            persistedExternally: false }, null, 2)));
    } else {
    for (const [index, message] of messages.entries()) {
        activeTurn = index + 1;
        const before = await store.read(owner);
        const input = { message, expectedVersion: before?.state.customerAgent?.version ?? 0 };
        const digest = createHash('sha256').update(JSON.stringify(input)).digest('hex');
        const requestCount = providerRequests;
        await customerTurn(store, owner, input, `synthetic_turn_${index}`, digest, provider, config.maxCalls);
        const state = (await store.read(owner))!.state, session = state.customerAgent!;
        const reply = session.turns.at(-1)!.text;
        const readiness = draftReadiness(session.draft, state);
        const menuRestaurants = ['Marmita Quentinha do Seu Niko', 'Sabor de Casa', 'Cozinha Expressa']
            .filter(name => reply.includes(name));
        turns.push({ turn: activeTurn, message, schemaValid: customerDraftSchema.safeParse(session.draft).success,
            mode: session.lastUsage?.mode, calls: providerRequests - requestCount, usage: session.lastUsage,
            draft: session.draft, readiness, menuRestaurants,
            reply: reply.length > 650 ? `${reply.slice(0, 300)} […] ${reply.slice(-300)}` : reply });
        assert.equal(state.orders.length, 0, 'A conversational input cannot create an order.');
        assert.equal(state.mandates.length, 0, 'A conversational input cannot authorize a purchase.');
        assert.equal(state.rfqs.length, 0, 'Menu consultation cannot open a purchase search.');
        assert.ok(state.restaurants.every(r => r.stock.every(item => item.reserved === '0')));
        if (index === 0) {
            firstDescription = session.draft.description;
            assert.ok(firstDescription && /bife/i.test(firstDescription), 'First turn must retain the requested beef dish.');
        }
        if (index > 0) assert.equal(session.draft.description, firstDescription,
            'Corrections to other fields must preserve the chosen dish.');
        if (index === 1) {
            assert.equal(cents(session.draft.budget!), 4000, 'Budget was not extracted from the second turn.');
            assert.equal(session.draft.maxMinutes, 50);
        }
        if (index === 2) assert.equal(session.draft.zone, 'other', 'Morumbi must remain outside the demo region.');
        if (index === 3) assert.equal(session.draft.zone, 'demo_butanta', 'The explicit region correction was not applied.');
        if (index === 4 || index === 5) {
            assert.equal(menuRestaurants.length, 3, 'Availability question must show all three simulated restaurant menus.');
        }
        if (index >= 4) {
            assert.equal(cents(session.draft.budget!), 4000);
            assert.equal(session.draft.maxMinutes, 50);
            assert.equal(session.draft.zone, 'demo_butanta');
            assert.deepEqual(session.draft.excluded, []);
            assert.equal(session.draft.foodSafetyConcern, false);
        }
        if (index === 6) assert.equal(session.draft.selectionPreference, 'BEST_RATED');
        if (index === 7) assert.equal(session.draft.selectionPreference, 'LOWEST_PRICE');
    }
    const finalState = (await store.read(owner))!.state, session = finalState.customerAgent!;
    const readiness = draftReadiness(session.draft, finalState);
    assert.equal(readiness.ready, true, `Final draft must be ready: ${JSON.stringify(readiness)}`);
    console.log(redact(JSON.stringify({ status: 'PASS',
        turns, providerRequests, models: [...new Set(usages.map(usage => usage.model))],
        reportedTokens: usages.some(usage => usage.tokens === null) ? null : usages.reduce((sum, usage) => sum + usage.tokens!, 0),
        committedCalls: session.calls, remainingQuestions: readiness.missing,
        portionNeedsClarification: session.draft.portions === null,
        persistedExternally: false, ordersCreated: finalState.orders.length }, null, 2)));
    }
} catch (error) {
    console.log(redact(JSON.stringify({ status: 'FAIL', failedTurn: activeTurn, turns, providerRequests,
        jsonCapability, capabilityHttpStatus,
        models: [...new Set(usages.map(usage => usage.model))],
        reportedTokens: usages.some(usage => usage.tokens === null) ? null : usages.reduce((sum, usage) => sum + usage.tokens!, 0),
        // Raw data is restricted to this disposable synthetic diagnostic and the failing turn.
        failedTurnSyntheticResponses: diagnosticCompletions.filter(item => item.turn === activeTurn)
            .map(item => ({ content: item.content.slice(0, 2500), truncated: item.content.length > 2500 })),
        code: error instanceof DomainError ? error.code : 'ASSERTION_OR_CONFIGURATION',
        reason: error instanceof Error ? error.message : 'Unknown error', persistedExternally: false }, null, 2)));
    process.exitCode = 1;
}
