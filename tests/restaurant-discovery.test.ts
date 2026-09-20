import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../lib/domain/fixtures.ts';
import { ensureDemoMarket } from '../lib/domain/demo-market.ts';
import { publicMenu } from '../lib/agents/customer/menu.ts';
import { runCustomerTool, draftReadiness } from '../lib/agents/customer/tools.ts';
import { emptyCustomerSession } from '../lib/agents/customer/state.ts';
import type { AgentDecision, CustomerDraft, CustomerSession } from '../lib/agents/customer/schemas.ts';

const at = '2026-09-20T15:00:00.000Z';
const neutral: AgentDecision = { tool: 'propose_request', patch: {} };
const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const complete = 'Quero uma porção de Bife a cavalo no Sabor de Casa, até R$ 45,00 no total, entrega no Butantã em até 40 minutos. Não tenho alergias e nenhum ingrediente para excluir.';

function conversation() {
    const state = initialState('restaurant-discovery-test', at);
    ensureDemoMarket(state, at);
    let draft = emptyCustomerSession().draft;
    let reply: string | undefined;
    let context: Pick<CustomerSession, 'discovery' | 'pendingQuestion' | 'question'> = {};
    return {
        state,
        send(message: string, decision: AgentDecision = neutral) {
            const result = runCustomerTool(decision, draft, state, at, message, reply, context);
            draft = result.draft;
            reply = result.reply;
            context = { discovery: result.discovery, pendingQuestion: result.pendingQuestion, question: result.question };
            return result;
        },
    };
}

function noUnstatedLimits(draft: CustomerDraft) {
    assert.equal(draft.budget, null);
    assert.equal(draft.maxMinutes, null);
    assert.equal(draft.foodSafetyConcern, null);
    assert.equal(draft.excluded, null);
}

test('the hungry customer reaches a reviewed dish and fixed restaurant without inventing numbers', () => {
    const flow = conversation(), untouched = structuredClone(flow.state);
    let result = flow.send('Quero um único prato, algo mais parrudo, estou com muita fome.');
    assert.equal(result.draft.description, null);
    assert.equal(result.draft.portions, 1);
    noUnstatedLimits(result.draft);
    result = flow.send('Quero carne vermelha, o que me recomenda? Qual o restaurante próximo melhor avaliado?');
    assert.equal(result.draft.description, null);
    assert.equal(result.draft.restaurantId ?? null, null);
    assert.equal(result.draft.deliveryPointId ?? null, null);
    assert.equal(result.draft.selectionPreference, 'BEST_RATED');
    assert.ok(result.discovery.ingredientIds.includes('patinho'));
    assert.equal(result.question?.kind, 'location');
    noUnstatedLimits(result.draft);
    const beforeExplanation = structuredClone(result.draft);
    const oldQuestion = result.question?.text;
    result = flow.send('Como assim?');
    assert.deepEqual(result.draft, beforeExplanation);
    assert.notEqual(result.reply, oldQuestion, 'An explanation must add useful context instead of repeating the question.');
    assert.match(normalize(result.reply), /local|bairro|ponto|entrega/);
    result = flow.send('Butantã.');
    assert.equal(result.draft.deliveryPointId, 'butanta_centro');
    assert.equal(result.discovery.choiceKind, 'restaurant');
    assert.ok(result.discovery.restaurantChoices?.length);
    assert.equal(result.discovery.restaurantChoices?.[0].restaurantId, 'casa');
    assert.match(normalize(result.reply), /simulad|fictici|demo/);
    assert.match(result.reply, /\bkm\b/i);
    result = flow.send('Quero o Sabor de Casa.');
    assert.equal(result.draft.restaurantId, 'casa');
    assert.equal(result.draft.description, null);
    result = flow.send('Bife a cavalo.');
    assert.equal(result.draft.description, 'Bife a cavalo');
    assert.equal(result.draft.restaurantId, 'casa');
    noUnstatedLimits(result.draft);
    result = flow.send('Uma porção, até R$ 45,00 com entrega em até 40 minutos. Não tenho alergias e nenhum ingrediente para excluir.');
    assert.equal(result.draft.budget, '45.00');
    assert.equal(result.draft.maxMinutes, 40);
    assert.equal(result.draft.portions, 1);
    assert.equal(result.draft.restaurantId, 'casa');
    assert.equal(result.draft.deliveryPointId, 'butanta_centro');
    assert.equal(result.draft.selectionPreference, 'BEST_RATED');
    assert.equal(draftReadiness(result.draft, flow.state).ready, true);
    assert.deepEqual(flow.state, untouched, 'Discovery never writes recipes, reserves stock or authorizes purchases.');
});

