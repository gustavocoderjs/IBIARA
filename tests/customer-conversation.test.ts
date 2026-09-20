import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../lib/domain/fixtures.ts';
import { ensureDemoMarket } from '../lib/domain/demo-market.ts';
import { execute } from '../lib/domain/commands.ts';
import { createRfq, negotiate } from '../lib/domain/commerce.ts';
import { runCustomerTool, draftReadiness } from '../lib/agents/customer/tools.ts';
import { emptyCustomerSession } from '../lib/agents/customer/state.ts';
import { agentDecisionSchema, type AgentDecision, type CustomerDraft } from '../lib/agents/customer/schemas.ts';
import { publicMenu } from '../lib/agents/customer/menu.ts';

const at = '2026-09-20T15:00:00.000Z';
const safetyQuestion = 'Há ingredientes a excluir, alergias ou risco de contaminação cruzada?';
function market() {
    const state = initialState('conversation-test', at);
    ensureDemoMarket(state, at);
    return state;
}
function awaitingSafety(): CustomerDraft {
    return { ...emptyCustomerSession().draft, description: 'Bife a cavalo', budget: '40.00',
        maxMinutes: 50, portions: 1, zone: 'demo_butanta' };
}
function assertShortMenu(reply: string, state: ReturnType<typeof market>) {
    const menu = publicMenu(state, at);
    const options = reply.split('\n').filter(line => menu.some(item =>
        line.includes(item.restaurantName) && line.includes(item.name)));
    assert.ok(options.length > 0 && options.length <= 3,
        `Discovery should present one to three real options; received ${options.length}.`);
}

test('real conversation: no followed by menu request completes safety without discarding existing order details', () => {
    const state = market(), before = structuredClone(state), draft = awaitingSafety();
    const result = runCustomerTool({ tool: 'inspect_offers' }, draft, state, at,
        'nao, me passe os pratos disponiveis', safetyQuestion);
    assert.deepEqual(result.draft, { ...draft, excluded: [], foodSafetyConcern: false });
    assert.equal(draftReadiness(result.draft, state).ready, true);
    assertShortMenu(result.reply, state);
    assert.match(result.reply, /Seu rascunho está pronto/);
    assert.doesNotMatch(result.reply, /qual seu limite|Não há ofertas ativas/i);
    assert.deepEqual(state, before, 'a menu read must not authorize, reserve or purchase');
});

test('availability questions before an RFQ return a calculated menu and ask only for missing information', () => {
    const state = market(), draft = { ...emptyCustomerSession().draft, budget: '40.00' };
    const result = runCustomerTool({ tool: 'inspect_offers' }, draft, state, at, 'o que tem disponivel?');
    assertShortMenu(result.reply, state);
    assert.match(result.reply, /(?:qual|escolh).*(?:refei|prato|opç)|(?:refei|prato|opç).*(?:prefere|escolh)/i);
    assert.doesNotMatch(result.reply, /qual seu limite|Não há ofertas ativas/i);
    assert.equal(result.draft.budget, '40.00');
    assert.equal(result.draft.excluded, null);
    assert.equal(result.draft.foodSafetyConcern, null);
    assert.equal(result.offers.length, 0);
    assert.equal(state.orders.length, 0);
});

test('a short no also answers the single safety question following a menu', () => {
    const state = market(), draft = awaitingSafety();
    const menu = runCustomerTool({ tool: 'consult_menu' }, draft, state, at, 'cardápio');
    const result = runCustomerTool({ tool: 'propose_request', patch: {} }, draft, state, at, 'não', menu.reply);
    assert.equal(draftReadiness(result.draft, state).ready, true);
    const ambiguous = runCustomerTool({ tool: 'consult_menu' }, { ...draft, portions: null }, state, at, 'cardápio');
    const unchanged = runCustomerTool({ tool: 'propose_request', patch: {} }, draft, state, at, 'não', ambiguous.reply);
    assert.equal(unchanged.draft.foodSafetyConcern, null, 'No cannot answer multiple distinct questions silently.');
});

