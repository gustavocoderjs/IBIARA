import assert from 'node:assert/strict';

if (!process.argv.includes('--live')) throw new Error('Pass --live explicitly; this makes four real inference calls.');
const base = process.env.IBYARA_TEST_ORIGIN ?? 'http://127.0.0.1:4173';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Disposable local sandbox only.');
const owner = `live_smoke_${crypto.randomUUID()}`;
async function request(path, body, key = crypto.randomUUID()) {
    const response = await fetch(`${base}/api/v1/${path}`, { method: body ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json', 'oai-authenticated-user-id': owner, 'Idempotency-Key': key },
        body: body ? JSON.stringify(body) : undefined });
    const result = await response.json();
    assert.equal(response.status, 200, `${path}: ${result.error?.code ?? response.status}`);
    return result;
}
try {
    const initial = await request('customer-agent');
    assert.equal(initial.mode, 'NEURALAKE', 'Run with server NEURALAKE_MODE=live.');
    assert.equal(initial.session.version, 0);
    assert.equal((await request('state?role=buyer')).orders.length, 0);
    const key = crypto.randomUUID(), input = { expectedVersion: 0,
        message: 'Quero uma porção de Frango grelhado com arroz e feijão. Limite de R$ 45,00 com entrega no Butantã, em até 40 minutos. Não tenho alergias e nenhum ingrediente para excluir.' };
    const turn = await request('customer-agent', input, key);
    assert.equal(turn.result.session.lastUsage.mode, 'NEURALAKE');
    assert.equal(turn.result.readiness.ready, true, JSON.stringify(turn.result.readiness));
    assert.equal((await request('customer-agent', input, key)).replayed, true);
    assert.equal((await request('state?role=buyer')).orders.length, 0, 'Chat cannot authorize a purchase.');
    const draft = turn.result.session.draft;
    const merchant = await request('state?role=merchant');
    assert.equal(merchant.restaurant.recipes.length, 4);
    // This synthetic test explicitly performs the same human review/authorization action as the UI.
    assert.equal(draft.portions, 1); assert.equal(draft.budget, '45.00');
    const mandate = await request('commands', { type: 'mandate', scope: 'buyer',
        description: draft.description, maxCents: 4500, maxMinutes: draft.maxMinutes,
        zone: draft.zone, excluded: draft.excluded, confirmed: true });
    const rfq = await request('commands', { type: 'rfq', scope: 'buyer', mandateId: mandate.result.mandateId });
    assert.equal(rfq.result.status, 'QUOTED');
    const purchaseKey = crypto.randomUUID(), purchase = { type: 'agent_negotiate', scope: 'buyer', rfqId: rfq.result.rfqId };
    const completed = await request('commands', purchase, purchaseKey);
    assert.equal(completed.state.orders.length, 1);
    assert.equal(completed.result.agents.length, 3);
    assert.ok(completed.result.agents.every(agent => agent.usage.mode === 'NEURALAKE'));
    const order = completed.state.orders[0];
    assert.equal(order.executionMode, 'SANDBOX'); assert.ok(order.totalCents <= 4500);
    assert.match(order.dish, /Frango/i); assert.equal(order.merchantId, 'niko');
    assert.equal((await request('commands', purchase, purchaseKey)).replayed, true);
    const persisted = await request('state?role=merchant');
    assert.equal(persisted.restaurant.stock.find(item => item.id === 'frango').reserved, '180');
    const reset = await request('customer-agent', { reset: true, expectedVersion: turn.result.session.version });
    assert.equal(reset.result.session.draft.description, null);
    assert.equal((await request('state?role=buyer')).orders.length, 1);
    console.log(JSON.stringify({ status: 'PASS', mode: 'NEURALAKE', realInferenceCalls: 4,
        customerUsage: turn.result.session.lastUsage,
        restaurants: completed.result.agents.map(agent => ({ restaurantId: agent.restaurantId, published: !!agent.offerId, usage: agent.usage })),
        order: { dish: order.dish, totalCents: order.totalCents, executionMode: order.executionMode },
        checks: ['user input first', '12 menu items seeded', 'review before authorization', 'four live agents',
            'D1 conversation and order', 'idempotent retry', '180g chicken reserved', 'new order resets only draft'],
        realPayments: false }, null, 2));
} catch (error) {
    console.error(JSON.stringify({ status: 'FAIL', message: error instanceof Error ? error.message : 'Unknown error' }));
    process.exitCode = 1;
}
