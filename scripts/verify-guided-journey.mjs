// Opt-in integration evidence. The Worker owns provider credentials; this script
// uses new synthetic workspaces and never authorizes or cancels a purchase.
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';

const latestFullOutput = new URL('../outputs/guided-journey.json', import.meta.url);
const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const fields = ['description', 'budget', 'portions', 'maxMinutes', 'zone', 'excluded',
    'foodSafetyConcern', 'selectionPreference', 'restaurantId', 'deliveryPointId'];
function redact(value) {
    if (typeof value === 'string') return value.replace(/\b(?:nlk|sk)-[a-z\d_-]{8,}/gi, '[REDACTED]')
        .replace(/\bBearer\s+[a-z\d._~+/-]{8,}/gi, 'Bearer [REDACTED]');
    if (Array.isArray(value)) return value.map(redact);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redact(item)]));
    return value;
}
const safeCode = value => typeof value === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/.test(value) ? value : 'HTTP_FAILURE';
function check(target, id, passed, expected, actual) {
    target.checks.push({ id, status: passed ? 'PASS' : 'FAIL',
        ...(expected === undefined ? {} : { expected }), ...(actual === undefined ? {} : { actual }) });
}
function equal(c, field, expected) {
    const actual = ['restaurantId', 'deliveryPointId'].includes(field) ? c.draft[field] ?? null : c.draft[field];
    const wanted = ['restaurantId', 'deliveryPointId'].includes(field) ? expected ?? null : expected;
    check(c.turn, `draft.${field}`, isDeepStrictEqual(actual, wanted), wanted, actual);
}
function preserve(c, except = []) {
    for (const field of fields.filter(item => !except.includes(item))) equal(c, field, c.before.session.draft[field]);
}
function unfilledLimits(c) {
    for (const field of ['budget', 'maxMinutes', 'excluded', 'foodSafetyConcern']) equal(c, field, null);
}
function ready(c, expected) { check(c.turn, 'readiness.ready', c.view.readiness.ready === expected, expected, c.view.readiness.ready); }
const step = (message, verify) => ({ message, verify });
const scenarios = [
    { id: 'hungry-customer-chooses-rated-nearby-restaurant', steps: [
        step('Quero um único prato, algo mais parrudo, estou com muita fome.', c => {
            equal(c, 'description', null); equal(c, 'portions', 1); unfilledLimits(c); ready(c, false);
        }),
        step('Quero carne vermelha, o que me recomenda? Qual o restaurante próximo melhor avaliado?', c => {
            equal(c, 'description', null); equal(c, 'restaurantId', null); equal(c, 'deliveryPointId', null);
            equal(c, 'selectionPreference', 'BEST_RATED'); unfilledLimits(c); ready(c, false);
            check(c.turn, 'question.location', c.view.session.question?.kind === 'location', 'location', c.view.session.question?.kind);
            check(c.turn, 'ingredient.red-meat', c.view.session.discovery?.ingredientIds?.includes('patinho'), true,
                c.view.session.discovery?.ingredientIds);
        }),
        step('Como assim?', c => {
            preserve(c); ready(c, false);
            check(c.turn, 'explanation.adds-context', c.reply !== c.before.session.turns.at(-1)?.text, true,
                c.reply !== c.before.session.turns.at(-1)?.text);
            check(c.turn, 'explanation.about-location', /local|bairro|ponto|entrega/.test(normalize(c.reply)), true);
        }),
        step('Butantã.', c => {
            equal(c, 'deliveryPointId', 'butanta_centro'); equal(c, 'zone', 'demo_butanta');
            preserve(c, ['deliveryPointId', 'zone']); ready(c, false);
            const choices = c.view.session.discovery?.restaurantChoices ?? [];
            check(c.turn, 'restaurant-shortlist', choices.length > 0 && choices.length <= 3, '1–3', choices.length);
            check(c.turn, 'best-rated-first', choices[0]?.restaurantId === 'casa', 'casa', choices[0]?.restaurantId);
            check(c.turn, 'distance-disclosed', /\bkm\b/i.test(c.reply), true);
            check(c.turn, 'fictional-location-disclosed', /simulad|fictici|demo/.test(normalize(c.reply)), true);
        }),
        step('Quero o Sabor de Casa.', c => {
            equal(c, 'restaurantId', 'casa'); equal(c, 'description', null);
            preserve(c, ['restaurantId']); ready(c, false);
        }),
        step('Bife a cavalo.', c => {
            equal(c, 'description', 'Bife a cavalo'); preserve(c, ['description']); unfilledLimits(c); ready(c, false);
        }),
        step('Uma porção, até R$ 45,00 com entrega em até 40 minutos. Não tenho alergias e nenhum ingrediente para excluir.', c => {
            equal(c, 'restaurantId', 'casa'); equal(c, 'deliveryPointId', 'butanta_centro');
            equal(c, 'description', 'Bife a cavalo'); equal(c, 'selectionPreference', 'BEST_RATED');
            equal(c, 'portions', 1); equal(c, 'budget', '45.00'); equal(c, 'maxMinutes', 40);
            equal(c, 'foodSafetyConcern', false); equal(c, 'excluded', []); ready(c, true);
        }),
        step('Não quero trocar de restaurante.', c => {
            preserve(c); ready(c, true);
            check(c.turn, 'refusal-does-not-reopen-restaurant-selection', c.view.session.question?.kind !== 'restaurant_choice', true);
            check(c.turn, 'refusal-does-not-ask-which-restaurant', !/qual restaurante/.test(normalize(c.reply)), true);
        }),
    ] },
    { id: 'restaurant-and-dish-ordinals-keep-their-context', steps: [
        step('Quais restaurantes atendem no Butantã? Prefiro o melhor avaliado.', c => {
            equal(c, 'description', null); equal(c, 'restaurantId', null); unfilledLimits(c);
            check(c.turn, 'choices.restaurant', c.view.session.discovery?.choiceKind === 'restaurant', 'restaurant', c.view.session.discovery?.choiceKind);
            check(c.turn, 'choices.at-least-two-restaurants', (c.view.session.discovery?.restaurantChoices?.length ?? 0) >= 2, true);
        }),
        step('A segunda.', c => {
            equal(c, 'restaurantId', c.before.session.discovery?.restaurantChoices?.[1]?.restaurantId);
            equal(c, 'description', null); equal(c, 'budget', null); equal(c, 'portions', null);
        }),
        step('Me passe os pratos disponíveis.', c => {
            preserve(c);
            const choices = c.view.session.discovery?.choices ?? [];
            check(c.turn, 'choices.dish', c.view.session.discovery?.choiceKind === 'dish', 'dish', c.view.session.discovery?.choiceKind);
            check(c.turn, 'choices.fixed-restaurant', choices.length >= 2 && choices.every(choice => choice.restaurantId === c.draft.restaurantId), true);
        }),
        step('A segunda.', c => {
            equal(c, 'description', c.before.session.discovery?.choices?.[1]?.name);
            preserve(c, ['description']); unfilledLimits(c); ready(c, false);
        }),
        step('Pode ser qualquer restaurante.', c => {
            equal(c, 'restaurantId', null); preserve(c, ['restaurantId']); ready(c, false);
        }),
    ] },
    { id: 'nearest-does-not-invent-customer-location', steps: [
        step('Qual restaurante é mais próximo de mim?', c => {
            equal(c, 'deliveryPointId', null); equal(c, 'restaurantId', null); equal(c, 'description', null);
            equal(c, 'portions', null); unfilledLimits(c); ready(c, false);
            check(c.turn, 'question.location', c.view.session.question?.kind === 'location', 'location', c.view.session.question?.kind);
            check(c.turn, 'no-invented-distance', !/\d+(?:[.,]\d+)?\s*km\b/i.test(c.reply), true);
        }),
        step('Não entendi, pode explicar?', c => {
            preserve(c); ready(c, false);
            check(c.turn, 'explanation.adds-context', c.reply !== c.before.session.turns.at(-1)?.text, true);
            check(c.turn, 'no-invented-distance', !/\d+(?:[.,]\d+)?\s*km\b/i.test(c.reply), true);
        }),
    ] },
    { id: 'denied-dish-changes-preserve-selection', steps: [
        step('Quero uma porção de Bife a cavalo no Seu Niko. Meu limite total é 75 reais com entrega no Butantã em até 60 minutos. Não tenho alergias e nenhum ingrediente para excluir.', c => {
            equal(c, 'description', 'Bife a cavalo'); equal(c, 'restaurantId', 'niko');
            equal(c, 'budget', '75.00'); equal(c, 'portions', 1); equal(c, 'maxMinutes', 60);
            equal(c, 'zone', 'demo_butanta'); equal(c, 'deliveryPointId', 'butanta_centro');
            equal(c, 'foodSafetyConcern', false); equal(c, 'excluded', []); ready(c, true);
        }),
        ...['Não troque meu prato.', 'Não mude a refeição.', 'Não remova meu prato.'].map(message => step(message, c => {
            preserve(c); ready(c, true);
            check(c.turn, 'refusal-keeps-dish-selected', c.view.session.question?.kind !== 'dish_choice', true);
            check(c.turn, 'refusal-does-not-ask-which-dish', !/qual prato/.test(normalize(c.reply)), true);
        })),
        step('Não remova meu pedido e prefiro Macarrão com carne e tomate.', c => {
            equal(c, 'description', 'Macarrão com carne e tomate'); equal(c, 'excluded', []);
            preserve(c, ['description']); ready(c, true);
        }),
        step('Agora quero excluir tomate. Não substitua meu prato.', c => {
            equal(c, 'description', 'Macarrão com carne e tomate'); equal(c, 'excluded', ['tomate']);
            preserve(c, ['excluded']); ready(c, false);
            check(c.turn, 'ingredient-conflict-explained', c.view.readiness.unsupported.some(item => normalize(item).includes('ingrediente')), true);
            check(c.turn, 'conflict-not-presented-as-ready', !normalize(c.reply).includes('seu rascunho esta pronto'), true);
        }),
    ] },
];

