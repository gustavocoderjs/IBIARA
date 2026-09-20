import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../lib/domain/fixtures.ts';
import { ensureDemoMarket } from '../lib/domain/demo-market.ts';
import { commandSchema, execute } from '../lib/domain/commands.ts';
import { createRfq, negotiate } from '../lib/domain/commerce.ts';
import { project } from '../lib/domain/projection.ts';
import { compareOffers, publicRating } from '../lib/domain/ratings.ts';
import { publicMenu } from '../lib/agents/customer/menu.ts';
import { toRestaurantOffer, toRestaurantRequest } from '../lib/agents/shared/contracts.ts';
import type { SelectionPreference, State } from '../lib/domain/types.ts';

const at = '2026-09-20T12:00:00.000Z';
function seeded() {
    const state = initialState('ratings-test', at);
    ensureDemoMarket(state, at);
    return state;
}
function search(state: State, preference?: SelectionPreference, maxCents = 5000, maxMinutes = 40) {
    const result = execute(state, commandSchema.parse({ type: 'mandate', scope: 'buyer',
        description: 'Bife a cavalo', maxCents, maxMinutes, zone: 'demo_butanta', excluded: [],
        confirmed: true, ...(preference ? { selectionPreference: preference } : {}) }), at) as { mandateId: string };
    return createRfq(state, result.mandateId, at).rfqId;
}

test('best rating selects a slower, more expensive eligible restaurant', () => {
    const state = seeded(), rfq = search(state, 'BEST_RATED');
    negotiate(state, rfq, at);
    const winner = state.orders[0], niko = state.offers.find(o => o.merchantId === 'niko')!;
    assert.equal(winner.merchantId, 'casa');
    assert.ok(winner.totalCents > niko.totalCents);
    const offer = state.offers.find(o => o.id === winner.offerId)!;
    assert.equal(offer.eta, 30);
    assert.ok(offer.eta > niko.eta);
    assert.equal(offer.ratingTenths, 49);
    assert.equal(state.mandates[0].selectionPreference, 'BEST_RATED');
});

test('best rating still respects the authorized budget and maximum wait', () => {
    for (const [budget, minutes] of [[3500, 40], [5000, 25]]) {
        const state = seeded(), rfq = search(state, 'BEST_RATED', budget, minutes);
        negotiate(state, rfq, at);
        assert.equal(state.orders[0].merchantId, 'niko');
        assert.ok(state.orders[0].totalCents <= budget);
        assert.ok(state.offers.find(o => o.id === state.orders[0].offerId)!.eta <= minutes);
    }
});

test('a higher rating cannot bypass unavailable stock or kitchen capacity', () => {
    for (const cause of ['stock', 'capacity']) {
        const state = seeded(), rfq = search(state, 'BEST_RATED');
        const casa = state.restaurants.find(r => r.id === 'casa')!;
        if (cause === 'stock') casa.stock.find(i => i.id === 'patinho')!.quantity = '0';
        else casa.policy!.capacity = 0;
        negotiate(state, rfq, at);
        assert.equal(state.orders[0].merchantId, 'niko');
        assert.equal(casa.stock.find(i => i.id === 'patinho')!.reserved, '0');
    }
});

test('omitted or legacy preference preserves lowest-price selection', () => {
    for (const legacy of [false, true]) {
        const state = seeded(), rfq = search(state);
        assert.equal(state.mandates[0].selectionPreference, 'LOWEST_PRICE');
        if (legacy) delete state.mandates[0].selectionPreference;
        negotiate(state, rfq, at);
        assert.equal(state.orders[0].merchantId, 'niko');
        assert.equal(state.orders[0].totalCents, 3090);
    }
});

test('equal ratings break ties by total, then wait, then stable restaurant ID', () => {
    const state = seeded(); search(state);
    const base = state.offers[0];
    const offers = [
        { ...base, merchantId: 'd', ratingTenths: 48, ratingCount: 5, totalCents: 4000, eta: 20 },
        { ...base, merchantId: 'c', ratingTenths: 48, ratingCount: 100, totalCents: 3000, eta: 30 },
        { ...base, merchantId: 'b', ratingTenths: 48, ratingCount: 3, totalCents: 3000, eta: 25 },
        { ...base, merchantId: 'a', ratingTenths: 48, ratingCount: 1, totalCents: 3000, eta: 25 },
    ];
    assert.deepEqual(offers.sort((a, b) => compareOffers(a, b, 'BEST_RATED')).map(o => o.merchantId),
        ['a', 'b', 'c', 'd']);
});

test('missing reviews remain unrated and rank after rated restaurants, including zero stars', () => {
    const state = seeded(); search(state);
    const base = state.offers[0];
    const unrated = { ...base, merchantId: 'unknown', ratingTenths: null, ratingCount: 0, totalCents: 1000 };
    const rated = { ...base, merchantId: 'rated', ratingTenths: 0, ratingCount: 1, totalCents: 2000 };
    assert.ok(compareOffers(rated, unrated, 'BEST_RATED') < 0);
    assert.ok(compareOffers(rated, unrated, 'LOWEST_PRICE') > 0);
    assert.deepEqual(publicRating('unknown'), { ratingTenths: null, ratingCount: 0, ratingIsDemo: false });
    assert.equal(publicRating('casa', { ratingTenths: null, ratingCount: 0 }).ratingTenths, null);
    assert.equal(publicRating('casa', { ratingTenths: 99, ratingCount: 1 }).ratingTenths, null);
});

test('legacy public ratings are read-only and contracts expose only own restaurant review data', () => {
    const state = seeded(); search(state, 'BEST_RATED');
    for (const item of [...state.restaurants, ...state.offers]) {
        delete item.ratingTenths; delete item.ratingCount; delete item.ratingIsDemo;
    }
    delete state.mandates[0].selectionPreference;
    const before = structuredClone(state), buyer = project(state, 'buyer', at);
    assert.ok('restaurants' in buyer && 'mandates' in buyer);
    assert.equal(buyer.restaurants.find(r => r.id === 'casa')!.ratingTenths, 49);
    assert.equal(buyer.mandates[0].selectionPreference, 'LOWEST_PRICE');
    assert.ok(buyer.offers.every(o => o.ratingIsDemo));
    assert.ok(publicMenu(state, at).every(item => item.ratingIsDemo && item.ratingCount > 0));
    const offer = toRestaurantOffer(state.offers.find(o => o.merchantId === 'casa')!);
    assert.equal(offer.ratingTenths, 49);
    assert.equal(offer.ratingCount, 86);
    const request = toRestaurantRequest(state.rfqs[0], 'casa');
    assert.equal('selectionPreference' in request, false);
    assert.equal('ratingTenths' in request, false);
    assert.deepEqual(state, before);
});
