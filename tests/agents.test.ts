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
const completeCustomerRequest = 'Quero uma porção de Bife a cavalo, até 35 reais no total com entrega no Butantã, em até 40 minutos. Não tenho alergias e nenhum ingrediente para excluir.';
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
    await customerTurn(store, 'one', { message: completeCustomerRequest, expectedVersion: 0 },
        'customer-key', 'body', fake({ tool: 'propose_request', patch }));
    const state = (await store.read('one'))!.state;
    assert.equal(state.customerAgent!.draft.budget, '35.00');
    assert.equal(state.customerAgent!.turns.length, 2);
    assert.equal(draftReadiness(state.customerAgent!.draft).ready, true);
    assert.equal(state.mandates.length, 0); assert.equal(state.orders.length, 0);
});

test('a complete model patch cannot invent the fields missing from the actual customer input', async () => {
    const store = new Store();
    const result = await customerTurn(store, 'ungrounded', { message: 'Uma refeição até 35 reais', expectedVersion: 0 },
        'ungrounded-key', 'ungrounded-digest', fake({ tool: 'propose_request', patch }));
    const state = (await store.read('ungrounded'))!.state;
    const draft = state.customerAgent!.draft;
    assert.equal(draft.budget, '35.00', 'The explicit budget must survive removal of invented fields.');
    assert.equal(draft.portions, 1, 'Uma refeição explicitly identifies one portion.');
    assert.equal(draft.description, null, 'A generic meal does not select the model-proposed Bife a cavalo.');
    assert.equal(draft.maxMinutes, null);
    assert.equal(draft.zone, null);
    assert.equal(draft.excluded, null);
    assert.equal(draft.foodSafetyConcern, null);
    assert.equal((result.result as { readiness: { ready: boolean } }).readiness.ready, false);
    assert.deepEqual(state.mandates, []); assert.deepEqual(state.rfqs, []); assert.deepEqual(state.orders, []);
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
    const reply = state.customerAgent!.turns.at(-1)!.text;
    const optionLines = reply.split('\n').filter(line => menu.some(item =>
        line.includes(item.restaurantName) && line.includes(item.name)));
    assert.ok(optionLines.length > 0 && optionLines.length <= 3,
        'The first response must show up to three real options, not all twelve dishes.');
    assert.equal(state.customerAgent!.draft.description, null, 'Listing choices does not select a meal.');
    assert.equal(state.customerAgent!.draft.budget, null, 'Listed prices are not the customer budget.');
    assert.equal(state.customerAgent!.draft.maxMinutes, null, 'Listed ETAs are not an authorized deadline.');
});

