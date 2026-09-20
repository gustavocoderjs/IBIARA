import { normalize } from '../../adapters/neuralake.ts';
import { catalog } from '../../domain/fixtures.ts';
import { cents } from '../../domain/money.ts';
import type { CustomerDiscovery, CustomerDraft } from './schemas.ts';
import type { publicMenu } from './menu.ts';

type Menu = ReturnType<typeof publicMenu>;
export const emptyDiscovery = (): CustomerDiscovery => ({ ingredientIds: [], preferences: [], choices: [], offset: 0 });
const words = (value: string): string[] => normalize(value).match(/[a-z]+/g) ?? [];
const genericWords = new Set(words('quero gostaria de comer pedir um uma porcao porcoes refeicao prato marmita para mim com e a ao da do os as o por favor'));
const mentions = (text: string, term: string) => ` ${text} `.includes(` ${normalize(term)} `);
const normalizedText = (text: string) => normalize(text).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

/** Last rendered question fallback is for sessions written before structured context existed. */
export function questionFromReply(reply?: string): keyof CustomerDraft | null {
    const text = normalize(reply?.split('\n').at(-1) ?? '');
    if (/alergias ou risco/.test(text)) return 'foodSafetyConcern';
    if (/entrega sera no butanta/.test(text)) return 'zone';
    if (/quantos minutos|prazo maximo.*minutos/.test(text)) return 'maxMinutes';
    if (/para uma porcao/.test(text)) return 'portions';
    if (/limite total.*reais/.test(text)) return 'budget';
    if (/qual refeicao|qual prato|qual opcao/.test(text)) return 'description';
    return null;
}

