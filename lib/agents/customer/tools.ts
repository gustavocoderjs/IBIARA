import { cents, money } from '../../domain/money.ts';
import { catalog } from '../../domain/fixtures.ts';
import { normalize } from '../../adapters/neuralake.ts';
import type { State } from '../../domain/types.ts';
import { toRestaurantOffer } from '../shared/contracts.ts';
import { customerDraftSchema, type AgentDecision, type CustomerDraft, type CustomerDiscovery, type CustomerQuestion } from './schemas.ts';
import { publicMenu } from './menu.ts';
import { mealIntentIssue } from '../../domain/meal-intent.ts';
import { groundCustomerPatch } from './grounding.ts';
import { discoverMeal, discoveryOptions, questionFromReply } from './discovery.ts';
import { deliveryPointFromText, preferenceLabel, restaurantRecommendations, selectRestaurant, simulatedLocationText, wantsExplanation, wantsNearby, wantsRestaurants } from './restaurants.ts';
import { explainQuestion, locationQuestion, nextDraftQuestion } from './questions.ts';
import { servesDeliveryPoint } from '../../domain/delivery.ts';

const safetyQuestion = 'Há ingredientes a excluir, alergias ou risco de contaminação cruzada?';
export function draftReadiness(draft: CustomerDraft, state?: State) {
    const missing: string[] = [];
    if (!draft.description) missing.push('Qual refeição você quer?');
    if (draft.budget === null || cents(draft.budget) <= 0) missing.push('Qual seu limite total em reais, com entrega?');
    if (draft.portions === null) missing.push('É para uma porção?');
    if (draft.maxMinutes === null) missing.push('Em quantos minutos precisa receber?');
    if (draft.zone === null) missing.push('A entrega será no Butantã?');
    if (draft.selectionPreference === 'NEAREST' && !draft.deliveryPointId) missing.push(locationQuestion().text);
    if (draft.excluded === null || draft.foodSafetyConcern === null) missing.push(safetyQuestion);
    const unsupported: string[] = [];
    const mealIssue = draft.description && state ? mealIntentIssue(draft.description, state) : null;
    if (mealIssue) unsupported.push(mealIssue);
    if (draft.portions !== null && draft.portions !== 1) unsupported.push('Esta demo atende uma porção por compra.');
    if (draft.zone === 'other') unsupported.push('Esta demo atende somente a região de teste Butantã.');
    if (draft.foodSafetyConcern) unsupported.push('A demo não verifica alergênicos ou contaminação cruzada.');
    if (state && draft.restaurantId) {
        const restaurant = state.restaurants.find(item => item.id === draft.restaurantId);
        if (!restaurant) unsupported.push('O restaurante escolhido não está disponível. Escolha outro restaurante.');
        else if (draft.description && !restaurant.recipes.some(recipe => recipe.status === 'CONFIRMED' && normalize(recipe.name) === normalize(draft.description!)))
            unsupported.push('O prato escolhido não está no cardápio desse restaurante. Escolha outro prato ou restaurante.');
        if (draft.deliveryPointId && !servesDeliveryPoint(draft.restaurantId, draft.deliveryPointId)) unsupported.push('O restaurante escolhido não atende esse ponto simulado. Escolha outro restaurante ou ponto de entrega.');
    }
    if (draft.excluded?.some(x => !catalog.some(i => i.aliases.some(a => a === normalize(x)))))
        unsupported.push('Um ingrediente excluído não pode ser verificado no catálogo de teste.');
    if (state && draft.description && draft.excluded?.length) {
        const excluded = catalog.filter(item => draft.excluded!.some(value => item.aliases.some(alias => alias === normalize(value)))).map(item => item.id);
        const matching = state.restaurants.filter(restaurant => !draft.restaurantId || restaurant.id === draft.restaurantId)
            .flatMap(restaurant => restaurant.recipes).filter(recipe => recipe.status === 'CONFIRMED' && normalize(recipe.name) === normalize(draft.description!));
        if (matching.length && matching.every(recipe => recipe.components.some(component => excluded.some(id => id === component.item))))
            unsupported.push('O prato escolhido contém um ingrediente que você excluiu. Escolha outro prato ou corrija a restrição; não fazemos substituições silenciosas.');
    }
    return { ready: !missing.length && !unsupported.length, missing, unsupported };
}
function draftNextStep(draft: CustomerDraft, state: State) {
    const status = draftReadiness(draft, state);
    return status.unsupported.length ? status.unsupported.join(' ') : status.missing.length ? status.missing[0] :
        `Seu rascunho está pronto. Critério: ${preferenceLabel(draft)}, dentro do orçamento e prazo máximo. Confira os dados e leve ao formulário para revisar e autorizar uma compra simulada.`;
}
function ratingText(item: { ratingTenths: number | null; ratingCount: number; ratingIsDemo: boolean }) {
    return item.ratingTenths === null ? 'Sem avaliações.' :
        `Nota ${(item.ratingTenths / 10).toFixed(1).replace('.', ',')}/5 (${item.ratingCount} avaliações${item.ratingIsDemo ? ' simuladas' : ''}).`;
}
export function runCustomerTool(decision: AgentDecision, draft: CustomerDraft, state: State, at: string,
    message: string, lastAssistantText?: string,
    context?: { discovery?: CustomerDiscovery; pendingQuestion?: keyof CustomerDraft | null; question?: CustomerQuestion | null }) {
    const pending = context?.question ? context.question.field ?? null : context?.pendingQuestion !== undefined ? context.pendingQuestion : questionFromReply(lastAssistantText);
    const saved = structuredClone(context?.discovery ?? { ingredientIds: [], preferences: [], choices: [], offset: 0 });
    if (decision.tool === 'explain_question' || wantsExplanation(message)) {
        const question = context?.question ?? nextDraftQuestion(draft);
        return { draft: structuredClone(draft), reply: explainQuestion(question), offers: [], discovery: saved,
            question, pendingQuestion: question?.field ?? pending ?? null };
    }
    const proposed = 'patch' in decision ? decision.patch ?? {} : {};
    const numberedChoice = !!(saved.choices.length || saved.restaurantChoices?.length) && /^[1-3][.!]?$/.test(message.trim());
    const next = customerDraftSchema.parse({ ...draft, ...groundCustomerPatch(proposed, draft, message, numberedChoice ? null : pending) });
    const point = deliveryPointFromText(message);
    if (point !== undefined) next.deliveryPointId = point;
    if (point) next.zone = 'demo_butanta';
    else if (next.zone !== draft.zone && next.zone !== 'demo_butanta') next.deliveryPointId = null;
    if (wantsNearby(message)) saved.nearby = true;
    if (context?.question?.kind === 'meal_style' && /\blegumes\b/.test(normalize(message))) saved.preferences = [...new Set([...saved.preferences, 'vegetables'])];
    const restaurantChoice = selectRestaurant(message, next, saved);
    const menu = publicMenu(state, at);
    const scopedMenu = next.restaurantId ? menu.filter(item => item.restaurantId === next.restaurantId) : menu;
    const onlyRestaurant = restaurantChoice.handled && !scopedMenu.some(item => normalize(message).includes(normalize(item.name))) &&
        !catalog.some(item => item.aliases.some(alias => new RegExp(`\\b${alias}\\b`).test(normalize(message))));
    const describingPreference = wantsRestaurants(message) || decision.tool === 'discover_restaurants' ||
        /\b(?:parrudo|reforcad[oa]|muita fome|bastante fome)\b/.test(normalize(message));
    const meal = discoverMeal(onlyRestaurant || saved.choiceKind === 'restaurant' && numberedChoice ? '' : message,
        onlyRestaurant ? {} : describingPreference ? { ...proposed, description: null } : proposed, draft, next, scopedMenu, saved);
    const incompatibleMeal = next.restaurantId && !/\b(?:nao quero|nao escolhi)\b/.test(normalize(message)) &&
        menu.find(item => normalize(message).includes(normalize(item.name)) && !scopedMenu.some(own => own.name === item.name));
    if (incompatibleMeal) next.description = incompatibleMeal.name;
    if (context?.question?.kind === 'meal_style' && /\blegumes\b/.test(normalize(message))) meal.showMenu = true;
    if (restaurantChoice.selected && next.description && !scopedMenu.some(item => normalize(item.name) === normalize(next.description!))) next.description = null;
    const status = draftReadiness(next, state);
    let question: CustomerQuestion | null = status.unsupported.length ? null : nextDraftQuestion(next);
    if (draft.portions !== null && next.portions === null) question = { kind: 'field', field: 'portions',
        text: 'A quantidade ficou pendente. Esta demo atende uma porção por compra. Qual quantidade você deseja?' };
    if (meal.clarification && meal.clarificationKind) question = { kind: meal.clarificationKind,
        ...(meal.clarificationKind === 'field' ? { field: 'maxMinutes' as const } : {}), text: meal.clarification };
    const restaurantRequested = !restaurantChoice.selected && !restaurantChoice.preserveSelection && (restaurantChoice.showRestaurants || wantsRestaurants(message) || decision.tool === 'discover_restaurants' ||
        (saved.choiceKind === 'restaurant' && /mais opcoes|outras opcoes/.test(normalize(message))) ||
        (context?.question?.kind === 'location' && !!point));
    if (restaurantRequested && !next.foodSafetyConcern) {
        if ((meal.discovery.nearby || next.selectionPreference === 'NEAREST') && !next.deliveryPointId) {
            question = locationQuestion();
            return { draft: next, discovery: meal.discovery, question, pendingQuestion: question.field!, offers: [], reply: question.text };
        }
        const restaurants = next.zone === 'other' ? [] : restaurantRecommendations(menu, next, meal.discovery);
        meal.discovery.choiceKind = 'restaurant'; meal.discovery.choices = [];
        meal.discovery.restaurantChoices = restaurants.map(({ restaurantId, name }) => ({ restaurantId, name }));
        question = restaurants.length ? { kind: 'restaurant_choice', text: 'Qual restaurante você prefere? Responda com o nome ou o número da opção.' } : null;
        const lines = restaurants.map((item, index) => `${index + 1}. ${item.name} — ${ratingText(item)} ${item.distanceMeters == null ? 'Distância ainda não definida.' : `${(item.distanceMeters / 1000).toFixed(1).replace('.', ',')} km em linha reta (simulado).`} ${item.etaMinutes} min; opções a partir de ${money(item.totalCents)} com entrega. Pratos: ${item.dishes.join('; ')}.`);
        return { draft: next, discovery: meal.discovery, question, pendingQuestion: null, offers: [],
            reply: (lines.length ? `Restaurantes compatíveis, priorizando ${preferenceLabel(next)}:\n${lines.join('\n')}` : 'Não encontrei restaurantes disponíveis com esses filtros. Você pode mudar o ponto, o tipo de comida ou os limites; não vou alterá-los por conta própria.') +
                `\n${simulatedLocationText(next.deliveryPointId)}\n${question?.text ?? 'Qual preferência você quer mudar?'}` };
    }
    const latestRfq = state.rfqs.at(-1);
    const mandate = state.mandates.find(m => m.id === latestRfq?.mandateId);
    const activeRfq = latestRfq && ['OPEN', 'QUOTED'].includes(latestRfq.status) && latestRfq.expiresAt > at &&
        mandate && !mandate.revoked && mandate.used < mandate.maxUses && mandate.expiresAt > at ? latestRfq : null;
    let reply = meal.selectionIssue || (status.unsupported.length ? status.unsupported.join(' ') :
        meal.clarification ?? draftNextStep(next, state));
    if (!meal.selectionIssue && !status.unsupported.length && draft.portions !== null && next.portions === null) reply = question!.text;
    if (restaurantChoice.preserveSelection) reply = `Mantenho ${state.restaurants.find(restaurant => restaurant.id === next.restaurantId)?.name ?? 'o restaurante escolhido'} como sua escolha. ${reply}`;
    let offers: ReturnType<typeof toRestaurantOffer>[] = [];
    const menuRequested = meal.showMenu || restaurantChoice.selected || (!meal.selected && !restaurantChoice.preserveSelection &&
        (decision.tool === 'consult_menu' || (decision.tool === 'inspect_offers' && !activeRfq)));
    if (menuRequested) {
        const { options, hasMore } = discoveryOptions(menu, next, meal.discovery);
        const lines = options.map((item, index) =>
            `${index + 1}. ${item.restaurantName} — ${ratingText(item)} ${item.name}: ${item.ingredients.join(', ')}. ${money(item.totalCents!)} com entrega, ${item.etaMinutes} min.`);
        const prompt = meal.selectionIssue || (status.unsupported.length ? status.unsupported.join(' ') :
            meal.clarification ?? (!next.description && options.length ? 'Qual prato você quer? Responda com o nome ou o número da opção.' : draftNextStep(next, state)));
        if (!meal.clarification && !status.unsupported.length && !next.description && options.length) question = { kind: 'dish_choice', field: 'description', text: 'Qual prato você quer? Responda com o nome ou o número da opção.' };
        reply = (lines.length ? lines.join('\n') : 'Não encontrei opções disponíveis que atendam aos filtros atuais. Você pode mudar os ingredientes ou os limites.') +
            `\nCardápio simulado. Preço e estoque serão revalidados na compra. ${hasMore ? 'Diga “mais opções” para ver outras. ' : ''}` +
            (next.restaurantId ? 'Seu restaurante escolhido será mantido na compra.\n' : 'A escolha é do prato; o restaurante será definido na busca autorizada, respeitando seu critério.\n') + prompt;
    } else if (decision.tool === 'inspect_offers' && activeRfq && !meal.selected) {
        offers = state.offers.filter(o => o.rfqId === activeRfq.id && o.status === 'ISSUED' && o.expiresAt > at).map(toRestaurantOffer);
        reply = offers.length ? offers.map(o => `${o.dish}: ${money(o.price.totalCents)} com entrega, ${o.etaMinutes} min. ${ratingText(o)} Oferta ${o.offerId}.`).join('\n') +
            '\nDisponibilidade será revalidada no aceite. Nenhum pedido foi criado por esta consulta.' :
            'Não há ofertas ativas nesta busca. Revise o pedido e use a autorização de compra para iniciar a negociação.';
    }
    return { draft: next, reply, offers, discovery: meal.discovery, question, pendingQuestion: question?.field ?? null };
}
