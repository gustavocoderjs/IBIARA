// Opt-in real-provider regression runner. Scenario definitions contain only
// synthetic conversation inputs and expectations; this runner never purchases.
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';

const MAX_CALLS_PER_OWNER = 24;
const draftKeys = ['description', 'budget', 'portions', 'maxMinutes', 'zone', 'excluded',
    'foodSafetyConcern', 'selectionPreference', 'restaurantId', 'deliveryPointId'];
const questionKinds = ['field', 'location', 'restaurant_choice', 'dish_choice', 'meal_style', 'portion_meaning', 'help'];
const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const credentialPattern = /\b(?:nlk|sk)-[a-z\d_-]{12,}|\bBearer\s+[a-z\d._~+/-]{16,}/i;
const privateFinancialPattern = /\b(?:custo(?:\s+unit[aá]rio)?|margem|piso(?:\s+de\s+pre[cç]o)?)\s*[:=]\s*(?:R\$\s*)?\d+(?:[.,]\d+)?(?:\s*%)?/i;
const safeCode = value => typeof value === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/.test(value) ? value : 'UNCLASSIFIED_FAILURE';
function redact(value) {
    if (typeof value === 'string') return value.replace(/\b(?:nlk|sk)-[a-z\d_-]{8,}/gi, '[REDACTED]')
        .replace(/\bBearer\s+[a-z\d._~+/-]{8,}/gi, 'Bearer [REDACTED]');
    if (Array.isArray(value)) return value.map(redact);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redact(item)]));
    return value;
}
async function save(path, report) { await writeFile(path, `${JSON.stringify(redact(report), null, 2)}\n`, 'utf8'); }
function check(target, id, passed, expected, actual) {
    target.checks.push({ id, status: passed ? 'PASS' : 'FAIL',
        ...(expected === undefined ? {} : { expected }), ...(actual === undefined ? {} : { actual }) });
}
function draftContract(draft) {
    if (!draft || typeof draft !== 'object' || Array.isArray(draft) || Object.keys(draft).some(key => !draftKeys.includes(key))) return false;
    if (draft.description !== null && (typeof draft.description !== 'string' || !draft.description.trim() || draft.description.length > 1000)) return false;
    if (draft.budget !== null && (typeof draft.budget !== 'string' || !/^\d{1,4}(?:\.\d{1,2})?$/.test(draft.budget))) return false;
    if (draft.portions !== null && (!Number.isInteger(draft.portions) || draft.portions < 1 || draft.portions > 20)) return false;
    if (draft.maxMinutes !== null && (!Number.isInteger(draft.maxMinutes) || draft.maxMinutes < 1 || draft.maxMinutes > 180)) return false;
    if (![null, 'demo_butanta', 'other'].includes(draft.zone)) return false;
    if (draft.excluded !== null && (!Array.isArray(draft.excluded) || draft.excluded.length > 20 || draft.excluded.some(item => typeof item !== 'string' || !item.trim() || item.length > 100))) return false;
    if (![null, true, false].includes(draft.foodSafetyConcern)) return false;
    if (![undefined, null, 'LOWEST_PRICE', 'BEST_RATED', 'NEAREST', 'FASTEST'].includes(draft.selectionPreference)) return false;
    if (![undefined, null, 'niko', 'casa', 'panela'].includes(draft.restaurantId)) return false;
    return [undefined, null, 'butanta_centro', 'usp', 'vila_indiana'].includes(draft.deliveryPointId);
}
function validView(view) {
    return !!view?.session && draftContract(view.session.draft) && Array.isArray(view.session.turns) &&
        Number.isInteger(view.session.version) && Number.isInteger(view.session.calls) &&
        typeof view.readiness?.ready === 'boolean' && Array.isArray(view.readiness.missing) && Array.isArray(view.readiness.unsupported);
}
function recordView(target, view) {
    if (!validView(view)) return;
    Object.assign(target, { draft: view.session.draft, readiness: view.readiness, question: view.session.question ?? null,
        discovery: view.session.discovery ?? null, version: view.session.version, calls: view.session.calls,
        mode: view.session.lastUsage?.mode ?? view.mode ?? null,
        reply: view.session.turns.findLast(item => item.role === 'assistant')?.text ?? '' });
}
async function request(base, owner, path, body, key) {
    try {
        const response = await fetch(new URL(`/api/v1/${path}`, base), {
            method: body ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.timeout(45000),
            headers: { 'Content-Type': 'application/json', 'oai-authenticated-user-id': owner,
                ...(key ? { 'Idempotency-Key': key } : {}) },
            ...(body ? { body: JSON.stringify(body) } : {}),
        });
        const data = await response.json();
        return { status: response.status, data, error: response.ok ? null : safeCode(data?.error?.code) };
    } catch (error) {
        return { status: null, data: null, error: error?.name === 'TimeoutError' ? 'REQUEST_TIMEOUT' : 'REQUEST_FAILED' };
    }
}
function expectations(turn, step, view) {
    for (const [field, expected] of Object.entries(step.expectedDraft ?? {})) {
        const actual = view.session.draft[field];
        const optional = ['restaurantId', 'deliveryPointId', 'selectionPreference'].includes(field);
        const normalizedActual = optional ? actual ?? null : actual;
        const normalizedExpected = optional ? expected ?? null : expected;
        check(turn, `expected-draft.${field}`, isDeepStrictEqual(normalizedActual, normalizedExpected), normalizedExpected, normalizedActual);
    }
    if (step.expectedReady !== undefined)
        check(turn, 'expected-readiness', view.readiness.ready === step.expectedReady, step.expectedReady, view.readiness.ready);
    if (step.expectedQuestionKind !== undefined)
        check(turn, 'expected-question-kind', (view.session.question?.kind ?? null) === step.expectedQuestionKind,
            step.expectedQuestionKind, view.session.question?.kind ?? null);
    if (step.expectedUnsupported !== undefined)
        check(turn, 'expected-unsupported', view.readiness.unsupported.some(item => normalize(item).includes(normalize(step.expectedUnsupported))),
            step.expectedUnsupported, view.readiness.unsupported);
    for (const fragment of step.forbiddenReply ?? [])
        check(turn, `forbidden-reply.${fragment}`, !normalize(turn.reply).includes(normalize(fragment)), false,
            normalize(turn.reply).includes(normalize(fragment)));
}
async function runCase(base, definition) {
    const scenario = { id: definition.id, dish: definition.dish, restaurantId: definition.restaurantId ?? null,
        owner: `dish_scenario_${randomUUID()}`, startedAt: new Date().toISOString(), status: 'RUNNING',
        plannedTurns: definition.steps.length, turns: [], checks: [], probes: [], aborted: false };
    const initial = await request(base, scenario.owner, 'customer-agent');
    check(scenario, 'initial-http-200', initial.status === 200, 200, initial.status);
    check(scenario, 'initial-contract', validView(initial.data), true);
    check(scenario, 'initial-live-mode', initial.data?.mode === 'NEURALAKE', 'NEURALAKE', initial.data?.mode);
    check(scenario, 'fresh-owner', initial.data?.session?.version === 0 && initial.data?.session?.calls === 0, true);
    let view = initial.data;
    if (scenario.checks.some(item => item.status === 'FAIL')) scenario.aborted = true;
    for (const [index, step] of definition.steps.entries()) {
        if (scenario.aborted) break;
        if (view.session.calls >= MAX_CALLS_PER_OWNER) {
            check(scenario, 'owner-call-budget-not-exhausted', false, `< ${MAX_CALLS_PER_OWNER}`, view.session.calls);
            scenario.aborted = true; break;
        }
        const before = structuredClone(view), key = randomUUID();
        const body = { message: step.message, expectedVersion: before.session.version };
        const turn = { number: index + 1, input: step.message, checks: [] };
        scenario.turns.push(turn);
        const posted = await request(base, scenario.owner, 'customer-agent', body, key);
        const persisted = await request(base, scenario.owner, 'customer-agent');
        recordView(turn, persisted.data);
        check(turn, 'post-http-200', posted.status === 200, 200, posted.status);
        check(turn, 'get-http-200', persisted.status === 200, 200, persisted.status);
        check(turn, 'post-contract', validView(posted.data?.result), true);
        check(turn, 'persisted-contract', validView(persisted.data), true);
        if (turn.checks.some(item => item.status === 'FAIL')) {
            turn.error = posted.error ?? persisted.error;
            if (posted.status !== 200 && validView(persisted.data))
                check(turn, 'failed-turn-preserved-session', isDeepStrictEqual(persisted.data.session, before.session), true);
            turn.status = 'FAIL'; scenario.aborted = true; break;
        }
        view = persisted.data;
        check(turn, 'post-and-persisted-match', isDeepStrictEqual(posted.data.result.session, view.session), true);
        check(turn, 'readiness-persists', isDeepStrictEqual(posted.data.result.readiness, view.readiness), true);
        check(turn, 'version-increments-once', view.session.version === before.session.version + 1, before.session.version + 1, view.session.version);
        check(turn, 'provider-live', view.session.lastUsage?.mode === 'NEURALAKE', 'NEURALAKE', view.session.lastUsage?.mode);
        check(turn, 'call-budget-respected', view.session.calls <= MAX_CALLS_PER_OWNER && view.session.calls >= before.session.calls + 1 &&
            view.session.calls <= before.session.calls + 2, `${before.session.calls + 1}–${Math.min(before.session.calls + 2, MAX_CALLS_PER_OWNER)}`, view.session.calls);
        check(turn, 'input-persisted', view.session.turns.at(-2)?.role === 'user' && view.session.turns.at(-2)?.text === step.message, true);
        const publicOutput = JSON.stringify({ draft: turn.draft, reply: turn.reply });
        check(turn, 'no-credentials', !credentialPattern.test(publicOutput), true);
        check(turn, 'no-private-financial-values', !privateFinancialPattern.test(turn.reply), true);
        const kind = view.session.discovery?.choiceKind;
        const displayed = kind === 'restaurant' ? view.session.discovery?.restaurantChoices : view.session.discovery?.choices;
        if (Array.isArray(displayed)) check(turn, 'shortlist-at-most-three', displayed.length <= 3, '<=3', displayed.length);
        expectations(turn, step, view);
        turn.status = turn.checks.some(item => item.status === 'FAIL') ? 'FAIL' : 'PASS';

        // One replay per scenario verifies the authoritative persistence boundary
        // without consuming another provider call. It is not a retry after error.
        if (index === 0) {
            const probe = { id: 'first-turn-idempotent-replay', checks: [] };
            scenario.probes.push(probe);
            const replay = await request(base, scenario.owner, 'customer-agent', body, key);
            const afterReplay = await request(base, scenario.owner, 'customer-agent');
            check(probe, 'replay-http-200', replay.status === 200, 200, replay.status);
            check(probe, 'replay-flag', replay.data?.replayed === true, true);
            check(probe, 'replay-same-result', isDeepStrictEqual(replay.data?.result, posted.data.result), true);
            check(probe, 'replay-persisted-http-200', afterReplay.status === 200, 200, afterReplay.status);
            check(probe, 'replay-no-session-or-call-changes', validView(afterReplay.data) && isDeepStrictEqual(afterReplay.data.session, view.session), true);
            probe.status = probe.checks.some(item => item.status === 'FAIL') ? 'FAIL' : 'PASS';
            if (probe.status === 'FAIL') scenario.aborted = true;
        }
    }
    const buyer = await request(base, scenario.owner, 'state?role=buyer');
    check(scenario, 'buyer-http-200', buyer.status === 200, 200, buyer.status);
    check(scenario, 'sandbox-mode', buyer.data?.mode === 'SANDBOX', 'SANDBOX', buyer.data?.mode);
    for (const field of ['orders', 'offers', 'mandates', 'rfqs'])
        check(scenario, `no-authority-side-effects.${field}`, Array.isArray(buyer.data?.[field]) && buyer.data[field].length === 0, 0, buyer.data?.[field]?.length);
    scenario.skippedTurns = definition.steps.length - scenario.turns.length;
    scenario.committedCalls = validView(view) ? view.session.calls : 0;
    scenario.completedAt = new Date().toISOString();
    const checks = [scenario, ...scenario.turns, ...scenario.probes].flatMap(item => item.checks);
    scenario.totals = { assertionsPassed: checks.filter(item => item.status === 'PASS').length,
        assertionsFailed: checks.filter(item => item.status === 'FAIL').length };
    scenario.status = scenario.aborted || scenario.totals.assertionsFailed ? 'FAIL' : 'PASS';
    return scenario;
}

