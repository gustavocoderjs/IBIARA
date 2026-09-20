import test from 'node:test';
import assert from 'node:assert/strict';
import { execute } from '../lib/domain/commands.ts';
import { initialState, DEMO_TURNS } from '../lib/domain/fixtures.ts';
import { DomainError, say } from '../lib/domain/types.ts';
import { isCustomerRequest } from '../lib/domain/conversation-entry.ts';

const at = '2026-09-20T18:00:00.000Z';
const rejection = (code: string) => (error: unknown) => error instanceof DomainError && error.code === code;

test('consumer text or voice turns cannot create a recipe or fire the scheduler', () => {
    for (const text of [
        'Quero um único prato, algo mais parrudo, estou com fome.',
        'Quero carne vermelha e um restaurante próximo.',
        'Me indique um restaurante perto de mim e bem avaliado.',
        'Quero comer um bife.',
    ]) {
        const state = initialState('wrong-entry', at);
        state.schedule.nextAt = at;
        const before = structuredClone(state);
        assert.throws(() => execute(state, { type: 'turn', scope: 'merchant', text }, at), rejection('CUSTOMER_FLOW_REQUIRED'));
        assert.deepEqual(state, before);
    }
});

test('clarification does not become a recipe name, ingredient, or scheduler mutation', () => {
    for (const withDraft of [false, true]) {
        const state = initialState('clarification', at);
        if (withDraft) for (const text of DEMO_TURNS.slice(0, 2)) execute(state, { type: 'turn', scope: 'merchant', text }, at);
        state.schedule.nextAt = at;
        const before = structuredClone(state);
        assert.throws(() => execute(state, { type: 'turn', scope: 'merchant', text: 'Como assim?' }, at), rejection('CONVERSATION_CLARIFICATION_REQUIRED'));
        assert.deepEqual(state, before);
    }
});

test('legacy buyer messages in merchant history keep ambiguous followups out of recipe parsing', () => {
    const state = initialState('legacy-wrong-entry', at);
    say(state, 'merchant', 'Quero um único prato, algo mais parrudo.', at, 'user');
    say(state, 'merchant', 'Carne vermelha.', at, 'user');
    say(state, 'merchant', 'Não entendi.', at, 'user');
    for (const text of ['Carne vermelha.', 'Como assim?']) {
        const before = structuredClone(state);
        assert.throws(() => execute(state, { type: 'turn', scope: 'merchant', text }, at), rejection('CUSTOMER_FLOW_REQUIRED'));
        assert.deepEqual(state, before);
    }
});

test('explicit merchant work and the entire canonical recipe remain supported', () => {
    for (const text of ['Quero cadastrar uma receita de bife.', 'Quero montar uma ficha de carne vermelha.', 'O restaurante fica perto da USP.', '200 gramas de patinho cru e limpo.', 'Confirmo a ficha técnica.']) {
        assert.equal(isCustomerRequest(text), false, text);
    }
    const state = initialState('merchant-work', at);
    for (const text of DEMO_TURNS) execute(state, { type: 'turn', scope: 'merchant', text }, at);
    assert.equal(state.restaurants[0].recipes.length, 1);
    assert.equal(state.restaurants[0].draft, null);
});
