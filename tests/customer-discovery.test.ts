import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../lib/domain/fixtures.ts';
import { ensureDemoMarket } from '../lib/domain/demo-market.ts';
import { publicMenu } from '../lib/agents/customer/menu.ts';
import { runCustomerTool, draftReadiness } from '../lib/agents/customer/tools.ts';
import { emptyCustomerSession } from '../lib/agents/customer/state.ts';
import type { AgentDecision, CustomerDiscovery, CustomerDraft } from '../lib/agents/customer/schemas.ts';

const at = '2026-09-20T15:00:00.000Z';
const invented: AgentDecision = { tool: 'propose_request', patch: {
    description: 'Omelete de legumes com arroz', budget: '30.00', portions: 1,
    maxMinutes: 25, zone: 'demo_butanta', excluded: [], foodSafetyConcern: false,
} };
const neutral: AgentDecision = { tool: 'propose_request', patch: {} };
const fullRequest = 'Quero uma porção de Bife a cavalo, até 45 reais no total, entrega no Butantã em até 40 minutos. Não tenho alergias e nenhum ingrediente para excluir.';

function conversation() {
    const state = initialState('deterministic-discovery', at);
    ensureDemoMarket(state, at);
    let draft = emptyCustomerSession().draft;
    let lastReply: string | undefined;
    let context: { discovery?: CustomerDiscovery; pendingQuestion?: keyof CustomerDraft | null } = {};
    return {
        state,
        send(message: string, decision: AgentDecision = invented) {
            const result = runCustomerTool(decision, draft, state, at, message, lastReply, context);
            draft = result.draft; lastReply = result.reply;
            context = { discovery: result.discovery, pendingQuestion: result.pendingQuestion };
            return result;
        },
    };
}
function noInventedLimits(draft: CustomerDraft) {
    for (const field of ['budget', 'portions', 'maxMinutes', 'zone', 'excluded', 'foodSafetyConcern'] as const)
        assert.equal(draft[field], null, `${field} requires an explicit customer statement.`);
}
function choiceKeys(discovery: CustomerDiscovery) {
    return discovery.choices.map(choice => `${choice.restaurantId}/${choice.menuItemId}`);
}

test('egg then light, little and fast keeps discovery separate until an actual dish is chosen', () => {
    const flow = conversation(), before = structuredClone(flow.state);
    let result = flow.send('Quero algo com ovo.');
    assert.equal(result.draft.description, null);
    assert.ok(result.discovery.ingredientIds.includes('ovo'));
    assert.ok(result.discovery.choices.length > 0 && result.discovery.choices.length <= 3);
    for (const message of ['Leve.', 'Pouco.', 'Rápido.']) {
        result = flow.send(message);
        noInventedLimits(result.draft);
        assert.equal(result.draft.description, null);
        assert.ok(result.discovery.ingredientIds.includes('ovo'));
        assert.equal(draftReadiness(result.draft, flow.state).ready, false);
    }
    assert.deepEqual(new Set(result.discovery.preferences), new Set(['leve', 'pouco', 'rapido']));
    assert.equal(result.pendingQuestion, 'maxMinutes');
    result = flow.send('Quero a Omelete de legumes com arroz.');
    assert.equal(result.draft.description, 'Omelete de legumes com arroz');
    noInventedLimits(result.draft);
    assert.equal(result.pendingQuestion, 'budget');
    assert.deepEqual(flow.state, before, 'Conversation cannot mutate the market or authorize a purchase.');
});

test('changing the meal leaves explicit limits intact and an unresolved change invalidates the previous choice', () => {
    const flow = conversation();
    const first = flow.send(fullRequest, neutral);
    assert.equal(draftReadiness(first.draft, flow.state).ready, true);
    const changing = flow.send('Quero outra coisa.', neutral);
    assert.equal(changing.draft.description, null);
    assert.equal(draftReadiness(changing.draft, flow.state).ready, false);
    assert.deepEqual({ ...changing.draft, description: first.draft.description }, first.draft);
    const changed = flow.send('Troque por Frango grelhado com arroz e feijão.', neutral);
    assert.equal(changed.draft.description, 'Frango grelhado com arroz e feijão');
    assert.deepEqual({ ...changed.draft, description: first.draft.description }, first.draft);
    assert.equal(draftReadiness(changed.draft, flow.state).ready, true);
});