export function discoverMeal(message: string, proposed: Partial<CustomerDraft>, previous: CustomerDraft,
    next: CustomerDraft, menu: Menu, saved?: CustomerDiscovery) {
    const discovery = structuredClone(saved ?? emptyDiscovery());
    const text = normalizedText(message);
    const changing = /\b(?:troque|trocar|troca|mude|mudei de ideia|agora quero|prefiro outro|quero outro|quero outra|quero escolher outr[oa])\b/.test(text);
    const declined = /\b(?:nao escolhi|nao escolho|nao escolha|nao autorizei|mantenha a intencao)\b/.test(text) ||
        /\bnao (?:defini|decidi) (?:o |a )?(?:prato|refeicao|pedido|o que)\b/.test(text);
    const clear = /\b(?:apague|esqueca|limpe|remova|retire|desconsidere)\b[^.!?;]*\b(?:prato|refeicao|pedido)\b/.test(normalize(message));
    const menuRequest = /\b(?:cardapio|opcoes|sugestao|sugestoes|recomenda|disponiveis|disponivel)\b/.test(text) ||
        /\b(?:quais|mostre|ver|passe|tem)\b.*\bpratos?\b/.test(text);
    const more = /\b(?:mais|outras) opcoes\b/.test(text);
    const discoveryRequest = /\b(?:algo|algum|alguma|opcoes|opcao|prato) com\b/.test(text) ||
        /\bnao sei o que comer\b/.test(text);
    const hostile = /ignore.*instru|chaves de api|configuracao secreta|sem mandato|mude.*regras/.test(text);
    let selected = false, selectionIssue = '', showMenu = menuRequest;

    if (clear) {
        next.description = null;
        discovery.ingredientIds = []; discovery.preferences = []; discovery.choices = []; discovery.offset = 0;
        delete discovery.nameQuery;
    }
    if (hostile) return { discovery, selected, selectionIssue, showMenu: false, clarification: null };

    // Rejecting the selected meal is a change of intent, not permission to keep
    // its old ready draft. A replacement in a later affirmative clause may win.
    const rejectedPrevious = !!previous.description && normalize(message).split(/[,.;!?]|\bmas\b/).some(part => {
        const rejected = part.match(/\bnao quero(?: mais)?\s+(.+)/)?.[1];
        const terms = rejected ? words(rejected).filter(word => !genericWords.has(word)) : [];
        return terms.length > 0 && terms.every(word => words(previous.description!).includes(word));
    });
    if (rejectedPrevious) {
        next.description = null;
        discovery.ingredientIds = []; discovery.preferences = []; discovery.choices = []; discovery.offset = 0;
        delete discovery.nameQuery;
        showMenu = true;
    }

    // A reference belongs to exactly the last displayed page, never the global catalogue.
    const ordinal = text.match(/^(?:(?:quero|prefiro|escolho|vou querer) )?(?:a |o |opcao )?(primeira|primeiro|segunda|segundo|terceira|terceiro|[1-3])(?: opcao)?(?: por favor)?$/);
    const demonstrative = /^(?:(?:quero|escolho|prefiro) )?(?:esse|essa|este|esta)(?: prato| opcao)?(?: por favor)?$/.test(text);
    if (!declined && (ordinal || demonstrative)) {
        const indexes: Record<string, number> = { primeira: 0, primeiro: 0, segunda: 1, segundo: 1, terceira: 2, terceiro: 2, '1': 0, '2': 1, '3': 2 };
        const index = ordinal ? indexes[ordinal[1]] : discovery.choices.length === 1 ? 0 : -1;
        const choice = discovery.choices[index];
        const current = choice && menu.find(item => item.restaurantId === choice.restaurantId && item.menuItemId === choice.menuItemId && item.name === choice.name);
        const excludedIds = new Set((next.excluded ?? []).flatMap(excluded => catalog.filter(item => item.aliases.some(alias => normalize(alias) === normalize(excluded))).map(item => item.id)));
        if (current?.available && !current.ingredientIds.some(id => excludedIds.has(id as typeof catalog[number]['id']))) {
            next.description = current.name; selected = true;
        } else {
            next.description = null;
            selectionIssue = choice ? 'Essa opção não está disponível com suas restrições atuais. Vamos escolher novamente.' :
                'Não consegui identificar essa opção. Diga o nome do prato ou escolha um número da lista atual.';
            showMenu = !!choice;
        }
    }

    // Name resolution uses actual words in this message. A model cannot choose a
    // dish merely because it shares the ingredient that the person is exploring.
    if (!selected && !ordinal && !demonstrative && !declined && !clear) {
        const explicitNames = menu.filter(item => mentions(text, item.name));
        const name = explicitNames.sort((a, b) => text.lastIndexOf(normalize(b.name)) - text.lastIndexOf(normalize(a.name)))[0];
        const prefix = name ? normalize(message).slice(0, normalize(message).lastIndexOf(normalize(name.name)))
            .split(/[,.;!?]|\b(?:mas|prefiro|troque|agora quero)\b/).at(-1) ?? '' : '';
        if (name && !/\b(?:sem|nao quero)\b/.test(prefix)) {
            next.description = name.name; selected = true;
        } else if (!rejectedPrevious && !discoveryRequest && !menuRequest && !/\b(?:nao quero|sem)\b/.test(text)) {
            const sourceQuery = words(message).filter(word => !genericWords.has(word));
            const sourceNames = sourceQuery.length ? menu.filter(item => sourceQuery.every(word => words(item.name).includes(word))) : [];
            // Short dish names are valid replies too. Resolve catalogue words
            // directly, even when the model expands "bife" into a full name.
            const meaningful = sourceNames.length ? sourceQuery : words(proposed.description ?? '').filter(word => !genericWords.has(word));
            const source = words(message);
            if (meaningful.length && meaningful.every(word => source.includes(word)) &&
                (sourceNames.length || /\b(?:quero|gostaria|prefiro|troque|pedir|comer)\b/.test(text))) {
                const matchingNames = [...new Set(menu.filter(item => meaningful.every(word => words(item.name).includes(word))).map(item => item.name))];
                if (matchingNames.length > 1) {
                    next.description = null;
                    discovery.nameQuery = meaningful.join(' '); discovery.offset = 0; showMenu = true;
                } else {
                    next.description = matchingNames[0] ?? proposed.description ?? null;
                    selected = true;
                }
            }
        }
    }

    // Ingredient preferences are discovery filters, not confirmed dish selections.
    const discoveryText = clear && text.includes('quero') ? text.slice(text.lastIndexOf('quero')) : text;
    const positive = discoveryText.replace(/\b(?:sem|exclua|excluir|nao quero)\b.*?(?=\b(?:mas|quero|com)\b|$)/g, ' ');
    const mentionedIds = catalog.filter(item => !['tempero', 'embalagem'].includes(item.id) &&
        item.aliases.some(alias => mentions(positive, alias))).map(item => item.id);
    if (!selected && (!declined || clear) && (discoveryRequest || changing || (!next.description && mentionedIds.length > 0))) {
        if (changing || discoveryRequest) delete discovery.nameQuery;
        discovery.ingredientIds = changing ? mentionedIds : [...new Set([...discovery.ingredientIds, ...mentionedIds])];
        discovery.offset = 0;
        showMenu = true;
        if (changing) next.description = null;
    }
    if (changing && !selected && !declined && !mentionedIds.length) {
        next.description = null; discovery.ingredientIds = []; discovery.offset = 0; showMenu = true;
        delete discovery.nameQuery;
    }
    if (selected) {
        discovery.choices = []; discovery.offset = 0; delete discovery.nameQuery;
        if (next.description !== previous.description) { discovery.ingredientIds = []; discovery.preferences = []; }
    }
    const vague = ['leve', 'pouco', 'rapido'].filter(word => new RegExp(`\\b${word}(?:a)?\\b`).test(text));
    discovery.preferences = [...new Set([...discovery.preferences, ...vague])];
    // An exclusion should refresh an existing shortlist without silently editing a recipe.
    if (!selected && discovery.ingredientIds.length && JSON.stringify(previous.excluded) !== JSON.stringify(next.excluded)) showMenu = true;
    if (more) discovery.offset += 3;
    else if (showMenu) discovery.offset = 0;
    const clarification = vague.includes('leve') && !next.description ?
        'Quando diz leve, você prefere mais legumes ou está pensando em comer menos? A demo não calcula calorias.' :
        vague.includes('pouco') && next.portions === null ?
            'Quando diz pouco, você fala de menos comida ou de gastar menos? A demo oferece uma porção padrão por compra.' :
            vague.includes('rapido') && next.maxMinutes === null ? 'Qual é seu prazo máximo em minutos?' : null;
    return { discovery, selected, selectionIssue, showMenu, clarification };
}

