import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../lib/domain/fixtures.ts';
import { quote } from '../lib/domain/pricing.ts';
import { execute, commandSchema } from '../lib/domain/commands.ts';
import { evaluateMarketPressure, type MarketContext } from '../lib/domain/market-pressure.ts';
import { demandLabel, marketSimulation } from '../lib/client/market-simulation.ts';

const at = '2026-09-19T18:00:00.000Z';
function context(overrides: Partial<MarketContext> = {}): MarketContext {
    const state = initialState('market-test', at);
    state.restaurants[0].policy = { ...state.restaurants[0].policy!, version: 1, objective: 'SURPLUS_FIRST', referenceCents: 3490, minMarginBps: 2500, maxDiscountBps: 2500, maxMarkupBps: 500, feeBps: 1000, fixedCents: 20, minContributionCents: 0, surplusDiscountBps: 2000, maxRounds: 2, offerTtlSeconds: 90, capacity: 12, confirmedAt: at };
    return { simulatedBuyerCount: 0, demandState: 'LOW', availableCapacity: 12, activeOrders: 0, surplusState: true, commercialPolicy: state.restaurants[0].policy!, baseReceipt: { subtotalCents: 2792, floorCents: 2618, ceilingCents: 3664 }, ...overrides };
}

test('market pressure is deterministic for the same context', () => {
    const first = evaluateMarketPressure(context({ simulatedBuyerCount: 2, demandState: 'NORMAL' }));
    const second = evaluateMarketPressure(context({ simulatedBuyerCount: 2, demandState: 'NORMAL' }));
    assert.deepEqual(first, second);
});

test('market pressure always stays inside existing pricing bounds', () => {
    const source = context();
    for (const result of [evaluateMarketPressure(source), evaluateMarketPressure({ ...source, simulatedBuyerCount: 8, demandState: 'HIGH', availableCapacity: 0, activeOrders: 12 })]) {
        assert.ok(Number.isInteger(result.simulatedPriceCents));
        assert.ok(result.simulatedPriceCents >= source.baseReceipt.floorCents);
        assert.ok(result.simulatedPriceCents <= source.baseReceipt.ceilingCents);
    }
});

test('pressure direction reflects surplus flexibility versus a pressed capacity', () => {
    const flexible = evaluateMarketPressure(context({ simulatedBuyerCount: 0, demandState: 'LOW' }));
    const pressured = evaluateMarketPressure(context({ simulatedBuyerCount: 8, demandState: 'HIGH', availableCapacity: 0, activeOrders: 12 }));
    assert.equal(flexible.commercialAdjustment.direction, 'DISCOUNT');
    assert.equal(pressured.commercialAdjustment.direction, 'MARKUP');
    assert.ok(flexible.simulatedPriceCents < pressured.simulatedPriceCents);
});

test('market simulation is isolated from normal pricing and remains presentation-only', () => {
    const state = initialState('market-test', at);
    execute(state, commandSchema.parse({ type: 'seed_demo', scope: 'merchant' }), at);
    const restaurant = state.restaurants[0];
    const before = quote(restaurant, restaurant.recipes[0], at).subtotalCents;
    const simulation = marketSimulation(8);
    assert.equal(demandLabel[simulation.demandState], 'Alta');
    evaluateMarketPressure({ ...context(), simulatedBuyerCount: simulation.simulatedBuyerCount, demandState: simulation.demandState, availableCapacity: 12, activeOrders: 0 });
    assert.equal(quote(restaurant, restaurant.recipes[0], at).subtotalCents, before);
    assert.equal(state.orders.length, 0);
    assert.equal(state.rfqs.length, 0);
});