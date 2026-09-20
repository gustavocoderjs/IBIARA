// Opt-in sandbox purchase. All writes go through the public API in a new
// synthetic workspace. Read-only local D1 access checks that competitors'
// inventory is untouched; it never reads any other workspace row.
import { randomUUID } from 'node:crypto';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';

const output = new URL('../outputs/selected-restaurant-api.json', import.meta.url);
const owner = `selected_restaurant_${randomUUID()}`;
const report = { status: 'RUNNING', startedAt: new Date().toISOString(), owner,
    realProvider: true, executionMode: 'SANDBOX', realPayments: false, realDeliveries: false,
    credentialsRead: false, syntheticOwnerOnly: true, directDatabaseWrites: false, checks: [] };
const safeCode = value => typeof value === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/.test(value) ? value : 'REQUEST_FAILED';
function requireCheck(id, condition) {
    report.checks.push({ id, status: condition ? 'PASS' : 'FAIL' });
    if (!condition) {
        const error = new Error('Controlled test assertion failed.');
        error.code = 'CHECK_FAILED';
        throw error;
    }
}
async function save() {
    await mkdir(new URL('../outputs/', import.meta.url), { recursive: true });
    await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}
function localOrigin() {
    const base = new URL(process.env.IBYARA_TEST_ORIGIN ?? 'http://127.0.0.1:4173');
    requireCheck('local-worker-origin', ['localhost', '127.0.0.1'].includes(base.hostname) &&
        ['http:', 'https:'].includes(base.protocol) && !['5173', '5174'].includes(base.port) &&
        !base.username && !base.password && !base.search && !base.hash && base.pathname === '/');
    return base;
}
async function request(base, path, body, key = randomUUID()) {
    const response = await fetch(new URL(`/api/v1/${path}`, base), {
        method: body ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.timeout(45000),
        headers: { 'Content-Type': 'application/json', 'oai-authenticated-user-id': owner,
            ...(body ? { 'Idempotency-Key': key } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const result = await response.json();
    if (!response.ok) {
        const error = new Error('API request failed.');
        error.code = safeCode(result.error?.code);
        throw error;
    }
    return result;
}

async function readSyntheticState() {
    // SQLite's read-only mode makes this an independent persistence check,
    // without adding a privileged HTTP endpoint or changing application scopes.
    const { DatabaseSync } = await import('node:sqlite');
    const directory = new URL('../.wrangler/state/v3/d1/miniflare-D1DatabaseObject/', import.meta.url);
    const files = (await readdir(directory)).filter(name => /^[a-f0-9]+\.sqlite$/i.test(name));
    for (const name of files) {
        const db = new DatabaseSync(fileURLToPath(new URL(name, directory)), { readOnly: true });
        try {
            if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'workspaces'").get()) continue;
            const row = db.prepare('SELECT data FROM workspaces WHERE owner_id = ?').get(owner);
            if (row) {
                const state = JSON.parse(row.data);
                requireCheck('readonly-row-belongs-to-synthetic-owner', state.ownerId === owner);
                return state;
            }
        } finally { db.close(); }
    }
    requireCheck('synthetic-owner-persisted-in-local-d1', false);
}
function stock(state, restaurantId) {
    const restaurant = state.restaurants.find(item => item.id === restaurantId);
    requireCheck(`stock-readable-${restaurantId}`, !!restaurant && Array.isArray(restaurant.stock));
    return restaurant.stock;
}

async function run() {
    const base = localOrigin(); report.origin = base.origin;
    report.phase = 'initial';
    const initial = await request(base, 'customer-agent');
    requireCheck('provider-is-live', initial.mode === 'NEURALAKE');
    requireCheck('fresh-customer-workspace', initial.session.version === 0 && initial.session.calls === 0);
    const empty = await request(base, 'state?role=buyer');
    requireCheck('fresh-commercial-workspace', ['orders', 'offers', 'rfqs', 'mandates'].every(name => empty[name].length === 0));
    requireCheck('sandbox-only', empty.mode === 'SANDBOX' && empty.integrations.execution.paymentReal === false && empty.integrations.execution.deliveryReal === false);
    await readSyntheticState();

    report.phase = 'customer-conversation';
    const input = { expectedVersion: 0,
        message: 'Quero uma porção de Bife a cavalo no Sabor de Casa. Limite de R$ 45,00 com entrega no Butantã, em até 40 minutos. Não tenho alergias e nenhum ingrediente para excluir.' };
    const chatKey = randomUUID();
    const turn = await request(base, 'customer-agent', input, chatKey);
    const draft = turn.result.session.draft;
    requireCheck('customer-used-neuralake', turn.result.session.lastUsage.mode === 'NEURALAKE');
    requireCheck('customer-ready-for-review', turn.result.readiness.ready === true);
    requireCheck('customer-selected-casa-and-point', draft.restaurantId === 'casa' && draft.deliveryPointId === 'butanta_centro');
    requireCheck('customer-kept-input-limits', draft.description === 'Bife a cavalo' && draft.portions === 1 &&
        draft.budget === '45.00' && draft.maxMinutes === 40 && draft.zone === 'demo_butanta' &&
        draft.foodSafetyConcern === false && draft.excluded.length === 0);
    requireCheck('chat-did-not-buy', (await request(base, 'state?role=buyer')).orders.length === 0);
    const chatReplay = await request(base, 'customer-agent', input, chatKey);
    requireCheck('chat-replay-idempotent', chatReplay.replayed === true && isDeepStrictEqual(chatReplay.result, turn.result));
    const beforePurchase = await readSyntheticState();
    const untouched = Object.fromEntries(['niko', 'panela'].map(id => [id, structuredClone(stock(beforePurchase, id))]));

    // The test now explicitly authorizes this one synthetic sandbox purchase,
    // matching the reviewed confirmation action in the consumer UI.
    report.phase = 'authorized-sandbox-purchase';
    const mandate = await request(base, 'commands', { type: 'mandate', scope: 'buyer',
        description: draft.description, maxCents: 4500, maxMinutes: draft.maxMinutes,
        zone: draft.zone, excluded: draft.excluded, selectionPreference: draft.selectionPreference ?? 'LOWEST_PRICE',
        restaurantId: draft.restaurantId, deliveryPointId: draft.deliveryPointId, confirmed: true });
    const storedMandate = mandate.state.mandates.find(item => item.id === mandate.result.mandateId);
    requireCheck('mandate-fixed-casa-and-point', storedMandate?.restaurantId === 'casa' && storedMandate?.deliveryPointId === 'butanta_centro');
    const rfq = await request(base, 'commands', { type: 'rfq', scope: 'buyer', mandateId: mandate.result.mandateId });
    requireCheck('rfq-quoted', rfq.result.status === 'QUOTED');
    requireCheck('only-casa-received-offers', rfq.state.offers.length > 0 && rfq.state.offers.every(item => item.merchantId === 'casa'));
    requireCheck('public-offers-have-simulated-location', rfq.state.offers.every(item => item.locationIsDemo === true && Number.isInteger(item.distanceMeters)));
    const purchaseKey = randomUUID();
    const purchase = { type: 'agent_negotiate', scope: 'buyer', rfqId: rfq.result.rfqId };
    const completed = await request(base, 'commands', purchase, purchaseKey);
    requireCheck('only-casa-agent-called', completed.result.agents.length === 1 && completed.result.agents[0].restaurantId === 'casa');
    requireCheck('casa-agent-used-neuralake', completed.result.agents[0].usage.mode === 'NEURALAKE');
    requireCheck('exactly-one-order', completed.state.orders.length === 1);
    const order = completed.state.orders[0];
    requireCheck('order-is-selected-restaurant', order.merchantId === 'casa' && order.dish === 'Bife a cavalo');
    requireCheck('order-is-authorized-sandbox', order.executionMode === 'SANDBOX' && order.totalCents > 0 && order.totalCents <= 4500);
    requireCheck('all-final-offers-still-casa', completed.state.offers.every(item => item.merchantId === 'casa'));
    const afterPurchase = await readSyntheticState();
    for (const id of ['niko', 'panela']) requireCheck(`competitor-stock-unchanged-${id}`, isDeepStrictEqual(stock(afterPurchase, id), untouched[id]));
    const casaStock = stock(afterPurchase, 'casa');
    requireCheck('casa-reserved-bife-ingredients', casaStock.find(item => item.id === 'patinho')?.reserved === '200' &&
        casaStock.find(item => item.id === 'ovo')?.reserved === '1');

    report.phase = 'purchase-replay';
    const replay = await request(base, 'commands', purchase, purchaseKey);
    requireCheck('purchase-replayed-same-result', replay.replayed === true && isDeepStrictEqual(replay.result, completed.result));
    requireCheck('purchase-replay-did-not-duplicate-order', replay.state.orders.length === 1 && replay.state.orders[0].id === order.id);
    requireCheck('purchase-replay-no-extra-provider-calls', replay.state.telemetry.llmCalls === completed.state.telemetry.llmCalls);
    const afterReplay = await readSyntheticState();
    requireCheck('replay-did-not-change-any-stock', isDeepStrictEqual(afterReplay.restaurants.map(item => ({ id: item.id, stock: item.stock })),
        afterPurchase.restaurants.map(item => ({ id: item.id, stock: item.stock }))));
    requireCheck('provider-accounting-matches-customer-plus-one-restaurant', completed.state.telemetry.llmCalls === turn.result.session.calls + 1);
    report.customerCalls = turn.result.session.calls;
    report.restaurantCalls = 1;
    report.committedCalls = completed.state.telemetry.llmCalls;
    report.order = { id: order.id, restaurantId: order.merchantId, dish: order.dish,
        totalCents: order.totalCents, executionMode: order.executionMode };
    report.status = 'PASS';
    report.phase = 'complete';
}

if (!process.argv.includes('--live')) {
    console.error('Opt-in required: node scripts/verify-selected-restaurant-api.mjs --live (one buyer turn, one restaurant turn and one authorized synthetic sandbox order).');
    process.exitCode = 1;
} else {
    try { await run(); }
    catch (error) {
        report.status = 'FAIL';
        report.error = { code: safeCode(error?.code), phase: report.phase };
        process.exitCode = 1;
    }
    report.completedAt = new Date().toISOString();
    report.assertionsPassed = report.checks.filter(item => item.status === 'PASS').length;
    report.assertionsFailed = report.checks.filter(item => item.status === 'FAIL').length;
    await save();
    console.log(`${report.status}: ${report.assertionsPassed} checks passed, ${report.assertionsFailed} failed; ${report.committedCalls ?? 'unknown'} committed calls; report: ${fileURLToPath(output)}`);
}