async function request(base, owner, path, body) {
    try {
        const response = await fetch(new URL(`/api/v1/${path}`, base), {
            method: body ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.timeout(45000),
            headers: { 'Content-Type': 'application/json', 'oai-authenticated-user-id': owner,
                ...(body ? { 'Idempotency-Key': randomUUID() } : {}) },
            ...(body ? { body: JSON.stringify(body) } : {}),
        });
        const data = await response.json();
        return { status: response.status, data, error: response.ok ? null : safeCode(data?.error?.code) };
    } catch (error) {
        return { status: null, data: null, error: error?.name === 'TimeoutError' ? 'REQUEST_TIMEOUT' : 'REQUEST_FAILED' };
    }
}
function validView(view) {
    return view?.session?.draft && Array.isArray(view.session.turns) &&
        Number.isInteger(view.session.version) && Number.isInteger(view.session.calls) && typeof view.readiness?.ready === 'boolean';
}
async function run(base, definition) {
    const scenario = { id: definition.id, owner: `guided_journey_${randomUUID()}`, checks: [], turns: [], aborted: false };
    const initial = await request(base, scenario.owner, 'customer-agent');
    check(scenario, 'initial-http', initial.status === 200, 200, initial.status);
    check(scenario, 'initial-contract', !!validView(initial.data), true);
    check(scenario, 'initial-live', initial.data?.mode === 'NEURALAKE', 'NEURALAKE', initial.data?.mode);
    check(scenario, 'fresh-synthetic-owner', initial.data?.session?.version === 0 && initial.data?.session?.calls === 0, true);
    let view = initial.data;
    if (scenario.checks.some(item => item.status === 'FAIL')) scenario.aborted = true;
    for (const [index, definitionStep] of definition.steps.entries()) {
        if (scenario.aborted) break;
        const before = structuredClone(view);
        const turn = { number: index + 1, input: definitionStep.message, checks: [] };
        scenario.turns.push(turn);
        const response = await request(base, scenario.owner, 'customer-agent', {
            message: definitionStep.message, expectedVersion: before.session.version,
        });
        const persisted = await request(base, scenario.owner, 'customer-agent');
        check(turn, 'post-http', response.status === 200, 200, response.status);
        check(turn, 'get-http', persisted.status === 200, 200, persisted.status);
        check(turn, 'persisted-contract', !!validView(persisted.data), true);
        check(turn, 'post-contract', !!validView(response.data?.result), true);
        if (turn.checks.some(item => item.status === 'FAIL')) {
            turn.error = response.error ?? persisted.error;
            turn.status = 'FAIL'; scenario.aborted = true; break;
        }
        view = persisted.data;
        const reply = view.session.turns.findLast(item => item.role === 'assistant')?.text ?? '';
        Object.assign(turn, { draft: view.session.draft, question: view.session.question, discovery: view.session.discovery,
            readiness: view.readiness, reply, calls: view.session.calls });
        check(turn, 'persisted-result-match', isDeepStrictEqual(response.data.result.session, view.session), true);
        check(turn, 'version-once', view.session.version === before.session.version + 1, before.session.version + 1, view.session.version);
        check(turn, 'live-provider', view.session.lastUsage?.mode === 'NEURALAKE', 'NEURALAKE', view.session.lastUsage?.mode);
        check(turn, 'no-credentials', !/\b(?:nlk|sk)-[a-z\d_-]{12,}|\bBearer\s+[a-z\d._~+/-]{16,}/i.test(reply), true);
        definitionStep.verify({ turn, before, view, draft: view.session.draft, reply });
        turn.status = turn.checks.some(item => item.status === 'FAIL') ? 'FAIL' : 'PASS';
    }
    const buyer = await request(base, scenario.owner, 'state?role=buyer');
    check(scenario, 'buyer-http', buyer.status === 200, 200, buyer.status);
    for (const name of ['orders', 'mandates', 'rfqs', 'offers'])
        check(scenario, `no-commercial-side-effects.${name}`, Array.isArray(buyer.data?.[name]) && buyer.data[name].length === 0, 0, buyer.data?.[name]?.length);
    scenario.committedCalls = view?.session?.calls ?? 0;
    const checks = [scenario, ...scenario.turns].flatMap(item => item.checks);
    scenario.totals = { pass: checks.filter(item => item.status === 'PASS').length, fail: checks.filter(item => item.status === 'FAIL').length };
    scenario.status = scenario.aborted || scenario.totals.fail ? 'FAIL' : 'PASS';
    return scenario;
}

