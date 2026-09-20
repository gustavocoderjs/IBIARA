import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../lib/domain/fixtures.ts';
import { commandSchema, execute, type Command } from '../lib/domain/commands.ts';
import { accept, counter, createRfq, negotiate } from '../lib/domain/commerce.ts';
import { DomainError, type State } from '../lib/domain/types.ts';
import { project } from '../lib/domain/projection.ts';
import { transact, type AggregateStore } from '../lib/domain/transaction.ts';
import { emptyCustomerSession } from '../lib/agents/customer/state.ts';
import { negotiateWithAgents, type RestaurantConnection } from '../lib/agents/customer/negotiate.ts';

const at = '2026-09-20T15:00:00.000Z';
const mandateCommand = commandSchema.parse({ type: 'mandate', scope: 'buyer',
    description: 'Bife a cavalo', maxCents: 5000, maxMinutes: 40,
    zone: 'demo_butanta', excluded: [], confirmed: true });
function seeded(time = at) {
    const state = initialState('food-safety-test', time);
    execute(state, { type: 'seed_demo', scope: 'merchant' }, time);
    return state;
}
function declareConcern(state: State) {
    state.customerAgent ??= emptyCustomerSession();
    state.customerAgent.draft.foodSafetyConcern = true;
    state.customerAgent.draft.excluded = ['ovo'];
}
function authorize(state: State, time = at) {
    return (execute(state, mandateCommand, time) as { mandateId: string }).mandateId;
}
function quoted(time = at) {
    const state = seeded(time), mandateId = authorize(state, time);
    const { rfqId } = createRfq(state, mandateId, time);
    const offer = state.offers.find(o => o.rfqId === rfqId && o.merchantId === 'niko')!;
    assert.ok(offer);
    return { state, mandateId, rfqId, offer };
}
const safetyRejection = (error: unknown) => {
    assert.ok(error instanceof DomainError);
    assert.equal(error.code, 'RESTRICTION_UNVERIFIED');
    assert.match(error.message, /não verifica alergênicos nem contaminação cruzada/);
    return true;
};

class MemoryStore implements AggregateStore {
    row: { revision: number; state: State };
    constructor(state: State) { this.row = { revision: 0, state: structuredClone(state) }; }
    async read() { return structuredClone(this.row); }
    async insert() { /* Already seeded for this isolated test. */ }
    async compareAndSwap(_owner: string, revision: number, state: State) {
        if (revision !== this.row.revision) return false;
        this.row = { revision: revision + 1, state: structuredClone(state) };
        return true;
    }
}

test('manual mandate cannot omit a declared allergy even when excluded is empty', async () => {
    const state = seeded();
    declareConcern(state);
    // Rejection must precede scheduler mutations as well as mandate/conversation writes.
    state.schedule.nextAt = at;
    const before = structuredClone(state);
    assert.throws(() => execute(state, mandateCommand, at), safetyRejection);
    assert.deepEqual(state, before);
    const store = new MemoryStore(state), persisted = structuredClone(store.row);
    await assert.rejects(transact(store, state.ownerId, mandateCommand, 'manual-allergy', 'same-body'), safetyRejection);
    assert.deepEqual(store.row, persisted);
    assert.equal(store.row.state.mandates.length, 0);
    assert.equal(store.row.state.orders.length, 0);
});

test('an authorization created before the allergy cannot open an RFQ', () => {
    const state = seeded(), mandateId = authorize(state);
    declareConcern(state);
    const before = structuredClone(state);
    assert.throws(() => createRfq(state, mandateId, at), safetyRejection);
    assert.throws(() => execute(state, { type: 'rfq', scope: 'buyer', mandateId }, at), safetyRejection);
    assert.deepEqual(state, before);
    assert.equal(state.rfqs.length, 0);
    assert.equal(state.offers.length, 0);
});

test('previously quoted offers cannot counter, negotiate or accept after a food-safety concern', () => {
    const { state, rfqId, offer } = quoted();
    declareConcern(state);
    // Even an empty exclusion list is not permission to disregard the separate concern.
    state.customerAgent!.draft.excluded = [];
    const before = structuredClone(state);
    const commands: Command[] = [
        { type: 'counter', scope: 'buyer', offerId: offer.id, subtotalCents: offer.subtotalCents },
        { type: 'negotiate', scope: 'buyer', rfqId },
        { type: 'accept', scope: 'buyer', offerId: offer.id, quoteToken: offer.quoteToken },
    ];
    for (const command of commands) {
        assert.throws(() => execute(state, command, at), safetyRejection);
        assert.deepEqual(state, before);
    }
    for (const operation of [
        () => counter(state, offer.id, offer.subtotalCents, at),
        () => negotiate(state, rfqId, at),
        () => accept(state, offer.id, offer.quoteToken, at),
    ]) {
        assert.throws(operation, safetyRejection);
        assert.deepEqual(state, before, 'No offers, stock, mandate usage or orders may change.');
    }
    assert.equal(state.orders.length, 0);
    assert.ok(state.restaurants.every(r => r.stock.every(item => item.reserved === '0')));
});

