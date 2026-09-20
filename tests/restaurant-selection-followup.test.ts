import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../lib/domain/fixtures.ts';
import { ensureDemoMarket } from '../lib/domain/demo-market.ts';
import { emptyCustomerSession } from '../lib/agents/customer/state.ts';
import { runCustomerTool, draftReadiness } from '../lib/agents/customer/tools.ts';
import { publicMenu } from '../lib/agents/customer/menu.ts';
import { restaurantRecommendations } from '../lib/agents/customer/restaurants.ts';
import type { CustomerDraft, AgentDecision } from '../lib/agents/customer/schemas.ts';

const at = '2026-09-20T12:00:00.000Z';
function scenario(patch: Partial<CustomerDraft> = {}) {
    const state = initialState('restaurant-selection-followup', at);
    ensureDemoMarket(state, at);
    const session = emptyCustomerSession();
    session.draft = { ...session.draft, description: 'Bife a cavalo', restaurantId: 'casa',
        deliveryPointId: 'usp', zone: 'demo_butanta', budget: '50.00', portions: 1,
        maxMinutes: 40, excluded: [], foodSafetyConcern: false, ...patch };
    return { state, session };
}

test('negating a restaurant change preserves the chosen restaurant and ready meal', () => {
    for (const message of ['Não quero trocar de restaurante.', 'Não quero qualquer restaurante, só o Sabor de Casa.',
        'Não quero outro restaurante.', 'Não prefiro Niko.']) {
        const { state, session } = scenario();
        const result = runCustomerTool({ tool: 'propose_request', patch: {} }, session.draft, state, at, message, undefined, session);
        assert.deepEqual(result.draft, session.draft, message);
        assert.equal(draftReadiness(result.draft, state).ready, true, message);
    }
});

test('refusing a restaurant change confirms the choice instead of opening another model-selected list', () => {
    const decisions: AgentDecision[] = [{ tool: 'discover_restaurants' }, { tool: 'propose_request', patch: {} }, { tool: 'consult_menu' }];
    for (const decision of decisions) {
        for (const message of ['Não quero trocar de restaurante.', 'Não quero outro restaurante. Meu orçamento agora é 60 reais.']) {
            const { state, session } = scenario();
            const result = runCustomerTool(decision, session.draft, state, at, message, undefined, session);
            assert.equal(result.draft.restaurantId, 'casa');
            assert.equal(result.draft.description, 'Bife a cavalo');
            assert.equal(result.draft.budget, message.includes('60') ? '60.00' : '50.00');
            assert.equal(draftReadiness(result.draft, state).ready, true);
            assert.match(result.reply, /Mantenho Sabor de Casa como sua escolha/);
            assert.match(result.reply, /rascunho está pronto/);
            assert.doesNotMatch(result.reply, /Qual restaurante|Restaurantes compatíveis|1\./);
            assert.equal(result.question, null);
        }
    }
});

test('affirmative restaurant clearing and replacements still work in clause order', () => {
    for (const [message, expected] of [
        ['Quero qualquer restaurante.', null],
        ['Quero trocar de restaurante.', null],
        ['Quero qualquer restaurante, mas prefiro Niko.', 'niko'],
        ['Prefiro Niko, mas pode ser qualquer restaurante.', null],
        ['Não quero trocar de restaurante, mas agora prefiro Niko.', 'niko'],
    ] as const) {
        const { state, session } = scenario();
        const result = runCustomerTool({ tool: 'propose_request', patch: {} }, session.draft, state, at, message, undefined, session);
        assert.equal(result.draft.restaurantId, expected, message);
        assert.equal(result.draft.description, 'Bife a cavalo', message);
        assert.equal(result.draft.budget, '50.00', message);
    }
});

test('negative change verbs never select the named alternative or clear the current meal', () => {
    for (const message of ['Não troque para a Cozinha Expressa.', 'Não mude para o Seu Niko.',
        'Não prefiro Niko.', 'Não escolha a Cozinha Expressa.', 'Não quero o Seu Niko.']) {
        const { state, session } = scenario();
        const result = runCustomerTool({ tool: 'discover_restaurants', patch: { restaurantId: 'panela' } }, session.draft, state, at, message, undefined, session);
        assert.deepEqual(result.draft, session.draft, message);
        assert.match(result.reply, /Mantenho Sabor de Casa/, message);
        assert.doesNotMatch(result.reply, /Qual restaurante|Restaurantes compatíveis/, message);
    }
});

test('alternative restaurant names ask for a decision without selecting the last name or erasing a ready draft', () => {
    for (const restaurantId of ['niko', null] as const) {
        const { state, session } = scenario({ restaurantId });
        const result = runCustomerTool({ tool: 'propose_request', patch: { restaurantId: 'panela' } }, session.draft, state, at,
            'Quero Sabor de Casa ou Cozinha Expressa.', undefined, session);
        assert.deepEqual(result.draft, session.draft);
        assert.equal(result.question?.kind, 'restaurant_choice');
        assert.match(result.reply, /Qual restaurante você prefere/);
    }
});

test('restaurant suggestions for an already selected dish include only kitchens selling that dish', () => {
    const { state, session } = scenario({ description: 'Omelete de legumes com arroz', restaurantId: null });
    const result = runCustomerTool({ tool: 'discover_restaurants' }, session.draft, state, at,
        'Quais restaurantes têm esse prato?', undefined, session);
    assert.deepEqual(result.discovery.restaurantChoices?.map(choice => choice.restaurantId), ['niko']);
    assert.match(result.reply, /Omelete de legumes com arroz/);
    assert.doesNotMatch(result.reply, /Sabor de Casa|Cozinha Expressa|Bife a cavalo/);
    assert.deepEqual(result.draft, session.draft);
    assert.equal(draftReadiness(result.draft, state).ready, true);
});

test('dish-specific recommendations keep coverage, price and availability filters', () => {
    for (const cause of ['budget', 'stock', 'coverage']) {
        const { state, session } = scenario({ description: 'Omelete de legumes com arroz', restaurantId: null });
        if (cause === 'budget') session.draft.budget = '30.00';
        else if (cause === 'stock') state.restaurants.find(restaurant => restaurant.id === 'niko')!.stock.find(item => item.id === 'ovo')!.quantity = '0';
        else { session.draft.description = 'Omelete com tomate e arroz'; session.draft.deliveryPointId = 'vila_indiana'; }
        const candidates = restaurantRecommendations(publicMenu(state, at), session.draft, session.discovery!);
        assert.deepEqual(candidates, [], cause);
    }
});

test('information and explanation about alternatives never replace a complete purchase draft', () => {
    const { state, session } = scenario();
    const listed = runCustomerTool({ tool: 'discover_restaurants' }, session.draft, state, at,
        'Compare restaurantes para a mesma refeição.', undefined, session);
    assert.deepEqual(listed.draft, session.draft);
    assert.equal(draftReadiness(listed.draft, state).ready, true);
    assert.ok(listed.discovery.restaurantChoices!.length > 1);
    const explained = runCustomerTool({ tool: 'explain_question' }, listed.draft, state, at,
        'Como assim?', listed.reply, listed);
    assert.deepEqual(explained.draft, session.draft);
    assert.equal(draftReadiness(explained.draft, state).ready, true);
});
