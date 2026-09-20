import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../lib/domain/fixtures.ts';
import { execute } from '../lib/domain/commands.ts';
import { createRfq } from '../lib/domain/commerce.ts';
import { type State, DomainError } from '../lib/domain/types.ts';
import type { AggregateStore } from '../lib/domain/transaction.ts';
import { customerTurn } from '../lib/agents/customer/service.ts';
import { emptyCustomerSession } from '../lib/agents/customer/state.ts';
import { agentDecisionSchema, customerTurnSchema } from '../lib/agents/customer/schemas.ts';
import { configForAgent } from '../lib/agents/shared/config.ts';
import { NeuraLakeChat, type ChatProvider, type ChatMessage } from '../lib/agents/shared/neuralake.ts';
import { toRestaurantRequest, toRestaurantOffer, priceQuoteSchema } from '../lib/agents/shared/contracts.ts';
import { routeAgentMessage, restaurantIds } from '../lib/agents/shared/router.ts';
import { consultRestaurant } from '../lib/agents/restaurants/service.ts';
import { negotiateWithAgents, type RestaurantConnection } from '../lib/agents/customer/negotiate.ts';
import { draftReadiness, runCustomerTool } from '../lib/agents/customer/tools.ts';
import { publicMenu } from '../lib/agents/customer/menu.ts';

const rejects = (code: string) => (e: unknown) => e instanceof DomainError && e.code === code;
class Store implements AggregateStore {
    rows = new Map<string, { revision: number; state: State }>();
    async read(owner: string) { return structuredClone(this.rows.get(owner) ?? null); }
    async insert(owner: string, state: State) { if (!this.rows.has(owner)) this.rows.set(owner, { revision: 0, state: structuredClone(state) }); }
    async compareAndSwap(owner: string, revision: number, state: State) {
        if (this.rows.get(owner)?.revision !== revision) return false;
        this.rows.set(owner, { revision: revision + 1, state: structuredClone(state) }); return true;
    }
}
function fake(content: unknown, inspect?: (messages: ChatMessage[]) => void): ChatProvider {
    return { async complete(messages) { inspect?.(messages); return { content: JSON.stringify(content),
        usage: { mode: 'NEURALAKE', model: 'test', tokens: 20, cost: null } }; } };
}
const patch = { description: 'Bife a cavalo', budget: '35.00', portions: 1, maxMinutes: 40,
    zone: 'demo_butanta', excluded: [], foodSafetyConcern: false };
function commercialState(owner = 'one') {
    const at = new Date().toISOString(), state = initialState(owner, at);
    execute(state, { type: 'seed_demo', scope: 'merchant' }, at);
    const m = execute(state, { type: 'mandate', scope: 'buyer', description: 'Bife a cavalo',
        maxCents: 3500, maxMinutes: 40, zone: 'demo_butanta', excluded: [], confirmed: true }, at) as { mandateId: string };
    const q = createRfq(state, m.mandateId, at);
    return { state, rfq: state.rfqs.find(r => r.id === q.rfqId)!, at };
}

test('customer extraction persists an unconfirmed draft; never creates mandate or order', async () => {
    const store = new Store();
    await customerTurn(store, 'one', { message: 'Uma refeição até 35 reais', expectedVersion: 0 },
        'customer-key', 'body', fake({ tool: 'propose_request', patch }));
    const state = (await store.read('one'))!.state;
    assert.equal(state.customerAgent!.draft.budget, '35.00');
    assert.equal(state.customerAgent!.turns.length, 2);
    assert.equal(draftReadiness(state.customerAgent!.draft).ready, true);
    assert.equal(state.mandates.length, 0); assert.equal(state.orders.length, 0);
});

test('first user message initializes the market and menu tool returns only public restaurant data', async () => {
    const store = new Store();
    await customerTurn(store, 'menu', { message: 'Quais pratos posso pedir?', expectedVersion: 0 },
        'menu-request', 'menu-digest', fake({ tool: 'consult_menu' }));
    const state = (await store.read('menu'))!.state;
    assert.equal(state.restaurants.reduce((n, r) => n + r.recipes.length, 0), 12);
    assert.equal(state.orders.length, 0); assert.equal(state.mandates.length, 0);
    const menu = publicMenu(state, new Date().toISOString());
    assert.equal(menu.length, 12); assert.ok(menu.every(item => item.available));
    for (const hidden of ['reserved', 'costNumerator', 'policy', 'floorCents', 'safety'])
        assert.ok(!JSON.stringify(menu).includes(hidden));
    assert.match(state.customerAgent!.turns.at(-1)!.text, /Sabor de Casa/);
});