test('proximity requires a grounded delivery point before ranking or inventing distances', () => {
    const flow = conversation();
    const result = flow.send('Qual restaurante é mais próximo de mim?', {
        tool: 'propose_request', patch: { deliveryPointId: 'usp', restaurantId: 'niko' },
    });
    assert.equal(result.draft.deliveryPointId ?? null, null);
    assert.equal(result.draft.restaurantId ?? null, null);
    assert.equal(result.draft.description, null);
    assert.equal(result.question?.kind, 'location');
    assert.equal(result.discovery.restaurantChoices?.length ?? 0, 0);
    assert.doesNotMatch(result.reply, /\d+(?:[.,]\d+)?\s*km\b/i);
    noUnstatedLimits(result.draft);
});

test('a selected restaurant filters every dish in subsequent menu pages', () => {
    const flow = conversation();
    flow.send('Quero o Sabor de Casa.');
    const first = flow.send('Me passe os pratos disponíveis.');
    assert.equal(first.draft.restaurantId, 'casa');
    assert.equal(first.discovery.choiceKind, 'dish');
    assert.ok(first.discovery.choices.length > 0);
    assert.ok(first.discovery.choices.every(choice => choice.restaurantId === 'casa'));
    const more = flow.send('Mais opções.');
    assert.equal(more.discovery.choiceKind, 'dish');
    assert.ok(more.discovery.choices.length > 0);
    assert.ok(more.discovery.choices.every(choice => choice.restaurantId === 'casa'));
    assert.ok(more.discovery.choices.every(choice => !first.discovery.choices.some(old => old.menuItemId === choice.menuItemId)));
});

test('an ordinal selects from the last restaurant list and never becomes a dish or spending limit', () => {
    const flow = conversation();
    flow.send('Quais restaurantes atendem no Butantã? Prefiro o melhor avaliado.');
    const listed = flow.send('Mais opções.');
    assert.equal(listed.discovery.choiceKind, 'restaurant');
    const expected = listed.discovery.restaurantChoices?.[1];
    assert.ok(expected, 'The three demo restaurants should be listed.');
    const selected = flow.send('2', { tool: 'propose_request', patch: { budget: '2.00' } });
    assert.equal(selected.draft.restaurantId, expected.restaurantId);
    assert.equal(selected.draft.description, null);
    assert.equal(selected.draft.budget, null);
    assert.equal(selected.draft.portions, null);
});

test('a new dish list replaces restaurant ordinal context and preserves the selected restaurant', () => {
    const flow = conversation();
    const restaurants = flow.send('Quais restaurantes atendem no Butantã? Prefiro o melhor avaliado.');
    const expectedRestaurant = restaurants.discovery.restaurantChoices?.[0];
    assert.ok(expectedRestaurant);
    flow.send('A primeira.');
    const dishes = flow.send('Me passe os pratos disponíveis.');
    assert.equal(dishes.discovery.choiceKind, 'dish');
    const expectedDish = dishes.discovery.choices[1];
    assert.ok(expectedDish);
    const selected = flow.send('A segunda.');
    assert.equal(selected.draft.description, expectedDish.name);
    assert.equal(selected.draft.restaurantId, expectedRestaurant.restaurantId);
    assert.equal(selected.draft.budget, null);
});

test('explaining a numerical question ignores a fabricated model patch and preserves authorization limits', () => {
    const flow = conversation();
    const pending = flow.send('Quero uma porção de Bife a cavalo no Sabor de Casa.');
    assert.equal(pending.question?.field, 'budget');
    const explained = flow.send('Como assim?', { tool: 'propose_request', patch: {
        budget: '35.00', maxMinutes: 25, deliveryPointId: 'usp', restaurantId: 'panela',
    } });
    assert.deepEqual(explained.draft, pending.draft);
    assert.equal(explained.question?.field, 'budget');
    assert.notEqual(explained.reply, pending.reply);
    assert.match(normalize(explained.reply), /entrega|gastar|total/);
    const answered = flow.send('45');
    assert.equal(answered.draft.budget, '45.00');
    assert.equal(answered.draft.maxMinutes, null);
    assert.equal(answered.draft.restaurantId, 'casa');
});

