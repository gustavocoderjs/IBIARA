import { cents, money } from '../../domain/money.ts';
import { catalog } from '../../domain/fixtures.ts';
import { normalize } from '../../adapters/neuralake.ts';
import type { State } from '../../domain/types.ts';
import { toRestaurantOffer } from '../shared/contracts.ts';
import { customerDraftSchema, type AgentDecision, type CustomerDraft } from './schemas.ts';
import { publicMenu } from './menu.ts';
import { mealIntentIssue } from '../../domain/meal-intent.ts';

const safetyQuestion = 'Há ingredientes a excluir, alergias ou risco de contaminação cruzada?';
const menuRequestWords = new Set('me passe mostre diga envie liste traga apresente ver saber quero gostaria de pode poderia quais que o os a as tem ha sao pratos prato cardapio opcoes opcao disponivel disponiveis por favor seu seus'.split(' '));

function answersNoToSafety(message: string, lastAssistantText?: string) {
    const lastQuestion = lastAssistantText?.split('\n').at(-1)?.replace(
        /^Cardápio simulado\. Preço e estoque serão revalidados na compra\. /, '').trim();
    if (!lastQuestion || normalize(lastQuestion) !== normalize(safetyQuestion)) return false;
    const text = normalize(message.trim());
    const answer = text.match(/^nao(?:[,.!?;]\s*|$)/);
    if (!answer) return false;
    const remainder = text.slice(answer[0].length).trim();
    if (!remainder) return true;
    // Only a separate menu request may follow this short answer. A qualification,
    // food preference or safety statement needs interpretation, never an assumed "no".
    const words = remainder.match(/[a-z]+/g) ?? [];
    return /\b(?:pratos?|cardapio|opcoes|opcao|disponiveis|disponivel)\b/.test(remainder) &&
        words.length > 0 && words.every(word => menuRequestWords.has(word));
}

export function draftReadiness(draft: CustomerDraft, state?: State) {
    const missing: string[] = [];
    if (!draft.description) missing.push('Qual refeição você quer?');
    if (draft.budget === null || cents(draft.budget) <= 0) missing.push('Qual seu limite total em reais, com entrega?');
    if (draft.portions === null) missing.push('É para uma porção?');
    if (draft.maxMinutes === null) missing.push('Em quantos minutos precisa receber?');
    if (draft.zone === null) missing.push('A entrega será no Butantã?');
    if (draft.excluded === null || draft.foodSafetyConcern === null)
        missing.push(safetyQuestion);
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
    return status.unsupported.length ? status.unsupported.join(' ') : status.missing.length ?
        status.missing[0] :
        `Seu rascunho está pronto. Critério: ${draft.selectionPreference === 'BEST_RATED' ?
            'melhor avaliação, dentro do orçamento e prazo máximo' : 'menor preço total'}. Confira os dados e leve ao formulário para revisar e autorizar uma compra simulada.`;
}

function isMenuOnly(message: string) {
    const text = normalize(message).replace(/^nao(?:[,.!?;]\s*|$)/, '');
    const words = text.match(/[a-z]+/g) ?? [];
    return !/\d/.test(text) && /\b(?:pratos?|cardapio|opcoes|opcao|disponiveis|disponivel)\b/.test(text) &&
        words.length > 0 && words.every(word => menuRequestWords.has(word));
}

