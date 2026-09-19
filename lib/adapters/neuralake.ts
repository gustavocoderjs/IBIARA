import { type Recipe, type Restaurant, uid } from '../domain/types.ts';
import { catalog } from '../domain/fixtures.ts';
import { cents, decimal, mul, rational, compare } from '../domain/money.ts';
export const providerCapabilities = { provider: 'NeuraLake', mode: 'LOCAL_MOCK', model: null, tokens: null, cost: null, crossMemory: false, structuredOutput: 'local-validated-patch', verifiedAt: null };
export const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const numbers = (s: string) => normalize(s).replace(/\b(um|uma)\b/g, '1').replace(/\b(dois|duas)\b/g, '2').replace(/\b(tres)\b/g, '3');
export const identify = (s: string) => catalog.find(i => i.aliases.some(a => new RegExp(`\\b${a}\\b`).test(normalize(s))));
export function registration(text: string) { const name = text.match(/(?:nome (?:dele|do restaurante) [ée]|(?:restaurante|chama)\s*[:é])\s*([^.!\n]+)/i); const address = text.match(/(?:localizad[oa]s?\s+n[ao]|endere[çc]o\s*[:é]|fica\s+n[ao])\s*([^!\n]+)/i); return { name: name?.[1].trim(), address: address?.[1].trim().replace(/\.$/, '') }; }
export function newDraft(text: string): Recipe { return { id: uid('recipe'), name: text.split(/[.!\n]/)[0].replace(/^(?:novo prato|prato|nome)\s*[:é]\s*/i, '').slice(0, 100), version: 1, status: 'DRAFT', components: [], servings: null, otherVariableCents: null, preparation: null, confirmedAt: null, mode: 'ON_DEMAND' }; }
export function recipePatch(current: Recipe, text: string): Recipe {
    const r = structuredClone(current), t = numbers(text);
    // Preserve unsupported ingredient fragments instead of silently omitting them.
    const sections = t.replace(/oleo e temperos/g, 'oleo_temperos').split(/[,;]|\s+e\s+(?=\d|um|uma|dois|duas)/);
    const unknown = sections.filter(part => /\d+\s*(?:g|gr|gramas?|kg|unidades?|un|doses?)?\s+(?:de\s+)?[a-z]/.test(part) && !identify(part.replace(/oleo_temperos/g, 'oleo e temperos')) && !/custo|rende|rendimento|preparo|pesam|porcao|porcoes|medid|limp|pronto/.test(part));
    if (unknown.length)
        r.unparsed = [...new Set([...(r.unparsed ?? []), ...unknown.map(x => x.trim())])];
    const remove = t.match(/remover ingrediente nao reconhecido:\s*(.+)/);
    if (remove)
        r.unparsed = (r.unparsed ?? []).filter(x => !x.includes(remove[1].trim()));
    if (/\b(?:ou|aproximadamente|talvez)\b/.test(t)) {
        r.unparsed = [...(r.unparsed ?? []), text];
        return r;
    }
    for (const i of catalog) {
        if (!i.aliases.some(a => new RegExp(`\\b${a}\\b`).test(t)))
            continue;
        let c = r.components.find(c => c.item === i.id);
        if (!c) {
            c = { item: i.id, quantity: null, unit: i.unit, basis: null, yield: null, source: text };
            r.components.push(c);
        }
        const aliases = i.aliases.join('|');
        const pattern = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(kg|quilogramas?|g|gr|gramas?|ml|unidades?|un|doses?)?\\s*(?:de\\s+)?(?:${aliases})\\b`);
        const m = t.match(pattern);
        if (m && (i.unit === 'un' || m[2])) {
            let q = m[1].replace(',', '.');
            if (m[2]?.startsWith('k'))
                q = decimal(mul(rational(q), rational('1000')));
            if (compare(q, '0') > 0) {
                c.quantity = q;
                c.source = text;
            }
        }
        if (i.unit === 'un' && c.quantity) {
            c.basis = 'AS_PURCHASED';
            c.yield = '1';
        }
        const y = t.match(new RegExp(`(?:${aliases})\\s+(?:rende(?:mento)?|rendimento(?:\\s+de)?|fator)\\s*[:=]?\\s*(\\d+(?:[.,]\\d+)?)`));
        if (y && compare(y[1].replace(',', '.'), '0') > 0) {
            c.yield = y[1].replace(',', '.');
            c.source = text;
        }
    }
    const meat = r.components.find(c => ['patinho', 'frango'].includes(c.item));
    if (meat && /bifes?|patinho|frango/.test(t)) {
        const m = t.match(/(?:pesam?|peso(?:\s+total)?(?:\s+e)?)\s*(\d+(?:[.,]\d+)?)\s*(kg|gramas?|g)\b/);
        if (m) {
            meat.quantity = m[2] === 'kg' ? decimal(mul(rational(m[1].replace(',', '.')), rational('1000'))) : m[1].replace(',', '.');
            meat.source = text;
        }
        if (/cru[sa]?\b/.test(t) && /limp[oa]s?/.test(t)) {
            meat.basis = 'RAW_EDIBLE';
            meat.yield = '1';
        }
        else if (/pront[oa]|cozid[oa]/.test(t) && !/acompanhamentos/.test(t))
            meat.basis = 'COOKED_EDIBLE';
    }
    if (/acompanhamentos.*pront|arroz.*pronto.*feijao|pesados prontos/.test(t))
        for (const c of r.components)
            if (['arroz', 'feijao', 'batata'].includes(c.item))
                c.basis = 'COOKED_EDIBLE';
    for (const c of r.components) {
        const m = t.match(new RegExp(`${c.item}\\s+(?:cru|comprado)`));
        if (m && !/rende/.test(t)) {
            c.basis = 'AS_PURCHASED';
            c.yield = '1';
        }
    }
    const servings = t.match(/rende\s+(\d+)\s*por[cç][aãõo]/);
    if (servings)
        r.servings = Number(servings[1]);
    const cost = t.match(/(?:outros custos(?: variaveis)?|custo variavel)\s*[:=]?\s*(?:r\$\s*)?(\d+(?:[.,]\d+)?)/);
    if (cost)
        r.otherVariableCents = cents(cost[1]);
    if (/preparo\s/.test(t))
        r.preparation = text;
    return r;
}
export function pending(r: Recipe): string[] { const p: string[] = (r.unparsed ?? []).map(x => `Ingrediente não reconhecido: ${x}. O mock não pode confirmar esta ficha sem resolver o item.`); if (!r.components.length)
    p.push('Quais ingredientes e quantidades entram no prato?'); for (const c of r.components) {
    const name = catalog.find(i => i.id === c.item)?.name ?? c.item;
    if (!c.quantity)
        p.push(`Quanto pesa ${name.toLowerCase()}? Preciso do peso total, não só do número de peças.`);
    if (!c.basis)
        p.push(`${name}: foi pesado cru e limpo ou pronto?`);
    if (!c.yield)
        p.push(`${name}: quanto rende depois do preparo? Informe a razão entre quantidade pronta e comprada.`);
} if (!r.components.some(c => c.item === 'tempero'))
    p.push('Informe a dose medida de óleo e temperos.'); if (!r.components.some(c => c.item === 'embalagem'))
    p.push('Quantas embalagens por receita?'); if (!r.servings)
    p.push('Quantas porções a receita rende?'); if (r.otherVariableCents === null)
    p.push('Quanto custam os demais itens variáveis por porção?'); if (!r.preparation)
    p.push('Como o prato é preparado?'); return p; }
export function suggested(r: Restaurant) { if (r.stage === 'START')
    return 'Byara, quero cadastrar meu restaurante na plataforma. O nome dele é Marmita Quentinha do Seu Niko. Estamos localizados na Avenida Corifeu de Azevedo Marques, 488.'; if (!r.draft)
    return 'Bife a cavalo. São dois bifes de patinho, um ovo, 150 gramas de batata frita, 250 gramas de arroz e 80 gramas de feijão.'; const d = r.draft; if (d.components.some(c => !c.quantity || !c.basis))
    return 'Os dois bifes juntos pesam 200 gramas, crus e limpos. Os acompanhamentos estão pesados prontos.'; if (d.components.some(c => !c.yield))
    return 'Arroz rende 2,5; feijão rende 2; batata rende 0,75. São os rendimentos que medi na cozinha.'; if (pending(d).length)
    return 'Uso 1 dose de óleo e temperos e 1 embalagem. Outros custos variáveis: R$ 0,80. Preparo grelhado e frito. Rende 1 porção.'; return 'Confirmo a ficha técnica.'; }
// TODO(NEURALAKE-01): implement server-only authenticated HTTP adapter after
// provider smoke tests. Map messages/schema/context_ref/limits to VERIFIED fields.
// TODO(NEURALAKE-02): validate output with strict schema, one bounded repair,
// timeout, per-principal context, call/token limits and usage returned by provider.
// TODO(NEURALAKE-03): enable Cross Memory only after tenant-isolation tests.
export interface InferenceAdapter {
    complete(input: {
        principalId: string;
        purpose: 'recipe' | 'intent';
        text: string;
        contextRef: string;
        maxCalls: number;
    }): Promise<{
        patch: unknown;
        tokens: number | null;
        cost: number | null;
    }>;
}
export class NeuraLakeAdapter implements InferenceAdapter {
    async complete(): Promise<never> { throw new Error('PROVIDER_UNAVAILABLE: NeuraLake integration pending; use explicit LOCAL_MOCK adapter.'); }
}