test('explicit new order resets the conversation without inference, stock replenishment or quota reset', async () => {
    const store = new Store();
    await customerTurn(store, 'reset', { message: 'frango até 45 reais', expectedVersion: 0 },
        'first-request', 'first-digest', fake({ tool: 'propose_request', patch }));
    const before = (await store.read('reset'))!.state;
    const neverCall: ChatProvider = { async complete() { throw new Error('reset must not infer'); } };
    const result = await customerTurn(store, 'reset', { reset: true, expectedVersion: 1 },
        'reset-request', 'reset-digest', neverCall);
    const after = (await store.read('reset'))!.state;
    assert.equal(after.customerAgent!.draft.description, null); assert.equal(after.customerAgent!.turns.length, 0);
    assert.equal(after.customerAgent!.version, 2); assert.equal(after.customerAgent!.calls, before.customerAgent!.calls);
    assert.deepEqual(after.restaurants, before.restaurants); assert.equal(result.replayed, false);
    assert.equal((await customerTurn(store, 'reset', { reset: true, expectedVersion: 1 },
        'reset-request', 'reset-digest', neverCall)).replayed, true);
});

test('customer context excludes merchant secrets and other owners; replay skips inference', async () => {
    const store = new Store(), commercial = commercialState();
    await store.insert('one', commercial.state);
    let calls = 0;
    const provider = fake({ tool: 'propose_request', patch: { description: 'Mensagem privada A' } }, messages => {
        calls++; assert.equal(messages[0].role, 'system');
        const text = JSON.stringify(messages); assert.ok(!text.includes('floorCents')); assert.ok(!text.includes('costNumerator'));
    });
    const input = { message: 'Mensagem privada A', expectedVersion: 0 };
    await customerTurn(store, 'one', input, 'unique-key', 'same', provider);
    const replay = await customerTurn(store, 'one', input, 'unique-key', 'same', provider);
    assert.equal(replay.replayed, true); assert.equal(calls, 1);
    await assert.rejects(customerTurn(store, 'one', input, 'unique-key', 'different', provider), rejects('IDEMPOTENCY_CONFLICT'));
    await customerTurn(store, 'two', { message: 'Olá B', expectedVersion: 0 }, 'key-two', 'two',
        fake({ tool: 'propose_request', patch: {} }, messages => assert.ok(!JSON.stringify(messages).includes('Mensagem privada A'))));
});

test('invalid tool, monetary fields, stale version and provider failures do not mutate state', async () => {
    assert.equal(agentDecisionSchema.safeParse({ tool: 'accept', offerId: 'x' }).success, false);
    assert.equal(agentDecisionSchema.safeParse({ tool: 'propose_request', patch: { confirmed: true, totalCents: 1 } }).success, false);
    assert.equal(customerTurnSchema.safeParse({ message: 'oi', expectedVersion: 0, ownerId: 'other' }).success, false);
    const store = new Store(); await store.insert('one', initialState('one', new Date().toISOString()));
    const before = await store.read('one');
    await assert.rejects(customerTurn(store, 'one', { message: 'oi', expectedVersion: 0 }, 'invalid-key', 'x', fake({ tool: 'delete' })), rejects('PROVIDER_INVALID_OUTPUT'));
    await assert.rejects(customerTurn(store, 'one', { message: 'oi', expectedVersion: 9 }, 'stale-key', 'x', fake({})), rejects('VERSION_CONFLICT'));
    await assert.rejects(customerTurn(store, 'one', { message: 'oi', expectedVersion: 0 }, 'failed-key', 'x', {
        async complete() { throw new DomainError('PROVIDER_TIMEOUT', 'Timeout', 503); },
    }), rejects('PROVIDER_TIMEOUT'));
    assert.deepEqual(await store.read('one'), before);
});

test('concurrent customer turns cannot overwrite a newer conversation', async () => {
    const store = new Store(); await store.insert('one', initialState('one', new Date().toISOString()));
    const provider = fake({ tool: 'propose_request', patch: { description: 'almoço' } });
    const results = await Promise.allSettled(['a', 'b'].map(x => customerTurn(store, 'one',
        { message: x, expectedVersion: 0 }, `customer-${x}`, x, provider)));
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal((await store.read('one'))!.state.customerAgent!.version, 1);
});