const nonMealWords = new Set('quero gostaria prefiro de comer pedir um uma porcao porcoes refeicao prato marmita para mim com e a ao da do os as o por favor'.split(' '));
function supportedPatch(decision: AgentDecision, draft: CustomerDraft, message: string) {
    const patch = { ...('patch' in decision ? decision.patch : {}) };
    // A pure menu read cannot rewrite preferences. Mixed messages (budget + menu,
    // for example) still use the model's validated extraction.
    if (isMenuOnly(message)) return {};
    const text = normalize(message);
    // null means an explicit removal, not an extraction that did not find a value.
    // The reset action is the separate operation for clearing the entire draft.
    const clearing = /\b(?:esqueca|retire|remova|apague|limpe|desconsidere)\b/.test(text);
    const fieldWords = { description: /\b(?:prato|refeicao|pedido)\b/, budget: /\b(?:orcamento|valor|limite)\b/,
        portions: /\b(?:quantidade|porcoes|porcao)\b/, maxMinutes: /\b(?:prazo|minutos|tempo)\b/,
        zone: /\b(?:regiao|endereco|bairro|local)\b/, excluded: /\b(?:exclusoes|restricoes|ingredientes)\b/,
        foodSafetyConcern: /\b(?:alergias|alergia|restricoes)\b/,
        selectionPreference: /\b(?:criterio|preferencia|avaliacao)\b/ };
    for (const field of Object.keys(fieldWords) as (keyof typeof fieldWords)[])
        if (patch[field] === null && !(clearing && fieldWords[field].test(text))) delete patch[field];
    if (draft.description && patch.description !== undefined && patch.description !== draft.description) {
        const dishWords = normalize(patch.description ?? '').match(/[a-z]+/g) ?? [];
        const explicitDish = dishWords.some(word => !nonMealWords.has(word) && new RegExp(`\\b${word}\\b`).test(text));
        const clearDish = /\b(?:esqueca|retire|remova|apague|limpe)\b.*\b(?:prato|refeicao|pedido)\b/.test(text);
        if (!explicitDish && !(patch.description === null && clearDish)) {
            const ambiguousChoice = /\b(?:quero|prefiro|escolho|troque|mude)\b/.test(text) &&
                /\b(?:opcao|esse|essa|este|esta|outra|outro)\b/.test(text);
            // An unresolved new meal choice invalidates the old selection. Ask for
            // the meal's name instead of silently approving the previously chosen dish.
            if (ambiguousChoice) patch.description = null;
            else delete patch.description;
        }
    }
    // Explicit singular meal quantifiers are not defaults. Do not collapse plural
    // requests, numbers or multiple meal quantifiers into the supported one portion.
    const singular = [...text.matchAll(/\b(?:um|uma)\s+(?:bife|marmita|prato|porcao|refeicao)\b/g)];
    if (patch.portions === undefined && singular.length === 1 &&
        !/\b(?:bifes|marmitas|pratos|porcoes|refeicoes|pessoas)\b/.test(text))
        patch.portions = 1;
    return patch;
}

function ratingText(item: { ratingTenths: number | null; ratingCount: number; ratingIsDemo: boolean }) {
    return item.ratingTenths === null ? 'Sem avaliações.' :
        `Nota ${(item.ratingTenths / 10).toFixed(1).replace('.', ',')}/5 (${item.ratingCount} avaliações${item.ratingIsDemo ? ' simuladas' : ''}).`;
}

export function runCustomerTool(decision: AgentDecision, draft: CustomerDraft, state: State, at: string,
    message: string, lastAssistantText?: string) {
    const next = customerDraftSchema.parse({ ...draft, ...supportedPatch(decision, draft, message) });
    if (answersNoToSafety(message, lastAssistantText)) {
        next.excluded = [];
        next.foodSafetyConcern = false;
    }
    // Preserve a concern even when extraction or a read-only tool omits it.
    // Explicit negative allergy statements are not themselves a positive concern.
    const safetyText = normalize(message).replace(/\b(?:nao tenho|nao possuo|sem) alergias?\b/g, '')
        .replace(/\bnao sou alergic[oa]\b/g, '');
    if (/alerg|celiac|anafil|contaminacao/.test(safetyText)) next.foodSafetyConcern = true;

    const latestRfq = state.rfqs.at(-1);
    const mandate = state.mandates.find(m => m.id === latestRfq?.mandateId);
    const activeRfq = latestRfq && ['OPEN', 'QUOTED'].includes(latestRfq.status) && latestRfq.expiresAt > at &&
        mandate && !mandate.revoked && mandate.used < mandate.maxUses && mandate.expiresAt > at ? latestRfq : null;
    if (isMenuOnly(message) || decision.tool === 'consult_menu' || (decision.tool === 'inspect_offers' && !activeRfq)) {
        const menu = publicMenu(state, at);
        const reply = menu.length ? menu.map(item =>
            `${item.restaurantName} — ${ratingText(item)} ${item.name}: ${item.ingredients.join(', ')}. ${item.available ?
                `${money(item.totalCents!)} com entrega, ${item.etaMinutes} min.` : 'Indisponível neste momento.'}`)
            .join('\n') + `\nCardápio simulado. Preço e estoque serão revalidados na compra. ${draftNextStep(next, state)}` :
            'Ainda não há pratos cadastrados neste cenário. Nenhum pedido foi criado.';
        return { draft: next, reply, offers: [] };
    }
    if (decision.tool === 'inspect_offers') {
        const offers = state.offers.filter(o => o.rfqId === activeRfq?.id && o.status === 'ISSUED' && o.expiresAt > at)
            .map(toRestaurantOffer);
        return { draft: next, reply: offers.length ? offers.map(o =>
            `${o.dish}: ${money(o.price.totalCents)} com entrega, ${o.etaMinutes} min. ${ratingText(o)} Oferta ${o.offerId}.`).join('\n') +
            '\nDisponibilidade será revalidada no aceite. Nenhum pedido foi criado por esta consulta.' :
            'Não há ofertas ativas nesta busca. Revise o pedido e use a autorização de compra para iniciar a negociação.', offers };
    }
    return { draft: next, reply: draftNextStep(next, state), offers: [] };
}