function options() {
    const config = { scenario: null, limit: null, concurrency: 1 };
    for (const argument of process.argv.slice(2)) {
        if (argument === '--live') continue;
        const match = argument.match(/^--(scenario|limit|concurrency)=(.+)$/);
        if (!match) throw new Error('INVALID_OPTIONS');
        if (match[1] === 'scenario') config.scenario = match[2];
        else {
            if (!/^\d+$/.test(match[2])) throw new Error('INVALID_OPTIONS');
            config[match[1]] = Number(match[2]);
        }
    }
    if (!Number.isInteger(config.concurrency) || config.concurrency < 1 || config.concurrency > 2 ||
        (config.limit !== null && (!Number.isSafeInteger(config.limit) || config.limit < 1))) throw new Error('INVALID_OPTIONS');
    return config;
}
function validateDefinitions(scenarios) {
    if (!Array.isArray(scenarios) || !scenarios.length) throw new Error('INVALID_SCENARIO_DEFINITIONS');
    const ids = new Set();
    for (const scenario of scenarios) {
        if (!scenario || !/^[a-z0-9][a-z0-9_-]{0,99}$/.test(scenario.id) || ids.has(scenario.id) ||
            typeof scenario.dish !== 'string' || !scenario.dish.trim() ||
            ![undefined, null, 'niko', 'casa', 'panela'].includes(scenario.restaurantId) ||
            ![undefined, false].includes(scenario.purchase) || !Array.isArray(scenario.steps) ||
            !scenario.steps.length || scenario.steps.length > MAX_CALLS_PER_OWNER) throw new Error('INVALID_SCENARIO_DEFINITIONS');
        ids.add(scenario.id);
        for (const step of scenario.steps) {
            if (!step || typeof step.message !== 'string' || !step.message.trim() || step.message.length > 1000 ||
                (step.expectedDraft !== undefined && (!step.expectedDraft || typeof step.expectedDraft !== 'object' || Array.isArray(step.expectedDraft) || Object.keys(step.expectedDraft).some(key => !draftKeys.includes(key)))) ||
                (step.expectedReady !== undefined && typeof step.expectedReady !== 'boolean') ||
                (step.expectedQuestionKind !== undefined && step.expectedQuestionKind !== null && !questionKinds.includes(step.expectedQuestionKind)) ||
                (step.forbiddenReply !== undefined && (!Array.isArray(step.forbiddenReply) || step.forbiddenReply.some(item => typeof item !== 'string' || !item))) ||
                (step.expectedUnsupported !== undefined && (typeof step.expectedUnsupported !== 'string' || !step.expectedUnsupported))) throw new Error('INVALID_SCENARIO_DEFINITIONS');
        }
    }
}
function totals(scenarios) {
    return { scenariosPassed: scenarios.filter(item => item.status === 'PASS').length,
        scenariosFailed: scenarios.filter(item => item.status === 'FAIL').length,
        turnsExecuted: scenarios.reduce((sum, item) => sum + item.turns.length, 0),
        turnsSkipped: scenarios.reduce((sum, item) => sum + item.skippedTurns, 0),
        assertionsPassed: scenarios.reduce((sum, item) => sum + item.totals.assertionsPassed, 0),
        assertionsFailed: scenarios.reduce((sum, item) => sum + item.totals.assertionsFailed, 0),
        committedCalls: scenarios.reduce((sum, item) => sum + item.committedCalls, 0) };
}
async function main() {
    if (!process.argv.includes('--live')) {
        console.error('Opt-in required: node scripts/verify-dish-scenarios.mjs --live [--scenario=id] [--limit=N] [--concurrency=1|2]. Uses real provider calls, synthetic owners and no purchase commands.');
        process.exitCode = 1; return;
    }
    const config = options();
    const base = new URL(process.env.IBYARA_TEST_ORIGIN ?? 'http://127.0.0.1:4173');
    if (!['localhost', '127.0.0.1'].includes(base.hostname) || !['http:', 'https:'].includes(base.protocol) ||
        ['5173', '5174'].includes(base.port) || base.username || base.password || base.search || base.hash || base.pathname !== '/')
        throw new Error('INVALID_LOCAL_WORKER_ORIGIN');
    const { scenarios } = await import('./dish-scenarios.mjs');
    validateDefinitions(scenarios);
    let selected = config.scenario ? scenarios.filter(item => item.id === config.scenario) : scenarios;
    if (!selected.length) throw new Error('SCENARIO_NOT_FOUND');
    if (config.limit !== null) selected = selected.slice(0, config.limit);
    const fullRun = config.scenario === null && config.limit === null;
    const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}_${randomUUID().slice(0, 8)}`;
    const root = new URL('../outputs/dish-scenarios/', import.meta.url);
    const directory = new URL(`${fullRun ? 'full' : 'targeted'}-${runId}/`, root);
    await mkdir(directory, { recursive: true });
    const report = { status: 'RUNNING', runId, startedAt: new Date().toISOString(), origin: base.origin,
        realProvider: true, credentialsRead: false, purchaseCommandsSent: 0, syntheticOwners: true,
        concurrency: config.concurrency, maxCommittedCallsPerOwner: MAX_CALLS_PER_OWNER,
        automaticHttpRetries: 0, formatRepair: 'Backend only, at most one repair per turn.',
        accounting: 'Committed calls only; failed provider attempts may incur additional uncommitted usage.',
        fullRun, plannedScenarios: selected.length, plannedTurns: selected.reduce((sum, item) => sum + item.steps.length, 0), scenarios: [] };
    await save(new URL('report.json', directory), report);
    for (let offset = 0; offset < selected.length; offset += config.concurrency) {
        const batch = await Promise.all(selected.slice(offset, offset + config.concurrency).map(async definition => {
            let scenario;
            try { scenario = await runCase(base, definition); }
            catch {
                scenario = { id: definition.id, dish: definition.dish, status: 'FAIL', aborted: true,
                    error: 'HARNESS_OR_CONTRACT_ERROR', turns: [], checks: [], probes: [], committedCalls: 0,
                    skippedTurns: definition.steps.length, totals: { assertionsPassed: 0, assertionsFailed: 1 } };
            }
            await save(new URL(`${definition.id}.json`, directory), scenario);
            console.log(`${scenario.status} ${definition.id}: ${scenario.turns.length}/${definition.steps.length} turns; ${scenario.totals.assertionsPassed} checks passed, ${scenario.totals.assertionsFailed} failed`);
            return scenario;
        }));
        report.scenarios.push(...batch);
        report.totals = totals(report.scenarios);
        await save(new URL('report.json', directory), report);
    }
    report.completedAt = new Date().toISOString();
    report.status = report.totals.scenariosFailed ? 'FAIL' : 'PASS';
    await save(new URL('report.json', directory), report);
    if (fullRun) await save(new URL('latest-full.json', root), report);
    console.log(`${report.status} TOTAL ${JSON.stringify(report.totals)}; report: ${fileURLToPath(new URL('report.json', directory))}`);
    if (report.status === 'FAIL') process.exitCode = 1;
}

await main().catch(() => {
    console.error('FAIL: invalid configuration/scenarios or unable to complete the run. No raw exception, provider response, environment or credentials were logged.');
    process.exitCode = 1;
});