test('menu-only queries ignore accidental rewrites and region corrections cannot rename an existing dish', () => {
    const state = market(), draft = awaitingSafety();
    const menu = runCustomerTool({ tool: 'consult_menu', patch: { zone: 'other', description: 'Bife', budget: '1' } },
        draft, state, at, 'nao, me passe os pratos disponiveis', safetyQuestion);
    assert.equal(menu.draft.zone, draft.zone);
    assert.equal(menu.draft.description, draft.description);
    assert.equal(menu.draft.budget, draft.budget);
    const region = runCustomerTool({ tool: 'propose_request', patch: { zone: 'demo_butanta', description: 'Bife', portions: null, budget: null } },
        { ...draft, zone: 'other' }, state, at, 'entao sera no butata');
    assert.equal(region.draft.description, draft.description);
    assert.equal(region.draft.zone, 'demo_butanta');
    assert.equal(region.draft.portions, 1);
    assert.equal(region.draft.budget, '40.00');
    const cleared = runCustomerTool({ tool: 'propose_request', patch: { budget: null } }, draft, state, at, 'apague o orçamento');
    assert.equal(cleared.draft.budget, null);
    const changed = runCustomerTool({ tool: 'propose_request', patch: { description: 'Frango grelhado' } },
        draft, state, at, 'prefiro frango grelhado');
    assert.match(changed.draft.description ?? '', /^Frango grelhado(?: com arroz e feijão)?$/);
    const ambiguous = runCustomerTool({ tool: 'propose_request', patch: { description: 'Frango grelhado' } },
        { ...draft, excluded: [], foodSafetyConcern: false }, state, at, 'prefiro a segunda opção');
    assert.equal(ambiguous.draft.description, null);
    assert.equal(draftReadiness(ambiguous.draft, state).ready, false);
    assert.match(ambiguous.reply, /(?:qual|escolh).*(?:refei|prato|opç)|(?:refei|prato|opç).*(?:prefere|escolh)/i);
});

test('quantity requires explicit, affirmative and unambiguous wording', () => {
    const state = market(), draft = emptyCustomerSession().draft;
    const decision: AgentDecision = { tool: 'propose_request', patch: { description: 'Bife' } };
    assert.equal(runCustomerTool(decision, draft, state, at, 'quero comer um bife').draft.portions, 1);
    for (const message of ['quero bife', 'um bife e uma marmita', 'quero um bife e seis marmitas',
        'Ainda não escolhi um prato', 'Não quero uma porção'])
        assert.equal(runCustomerTool(decision, draft, state, at, message).draft.portions, null, message);
    const multiple = runCustomerTool(decision, draft, state, at, 'quero duas marmitas');
    assert.equal(multiple.draft.portions, 2, 'The one-portion demo cannot silently rewrite an explicit quantity.');
    assert.equal(draftReadiness(multiple.draft, state).ready, false);
    const next = runCustomerTool(decision, draft, state, at, 'quero bife');
    assert.equal((next.reply.match(/\?/g) ?? []).length, 1, 'Ask one question so short replies have one meaning.');
});

test('qualitative requests cannot accept invented commercial values from a model patch', () => {
    const state = market(), before = structuredClone(state);
    const invented: AgentDecision = { tool: 'propose_request', patch: {
        description: 'Omelete de legumes com arroz', budget: '40.00', portions: 1,
        maxMinutes: 25, zone: 'demo_butanta', excluded: [], foodSafetyConcern: false,
    } };
    for (const message of ['Quero algo com ovo e leve', 'Pouco', 'Rápido']) {
        const result = runCustomerTool(invented, emptyCustomerSession().draft, state, at, message);
        for (const field of ['description', 'budget', 'portions', 'maxMinutes', 'zone', 'excluded', 'foodSafetyConcern'] as const)
            assert.equal(result.draft[field], null, `${message}: ${field} must not come from the model's guess.`);
        assert.equal(draftReadiness(result.draft, state).ready, false);
    }
    assert.deepEqual(state, before, 'Discovery must not mutate stock, mandates or orders.');
});

