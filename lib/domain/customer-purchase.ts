import { demand, type State } from './types.ts';

/** Known customer constraints apply to every purchase entry point, including the manual form. */
export function assertCustomerPurchaseSupported(state: State) {
    const draft = state.customerAgent?.draft;
    demand(draft?.foodSafetyConcern !== true, 'RESTRICTION_UNVERIFIED',
        'Esta demonstração não verifica alergênicos nem contaminação cruzada. Não posso executar essa compra.');
    demand(draft?.portions == null || draft.portions === 1, 'INTENT_UNSUPPORTED',
        'Esta demonstração atende uma porção por compra. Revise a quantidade antes de autorizar.');
}
