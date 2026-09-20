import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureDemoMarket, DEMO_MARKET_VERSION } from '../lib/domain/demo-market.ts';
import { initialState, catalog } from '../lib/domain/fixtures.ts';
import { execute } from '../lib/domain/commands.ts';
import { createRfq, negotiate } from '../lib/domain/commerce.ts';
import { quote, requirements } from '../lib/domain/pricing.ts';
import { DomainError, type State } from '../lib/domain/types.ts';

const at = '2026-09-19T15:00:00.000Z';
function market() {
    const s = initialState('market-test', at);
    ensureDemoMarket(s, at);
    return s;
}
function canonicalPurchase(s: State) {
    const authorization = execute(s, { type: 'mandate', scope: 'buyer', maxCents: 3500,
        description: 'Bife a cavalo com arroz e feijão', maxMinutes: 40, zone: 'demo_butanta',
        excluded: [], confirmed: true }, at) as { mandateId: string };
    const request = createRfq(s, authorization.mandateId, at);
    return negotiate(s, request.rfqId, at);
}

test('first customer market preparation provides four complete recipes per restaurant without a purchase', () => {
    const s = market();
    assert.equal(s.demoMarketVersion, DEMO_MARKET_VERSION);
    assert.deepEqual(s.restaurants.map(r => r.id), ['niko', 'casa', 'panela']);
    assert.equal(s.restaurants[0].name, 'Marmita Quentinha do Seu Niko');
    assert.equal(s.restaurants[1].name, 'Sabor de Casa');
    assert.equal(s.restaurants[2].name, 'Cozinha Expressa');
    const recipeIds: string[] = [];
    for (const r of s.restaurants) {
        assert.equal(r.recipes.length, 4);
        assert.equal(r.fictional, true);
        assert.equal(new Set(r.stock.map(i => i.id)).size, r.stock.length);
        assert.ok(r.policy);
        for (const recipe of r.recipes) {
            recipeIds.push(recipe.id);
            assert.equal(recipe.servings, 1);
            assert.equal(recipe.status, 'CONFIRMED');
            assert.ok(recipe.preparation);
            for (const part of recipe.components) {
                assert.ok(part.quantity && part.basis && part.yield && part.source);
                assert.ok(catalog.some(i => i.id === part.item));
                assert.ok(r.stock.some(i => i.id === part.item && i.unit === part.unit));
            }
            const price = quote(r, recipe, at);
            assert.ok(price.subtotalCents >= price.floorCents);
            assert.ok(price.subtotalCents <= price.ceilingCents);
        }
    }
    assert.equal(new Set(recipeIds).size, 12);
    assert.equal(s.orders.length, 0);
    assert.equal(s.mandates.length, 0);
    assert.equal(s.rfqs.length, 0);
});

test('simulated recipes convert cooked yield into raw stock requirements exactly', () => {
    const s = market();
    const pasta = s.restaurants[2].recipes.find(r => r.name === 'Macarrão com frango e brócolis')!;
    const needs = requirements(pasta);
    assert.deepEqual(needs.find(i => i.item === 'macarrao'), { item: 'macarrao', quantity: '100' });
    assert.deepEqual(needs.find(i => i.item === 'frango'), { item: 'frango', quantity: '150' });
    const lentils = s.restaurants[1].recipes.find(r => r.name === 'Lentilha com arroz e salada')!;
    assert.deepEqual(requirements(lentils).find(i => i.item === 'lentilha'), { item: 'lentilha', quantity: '80' });
    assert.deepEqual(requirements(lentils).find(i => i.item === 'arroz'), { item: 'arroz', quantity: '100' });
});

test('restaurants own independent stocks, costs and recipes; shortages block only their own dishes', () => {
    const s = market(), [niko, casa, panela] = s.restaurants;
    const casaBefore = structuredClone(casa), panelaBefore = structuredClone(panela);
    const chicken = niko.stock.find(i => i.id === 'frango')!;
    chicken.quantity = '0';
    chicken.costNumerator = '999';
    const recipe = niko.recipes.find(r => r.name === 'Frango grelhado com arroz e feijão')!;
    assert.throws(() => quote(niko, recipe, at), (error: unknown) => error instanceof DomainError && error.code === 'STOCK_INSUFFICIENT');
    assert.doesNotThrow(() => quote(casa, casa.recipes.find(r => r.name === 'Frango com legumes e arroz')!, at));
    assert.doesNotThrow(() => quote(panela, panela.recipes.find(r => r.name === 'Frango com brócolis e arroz')!, at));
    assert.deepEqual(casa, casaBefore);
    assert.deepEqual(panela, panelaBefore);
});

test('expanded market preserves the canonical 3090-cent sandbox purchase and isolates reservations', () => {
    const s = market();
    const otherStocks = structuredClone(s.restaurants.slice(1).map(r => r.stock));
    canonicalPurchase(s);
    assert.equal(s.orders.length, 1);
    assert.equal(s.orders[0].totalCents, 3090);
    assert.equal(s.orders[0].merchantId, 'niko');
    assert.equal(s.orders[0].executionMode, 'SANDBOX');
    assert.equal(s.restaurants[0].stock.find(i => i.id === 'patinho')!.reserved, '200');
    assert.deepEqual(s.restaurants.slice(1).map(r => r.stock), otherStocks);
});

