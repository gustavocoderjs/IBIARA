import { type State, type Restaurant, type Policy, type Recipe, type Stock, uid } from './types.ts';
export const catalog = [
    { id: 'patinho', name: 'Patinho', unit: 'g', basis: 'RAW_EDIBLE', aliases: ['patinho', 'bife', 'bifes', 'carne', 'carne bovina'] },
    { id: 'frango', name: 'Frango', unit: 'g', basis: 'RAW_EDIBLE', aliases: ['frango'] },
    { id: 'ovo', name: 'Ovo', unit: 'un', basis: 'AS_PURCHASED', aliases: ['ovo', 'ovos'] },
    { id: 'batata', name: 'Batata', unit: 'g', basis: 'AS_PURCHASED', aliases: ['batata', 'batatas'] },
    { id: 'arroz', name: 'Arroz cru', unit: 'g', basis: 'AS_PURCHASED', aliases: ['arroz'] },
    { id: 'feijao', name: 'Feijão cru', unit: 'g', basis: 'AS_PURCHASED', aliases: ['feijao'] },
    { id: 'tempero', name: 'Óleo e temperos (dose medida)', unit: 'un', basis: 'AS_PURCHASED', aliases: ['oleo e temperos', 'dose de tempero'] },
    { id: 'embalagem', name: 'Embalagem', unit: 'un', basis: 'AS_PURCHASED', aliases: ['embalagem', 'embalagens'] },
    { id: 'cenoura', name: 'Cenoura', unit: 'g', basis: 'RAW_EDIBLE', aliases: ['cenoura', 'cenouras'] },
    { id: 'abobrinha', name: 'Abobrinha', unit: 'g', basis: 'RAW_EDIBLE', aliases: ['abobrinha', 'abobrinhas'] },
    { id: 'brocolis', name: 'Brócolis', unit: 'g', basis: 'RAW_EDIBLE', aliases: ['brocolis'] },
    { id: 'macarrao', name: 'Macarrão seco', unit: 'g', basis: 'AS_PURCHASED', aliases: ['macarrao', 'espaguete', 'penne'] },
    { id: 'tomate', name: 'Tomate', unit: 'g', basis: 'RAW_EDIBLE', aliases: ['tomate', 'tomates'] },
    { id: 'queijo', name: 'Queijo muçarela', unit: 'g', basis: 'AS_PURCHASED', aliases: ['queijo', 'mucarela', 'mussarela'] },
    { id: 'lentilha', name: 'Lentilha seca', unit: 'g', basis: 'AS_PURCHASED', aliases: ['lentilha', 'lentilhas'] },
    { id: 'alface', name: 'Alface', unit: 'g', basis: 'RAW_EDIBLE', aliases: ['alface'] },
] as const;
export const demoPolicy = (at: string): Policy => ({ version: 1, objective: 'SURPLUS_FIRST', referenceCents: 3490, minMarginBps: 2500, maxDiscountBps: 2500, maxMarkupBps: 500, feeBps: 1000, fixedCents: 20, minContributionCents: 0, surplusDiscountBps: 2000, maxRounds: 2, offerTtlSeconds: 90, capacity: 12, confirmedAt: at });
export function baseRecipe(at: string, protein = 'patinho'): Recipe { return { id: uid('recipe'), name: protein === 'patinho' ? 'Bife a cavalo' : 'Frango da casa', version: 1, status: 'CONFIRMED', servings: 1, otherVariableCents: 80, preparation: 'Proteína grelhada, acompanhamentos preparados; uma dose medida de óleo e temperos por porção.', mode: 'ON_DEMAND', confirmedAt: at, components: [{ item: protein, quantity: '200', unit: 'g', basis: 'RAW_EDIBLE', yield: '1', source: 'fixture_demo_v1' }, { item: 'ovo', quantity: '1', unit: 'un', basis: 'AS_PURCHASED', yield: '1', source: 'fixture_demo_v1' }, { item: 'batata', quantity: '150', unit: 'g', basis: 'COOKED_EDIBLE', yield: '0.75', source: 'fixture_demo_v1' }, { item: 'arroz', quantity: '250', unit: 'g', basis: 'COOKED_EDIBLE', yield: '2.5', source: 'fixture_demo_v1' }, { item: 'feijao', quantity: '80', unit: 'g', basis: 'COOKED_EDIBLE', yield: '2', source: 'fixture_demo_v1' }, { item: 'tempero', quantity: '1', unit: 'un', basis: 'AS_PURCHASED', yield: '1', source: 'fixture_demo_v1' }, { item: 'embalagem', quantity: '1', unit: 'un', basis: 'AS_PURCHASED', yield: '1', source: 'fixture_demo_v1' }] }; }
export function stockCatalog(at: string, seeded = false): Stock[] {
    // Exact cents per stock unit. These are synthetic fixtures, not market prices.
    const defaults: Record<(typeof catalog)[number]['id'], readonly [string, string, string]> = {
        patinho: ['6000', '4', '1'], frango: ['2000', '2', '1'], ovo: ['30', '90', '1'],
        batata: ['6000', '1', '1'], arroz: ['5000', '3', '5'], feijao: ['2000', '4', '5'],
        tempero: ['30', '68', '1'], embalagem: ['30', '150', '1'],
        cenoura: ['2400', '3', '5'], abobrinha: ['1800', '7', '10'], brocolis: ['1800', '6', '5'],
        macarrao: ['3000', '4', '5'], tomate: ['2400', '4', '5'], queijo: ['1200', '3', '1'],
        lentilha: ['1500', '7', '5'], alface: ['900', '1', '1'],
    };
    return catalog.map(i => {
        const [quantity, numerator, denominator] = defaults[i.id];
        return { id: i.id, name: i.name, unit: i.unit, basis: i.basis, quantity: seeded ? quantity : '0',
            reserved: '0', safety: '0', costNumerator: seeded ? numerator : null,
            costDenominator: seeded ? denominator : null, eligible: seeded,
            expiresAt: new Date(Date.parse(at) + 30 * 86400000).toISOString(), surplus: seeded && i.id === 'patinho' };
    });
}
export function restaurant(id: string, at: string, seeded = false): Restaurant { return { id, name: seeded ? (id === 'casa' ? 'Sabor de Casa' : 'Cozinha Expressa') : 'Sua cozinha', address: seeded ? 'Endereço fictício · Butantã' : '', zone: 'demo_butanta', eta: id === 'casa' ? 30 : 25, deliveryCents: id === 'panela' ? 490 : 390, fictional: true, recipes: seeded ? [baseRecipe(at)] : [], stock: stockCatalog(at, seeded), policy: seeded ? { ...demoPolicy(at), referenceCents: id === 'casa' ? 3690 : 3790, maxDiscountBps: 1000, objective: 'BALANCED' } : null, policyHistory: [], receiptHistory: [], conversation: [], draft: null, stage: 'START' }; }
export function nextCount(at: string, days: number, hour: string) { const sp = new Date(Date.parse(at) - 3 * 3600000); const [h, m] = hour.split(':').map(Number); return new Date(Date.UTC(sp.getUTCFullYear(), sp.getUTCMonth(), sp.getUTCDate() + days, h + 3, m)).toISOString(); }
export function initialState(ownerId: string, at: string): State { const s: State = { version: 1, ownerId, restaurants: [restaurant('niko', at), restaurant('casa', at, true), restaurant('panela', at, true)], buyerConversation: [], mandates: [], rfqs: [], offers: [], orders: [], events: [], purchases: [], count: null, schedule: { days: 3, hour: '09:00', timeZone: 'America/Sao_Paulo', nextAt: nextCount(at, 3, '09:00'), lastFiredAt: null }, clockOffset: 0, idempotency: {}, sequence: 0 }; s.restaurants[0].conversation.push({ id: uid('turn'), role: 'assistant', text: 'Oi, eu sou a Byara. Vamos colocar sua cozinha no mapa? Me conte o nome do restaurante e onde ele fica.', at, mode: 'LOCAL_MOCK' }); return s; }
export const DEMO_TURNS = [
    'Byara, quero cadastrar meu restaurante na plataforma. O nome dele é Marmita Quentinha do Seu Niko. Estamos localizados na Avenida Corifeu de Azevedo Marques, 488.',
    'Bife a cavalo. São dois bifes de patinho, um ovo, 150 gramas de batata frita, 250 gramas de arroz e 80 gramas de feijão.',
    'Os dois bifes juntos pesam 200 gramas, crus e limpos. Os acompanhamentos estão pesados prontos.',
    'Arroz rende 2,5; feijão rende 2; batata rende 0,75. São os rendimentos que medi na cozinha.',
    'Uso 1 dose de óleo e temperos e 1 embalagem. Outros custos variáveis: R$ 0,80. Preparo grelhado e frito. Rende 1 porção.',
    'Confirmo a ficha técnica.'
];
export const purchaseFixture = { key: 'DEMO-NOTA-001', environment: 'DEMO', issuer: 'Distribuidora de exemplo', lines: [{ item: 'patinho', description: 'Patinho cru limpo', quantity: '6000', unit: 'g', totalCents: 24000 }, { item: 'frango', description: 'Frango cru', quantity: '2000', unit: 'g', totalCents: 4000 }, { item: 'ovo', description: 'Ovos por unidade', quantity: '30', unit: 'un', totalCents: 2700 }, { item: 'batata', description: 'Batata', quantity: '6000', unit: 'g', totalCents: 6000 }, { item: 'arroz', description: 'Arroz cru', quantity: '5000', unit: 'g', totalCents: 3000 }, { item: 'feijao', description: 'Feijão cru', quantity: '2000', unit: 'g', totalCents: 1600 }, { item: 'tempero', description: 'Dose medida de óleo e temperos', quantity: '30', unit: 'un', totalCents: 2040 }, { item: 'embalagem', description: 'Embalagem', quantity: '30', unit: 'un', totalCents: 4500 }] };
