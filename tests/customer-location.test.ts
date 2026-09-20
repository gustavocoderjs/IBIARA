import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../lib/domain/fixtures.ts';
import { ensureDemoMarket } from '../lib/domain/demo-market.ts';
import { emptyCustomerSession } from '../lib/agents/customer/state.ts';
import { groundCustomerPatch } from '../lib/agents/customer/grounding.ts';
import { runCustomerTool, draftReadiness } from '../lib/agents/customer/tools.ts';

const at = '2026-09-20T15:00:00.000Z';
const complete = 'Quero uma porção de Bife a cavalo no Sabor de Casa, até R$ 45,00 no total, entrega no Butantã em até 40 minutos. Não tenho alergias e nenhum ingrediente para excluir. Prefiro a menor distância.';
function conversation() {
    const state = initialState('customer-location-test', at);
    ensureDemoMarket(state, at);
    let result = runCustomerTool({ tool: 'propose_request', patch: {} }, emptyCustomerSession().draft, state, at, complete);
    assert.equal(result.draft.selectionPreference, 'NEAREST');
    assert.equal(draftReadiness(result.draft, state).ready, true);
    return { state, get result() { return result; }, send(message: string) {
        result = runCustomerTool({ tool: 'propose_request', patch: {
            zone: 'demo_butanta', deliveryPointId: 'butanta_centro',
        } }, result.draft, state, at, message, result.reply, result);
        return result;
    } };
}

test('a negated old delivery region and an explicit outside destination invalidate the ready order', () => {
    for (const message of ['Não é no Butantã, é em Pinheiros.', 'A entrega será em Pinheiros.',
        'Não será no Butantã, mas em Pinheiros.']) {
        const flow = conversation(), before = structuredClone(flow.result.draft);
        const after = flow.send(message);
        assert.equal(after.draft.zone, 'other', message);
        assert.equal(after.draft.deliveryPointId, null, message);
        assert.equal(draftReadiness(after.draft, flow.state).ready, false);
        assert.deepEqual({ ...after.draft, zone: before.zone, deliveryPointId: before.deliveryPointId }, before);
    }
});

test('restaurant location cannot overwrite the delivery region or simulate the customer location', () => {
    for (const message of ['Moro em Pinheiros, o restaurante pode ser no Butantã.',
        'O restaurante fica na USP, moro em Pinheiros.', 'Moro em Pinheiros, a Cozinha Expressa fica na USP.']) {
        const flow = conversation(), after = flow.send(message);
        assert.equal(after.draft.zone, 'other', message);
        assert.equal(after.draft.deliveryPointId, null, message);
        assert.equal(draftReadiness(after.draft, flow.state).ready, false);
    }
    for (const message of ['O restaurante está localizado no Butantã.', 'A Cozinha Expressa fica na USP.']) {
        const flow = conversation(), before = structuredClone(flow.result.draft);
        assert.deepEqual(flow.send(message).draft, before, message);
        const patch = groundCustomerPatch({ zone: 'demo_butanta', deliveryPointId: 'usp' }, emptyCustomerSession().draft, message);
        assert.equal(patch.zone, undefined, message);
        assert.equal(patch.deliveryPointId, undefined, message);
    }
});

test('explicit simulated points are selected without accepting unrelated model guesses', () => {
    const flow = conversation(), before = structuredClone(flow.result.draft);
    const after = flow.send('A entrega será na USP.');
    assert.equal(after.draft.zone, 'demo_butanta');
    assert.equal(after.draft.deliveryPointId, 'usp');
    assert.deepEqual({ ...after.draft, deliveryPointId: before.deliveryPointId }, before);
    const changed = flow.send('Não será na USP, mas na Vila Indiana.');
    assert.equal(changed.draft.deliveryPointId, 'vila_indiana');
    assert.equal(changed.draft.zone, 'demo_butanta');
});

test('negating a destination does not select it or retain a previously rejected point', () => {
    const flow = conversation();
    flow.send('A entrega será na USP.');
    const denied = flow.send('Não quero entregar na USP.');
    assert.equal(denied.draft.deliveryPointId, null);
    assert.equal(draftReadiness(denied.draft, flow.state).ready, false);
});

test('two alternative delivery points stay unresolved rather than choosing one automatically', () => {
    const flow = conversation();
    const ambiguous = flow.send('A entrega pode ser na USP ou na Vila Indiana.');
    assert.equal(ambiguous.draft.deliveryPointId, null);
    assert.equal(draftReadiness(ambiguous.draft, flow.state).ready, false);
    assert.ok(ambiguous.question?.field === 'deliveryPointId' || ambiguous.question?.field === 'zone');
});

test('missing or hypothetical location information never supplies a destination', () => {
    const empty = emptyCustomerSession();
    const state = initialState('customer-no-location', at);
    ensureDemoMarket(state, at);
    for (const message of ['Ainda não sei meu endereço.', 'Talvez na USP.', 'Se fosse no Butantã, qual restaurante seria?',
        'Quero algo com frango, não informei minha localização.']) {
        const after = runCustomerTool({ tool: 'propose_request', patch: {
            zone: 'demo_butanta', deliveryPointId: 'usp',
        } }, empty.draft, state, at, message, undefined, empty);
        assert.equal(after.draft.zone, null, message);
        assert.equal(after.draft.deliveryPointId, null, message);
        assert.equal(draftReadiness(after.draft, state).ready, false);
    }
});

test('choosing a restaurant outside its simulated coverage remains a visible incompatibility', () => {
    const flow = conversation();
    const after = flow.send('Quero a Cozinha Expressa, entrega na Vila Indiana.');
    assert.equal(after.draft.restaurantId, 'panela');
    assert.equal(after.draft.deliveryPointId, 'vila_indiana');
    const readiness = draftReadiness(after.draft, flow.state);
    assert.equal(readiness.ready, false);
    assert.ok(readiness.unsupported.some(issue => /não atende esse ponto/.test(issue)));
    assert.equal(flow.state.orders.length, 0);
});
