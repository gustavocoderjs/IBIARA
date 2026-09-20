import { cents, money } from '../../domain/money.ts';
import { catalog } from '../../domain/fixtures.ts';
import { normalize } from '../../adapters/neuralake.ts';
import type { State } from '../../domain/types.ts';
import { toRestaurantOffer } from '../shared/contracts.ts';
import { customerDraftSchema, type AgentDecision, type CustomerDraft } from './schemas.ts';
import { publicMenu } from './menu.ts';
import { mealIntentIssue } from '../../domain/meal-intent.ts';

export function draftReadiness(draft: CustomerDraft, state?: State) {
    const missing: string[] = [];
    if (!draft.description) missing.push('Qual refeição você quer?');
    if (draft.budget === null || cents(draft.budget) <= 0) missing.push('Qual seu limite total em reais, com entrega?');
    if (draft.portions === null) missing.push('É para uma porção?');
    if (draft.maxMinutes === null) missing.push('Em quantos minutos precisa receber?');
    if (draft.zone === null) missing.push('A entrega será no Butantã?');
    if (draft.excluded === null || draft.foodSafetyConcern === null)
        missing.push('Há ingredientes a excluir, alergias ou risco de contaminação cruzada?');
    const unsupported: string[] = [];
    const mealIssue = draft.description && state ? mealIntentIssue(draft.description, state) : null;
    if (mealIssue) unsupported.push(mealIssue);
    if (draft.portions !== null && draft.portions !== 1) unsupported.push('Esta demo atende uma porção por compra.');
    if (draft.zone === 'other') unsupported.push('Esta demo atende somente a região de teste Butantã.');
    if (draft.foodSafetyConcern) unsupported.push('A demo não verifica alergênicos ou contaminação cruzada.');
    if (draft.excluded?.some(x => !catalog.some(i => i.aliases.some(a => a === normalize(x)))))
        unsupported.push('Um ingrediente excluído não pode ser verificado no catálogo de teste.');
    return { ready: !missing.length && !unsupported.length, missing, unsupported };
}

export function runCustomerTool(decision: AgentDecision, draft: CustomerDraft, state: State, at: string, message: string) {
    if (decision.tool === 'consult_menu') {
        const menu = publicMenu(state, at);
        const reply = menu.length ? menu.map(item =>
            `${item.restaurantName} — ${item.name}: ${item.ingredients.join(', ')}. ${item.available ?
                `${money(item.totalCents!)} com entrega, ${item.etaMinutes} min.` : 'Indisponível neste momento.'}`)
            .join('\n') + '\nCardápio simulado. Preço e estoque serão revalidados na compra. Qual refeição você quer e qual seu limite com entrega?' :
            'Ainda não há pratos cadastrados neste cenário. Nenhum pedido foi criado.';
        return { draft, reply, offers: [] };
    }
    if (decision.tool === 'inspect_offers') {
        const rfq = state.rfqs.at(-1);
        const offers = state.offers.filter(o => o.rfqId === rfq?.id && o.status === 'ISSUED' && o.expiresAt > at)
            .map(toRestaurantOffer);
        return { draft, reply: offers.length ? offers.map(o =>
            `${o.dish}: ${money(o.price.totalCents)} com entrega, ${o.etaMinutes} min. Oferta ${o.offerId}.`).join('\n') +
            '\nDisponibilidade será revalidada no aceite. Nenhum pedido foi criado por esta consulta.' :
            'Não há ofertas ativas nesta busca. Revise o pedido e use a autorização de compra para iniciar a negociação.', offers };
    }
    const next = customerDraftSchema.parse({ ...draft, ...decision.patch });
    // Preserve an explicit safety concern even if extraction omits it. No diagnosis is inferred.
    const safetyText = message.replace(/\b(?:n[ãa]o tenho|sem) alergias?\b/gi, '');
    if (/alerg|cel[ií]ac|anafil|contamina[çc][aã]o/i.test(safetyText)) next.foodSafetyConcern = true;
    const status = draftReadiness(next, state);
    const reply = status.unsupported.length ? status.unsupported.join(' ') : status.missing.length ?
        status.missing.slice(0, 2).join(' ') :
        'Seu rascunho está pronto. Confira os dados e leve ao formulário para revisar e autorizar uma compra simulada.';
    return { draft: next, reply, offers: [] };
}