test('an explicit change of mind cannot leave the previously complete meal ready for review', () => {
    const flow = conversation();
    const before = flow.send(fullRequest, neutral);
    const changed = flow.send('Mudei de ideia, quero escolher outra refeição.', neutral);
    assert.equal(changed.draft.description, null);
    assert.equal(draftReadiness(changed.draft, flow.state).ready, false);
    assert.deepEqual({ ...changed.draft, description: before.draft.description }, before.draft);
});

test('negating the old dish in one clause does not negate the explicitly chosen replacement', () => {
    const flow = conversation();
    flow.send(fullRequest, neutral);
    const changed = flow.send('Não quero Bife a cavalo, prefiro Frango grelhado com arroz e feijão.', neutral);
    assert.equal(changed.draft.description, 'Frango grelhado com arroz e feijão');
    assert.equal(changed.draft.budget, '45.00');
    assert.equal(changed.draft.maxMinutes, 40);
    assert.equal(changed.draft.zone, 'demo_butanta');
});

test('a short dish name replaces a previous complete choice without requiring a verb or model naming format', () => {
    const flow = conversation();
    const before = flow.send(fullRequest, neutral);
    const changed = flow.send('frango grelhado', neutral);
    assert.equal(changed.draft.description, 'Frango grelhado com arroz e feijão');
    assert.deepEqual({ ...changed.draft, description: before.draft.description }, before.draft);
    const beef = flow.send('quero comer bife', { tool: 'propose_request', patch: { description: 'Bife a cavalo' } });
    assert.equal(beef.draft.description, 'Bife a cavalo');
});

test('rejecting the selected dish invalidates readiness and never becomes an ingredient exclusion', () => {
    for (const message of ['Não quero mais Bife a cavalo.', 'Não quero bife.']) {
        const flow = conversation();
        const before = flow.send(fullRequest, neutral);
        const rejected = flow.send(message, { tool: 'propose_request', patch: { description: 'Bife a cavalo' } });
        assert.equal(rejected.draft.description, null, message);
        assert.equal(draftReadiness(rejected.draft, flow.state).ready, false, message);
        assert.deepEqual(rejected.draft.excluded, before.draft.excluded, message);
        assert.equal(rejected.draft.budget, before.draft.budget, message);
    }
});

test('an ordinal selects from the last displayed page instead of the first page or the global catalog', () => {
    const flow = conversation();
    const first = flow.send('Me passe os pratos disponíveis.', neutral);
    assert.equal(first.discovery.choices.length, 3);
    const second = flow.send('Mais opções.', neutral);
    assert.equal(second.discovery.choices.length, 3);
    assert.ok(choiceKeys(second.discovery).every(key => !choiceKeys(first.discovery).includes(key)));
    const expected = second.discovery.choices[1];
    const selected = flow.send('A segunda.', neutral);
    assert.equal(selected.draft.description, expected.name);
    assert.notEqual(selected.draft.description, first.discovery.choices[1].name);
    noInventedLimits(selected.draft);
});

test('a displayed option number cannot become money when the outstanding draft field is budget', () => {
    const flow = conversation();
    const draft = flow.send('Quero uma porção de Bife a cavalo, entrega no Butantã em até 40 minutos. Não tenho alergias e nenhum ingrediente para excluir.', neutral);
    assert.equal(draft.pendingQuestion, 'budget');
    assert.equal(draft.draft.budget, null);
    const listed = flow.send('Me passe os pratos disponíveis.', neutral);
    assert.ok(listed.discovery.choices.length >= 2);
    const expected = listed.discovery.choices[1];
    const selected = flow.send('2', { tool: 'propose_request', patch: { budget: '2.00' } });
    assert.equal(selected.draft.description, expected.name);
    assert.equal(selected.draft.budget, null, '2 references the last menu option, not an authorization to spend R$2.');
    assert.equal(selected.draft.portions, 1);
    assert.equal(selected.draft.maxMinutes, 40);
    assert.equal(draftReadiness(selected.draft, flow.state).ready, false);
});

test('missing or out-of-range ordinal never selects a model suggestion', () => {
    const fresh = conversation();
    const absent = fresh.send('A segunda.');
    assert.equal(absent.draft.description, null);
    noInventedLimits(absent.draft);
    assert.match(absent.reply, /nome do prato|lista atual|identificar/i);
    const filtered = conversation();
    const listed = filtered.send('Quero algo com ovo e abobrinha.', neutral);
    assert.equal(listed.discovery.choices.length, 1);
    assert.equal(listed.discovery.choices[0].menuItemId, 'demo_niko_omelete_legumes');
    const missing = filtered.send('A terceira.', neutral);
    assert.equal(missing.draft.description, null);
    assert.equal(draftReadiness(missing.draft, filtered.state).ready, false);
});

