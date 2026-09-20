import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../lib/domain/fixtures.ts';
import { ensureDemoMarket } from '../lib/domain/demo-market.ts';
import { commandSchema, execute } from '../lib/domain/commands.ts';
import { accept, counter, createRfq, merchantOffer, negotiate } from '../lib/domain/commerce.ts';
import { compareOffers } from '../lib/domain/ratings.ts';
import { deliveryPoints, distanceMeters, servesDeliveryPoint } from '../lib/domain/delivery.ts';
import { DomainError, type State } from '../lib/domain/types.ts';
import { emptyCustomerSession } from '../lib/agents/customer/state.ts';
import { negotiateWithAgents, type RestaurantConnection } from '../lib/agents/customer/negotiate.ts';
import { toRestaurantOffer, toRestaurantRequest } from '../lib/agents/shared/contracts.ts';
import type { AggregateStore } from '../lib/domain/transaction.ts';

const at = '2026-09-20T12:00:00.000Z';
const input = { type: 'mandate', scope: 'buyer', description: 'Bife a cavalo', maxCents: 6000,
    maxMinutes: 40, zone: 'demo_butanta', excluded: [], confirmed: true };
const rejects = (code: string) => (error: unknown) => error instanceof DomainError && error.code === code;
function seeded(time = at) {
    const state = initialState('delivery-selection', time);
    ensureDemoMarket(state, time);
    return state;
}
function search(state: State, patch: Record<string, unknown> = {}, time = at) {
    const { mandateId } = execute(state, commandSchema.parse({ ...input, ...patch }), time) as { mandateId: string };
    const { rfqId } = createRfq(state, mandateId, time);
    return state.rfqs.find(q => q.id === rfqId)!;
}

test('demo distances are stable, explicitly simulated and never guessed for unknown locations', () => {
    assert.equal(deliveryPoints.length, 3);
    assert.ok(deliveryPoints.every(point => point.simulation));
    assert.ok(distanceMeters('niko', 'butanta_centro')! < distanceMeters('casa', 'butanta_centro')!);
    assert.ok(distanceMeters('panela', 'usp')! < distanceMeters('niko', 'usp')!);
    assert.equal(servesDeliveryPoint('panela', 'vila_indiana'), false);
    assert.equal(servesDeliveryPoint('casa', 'vila_indiana'), true);
    for (const [restaurant, point] of [['niko', 'real_address'], ['unknown', 'usp'], ['__proto__', 'usp']]) {
        assert.equal(distanceMeters(restaurant, point), null);
        assert.equal(servesDeliveryPoint(restaurant, point), false);
    }
});

test('mandate validates proximity, delivery point and restaurant before any state changes', () => {
    for (const [patch, code] of [
        [{ selectionPreference: 'NEAREST' }, 'DELIVERY_POINT_REQUIRED'],
        [{ deliveryPointId: 'usp', zone: 'other' }, 'DELIVERY_POINT_UNSUPPORTED'],
        [{ restaurantId: 'panela', deliveryPointId: 'vila_indiana' }, 'DELIVERY_UNAVAILABLE'],
    ] as const) {
        const state = seeded(); state.schedule.nextAt = at;
        const before = structuredClone(state);
        assert.throws(() => execute(state, commandSchema.parse({ ...input, ...patch }), at), rejects(code));
        assert.deepEqual(state, before);
    }
    for (const patch of [{ restaurantId: 'foreign' }, { deliveryPointId: 'unknown' }])
        assert.equal(commandSchema.safeParse({ ...input, ...patch }).success, false);
});

test('an omitted restaurant and point inherit the conversation choice in the authorization', () => {
    const state = seeded(); state.customerAgent = emptyCustomerSession();
    state.customerAgent.draft.restaurantId = 'casa';
    state.customerAgent.draft.deliveryPointId = 'vila_indiana';
    const rfq = search(state);
    assert.equal(state.mandates[0].restaurantId, 'casa');
    assert.equal(rfq.restaurantId, 'casa'); assert.equal(rfq.deliveryPointId, 'vila_indiana');
    assert.deepEqual([...new Set(state.offers.map(o => o.merchantId))], ['casa']);
    negotiate(state, rfq.id, at);
    assert.equal(state.orders[0].merchantId, 'casa');
});

test('a chosen restaurant survives cheaper competitors and does not silently fall back when over budget', () => {
    for (const budget of [6000, 3500]) {
        const state = seeded(), rfq = search(state, { restaurantId: 'casa', maxCents: budget });
        assert.ok(state.offers.length > 0);
        assert.ok(state.offers.every(o => o.merchantId === 'casa'));
        negotiate(state, rfq.id, at);
        if (budget === 6000) assert.equal(state.orders[0].merchantId, 'casa');
        else { assert.equal(state.orders.length, 0); assert.equal(rfq.status, 'NO_MATCH'); }
    }
});

