import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../lib/domain/fixtures.ts';
import { ensureDemoMarket } from '../lib/domain/demo-market.ts';
import { execute } from '../lib/domain/commands.ts';
import { createRfq, negotiate } from '../lib/domain/commerce.ts';
import { runCustomerTool, draftReadiness } from '../lib/agents/customer/tools.ts';
import { emptyCustomerSession } from '../lib/agents/customer/state.ts';
import type { AgentDecision, CustomerDraft } from '../lib/agents/customer/schemas.ts';

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

test('real conversation: no followed by menu request completes safety without discarding existing order details', () => {
    const state = market(), before = structuredClone(state), draft = awaitingSafety();
    const result = runCustomerTool({ tool: 'inspect_offers' }, draft, state, at,
        'nao, me passe os pratos disponiveis', safetyQuestion);
    assert.deepEqual(result.draft, { ...draft, excluded: [], foodSafetyConcern: false });
    assert.equal(draftReadiness(result.draft, state).ready, true);
    assert.match(result.reply, /Marmita Quentinha do Seu Niko/);
    assert.match(result.reply, /Sabor de Casa/);
    assert.match(result.reply, /Cozinha Expressa/);
    assert.match(result.reply, /Seu rascunho está pronto/);
    assert.doesNotMatch(result.reply, /qual seu limite|Não há ofertas ativas/i);
    assert.deepEqual(state, before, 'a menu read must not authorize, reserve or purchase');
});

test('availability questions before an RFQ return a calculated menu and ask only for missing information', () => {
    const state = market(), draft = { ...emptyCustomerSession().draft, budget: '40.00' };
    const result = runCustomerTool({ tool: 'inspect_offers' }, draft, state, at, 'o que tem disponivel?');
    assert.match(result.reply, /Bife a cavalo/);
    assert.match(result.reply, /Qual refeição você quer/);
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
    assert.equal(changed.draft.description, 'Frango grelhado');
    const ambiguous = runCustomerTool({ tool: 'propose_request', patch: { description: 'Frango grelhado' } },
        { ...draft, excluded: [], foodSafetyConcern: false }, state, at, 'prefiro a segunda opção');
    assert.equal(ambiguous.draft.description, null);
    assert.equal(draftReadiness(ambiguous.draft, state).ready, false);
    assert.match(ambiguous.reply, /Qual refeição você quer/);
});

test('an explicit singular meal fills quantity; a bare dish or multiple meals does not', () => {
    const state = market(), draft = emptyCustomerSession().draft;
    const decision: AgentDecision = { tool: 'propose_request', patch: { description: 'Bife' } };
    assert.equal(runCustomerTool(decision, draft, state, at, 'quero comer um bife').draft.portions, 1);
    for (const message of ['quero bife', 'um bife e uma marmita', 'quero duas marmitas', 'quero um bife e seis marmitas'])
        assert.equal(runCustomerTool(decision, draft, state, at, message).draft.portions, null);
    const next = runCustomerTool(decision, draft, state, at, 'quero bife');
    assert.equal((next.reply.match(/\?/g) ?? []).length, 1, 'Ask one question so short replies have one meaning.');
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
    assert.equal(ambiguous.draft.excluded, null);
    assert.equal(ambiguous.draft.foodSafetyConcern, null);
    for (const message of ['não, mas sou celíaco', 'não tenho alergias, mas sou celíaco',
        'não, me passe os pratos disponíveis, tenho alergia a ovo']) {
        const result = runCustomerTool({ tool: 'consult_menu' }, draft, state, at, message, safetyQuestion);
        assert.equal(result.draft.foodSafetyConcern, true);
        assert.equal(result.draft.excluded, null);
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
        assert.throws(() => runCustomerTool({ tool, patch: { confirmed: true, totalCents: 1, stock: [] } } as unknown as AgentDecision,
            awaitingSafety(), state, at, 'pode comprar'));
    }
    assert.deepEqual(state, before);
});