test('menu consultation applies a validated partial patch before presenting the next step', () => {
    const state = market(), draft = awaitingSafety();
    const decision = { tool: 'consult_menu', patch: { budget: '45.00', excluded: [], foodSafetyConcern: false } } as AgentDecision;
    const result = runCustomerTool(decision, draft, state, at, 'até 45 reais, sem alergias e nenhum ingrediente a excluir; mostre o cardápio');
    assert.equal(result.draft.budget, '45.00');
    assert.equal(result.draft.description, draft.description);
    assert.equal(draftReadiness(result.draft, state).ready, true);
    assert.match(result.reply, /Seu rascunho está pronto/);
    assert.equal(draft.budget, '40.00', 'the prior draft remains unchanged');
});

test('a short negative clears safety only in the exact question context and never across qualifications', () => {
    const state = market(), draft = awaitingSafety();
    const unrelated = runCustomerTool({ tool: 'propose_request', patch: {} }, draft, state, at,
        'não', 'A entrega será no Butantã?');
    assert.equal(unrelated.draft.excluded, null);
    assert.equal(unrelated.draft.foodSafetyConcern, null);
    const ambiguous = runCustomerTool({ tool: 'consult_menu' }, draft, state, at,
        'não me passe pratos com queijo', safetyQuestion);
    assert.deepEqual(ambiguous.draft.excluded, ['queijo'], 'An explicit ingredient exclusion is distinct from denying all restrictions.');
    assert.equal(ambiguous.draft.foodSafetyConcern, null);
    for (const message of ['não, mas sou celíaco', 'não tenho alergias, mas sou celíaco',
        'não, me passe os pratos disponíveis, tenho alergia a ovo']) {
        const result = runCustomerTool({ tool: 'consult_menu' }, draft, state, at, message, safetyQuestion);
        assert.equal(result.draft.foodSafetyConcern, true);
        assert.notDeepEqual(result.draft.excluded, [], 'A qualified negative must not silently declare no exclusions.');
        assert.equal(draftReadiness(result.draft, state).ready, false);
    }
});

test('active quote inspection still returns offers; closed or revoked searches return the menu', () => {
    const state = market(), draft = awaitingSafety();
    const m = execute(state, { type: 'mandate', scope: 'buyer', description: 'Bife a cavalo',
        maxCents: 4000, maxMinutes: 50, zone: 'demo_butanta', excluded: [], confirmed: true }, at) as { mandateId: string };
    const q = createRfq(state, m.mandateId, at);
    const active = runCustomerTool({ tool: 'inspect_offers' }, draft, state, at, 'quais propostas recebi?');
    assert.equal(active.offers.length, 3);
    assert.match(active.reply, /Oferta offer_/);
    state.mandates[0].revoked = true;
    const revoked = runCustomerTool({ tool: 'inspect_offers' }, draft, state, at, 'o que está disponível?');
    assert.equal(revoked.offers.length, 0);
    assert.match(revoked.reply, /Cardápio simulado/);
    state.mandates[0].revoked = false;
    negotiate(state, q.rfqId, at);
    const before = structuredClone(state);
    const closed = runCustomerTool({ tool: 'inspect_offers' }, draft, state, at, 'o que está disponível?');
    assert.equal(closed.offers.length, 0);
    assert.match(closed.reply, /Cardápio simulado/);
    assert.deepEqual(state, before);
});

test('read-only tools cannot smuggle purchase authority or arbitrary stock fields in a patch', () => {
    const state = market(), before = structuredClone(state);
    for (const tool of ['consult_menu', 'inspect_offers']) {
        const forged = { tool, patch: { confirmed: true, totalCents: 1, stock: [] } };
        assert.equal(agentDecisionSchema.safeParse(forged).success, false,
            'External model decisions must be rejected before tool execution.');
        const result = runCustomerTool(forged as unknown as AgentDecision, awaitingSafety(), state, at, 'pode comprar');
        for (const field of ['confirmed', 'totalCents', 'stock']) assert.equal(field in result.draft, false);
        assert.deepEqual(result.draft, awaitingSafety(), 'Even an internal invalid call cannot smuggle state into the draft.');
    }
    assert.deepEqual(state, before);
});
