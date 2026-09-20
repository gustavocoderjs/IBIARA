import { normalize } from '../../adapters/neuralake.ts';
import { deliveryPoints, distanceMeters, servesDeliveryPoint } from '../../domain/delivery.ts';
import type { CustomerDraft, CustomerDiscovery } from './schemas.ts';
import type { publicMenu } from './menu.ts';
import { discoveryOptions } from './discovery.ts';
import { customerLocation } from './location.ts';

type Menu = ReturnType<typeof publicMenu>;
const aliases = { niko: ['marmita quentinha do seu niko', 'seu niko', 'niko'], casa: ['sabor de casa'], panela: ['cozinha expressa'] } as const;
const clean = (text: string) => normalize(text).replace(/[.!?]/g, '').trim();
export const wantsRestaurants = (message: string) => /\brestaurantes?\b/.test(normalize(message)) &&
    /\b(?:qual|quais|recomenda|indica|perto|proxim|melhor|opcoes|compar|trocar|mudar|outro)/.test(normalize(message));
export const wantsNearby = (message: string) => /\b(?:perto|proxim[oa]s?|distancia)\b/.test(normalize(message));
export const wantsExplanation = (message: string) => /^(?:(?:como assim|nao entendi|pode explicar|explique|o que voce quer dizer|me ajuda|ajuda|o que faco agora)[?!. ,]*)+$/.test(normalize(message));

export function deliveryPointFromText(message: string): CustomerDraft['deliveryPointId'] {
    return customerLocation(message).deliveryPointId;
}

export function selectRestaurant(message: string, draft: CustomerDraft, discovery: CustomerDiscovery) {
    const text = clean(message);
    let id: CustomerDraft['restaurantId'];
    let handled = false, cleared = false, declinedChange = false, ambiguousChoice = false;
    if (discovery.choiceKind === 'restaurant') {
        const ordinal = text.match(/^(?:(?:quero|prefiro|escolho|vou querer) )?(?:a |o |opcao )?(primeira|primeiro|segunda|segundo|terceira|terceiro|[1-3])(?: opcao)?$/);
        if (ordinal) {
            handled = true;
            const index = { primeira: 0, primeiro: 0, segunda: 1, segundo: 1, terceira: 2, terceiro: 2, '1': 0, '2': 1, '3': 2 }[ordinal[1]]!;
            id = discovery.restaurantChoices?.[index]?.restaurantId as CustomerDraft['restaurantId'];
        }
    }
    for (const clause of text.split(/[,;]|\bmas\b/)) {
        const clear = clause.match(/\b(?:comparar (?:todos|os restaurantes)|qualquer restaurante|sem (?:preferencia de|fixar) restaurante|remov[ae] (?:o )?restaurante|trocar (?:de )?restaurante|outro restaurante)\b/);
        // A negated change preserves the current choice. Evaluate clauses in order
        // so an affirmative replacement can follow a rejection or a general search.
        if (clear) {
            handled = true;
            if (/\b(?:nao|nunca|jamais)\b/.test(clause.slice(0, clear.index))) declinedChange = true;
            else { id = undefined; cleared = true; }
        }
        const mentioned = Object.entries(aliases).filter(([, names]) => names.some(name => clause.includes(name)));
        if (mentioned.length && /\b(?:(?:nao|nunca|jamais) (?:quero|prefiro|escolh[oaie]|vou querer|pedir|troqu[ei]|mud[ei])|sem escolher)\b/.test(clause)) {
            declinedChange = true; handled = true;
            continue;
        }
        const namedChoices = mentioned.filter(([, names]) => names.some(name => clause.trim() === name) ||
            /\b(?:quero|prefiro|escolh[oaie]|troque|mude|vou querer|pedir)\b/.test(clause) || /^\s*(?:so|somente|apenas)\s+(?:o\s+)?/.test(clause));
        if (namedChoices.length > 1) {
            id = undefined; handled = true; ambiguousChoice = true; cleared = false;
        } else if (namedChoices.length === 1) {
            id = namedChoices[0][0] as CustomerDraft['restaurantId']; cleared = false; ambiguousChoice = false;
        }
    }
    if (id) {
        draft.restaurantId = id;
        discovery.restaurantChoices = []; discovery.choiceKind = 'dish'; discovery.choices = []; discovery.offset = 0;
        return { selected: true, showRestaurants: false, handled: true, preserveSelection: false };
    }
    if (cleared) draft.restaurantId = null;
    return { selected: false, showRestaurants: ambiguousChoice || cleared || (handled && !declinedChange), handled,
        preserveSelection: declinedChange && !cleared && !ambiguousChoice && !!draft.restaurantId };
}

export function restaurantRecommendations(menu: Menu, draft: CustomerDraft, discovery: CustomerDiscovery) {
    // Reuse exactly the same composition/budget/deadline filters as dish discovery,
    // without its name de-duplication hiding other eligible restaurants.
    const restaurants = [...new Set(menu.map(item => item.restaurantId))];
    const candidates = restaurants.flatMap(id => {
        if (draft.deliveryPointId && !servesDeliveryPoint(id, draft.deliveryPointId)) return [];
        const filtered = discoveryOptions(menu.filter(item => item.restaurantId === id &&
            (!draft.description || normalize(item.name) === normalize(draft.description))),
            { ...draft, restaurantId: null }, { ...discovery, choices: [], offset: 0 });
        const item = filtered.options[0];
        if (!item) return [];
        return [{ restaurantId: id, name: item.restaurantName, ratingTenths: item.ratingTenths, ratingIsDemo: item.ratingIsDemo,
            ratingCount: item.ratingCount, etaMinutes: item.etaMinutes, totalCents: item.totalCents!,
            distanceMeters: draft.deliveryPointId ? distanceMeters(id, draft.deliveryPointId) : null,
            dishes: filtered.options.map(option => option.name) }];
    });
    candidates.sort((a, b) => {
        if (draft.selectionPreference === 'BEST_RATED') return (b.ratingTenths ?? -1) - (a.ratingTenths ?? -1) || a.totalCents - b.totalCents;
        if (draft.selectionPreference === 'NEAREST') return (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity) || a.totalCents - b.totalCents;
        if (draft.selectionPreference === 'FASTEST') return a.etaMinutes - b.etaMinutes || a.totalCents - b.totalCents;
        return a.totalCents - b.totalCents || a.etaMinutes - b.etaMinutes;
    });
    return candidates.slice(0, 3);
}

export function simulatedLocationText(pointId: CustomerDraft['deliveryPointId']) {
    const point = deliveryPoints.find(point => point.id === pointId);
    return point ? `Ponto de entrega fictício: ${point.label}. Distâncias aproximadas em linha reta, simuladas; não são tempo de entrega nem sua localização real.` : '';
}

export const preferenceLabel = (draft: CustomerDraft) => ({
    BEST_RATED: 'melhor avaliação', LOWEST_PRICE: 'menor preço total', NEAREST: 'menor distância simulada', FASTEST: 'menor prazo de entrega',
})[draft.selectionPreference ?? 'LOWEST_PRICE'];