test('other restaurant offers cannot be issued, countered or accepted under a selected-restaurant mandate', () => {
    const state = seeded(), rfq = search(state, { restaurantId: 'casa', deliveryPointId: 'usp' });
    const niko = state.restaurants.find(r => r.id === 'niko')!;
    assert.throws(() => merchantOffer(niko, niko.recipes[0], rfq, at), rejects('RESTAURANT_MISMATCH'));
    assert.throws(() => toRestaurantRequest(rfq, 'niko'), rejects('RESTAURANT_MISMATCH'));
    // Even a mistakenly injected offer must be rejected at the final authority boundary.
    const injected = { ...state.offers[0], id: 'injected', merchantId: 'niko', quoteToken: 'injected-token' };
    state.offers.push(injected);
    const before = structuredClone(state);
    assert.throws(() => counter(state, injected.id, 1000, at), rejects('RESTAURANT_MISMATCH'));
    assert.deepEqual(state, before);
    assert.throws(() => accept(state, injected.id, injected.quoteToken, at), rejects('RESTAURANT_MISMATCH'));
    assert.deepEqual(state, before);
});

test('a changed RFQ delivery point cannot consume the original authorization', () => {
    const state = seeded(), rfq = search(state, { restaurantId: 'casa', deliveryPointId: 'usp' });
    rfq.deliveryPointId = 'vila_indiana';
    const offer = state.offers[0], before = structuredClone(state);
    assert.throws(() => accept(state, offer.id, offer.quoteToken, at), rejects('AUTHORIZATION_MISMATCH'));
    assert.throws(() => negotiate(state, rfq.id, at), rejects('AUTHORIZATION_MISMATCH'));
    assert.deepEqual(state, before);
});

test('nearest ranks computed distance, while ratings remain constrained to restaurants serving the point', () => {
    const nearest = seeded(), nearestRfq = search(nearest, { selectionPreference: 'NEAREST', deliveryPointId: 'usp' });
    negotiate(nearest, nearestRfq.id, at);
    assert.equal(nearest.orders[0].merchantId, 'panela');
    const rated = seeded(), ratedRfq = search(rated, { selectionPreference: 'BEST_RATED', deliveryPointId: 'vila_indiana' });
    assert.ok(rated.offers.every(o => o.merchantId !== 'panela'));
    assert.ok(rated.offers.every(o => o.locationIsDemo && Number.isInteger(o.distanceMeters)));
    negotiate(rated, ratedRfq.id, at);
    assert.equal(rated.orders[0].merchantId, 'casa');
});

test('fastest ranks ETA independently of proximity, while unknown distances stay behind measured ones', () => {
    const state = seeded(); state.restaurants.find(r => r.id === 'panela')!.eta = 18;
    const rfq = search(state, { selectionPreference: 'FASTEST', deliveryPointId: 'butanta_centro' });
    negotiate(state, rfq.id, at);
    assert.equal(state.orders[0].merchantId, 'panela');
    const base = state.offers[0];
    const measured = { ...base, distanceMeters: 500, totalCents: 6000 };
    const unknown = { ...base, distanceMeters: null, totalCents: 1000 };
    assert.ok(compareOffers(measured, unknown, 'NEAREST') < 0);
    assert.ok(compareOffers(measured, unknown, 'LOWEST_PRICE') > 0);
});

class MemoryStore implements AggregateStore {
    row: { revision: number; state: State };
    constructor(state: State) { this.row = { revision: 0, state: structuredClone(state) }; }
    async read() { return structuredClone(this.row); }
    async insert() { /* Test uses a seeded private scenario. */ }
    async compareAndSwap(_owner: string, revision: number, state: State) {
        if (revision !== this.row.revision) return false;
        this.row = { revision: revision + 1, state: structuredClone(state) }; return true;
    }
}

test('the coordinator contacts only the chosen restaurant, keeps context private and replays without another inference', async () => {
    const time = new Date().toISOString(), state = seeded(time);
    const rfq = search(state, { restaurantId: 'casa', deliveryPointId: 'usp' }, time), store = new MemoryStore(state);
    let calls = 0;
    const forbidden: RestaurantConnection = { mode: 'live', provider: { async complete() { throw new Error('Unselected restaurant called.'); } } };
    const chosen: RestaurantConnection = { mode: 'live', provider: { async complete(messages) {
        calls++;
        const context = JSON.parse(messages[1].content);
        assert.equal(context.message.payload.restaurantId, 'casa');
        assert.equal(context.message.payload.deliveryPointId, 'usp');
        assert.equal(context.message.payload.locationIsDemo, true);
        assert.equal(context.message.payload.distanceMeters, distanceMeters('casa', 'usp'));
        assert.ok(context.ownCalculatedOffers.every((o: { restaurantId: string }) => o.restaurantId === 'casa'));
        assert.equal('maxCents' in context.message.payload, false);
        assert.equal('selectionPreference' in context.message.payload, false);
        assert.equal('customerAgent' in context, false);
        return { content: JSON.stringify({ tool: 'submit_offer', offerId: context.ownCalculatedOffers[0].offerId }),
            usage: { mode: 'NEURALAKE', model: 'isolated-test', tokens: 1, cost: null } };
    } } };
    const connections = { niko: forbidden, casa: chosen, panela: forbidden };
    const result = await negotiateWithAgents(store, state.ownerId, rfq.id, 'chosen-restaurant', 'same-body', connections);
    assert.equal(result.state.orders[0].merchantId, 'casa'); assert.equal(calls, 1);
    const offer = toRestaurantOffer(result.state.offers.find(o => o.status === 'ACCEPTED')!);
    assert.equal(offer.distanceMeters, distanceMeters('casa', 'usp'));
    const replay = await negotiateWithAgents(store, state.ownerId, rfq.id, 'chosen-restaurant', 'same-body', connections);
    assert.equal(replay.replayed, true); assert.equal(calls, 1); assert.equal(replay.state.orders.length, 1);
});