async function main() {
    if (!process.argv.includes('--live')) {
        console.error(`Opt-in required: node scripts/verify-guided-journey.mjs --live [--scenario=id] (${scenarios.reduce((sum, item) => sum + item.steps.length, 0)} synthetic turns in the full suite; real NeuraLake calls).`);
        process.exitCode = 1; return;
    }
    const filters = process.argv.slice(2).filter(argument => argument !== '--live');
    if (filters.length > 1 || (filters.length && !filters[0].startsWith('--scenario='))) {
        console.error('FAIL: use only --live and the optional --scenario=id filter.');
        process.exitCode = 1; return;
    }
    const scenarioId = filters[0]?.slice('--scenario='.length) ?? null;
    const selected = scenarioId === null ? scenarios : scenarios.filter(item => item.id === scenarioId);
    if (!selected.length) {
        console.error('FAIL: scenario id does not match a declared guided journey.');
        process.exitCode = 1; return;
    }
    let base;
    try {
        base = new URL(process.env.IBYARA_TEST_ORIGIN ?? 'http://127.0.0.1:4173');
        if (!['localhost', '127.0.0.1'].includes(base.hostname) || !['http:', 'https:'].includes(base.protocol) ||
            ['5173', '5174'].includes(base.port) || base.username || base.password || base.search || base.hash || base.pathname !== '/') throw new Error();
    } catch {
        console.error('FAIL: use a local Worker origin, normally port 4173, never a preview proxy on 5173/5174.');
        process.exitCode = 1; return;
    }
    const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}_${randomUUID().slice(0, 8)}`;
    const directory = new URL('../outputs/guided-journey-runs/', import.meta.url);
    const output = new URL(`${scenarioId === null ? 'full' : 'targeted'}-${runId}.json`, directory);
    const report = { startedAt: new Date().toISOString(), origin: base.origin, realProvider: true,
        syntheticOwners: true, credentialsRead: false, purchaseCommandsSent: 0, scenarioFilter: scenarioId,
        plannedScenarios: selected.length, plannedTurns: selected.reduce((sum, item) => sum + item.steps.length, 0), scenarios: [] };
    await mkdir(directory, { recursive: true });
    for (const definition of selected) {
        const scenario = await run(base, definition);
        report.scenarios.push(scenario);
        await writeFile(output, `${JSON.stringify(redact(report), null, 2)}\n`, 'utf8');
        console.log(`${scenario.status} ${scenario.id}: ${scenario.turns.length}/${definition.steps.length} turns; ${scenario.totals.pass} checks passed, ${scenario.totals.fail} failed`);
    }
    const checks = report.scenarios.flatMap(item => [item, ...item.turns].flatMap(part => part.checks));
    report.completedAt = new Date().toISOString();
    report.totals = { scenariosPassed: report.scenarios.filter(item => item.status === 'PASS').length,
        scenariosFailed: report.scenarios.filter(item => item.status === 'FAIL').length,
        turns: report.scenarios.reduce((sum, item) => sum + item.turns.length, 0),
        assertionsPassed: checks.filter(item => item.status === 'PASS').length,
        assertionsFailed: checks.filter(item => item.status === 'FAIL').length,
        committedCalls: report.scenarios.reduce((sum, item) => sum + item.committedCalls, 0) };
    report.status = report.totals.scenariosFailed ? 'FAIL' : 'PASS';
    await writeFile(output, `${JSON.stringify(redact(report), null, 2)}\n`, 'utf8');
    // Targeted runs have their own immutable evidence file. They never replace
    // the full-suite report or the archived evidence from an earlier run.
    if (scenarioId === null) await writeFile(latestFullOutput, `${JSON.stringify(redact(report), null, 2)}\n`, 'utf8');
    console.log(`${report.status} ${JSON.stringify(report.totals)}; report: ${fileURLToPath(output)}`);
    if (report.status === 'FAIL') process.exitCode = 1;
}

await main().catch(() => {
    console.error('FAIL: harness could not complete; raw exceptions and response bodies were not logged.');
    process.exitCode = 1;
});