test('explicit new order resets the conversation without inference, stock replenishment or quota reset', async () => {
    const store = new Store();
    await customerTurn(store, 'reset', { message: completeCustomerRequest, expectedVersion: 0 },
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

test('provider failure and idempotent replay preserve discovery and the pending question', async () => {
    const store = new Store();
    await customerTurn(store, 'discovery-retry', { message: 'Quero algo com ovo.', expectedVersion: 0 },
        'discovery-initial', 'discovery-initial-body', fake({ tool: 'consult_menu' }));
    const before = (await store.read('discovery-retry'))!;
    const session = before.state.customerAgent!;
    assert.ok(session.discovery?.choices.length);
    assert.equal(session.pendingQuestion, 'description');
    const input = { message: 'Meu limite total é 35 reais.', expectedVersion: session.version };
    let inspected = 0;
    const inspect = (messages: ChatMessage[]) => {
        inspected++;
        const context = JSON.parse(messages.at(-1)!.content);
        assert.deepEqual(context.currentDraft, session.draft);
        assert.deepEqual(context.discovery, session.discovery);
        assert.equal(context.pendingQuestion, session.pendingQuestion);
        assert.equal(context.currentMessage, input.message);
        for (const field of ['costNumerator', 'costDenominator', 'floorCents', 'receiptHistory', 'policyHistory'])
            assert.equal(JSON.stringify(context).includes(field), false, `${field} must stay private to the restaurant.`);
    };
    await assert.rejects(customerTurn(store, 'discovery-retry', input, 'discovery-next', 'discovery-next-body', {
        async complete(messages) { inspect(messages); throw new DomainError('PROVIDER_UNAVAILABLE', 'Synthetic failure', 503); },
    }), rejects('PROVIDER_UNAVAILABLE'));
    assert.deepEqual(await store.read('discovery-retry'), before, 'A failed turn keeps choices, pending question, version and quota.');
    await customerTurn(store, 'discovery-retry', input, 'discovery-next', 'discovery-next-body',
        fake({ tool: 'propose_request', patch: { budget: '35.00' } }, inspect));
    const persisted = await store.read('discovery-retry');
    const replay = await customerTurn(store, 'discovery-retry', input, 'discovery-next', 'discovery-next-body', {
        async complete() { throw new Error('Replay must not infer.'); },
    });
    assert.equal(replay.replayed, true);
    assert.equal(inspected, 2);
    assert.deepEqual(await store.read('discovery-retry'), persisted, 'Replay cannot rewrite the successful discovery context.');
});

test('reset clears meal discovery but preserves an unretracted safety concern and exclusions', async () => {
    const store = new Store();
    await customerTurn(store, 'safe-reset', { expectedVersion: 0,
        message: 'Quero algo com ovo, sem queijo. Limite total de 45 reais, prazo de 40 minutos, entrega no Butantã. Tenho alergia a ovo.' },
    'safety-initial', 'safety-initial-body', fake({ tool: 'consult_menu' }));
    const before = (await store.read('safe-reset'))!.state;
    assert.equal(before.customerAgent!.draft.foodSafetyConcern, true);
    assert.ok(before.customerAgent!.draft.excluded?.includes('queijo'));
    assert.ok(before.customerAgent!.discovery?.ingredientIds.includes('ovo'));
    await customerTurn(store, 'safe-reset', { reset: true, expectedVersion: before.customerAgent!.version },
        'safety-reset', 'safety-reset-body', { async complete() { throw new Error('Reset must not infer.'); } });
    const after = (await store.read('safe-reset'))!.state;
    const expected = emptyCustomerSession();
    assert.deepEqual(after.customerAgent!.draft, { ...expected.draft, foodSafetyConcern: true,
        excluded: before.customerAgent!.draft.excluded });
    assert.deepEqual(after.customerAgent!.discovery, expected.discovery);
    assert.equal(after.customerAgent!.pendingQuestion, expected.pendingQuestion);
    assert.deepEqual(after.customerAgent!.turns, []);
    assert.equal(after.customerAgent!.calls, before.customerAgent!.calls);
    assert.deepEqual(after.restaurants, before.restaurants);
    assert.equal(draftReadiness(after.customerAgent!.draft, after).ready, false);
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

test('one format repair validates the same contract, counts both calls and cannot authorize a purchase', async () => {
    const store = new Store(); let calls = 0;
    const provider: ChatProvider = { async complete(messages) {
        calls++;
        if (calls === 2) assert.equal(messages.at(-1)!.role, 'system');
        return { content: calls === 1 ? 'Resposta fora do JSON' : JSON.stringify({ tool: 'propose_request', patch }),
            usage: { mode: 'NEURALAKE', model: 'test', tokens: 7, cost: null } };
    } };
    const input = { message: completeCustomerRequest, expectedVersion: 0 };
    await customerTurn(store, 'repair', input, 'repair-key', 'repair-digest', provider);
    const state = (await store.read('repair'))!.state;
    assert.equal(calls, 2); assert.equal(state.customerAgent!.calls, 2);
    assert.equal(state.inference!.committedCalls, 2); assert.equal(state.inference!.knownTokens, 14);
    assert.equal(state.mandates.length, 0); assert.equal(state.orders.length, 0);
    assert.equal((await customerTurn(store, 'repair', input, 'repair-key', 'repair-digest', provider)).replayed, true);
    assert.equal(calls, 2);
});

test('failed format repair is bounded, preserves the draft and never admits financial fields', async () => {
    const store = new Store(); await store.insert('repair-failure', initialState('repair-failure', new Date().toISOString()));
    const before = await store.read('repair-failure'); let calls = 0;
    const provider = fake({ tool: 'consult_menu', patch: { confirmed: true, totalCents: 1 } }, () => { calls++; });
    await assert.rejects(customerTurn(store, 'repair-failure', { message: 'cardápio', expectedVersion: 0 },
        'failure-key', 'failure-digest', provider), rejects('PROVIDER_INVALID_OUTPUT'));
    assert.equal(calls, 2); assert.deepEqual(await store.read('repair-failure'), before);
    calls = 0;
    await assert.rejects(customerTurn(store, 'repair-failure', { message: 'cardápio', expectedVersion: 0 },
        'quota-key', 'quota-digest', provider, 1), rejects('PROVIDER_INVALID_OUTPUT'));
    assert.equal(calls, 1, 'Repair cannot exceed the remaining inference budget.');
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
        assert.deepEqual(body.response_format, { type: 'json_object' });
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