test('unsupported portion/zone and allergies cannot be silently converted to supported intent', () => {
    const draft = { ...emptyCustomerSession().draft, ...patch, zone: 'demo_butanta' as const };
    assert.equal(draftReadiness({ ...draft, portions: 2 }).ready, false);
    assert.equal(draftReadiness({ ...draft, zone: 'other' }).ready, false);
    assert.equal(draftReadiness({ ...draft, foodSafetyConcern: true }).ready, false);
    assert.equal(draftReadiness({ ...draft, excluded: ['amendoim'] }).ready, false);
    const state = initialState('safety', new Date().toISOString());
    const decision = { tool: 'propose_request' as const, patch: { foodSafetyConcern: false } };
    assert.equal(runCustomerTool(decision, draft, state, '', 'não tenho alergias').draft.foodSafetyConcern, false);
    assert.equal(runCustomerTool(decision, draft, state, '', 'sem alergias, mas sou celíaco').draft.foodSafetyConcern, true);
    assert.equal(runCustomerTool(decision, draft, state, '', 'tenho alergia a amendoim').draft.foodSafetyConcern, true);
});

test('four configurations select separate credentials, without restaurant fallback', () => {
    const env = { NEURALAKE_MODE: 'live', NEURALAKE_CUSTOMER_API_KEY: 'test-customer',
        NEURALAKE_NIKO_API_KEY: 'test-niko', NEURALAKE_CASA_API_KEY: 'test-casa', NEURALAKE_PANELA_API_KEY: 'test-panela' };
    assert.equal(new Set(['buyer', ...restaurantIds].map(id => configForAgent(env, id as 'buyer' | typeof restaurantIds[number]).apiKey)).size, 4);
    assert.throws(() => configForAgent({ NEURALAKE_MODE: 'live', NEURALAKE_API_KEY: 'customer-only' }, 'niko'), rejects('PROVIDER_CONFIGURATION'));
    assert.throws(() => configForAgent({ ...env, NEURALAKE_BASE_URL: 'https://example.com' }, 'buyer'), rejects('PROVIDER_CONFIGURATION'));
});

test('NeuraLake sends bounded server-side request and preserves unknown usage', async () => {
    const config = configForAgent({ NEURALAKE_MODE: 'live', NEURALAKE_CUSTOMER_API_KEY: 'test-secret' }, 'buyer');
    const http: typeof fetch = async function (this: unknown, url, init) {
        assert.equal(this, globalThis, 'Native Worker fetch must not receive the provider class as this.');
        assert.equal(url, 'https://api.neuralake.cloud/v1/chat/completions');
        const body = JSON.parse(String(init!.body));
        assert.equal(body.stream, false); assert.equal(body.max_tokens, 512);
        assert.equal(body.messages[0].role, 'system'); assert.equal(init!.redirect, 'manual');
        assert.equal('tools' in body, false); assert.equal('memory_id' in body, false);
        return Response.json({ choices: [{ message: { content: '{}' }, finish_reason: 'stop' }] });
    };
    const r = await new NeuraLakeChat(config, http).complete([{ role: 'system', content: 'test' }]);
    assert.equal(r.usage.tokens, null); assert.equal(r.usage.model, null); assert.equal(r.usage.cost, null);
    const failure = new NeuraLakeChat(config, async () => new Response('test-secret provider body', { status: 401 }));
    await assert.rejects(failure.complete([]), e => e instanceof DomainError && !e.message.includes('test-secret'));
    let redirectCalls = 0;
    const redirect = new NeuraLakeChat(config, async (_url, init) => {
        redirectCalls++;
        assert.equal(init?.redirect, 'manual');
        return new Response(null, { status: 302, headers: { Location: 'https://example.com/untrusted' } });
    });
    await assert.rejects(redirect.complete([]), rejects('PROVIDER_UNAVAILABLE'));
    assert.equal(redirectCalls, 1);
    const timeout = new NeuraLakeChat({ ...config, timeoutMs: 1 } as typeof config, async (_url, init) =>
        new Promise((_resolve, reject) => init!.signal!.addEventListener('abort', () => reject(new Error('aborted')))));
    await assert.rejects(timeout.complete([]), rejects('PROVIDER_TIMEOUT'));
});