test('agent negotiation of an old RFQ cannot commit a purchase when concern is already recorded', async () => {
    const time = new Date().toISOString(), { state, rfqId } = quoted(time);
    declareConcern(state);
    const store = new MemoryStore(state), before = structuredClone(store.row);
    const mockConnection: RestaurantConnection = { mode: 'mock', provider: { async complete() {
        throw new Error('This isolated test must never call a provider.');
    } } };
    await assert.rejects(negotiateWithAgents(store, state.ownerId, rfqId, 'agent-allergy', 'same-body',
        { niko: mockConnection, casa: mockConnection, panela: mockConnection }), safetyRejection);
    assert.deepEqual(store.row, before);
    assert.equal(store.row.state.orders.length, 0);
});

test('declaring a concern preserves read access, revocation and cancellation of an existing reservation', () => {
    const { state, mandateId, offer } = quoted();
    const { orderId } = accept(state, offer.id, offer.quoteToken, at);
    declareConcern(state);
    const beforeRead = structuredClone(state);
    assert.equal(project(state, 'buyer', at).orders[0].id, orderId);
    assert.doesNotThrow(() => project(state, 'merchant', at));
    assert.deepEqual(state, beforeRead);
    execute(state, { type: 'revoke', scope: 'buyer', mandateId }, at);
    assert.equal(state.mandates[0].revoked, true);
    execute(state, { type: 'order', scope: 'buyer', orderId, action: 'cancel' }, at);
    assert.equal(state.orders[0].status, 'CANCELLED');
    assert.equal(state.mandates[0].committedCents, 0);
    assert.ok(state.restaurants.every(r => r.stock.every(item => item.reserved === '0')));
    assert.equal(state.restaurants[0].stock.find(item => item.id === 'patinho')!.quantity, '6000');
});

test('scenarios without a declared concern retain the canonical purchase behavior', () => {
    for (const concern of [undefined, null, false]) {
        const state = seeded();
        if (concern !== undefined) {
            state.customerAgent = emptyCustomerSession();
            state.customerAgent.draft.foodSafetyConcern = concern;
        }
        const { rfqId } = createRfq(state, authorize(state), at);
        negotiate(state, rfqId, at);
        assert.equal(state.orders.length, 1);
        assert.equal(state.orders[0].totalCents, 3090);
        assert.equal(state.orders[0].executionMode, 'SANDBOX');
        assert.equal(state.restaurants[0].stock.find(item => item.id === 'patinho')!.reserved, '200');
    }
});

test('manual purchase and old offers cannot silently turn a known two-portion request into one', () => {
    const { state, mandateId, rfqId, offer } = quoted();
    state.customerAgent = emptyCustomerSession();
    state.customerAgent.draft.portions = 2;
    state.customerAgent.draft.foodSafetyConcern = false;
    const before = structuredClone(state);
    const unsupportedQuantity = (error: unknown) => error instanceof DomainError &&
        error.code === 'INTENT_UNSUPPORTED' && /uma porção por compra/.test(error.message);
    const commands: Command[] = [
        mandateCommand,
        { type: 'rfq', scope: 'buyer', mandateId },
        { type: 'counter', scope: 'buyer', offerId: offer.id, subtotalCents: offer.subtotalCents },
        { type: 'negotiate', scope: 'buyer', rfqId },
        { type: 'accept', scope: 'buyer', offerId: offer.id, quoteToken: offer.quoteToken },
    ];
    for (const command of commands) {
        assert.throws(() => execute(state, command, at), unsupportedQuantity);
        assert.deepEqual(state, before);
    }
    for (const operation of [
        () => createRfq(state, mandateId, at),
        () => counter(state, offer.id, offer.subtotalCents, at),
        () => negotiate(state, rfqId, at),
        () => accept(state, offer.id, offer.quoteToken, at),
    ]) {
        assert.throws(operation, unsupportedQuantity);
        assert.deepEqual(state, before);
    }
    assert.equal(state.orders.length, 0);
    assert.ok(state.restaurants.every(r => r.stock.every(item => item.reserved === '0')));
});
