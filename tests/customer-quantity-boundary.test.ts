import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../lib/domain/fixtures.ts';
import { ensureDemoMarket } from '../lib/domain/demo-market.ts';
import { groundCustomerPatch } from '../lib/agents/customer/grounding.ts';
import { runCustomerTool, draftReadiness } from '../lib/agents/customer/tools.ts';
import { emptyCustomerSession } from '../lib/agents/customer/state.ts';

const at = '2026-09-20T15:00:00.000Z';
const complete = 'Quero uma porção de Bife a cavalo no Sabor de Casa, até R$ 45,00 no total, entrega no Butantã em até 40 minutos. Não tenho alergias e nenhum ingrediente para excluir.';
function readyOrder() {
    const state = initialState('quantity-boundary', at);
    ensureDemoMarket(state, at);
    const result = runCustomerTool({ tool: 'propose_request', patch: {} }, emptyCustomerSession().draft, state, at, complete);
    assert.equal(draftReadiness(result.draft, state).ready, true);
    return { state, result };
}

test('explicit quantities outside the schema range invalidate an old ready single portion', () => {
    for (const message of ['Quero zero porções de Bife a cavalo.', 'Agora são 0 porções.', 'Quero 21 porções.',
        'Quero vinte e uma porções.', 'Quero -1 porção.', 'Quero menos duas porções.',
        'Quero 1,5 porções.', 'Quero 1.234 porções.']) {
        const { state, result: before } = readyOrder();
        const after = runCustomerTool({ tool: 'propose_request', patch: { portions: 1 } }, before.draft, state, at, message, before.reply, before);
        assert.equal(after.draft.portions, null, message);
        assert.equal(draftReadiness(after.draft, state).ready, false, message);
        assert.equal(after.question?.field, 'portions', message);
        assert.deepEqual({ ...after.draft, portions: before.draft.portions }, before.draft, message);
        assert.equal(state.mandates.length, 0);
        assert.equal(state.orders.length, 0);
    }
});

test('invalid short quantity answers stay pending rather than reviving a previous amount', () => {
    const draft = { ...emptyCustomerSession().draft, portions: 1 };
    for (const message of ['0', 'zero', '21', '-1', 'menos duas', '1,5'])
        assert.equal(groundCustomerPatch({ portions: 1 }, draft, message, 'portions').portions, null, message);
    assert.deepEqual(groundCustomerPatch({}, draft, '21', 'budget'), { budget: '21.00' });
});

test('quantity negation and a correction in the next clause cannot retain one portion', () => {
    const { state, result: before } = readyOrder();
    const corrected = runCustomerTool({ tool: 'propose_request', patch: {} }, before.draft, state, at, 'Não é uma porção, são duas.', before.reply, before);
    assert.equal(corrected.draft.portions, 2);
    assert.equal(draftReadiness(corrected.draft, state).ready, false);
    const rejected = groundCustomerPatch({}, before.draft, 'Não é uma porção.');
    assert.equal(rejected.portions, null);
    assert.deepEqual(groundCustomerPatch({}, before.draft, 'Não quero duas porções.'), {});
});

test('alternative quantities remain unresolved and an explicit later correction can restore the supported amount', () => {
    const { state, result: before } = readyOrder();
    for (const message of ['Pode ser uma ou duas porções.', 'De uma a duas porções.']) {
        const after = runCustomerTool({ tool: 'propose_request', patch: { portions: 1 } }, before.draft, state, at, message, before.reply, before);
        assert.equal(after.draft.portions, null, message);
        assert.equal(draftReadiness(after.draft, state).ready, false, message);
        const corrected = runCustomerTool({ tool: 'propose_request', patch: {} }, after.draft, state, at, 'Corrigindo, quero uma porção.', after.reply, after);
        assert.equal(corrected.draft.portions, 1);
        assert.equal(draftReadiness(corrected.draft, state).ready, true);
    }
});