test('repeated preparation never replenishes stock, extends expiry, clears orders or changes state', () => {
    const s = market();
    canonicalPurchase(s);
    s.restaurants[0].stock.find(i => i.id === 'frango')!.quantity = '17';
    const snapshot = structuredClone(s);
    ensureDemoMarket(s, '2027-01-01T00:00:00.000Z');
    assert.deepEqual(s, snapshot);
});

test('legacy workspace enrichment preserves transactions, economic settings and all original stock rows', () => {
    const s = initialState('legacy', at);
    execute(s, { type: 'seed_demo', scope: 'merchant' }, at);
    canonicalPurchase(s);
    const niko = s.restaurants[0];
    // Represents the eight-item persisted schema from release 0.3.0.
    for (const r of s.restaurants) r.stock = r.stock.slice(0, 8);
    niko.stock[1].quantity = '0';
    niko.stock[1].eligible = false;
    niko.policy!.capacity = 5;
    const orders = structuredClone(s.orders), mandates = structuredClone(s.mandates);
    const original = s.restaurants.map(r => ({ stock: structuredClone(r.stock), recipes: structuredClone(r.recipes),
        policy: structuredClone(r.policy), receipts: structuredClone(r.receiptHistory) }));
    ensureDemoMarket(s, at);
    assert.deepEqual(s.orders, orders);
    assert.deepEqual(s.mandates, mandates);
    for (const [index, r] of s.restaurants.entries()) {
        assert.deepEqual(r.stock.slice(0, 8), original[index].stock);
        assert.deepEqual(r.recipes.slice(0, 1), original[index].recipes);
        assert.deepEqual(r.policy, original[index].policy);
        assert.deepEqual(r.receiptHistory, original[index].receipts);
        assert.equal(r.stock.length, 16);
        assert.equal(r.recipes.length, 4);
    }
});

test('partially configured merchant is not silently reset or given a new commercial policy', () => {
    const s = initialState('partial', at), niko = s.restaurants[0];
    niko.name = 'Cozinha em cadastro';
    niko.stage = 'RESTAURANT_DRAFT';
    niko.stock[0].quantity = '321';
    const stock = structuredClone(niko.stock), conversation = structuredClone(niko.conversation);
    ensureDemoMarket(s, at);
    assert.equal(niko.name, 'Cozinha em cadastro');
    assert.equal(niko.stage, 'RESTAURANT_DRAFT');
    assert.equal(niko.policy, null);
    assert.deepEqual(niko.stock, stock);
    assert.deepEqual(niko.conversation, conversation);
    assert.throws(() => quote(niko, niko.recipes[0], at), (error: unknown) => error instanceof DomainError && error.code === 'POLICY_REQUIRED');
});

test('dish name selects the requested current recipe and never resurrects an older version', () => {
    const s = market(), niko = s.restaurants[0];
    const old = niko.recipes.find(r => r.name === 'Macarrão com carne e tomate')!;
    niko.recipes.push({ ...structuredClone(old), version: 2, name: 'Macarrão com frango e tomate',
        components: old.components.map(c => c.item === 'patinho' ? { ...c, item: 'frango' } : { ...c }) });
    const authorization = execute(s, { type: 'mandate', scope: 'buyer', maxCents: 4500,
        description: 'Macarrão com carne e tomate', maxMinutes: 40, zone: 'demo_butanta',
        excluded: [], confirmed: true }, at) as { mandateId: string };
    const q = createRfq(s, authorization.mandateId, at);
    assert.ok(!s.offers.some(o => o.rfqId === q.rfqId && o.recipeId === old.id && o.recipeVersion === 1));
    const nextAuthorization = execute(s, { type: 'mandate', scope: 'buyer', maxCents: 4500,
        description: 'Macarrão com tomate e queijo', maxMinutes: 40, zone: 'demo_butanta',
        excluded: [], confirmed: true }, at) as { mandateId: string };
    const next = createRfq(s, nextAuthorization.mandateId, at);
    assert.equal(s.offers.filter(o => o.rfqId === next.rfqId).length, 1);
    assert.equal(s.offers.find(o => o.rfqId === next.rfqId)!.merchantId, 'casa');
});

test('unsupported food type cannot silently become another dish containing a known ingredient', () => {
    const s = market();
    const authorization = execute(s, { type: 'mandate', scope: 'buyer', maxCents: 5000,
        description: 'Pizza de queijo', maxMinutes: 40, zone: 'demo_butanta', excluded: [], confirmed: true }, at) as { mandateId: string };
    assert.throws(() => createRfq(s, authorization.mandateId, at), (error: unknown) =>
        error instanceof DomainError && error.code === 'INTENT_UNSUPPORTED');
    assert.equal(s.orders.length, 0); assert.equal(s.rfqs.length, 0);
});
