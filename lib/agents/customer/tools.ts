import { cents, money } from '../../domain/money.ts';
import { catalog } from '../../domain/fixtures.ts';
import { normalize } from '../../adapters/neuralake.ts';
import type { State } from '../../domain/types.ts';
import { toRestaurantOffer } from '../shared/contracts.ts';
import { customerDraftSchema, type AgentDecision, type CustomerDraft, type CustomerDiscovery } from './schemas.ts';
import { publicMenu } from './menu.ts';
import { mealIntentIssue } from '../../domain/meal-intent.ts';
import { groundCustomerPatch } from './grounding.ts';
import { discoverMeal, discoveryOptions, questionFromReply } from './discovery.ts';

const safetyQuestion = 'Há ingredientes a excluir, alergias ou risco de contaminação cruzada?';
export function draftReadiness(draft: CustomerDraft, state?: State) {
    const missing: string[] = [];
    if (!draft.description) missing.push('Qual refeição você quer?');
    if (draft.budget === null || cents(draft.budget) <= 0) missing.push('Qual seu limite total em reais, com entrega?');
    if (draft.portions === null) missing.push('É para uma porção?');
    if (draft.maxMinutes === null) missing.push('Em quantos minutos precisa receber?');
    if (draft.zone === null) missing.push('A entrega será no Butantã?');
    if (draft.excluded === null || draft.foodSafetyConcern === null) missing.push(safetyQuestion);
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
function draftNextStep(draft: CustomerDraft, state: State) {
    const status = draftReadiness(draft, state);
    return status.unsupported.length ? status.unsupported.join(' ') : status.missing.length ? status.missing[0] :
        `Seu rascunho está pronto. Critério: ${draft.selectionPreference === 'BEST_RATED' ?
            'melhor avaliação, dentro do orçamento e prazo máximo' : 'menor preço total'}. Confira os dados e leve ao formulário para revisar e autorizar uma compra simulada.`;
}
function ratingText(item: { ratingTenths: number | null; ratingCount: number; ratingIsDemo: boolean }) {
    return item.ratingTenths === null ? 'Sem avaliações.' :
        `Nota ${(item.ratingTenths / 10).toFixed(1).replace('.', ',')}/5 (${item.ratingCount} avaliações${item.ratingIsDemo ? ' simuladas' : ''}).`;
}
export function runCustomerTool(decision: AgentDecision, draft: CustomerDraft, state: State, at: string,
    message: string, lastAssistantText?: string,
    context?: { discovery?: CustomerDiscovery; pendingQuestion?: keyof CustomerDraft | null }) {
    const pending = context?.pendingQuestion !== undefined ? context.pendingQuestion : questionFromReply(lastAssistantText);
    const proposed = 'patch' in decision ? decision.patch ?? {} : {};
    const numberedChoice = !!context?.discovery?.choices.length && /^[1-3][.!]?$/.test(message.trim());
    const next = customerDraftSchema.parse({ ...draft, ...groundCustomerPatch(proposed, draft, message, numberedChoice ? null : pending) });
    const menu = publicMenu(state, at);
    const meal = discoverMeal(message, proposed, draft, next, menu, context?.discovery);
    const status = draftReadiness(next, state);
    const latestRfq = state.rfqs.at(-1);
    const mandate = state.mandates.find(m => m.id === latestRfq?.mandateId);
    const activeRfq = latestRfq && ['OPEN', 'QUOTED'].includes(latestRfq.status) && latestRfq.expiresAt > at &&
        mandate && !mandate.revoked && mandate.used < mandate.maxUses && mandate.expiresAt > at ? latestRfq : null;
    let reply = meal.selectionIssue || (status.unsupported.length ? status.unsupported.join(' ') :
        meal.clarification ?? draftNextStep(next, state));
    let offers: ReturnType<typeof toRestaurantOffer>[] = [];
    const menuRequested = meal.showMenu || (!meal.selected &&
        (decision.tool === 'consult_menu' || (decision.tool === 'inspect_offers' && !activeRfq)));
    if (menuRequested) {
        const { options, hasMore } = discoveryOptions(menu, next, meal.discovery);
        const lines = options.map((item, index) =>
            `${index + 1}. ${item.restaurantName} — ${ratingText(item)} ${item.name}: ${item.ingredients.join(', ')}. ${money(item.totalCents!)} com entrega, ${item.etaMinutes} min.`);
        const prompt = meal.selectionIssue || (status.unsupported.length ? status.unsupported.join(' ') :
            meal.clarification ?? (!next.description && options.length ? 'Qual prato você quer? Responda com o nome ou o número da opção.' : draftNextStep(next, state)));
        reply = (lines.length ? lines.join('\n') : 'Não encontrei opções disponíveis que atendam aos filtros atuais. Você pode mudar os ingredientes ou os limites.') +
            `\nCardápio simulado. Preço e estoque serão revalidados na compra. ${hasMore ? 'Diga “mais opções” para ver outras. ' : ''}` +
            'A escolha é do prato; o restaurante será definido na busca autorizada, respeitando seu critério.\n' + prompt;
    } else if (decision.tool === 'inspect_offers' && activeRfq && !meal.selected) {
        offers = state.offers.filter(o => o.rfqId === activeRfq.id && o.status === 'ISSUED' && o.expiresAt > at).map(toRestaurantOffer);
        reply = offers.length ? offers.map(o => `${o.dish}: ${money(o.price.totalCents)} com entrega, ${o.etaMinutes} min. ${ratingText(o)} Oferta ${o.offerId}.`).join('\n') +
            '\nDisponibilidade será revalidada no aceite. Nenhum pedido foi criado por esta consulta.' :
            'Não há ofertas ativas nesta busca. Revise o pedido e use a autorização de compra para iniciar a negociação.';
    }
    return { draft: next, reply, offers, discovery: meal.discovery, pendingQuestion: questionFromReply(reply) };
}