test('router rejects every restaurant-to-restaurant route and forged sender', () => {
    const { state, rfq } = commercialState();
    for (const from of restaurantIds) for (const to of restaurantIds) {
        assert.throws(() => routeAgentMessage(from, { kind: 'request', from, to, payload: toRestaurantRequest(rfq, to) }), rejects('UNAUTHORIZED_AGENT_ROUTE'));
    }
    assert.throws(() => routeAgentMessage('niko', { kind: 'request', from: 'buyer', to: 'casa', payload: toRestaurantRequest(rfq, 'casa') }), rejects('UNAUTHORIZED_AGENT_ROUTE'));
    const request = toRestaurantRequest(rfq, 'niko');
    assert.ok(!JSON.stringify(request).includes('3500')); assert.equal('mandateId' in request, false); assert.equal('description' in request, false);
    const offer = toRestaurantOffer(state.offers[0]);
    assert.equal('receipt' in offer, false); assert.equal('quoteToken' in offer, false);
    assert.equal(priceQuoteSchema.safeParse({ subtotalCents: 100, deliveryCents: 50, buyerFeeCents: 0, totalCents: 1 }).success, false);
});

test('each restaurant receives only its own offers and can only reply to buyer', async () => {
    const { state, rfq } = commercialState();
    for (const id of restaurantIds) {
        const own = state.offers.filter(o => o.merchantId === id).map(toRestaurantOffer);
        const foreign = state.offers.find(o => o.merchantId !== id)!;
        await consultRestaurant(id, toRestaurantRequest(rfq, id), own,
            fake({ tool: 'submit_offer', offerId: own[0].offerId }, messages => {
                const text = JSON.stringify(messages); assert.ok(!text.includes(foreign.id));
                assert.ok(!text.includes('maxCents')); assert.ok(!text.includes('receipt'));
                assert.equal(messages.length, 2);
            }), 'live');
        await assert.rejects(consultRestaurant(id, toRestaurantRequest(rfq, id), own,
            fake({ tool: 'submit_offer', offerId: foreign.id }), 'live'), rejects('UNAUTHORIZED_AGENT_OFFER'));
        await assert.rejects(consultRestaurant(id, toRestaurantRequest(rfq, id), [toRestaurantOffer(foreign)],
            fake({}), 'live'), rejects('UNAUTHORIZED_AGENT_CONTEXT'));
    }
});

test('four-agent path preserves deterministic total, atomic order and idempotency', async () => {
    const { state, rfq } = commercialState(); const store = new Store(); await store.insert('one', state);
    const unused = fake({});
    const connections = Object.fromEntries(restaurantIds.map(id => [id, { provider: unused, mode: 'mock' }])) as Record<typeof restaurantIds[number], RestaurantConnection>;
    const first = await negotiateWithAgents(store, 'one', rfq.id, 'agent-buy-key', 'digest', connections);
    assert.equal(first.state.orders.length, 1); assert.equal(first.state.orders[0].totalCents, 3090);
    assert.equal(first.state.events.filter(e => e.type === 'RESTAURANT_AGENT_DECISION').length, 3);
    const again = await negotiateWithAgents(store, 'one', rfq.id, 'agent-buy-key', 'digest', connections);
    assert.equal(again.replayed, true); assert.equal(again.state.orders.length, 1);
    await assert.rejects(negotiateWithAgents(store, 'two', rfq.id, 'agent-buy-key', 'digest', connections), rejects('RFQ_NOT_FOUND'));
});

test('restaurant provider failure leaves all orders and offers unchanged; no silent mock', async () => {
    const { state, rfq } = commercialState(); const store = new Store(); await store.insert('one', state);
    const provider: ChatProvider = { async complete() { throw new DomainError('PROVIDER_UNAVAILABLE', 'not connected', 503); } };
    const connections = Object.fromEntries(restaurantIds.map(id => [id, { provider, mode: 'live' }])) as Record<typeof restaurantIds[number], RestaurantConnection>;
    await assert.rejects(negotiateWithAgents(store, 'one', rfq.id, 'failed-buy', 'digest', connections), rejects('PROVIDER_UNAVAILABLE'));
    assert.deepEqual((await store.read('one'))!.state, state);
});
