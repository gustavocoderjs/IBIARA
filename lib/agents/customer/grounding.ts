import type { CustomerDraft } from './schemas.ts';
import { catalog } from '../../domain/fixtures.ts';

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const units: Record<string, number> = { zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4,
    cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13,
    catorze: 14, quatorze: 14, quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19,
    vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80,
    noventa: 90, cem: 100, cento: 100 };
const one = '(?:um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove)';
const tens = '(?:vinte|trinta|quarenta|cinquenta|sessenta|setenta|oitenta|noventa)';
const wordNumber = `(?:cento e (?:${tens}(?: e ${one})?|${one}|dez|onze|doze|treze|quinze)|cem|${tens}(?: e ${one})?|dezesseis|dezessete|dezoito|dezenove|catorze|quatorze|quinze|treze|doze|onze|dez|zero|${one})`;
const number = `(?:\\d+(?:[.,]\\d{1,2})?|${wordNumber})`;
const numeric = (value: string) => /^\d/.test(value) ? Number(value.replace(',', '.')) :
    value.split(/\s+e\s+/).reduce((sum, part) => sum + (units[part] ?? NaN), 0);
const monetary = (value: number) => value > 0 && value < 10000 ? value.toFixed(2) : undefined;
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const mentions = (text: string, value: string) => new RegExp(`\\b${escape(normalize(value))}\\b`).test(text);
const clauses = (text: string) => text.split(/[,;!?](?!\d)|\.\s+|\bmas\b/).map(value => value.trim()).filter(Boolean);
const uncertain = (text: string) => /\b(?:talvez|exemplo|hipoteticamente|nao sei|ainda nao sei|e se|seria|nao escolhi)\b/.test(text);
const denied = (text: string) => /\bnao\s+(?:tenho|quero|posso|vou|preciso|aceito|pago|consigo|sera|seria)\b/.test(text);
const question = (text: string) => /\b(?:quanto custa|qual o preco|custa|cobram?|preco do|preco da|preco final|total do pedido|oferta de|vi (?:um|uma|o|a)|anuncio|frete (?:e|de)|a entrega e)\b/.test(text);
const numberMatches = (pattern: string, text: string) => [...text.matchAll(new RegExp(pattern, 'g'))];
const shortNumber = (text: string) => text.match(new RegExp(`^(?:(?:so|apenas|ate|no maximo|pode ser|na verdade|corrigindo|sao|somos|para)\\s+)?(${number})(?:\\s+por favor)?[.!]?$`));
const upperBound = (text: string) => text
    .replace(/\bnao (?:quero|posso|vou|pretendo|consigo|devo) (?:gastar|pagar|esperar|aguardar) (?:mais|acima) (?:do que|de)\s+/g, 'ate ')
    .replace(/\bnao (?:quero|posso|vou|consigo|devo) (?:passar de|ultrapassar(?: o limite de)?)\s+/g, 'ate ');
function explicitOtherRegion(text: string) {
    const place = text.match(/\b(?:(?:(?:a )?entrega(?: (?:sera|vai ser))?|sera|vai ser|moro) (?:em|no|na)|(?:meu )?(?:bairro|regiao|endereco) (?:e|sera|de))\s+([a-z][a-z -]*)/)?.[1].trim();
    return !!place && !/^(?:mesm[oa]|outr[oa]|algum|qualquer|local|lugar|endereco|bairro|regiao|restaurante|prato|pedido|cardapio|horario|dia|momento|inicio|fim|comeco|total|maximo|minimo|que|meu|minha|seu|sua|casa|trabalho|escritorio|empresa|hotel|faculdade|escola|hospital)\b/.test(place) &&
        !catalog.some(item => item.aliases.some(alias => place === alias || place.startsWith(`${alias} `)));
}
type NumericField = 'budget' | 'portions' | 'maxMinutes';

/** A schema-valid model value is still only a proposal. This accepts textual evidence,
 * never the model's ungrounded numbers. Unsupported/ambiguous language stays pending. */
