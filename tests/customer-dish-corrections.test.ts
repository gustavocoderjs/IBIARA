import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../lib/domain/fixtures.ts';
import { ensureDemoMarket } from '../lib/domain/demo-market.ts';
import { emptyCustomerSession } from '../lib/agents/customer/state.ts';
import { runCustomerTool, draftReadiness } from '../lib/agents/customer/tools.ts';
import { groundCustomerPatch } from '../lib/agents/customer/grounding.ts';

const at = '2026-09-20T12:00:00.000Z';
function turn(message: string) {
    const state = initialState('dish-correction', at); ensureDemoMarket(state, at);
    const session = emptyCustomerSession();
    session.draft = { ...session.draft, description: 'Bife a cavalo', restaurantId: 'niko',
        deliveryPointId: 'butanta_centro', zone: 'demo_butanta', budget: '75.00', maxMinutes: 60,
        portions: 1, excluded: [], foodSafetyConcern: false };
    const result = runCustomerTool({ tool: 'propose_request', patch: {} }, session.draft, state, at, message, undefined, session);
    return { result, original: session.draft, readiness: draftReadiness(result.draft, state) };
}

test('two distinct dish names joined by or or and require a choice, never the last dish', () => {
    for (const connector of ['ou', 'e']) {
        const { result, readiness } = turn(`Quero Bife a cavalo ${connector} Macarrão com carne e tomate.`);
        assert.equal(result.draft.description, null);
        assert.equal(readiness.ready, false);
        assert.match(result.reply, /mais de um prato/);
        assert.equal(result.draft.budget, '75.00');
    }
});

test('rejecting the previous dish among multiple rejected dishes removes its authorization draft', () => {
    const { result, readiness } = turn('Não quero Bife a cavalo nem Macarrão com carne e tomate.');
    assert.equal(result.draft.description, null); assert.equal(readiness.ready, false);
    assert.equal(result.draft.restaurantId, 'niko'); assert.equal(result.draft.budget, '75.00');
});

test('explicit replacements still choose only the affirmative dish', () => {
    for (const message of ['Troque Bife a cavalo por Macarrão com carne e tomate.',
        'Não quero Bife a cavalo, mas prefiro Macarrão com carne e tomate.']) {
        const { result, readiness } = turn(message);
        assert.equal(result.draft.description, 'Macarrão com carne e tomate', message);
        assert.equal(readiness.ready, true, message);
    }
});

test('excluding a required dish ingredient blocks review without silently substituting the recipe', () => {
    for (const message of ['Quero sem ovo.', 'Agora quero excluir ovo. Sem ovo, por favor. Não substitua meu prato.']) {
        const { result, readiness } = turn(message);
        assert.equal(result.draft.description, 'Bife a cavalo');
        assert.deepEqual(result.draft.excluded, ['ovo']);
        assert.equal(readiness.ready, false); assert.match(readiness.unsupported.join(' '), /ingrediente/);
        assert.match(result.reply, /não fazemos substituições/);
    }
});

test('denied changes and removals preserve the chosen dish and all other request fields', () => {
    for (const message of ['Não troque meu prato.', 'Não mude a refeição.', 'Não remova meu prato.',
        'Não apague meu pedido.', 'Nunca retire minha refeição.', 'Jamais desconsidere meu prato.',
        'Não quero trocar meu prato.', 'Não quero que troque meu prato.',
        'Não remova meu Bife a cavalo.', 'Não retire o ovo do meu prato.',
        'Não troque Bife a cavalo por Macarrão com carne e tomate.']) {
        const { result, original, readiness } = turn(message);
        assert.deepEqual(result.draft, original, message);
        assert.equal(readiness.ready, true, message);
    }
});

test('denied ingredient removal is ignored while an affirmative exclusion still applies', () => {
    const draft = { ...emptyCustomerSession().draft, description: 'Bife a cavalo', excluded: [] };
    for (const message of ['Não retire ovo e exclua queijo.', 'Não remova ovo, mas retire queijo.',
        'Não quero que remova ovo; quero sem queijo.']) {
        const patch = groundCustomerPatch({ excluded: ['ovo', 'queijo'] }, draft, message);
        assert.deepEqual(patch.excluded, ['queijo'], message);
    }
});

test('affirmative changes and real dish rejections still apply after a denied edit instruction', () => {
    for (const message of ['Não troque meu prato, mas agora quero Macarrão com carne e tomate.',
        'Não remova meu pedido e prefiro Macarrão com carne e tomate.']) {
        const { result, original, readiness } = turn(message);
        assert.equal(result.draft.description, 'Macarrão com carne e tomate', message);
        assert.deepEqual({ ...result.draft, description: original.description }, original, message);
        assert.equal(readiness.ready, true, message);
    }
    for (const message of ['Remova meu prato.', 'Mude a refeição.',
        'Não troque automaticamente. Não quero mais Bife a cavalo.']) {
        const { result, original, readiness } = turn(message);
        assert.equal(result.draft.description, null, message);
        assert.deepEqual({ ...result.draft, description: original.description }, original, message);
        assert.equal(readiness.ready, false, message);
    }
});