test('more choices preserve ingredient filters and do not repeat a page while further dishes remain', () => {
    const flow = conversation();
    const first = flow.send('Quero algo com frango.', neutral);
    assert.ok(first.discovery.choices.length > 0 && first.discovery.choices.length <= 3);
    const more = flow.send('Mais opções.', neutral);
    assert.ok(more.discovery.choices.length > 0 && more.discovery.choices.length <= 3);
    assert.deepEqual(more.discovery.ingredientIds, ['frango']);
    assert.ok(choiceKeys(more.discovery).every(key => !choiceKeys(first.discovery).includes(key)));
    const menu = publicMenu(flow.state, at);
    for (const choice of more.discovery.choices) {
        const item = menu.find(item => item.restaurantId === choice.restaurantId && item.menuItemId === choice.menuItemId);
        assert.ok(item?.available && item.ingredientIds.includes('frango'));
    }
    assert.equal(more.draft.description, null);
    noInventedLimits(more.draft);
});

test('ingredient exclusions refresh discovery without silently removing wanted ingredients', () => {
    const flow = conversation();
    flow.send('Quero algo com ovo.', neutral);
    const withoutCheese = flow.send('Sem queijo.', neutral);
    assert.deepEqual(withoutCheese.draft.excluded, ['queijo']);
    assert.deepEqual(withoutCheese.discovery.ingredientIds, ['ovo']);
    assert.ok(withoutCheese.discovery.choices.length > 0);
    const menu = publicMenu(flow.state, at);
    for (const choice of withoutCheese.discovery.choices) {
        const item = menu.find(item => item.restaurantId === choice.restaurantId && item.menuItemId === choice.menuItemId);
        assert.ok(item);
        assert.ok(item.ingredientIds.includes('ovo'));
        assert.equal(item.ingredientIds.includes('queijo'), false);
    }
    const conflicting = flow.send('Sem ovo também.', neutral);
    assert.ok(conflicting.draft.excluded?.includes('ovo'));
    assert.deepEqual(conflicting.discovery.ingredientIds, ['ovo'], 'Do not silently drop the earlier positive preference.');
    assert.equal(conflicting.discovery.choices.length, 0);
    assert.equal(conflicting.draft.description, null);
    assert.match(conflicting.reply, /não encontrei|nenhuma opção/i);
});

test('structured pending question governs a short no independently from the wording of the previous reply', () => {
    const { state } = conversation();
    const draft = { ...emptyCustomerSession().draft, description: 'Bife a cavalo', budget: '45.00',
        maxMinutes: 40, portions: 1, zone: null };
    const zone = runCustomerTool(neutral, draft, state, at, 'Não.', 'Texto público de uma lista antiga.', { pendingQuestion: 'zone' });
    assert.equal(zone.draft.zone, 'other');
    assert.equal(zone.draft.excluded, null);
    assert.equal(zone.draft.foodSafetyConcern, null);
    const safety = runCustomerTool(neutral, { ...draft, zone: 'demo_butanta' }, state, at,
        'Não.', 'Texto público de uma lista antiga.', { pendingQuestion: 'foodSafetyConcern' });
    assert.deepEqual(safety.draft.excluded, []);
    assert.equal(safety.draft.foodSafetyConcern, false);
    assert.equal(draftReadiness(safety.draft, state).ready, true);
});

test('a previously displayed option is checked against current availability before ordinal selection', () => {
    const flow = conversation();
    const first = flow.send('Quero algo com ovo e abobrinha.', neutral);
    const choice = first.discovery.choices[0];
    assert.ok(choice);
    const restaurant = flow.state.restaurants.find(item => item.id === choice.restaurantId)!;
    restaurant.stock.find(item => item.id === 'ovo')!.quantity = '0';
    const selected = flow.send('A primeira.', neutral);
    assert.equal(selected.draft.description, null);
    assert.equal(draftReadiness(selected.draft, flow.state).ready, false);
    assert.match(selected.reply, /não está disponível|não encontrei/i);
    assert.deepEqual(flow.state.orders, []);
    assert.deepEqual(flow.state.mandates, []);
    assert.deepEqual(flow.state.rfqs, []);
});