export function discoveryOptions(menu: Menu, draft: CustomerDraft, discovery: CustomerDiscovery) {
    const excludedIds = new Set((draft.excluded ?? []).flatMap(value => catalog.filter(item =>
        item.aliases.some(alias => normalize(alias) === normalize(value))).map(item => item.id as string)));
    const eligible = menu.filter(item => item.available && discovery.ingredientIds.every(id => item.ingredientIds.includes(id)) &&
        (!discovery.nameQuery || words(discovery.nameQuery).every(word => words(item.name).includes(word))) &&
        !item.ingredientIds.some(id => excludedIds.has(id)) &&
        (draft.budget === null || item.totalCents! <= cents(draft.budget)) &&
        (draft.maxMinutes === null || item.etaMinutes <= draft.maxMinutes));
    // One representative per dish: final purchase compares eligible restaurants
    // offering that dish, under the separately authorized selection preference.
    eligible.sort((a, b) => draft.selectionPreference === 'BEST_RATED' ?
        (b.ratingTenths ?? -1) - (a.ratingTenths ?? -1) || (a.totalCents! - b.totalCents!) : a.totalCents! - b.totalCents!);
    const unique = eligible.filter((item, index) => eligible.findIndex(other => other.name === item.name) === index);
    const start = discovery.offset >= unique.length ? 0 : discovery.offset;
    discovery.offset = start;
    const options = unique.slice(start, start + 3);
    discovery.choices = options.map(({ restaurantId, menuItemId, name }) => ({ restaurantId, menuItemId, name }));
    return { options, hasMore: start + 3 < unique.length };
}