export function groundCustomerPatch(proposed: Partial<CustomerDraft>, draft: CustomerDraft,
    message: string, pendingQuestion?: keyof CustomerDraft | null): Partial<CustomerDraft> {
    const text = normalize(message), result: Partial<CustomerDraft> = {};
    // Commands targeting model instructions, credentials or commercial internals
    // are not evidence of the buyer's spending/time/quantity limits. Safety facts
    // below still apply even when a malicious command is in the same message.
    const commercialInstruction = /\bignore\b.*\b(?:instrucoes|regras|prompt|sistema)\b/.test(text) ||
        /\b(?:fixe|defina|altere|mude|force|invente)\b.*\b(?:preco|total|taxa|estoque|nota|margem)\b/.test(text) ||
        /\bsem (?:mandato|autorizacao)\b|\b(?:api[_ -]?key|chaves? (?:de |da )?api)\b|\bnlk-/.test(text);
    const parts = clauses(text);
    const values: Record<NumericField, number[]> = { budget: [], portions: [], maxMinutes: [] };
    const currency = /r\$|\breais?\b|\borcamento\b/.test(text);
    const duration = /\b(?:minutos?|min|horas?|prazo)\b/.test(text);
    for (const source of parts) {
        if (commercialInstruction) break;
        const part = upperBound(source);
        if (uncertain(part) || denied(part) || question(part) || /\bsem (?:alterar|mudar)\b/.test(part)) continue;
        const foreignMoney = /\b(?:dolares?|euros?|usd|eur|libras?|pesos?)\b/.test(part);
        for (const match of numberMatches(`(?<![\\w.,-])(${number})\\s*(?:reais?|brl)\\b|r\\$\\s*(${number})(?![\\d.,])`, part))
            if (!foreignMoney) values.budget.push(numeric(match[1] ?? match[2]));
        for (const match of numberMatches(`\\b(?:meu )?(?:orcamento|limite|posso gastar|posso pagar|tenho para gastar)\\s*(?:e|de|:|ate)?\\s*(${number})(?![\\d.,])`, part))
            if (!foreignMoney && (!duration || currency)) values.budget.push(numeric(match[1]));
        for (const match of numberMatches(`(?<![\\w.,-])(${number})\\s*(minutos?|min|horas?|h)\\b`, part)) {
            if (/\bas\s*$/.test(part.slice(0, match.index))) continue; // A clock time is not a duration.
            values.maxMinutes.push(numeric(match[1]) * (/^(?:hora|h)/.test(match[2]) ? 60 : 1));
        }
        if (/\bmeia hora\b/.test(part)) values.maxMinutes.push(30);
        for (const match of numberMatches(`(?<![\\w.,-])(${number})\\s*(?:porcoes|porcao|marmitas?|pratos?|refeicoes|refeicao|pessoas?)\\b`, part))
            values.portions.push(numeric(match[1]));
        if (/\b(?:quero|pedir|comer|gostaria de)\b/.test(part) && /\b(?:um|uma) bife\b/.test(part)) values.portions.push(1);
        const short = shortNumber(part);
        if (short && !/\b(?:dolares?|euros?|kg|gramas?|nota|estrelas?)\b/.test(text)) {
            const field = pendingQuestion === 'budget' || pendingQuestion === 'portions' || pendingQuestion === 'maxMinutes' ? pendingQuestion :
                /^(?:so|apenas|na verdade|corrigindo)\b/.test(part) && currency !== duration ? (currency ? 'budget' : 'maxMinutes') : null;
            if (field) values[field].push(numeric(short[1]));
        }
    }
    // A correction clause replaces a negated value; competing affirmative values
    // stay ambiguous rather than selecting an arbitrary number from the message.
    for (const field of ['budget', 'portions', 'maxMinutes'] as const) {
        const distinct = [...new Set(values[field])];
        if (distinct.length > 1) { Object.assign(result, { [field]: null }); continue; }
        if (!distinct.length) continue;
        const value = distinct[0];
        if (field === 'budget') { const amount = monetary(value); if (amount) result.budget = amount; }
        else if (Number.isInteger(value) && value >= 1 && value <= (field === 'portions' ? 20 : 180)) result[field] = value;
    }
    if (values.portions.length > 0 && /\b(?:um|uma|\d+)\s+(?:bife|marmita|prato|porcao|refeicao)\b.*\b(?:e|ou)\b.*\b(?:um|uma|\d+)\s+(?:bife|marmita|prato|porcao|refeicao)\b/.test(text))
        result.portions = null;
    const yes = /^(?:sim|isso|isso mesmo|correto|exato|pode ser)[.!]?$/.test(text);
    const no = /^(?:nao|nenhum|nenhuma)[.!]?$/.test(text);
    const menuTail = text.match(/^nao[,;.!]\s*(.*)$/)?.[1];
    const menuWords = new Set('me passe mostre diga envie liste traga apresente ver saber quero gostaria de pode poderia quais que o os a as tem ha sao pratos prato cardapio opcoes opcao disponivel disponiveis por favor seu seus'.split(' '));
    const noThenMenu = !!menuTail && /\b(?:pratos?|cardapio|opcoes|disponiveis|disponivel)\b/.test(menuTail) &&
        (menuTail.match(/[a-z]+/g) ?? []).every(word => menuWords.has(word));
    if (pendingQuestion === 'portions' && yes) result.portions = 1;
    if (pendingQuestion === 'portions' && no) result.portions = null;
    if (pendingQuestion === 'zone' && (yes || no)) result.zone = yes ? 'demo_butanta' : 'other';
    for (const part of parts) {
        if (uncertain(part)) continue;
        if (/\b(?:butanta|butata)\b/.test(part)) result.zone = denied(part) ? 'other' : 'demo_butanta';
        else if (!denied(part) && explicitOtherRegion(part)) result.zone = 'other';
    }

    const noneExcluded = /\b(?:nenhum ingrediente (?:a |para )?excluir|nenhuma restricao|sem restricoes|nao (?:tenho|quero) (?:exclusoes|restricoes)|nao quero excluir (?:nada|nenhum ingrediente))\b/.test(text);
    const safetyAnswer = pendingQuestion === 'foodSafetyConcern' || pendingQuestion === 'excluded';
    if (noneExcluded || (safetyAnswer && (no || noThenMenu) && draft.foodSafetyConcern !== true)) result.excluded = [];
    const exclusions: string[] = [];
    for (const part of parts) {
        const rejected = part.match(/\bnao quero (?:mais )?(?:(?:o|a|um|uma) )?(.+)/)?.[1]?.replace(/[.]+$/, '').trim();
        // Rejecting a whole dish does not exclude each ingredient in its name.
        // A bare "não quero X" is an exclusion only when X names one ingredient.
        const selectedDish = normalize(draft.description ?? '');
        const rejectsSelectedDish = !!rejected && !!selectedDish &&
            (mentions(rejected, selectedDish) || selectedDish.startsWith(`${rejected} `));
        const ingredientRejection = rejected && !rejectsSelectedDish &&
            catalog.some(item => item.aliases.some(alias => alias === rejected)) ? rejected : undefined;
        const exclusion = part.match(/\b(?:sem|exclua|excluir|retire|remova|nao pode ter|nao posso (?:comer|consumir)|nao (?:me )?(?:passe|mande|mostre|traga|envie) (?:pratos?|marmitas?) com)\s+(.+)/)?.[1] ?? ingredientRejection;
        if (!exclusion || /^(?:alerg|restricoes|alterar|mudar|pressa)/.test(exclusion)) continue;
        for (const item of catalog) if (item.aliases.some(alias => mentions(exclusion, alias))) exclusions.push(item.aliases[0]);
        for (const item of proposed.excluded ?? []) if (mentions(exclusion, item)) exclusions.push(item);
    }
    if (exclusions.length) result.excluded = [...new Set([...(draft.excluded ?? []), ...exclusions])].slice(0, 20);

    const negativeSafety = /\b(?:(?:nao tenho|nao possuo|sem) alergias?|nao sou (?:alergic[oa]|celiac[oa])|(?:nao (?:ha|tenho)|sem) (?:risco de )?contaminacao)\b/g;
    const deniesSafety = negativeSafety.test(text);
    negativeSafety.lastIndex = 0;
    const positiveSafety = /alerg|celiac|anafil|contaminacao/.test(text.replace(negativeSafety, ''));
    const retracts = /\b(?:corrigindo|correcao|me enganei|informei errado|foi engano|na verdade|retiro a informacao)\b/.test(text);
    if (positiveSafety || (safetyAnswer && yes)) result.foodSafetyConcern = true;
    else if ((deniesSafety || (safetyAnswer && (no || noThenMenu))) && (draft.foodSafetyConcern !== true || (retracts && deniesSafety)))
        result.foodSafetyConcern = false;

    for (const part of parts) {
        if (denied(part) || uncertain(part)) continue;
        if (/\b(?:melhor avaliado|mais bem avaliado|melhor avaliacao|maior nota|mais avaliado|prefiro avaliacao|priorizar avaliacao)\b/.test(part))
            result.selectionPreference = 'BEST_RATED';
        else if (/\b(?:menor preco|mais barato|priorizar preco|prefiro preco|prioridade (?:e )?(?:o )?preco)\b/.test(part))
            result.selectionPreference = 'LOWEST_PRICE';
    }
    // Explicit removal is separate from unknown extraction. Safety cannot be
    // removed via "forget allergies"; it requires the retraction above.
    const clearTerms: Partial<Record<keyof CustomerDraft, RegExp>> = {
        budget: /\b(?:orcamento|limite|valor)\b/, portions: /\b(?:quantidade|porcoes|porcao)\b/,
        maxMinutes: /\b(?:prazo|tempo|minutos)\b/, zone: /\b(?:regiao|endereco|bairro)\b/,
        excluded: /\b(?:exclusoes|ingredientes excluidos)\b/,
        selectionPreference: /\b(?:criterio|preferencia|avaliacao)\b/,
    };
    for (const part of parts) {
        if (!/\b(?:esqueca|retire|remova|apague|limpe|desconsidere)\b/.test(part)) continue;
        for (const field of Object.keys(clearTerms) as (keyof typeof clearTerms)[])
            if (clearTerms[field]?.test(part)) Object.assign(result, { [field]: null });
    }
    return result;
}