test('switching or releasing a restaurant does not erase unrelated confirmed values', () => {
    const flow = conversation();
    const original = flow.send(complete);
    assert.equal(draftReadiness(original.draft, flow.state).ready, true);
    const switched = flow.send('Troque o restaurante para a Cozinha Expressa.');
    assert.equal(switched.draft.restaurantId, 'panela');
    assert.deepEqual({ ...switched.draft, restaurantId: original.draft.restaurantId }, original.draft);
    const released = flow.send('Pode ser qualquer restaurante.');
    assert.equal(released.draft.restaurantId, null);
    assert.deepEqual({ ...released.draft, restaurantId: original.draft.restaurantId }, original.draft);
});

test('rejecting one restaurant does not negate an explicitly selected replacement in another clause', () => {
    const flow = conversation();
    const original = flow.send(complete);
    const changed = flow.send('Não quero o Sabor de Casa, prefiro o Seu Niko.');
    assert.equal(changed.draft.restaurantId, 'niko');
    assert.deepEqual({ ...changed.draft, restaurantId: original.draft.restaurantId }, original.draft);
    assert.equal(draftReadiness(changed.draft, flow.state).ready, true);
});

test('an allergy denial cannot negate delivery location and a duration cannot become a new address', () => {
    const flow = conversation();
    const original = flow.send(complete);
    assert.equal(original.draft.deliveryPointId, 'butanta_centro');
    const clarified = flow.send('A entrega será em até 35 minutos.');
    assert.equal(clarified.draft.maxMinutes, 35);
    assert.equal(clarified.draft.zone, 'demo_butanta');
    assert.equal(clarified.draft.deliveryPointId, 'butanta_centro');
    assert.equal(clarified.draft.restaurantId, 'casa');
    assert.deepEqual({ ...clarified.draft, maxMinutes: original.draft.maxMinutes }, original.draft);
});

test('a dish unavailable in the chosen restaurant cannot be reviewed as a ready purchase', () => {
    const flow = conversation();
    const original = flow.send(complete);
    const incompatible = flow.send('Quero Omelete de legumes com arroz.');
    assert.equal(incompatible.draft.restaurantId, 'casa', 'Do not silently switch to Niko to fulfill the dish.');
    assert.equal(draftReadiness(incompatible.draft, flow.state).ready, false);
    assert.equal(incompatible.draft.budget, original.draft.budget);
    assert.equal(incompatible.draft.maxMinutes, original.draft.maxMinutes);
    assert.match(normalize(incompatible.reply), /restaurante|cardapio|disponivel|oferece/);
});

test('restaurant discovery respects ingredient exclusions and cannot recommend an incompatible catalog', () => {
    const flow = conversation();
    flow.send('Quero algo com frango, sem queijo.');
    const listed = flow.send('Qual restaurante próximo no Butantã é o melhor avaliado?');
    assert.deepEqual(listed.draft.excluded, ['queijo']);
    assert.ok(listed.discovery.ingredientIds.includes('frango'));
    assert.ok(listed.discovery.restaurantChoices?.length);
    const menu = publicMenu(flow.state, at);
    for (const choice of listed.discovery.restaurantChoices ?? []) {
        assert.ok(menu.some(item => item.restaurantId === choice.restaurantId && item.available &&
            item.ingredientIds.includes('frango') && !item.ingredientIds.includes('queijo')));
    }
    assert.equal(listed.draft.description, null);
});

test('a nearest ranking preference never invents or changes a delivery deadline', () => {
    const flow = conversation();
    const before = flow.send(complete);
    const nearer = flow.send('Prefiro o restaurante mais próximo.');
    assert.equal(nearer.draft.selectionPreference, 'NEAREST');
    assert.equal(nearer.draft.maxMinutes, before.draft.maxMinutes);
    assert.equal(nearer.draft.budget, before.draft.budget);
    assert.equal(nearer.draft.restaurantId, 'casa', 'A ranking preference does not revoke an explicit merchant choice.');
});
