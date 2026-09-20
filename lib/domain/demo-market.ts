import { baseRecipe, demoPolicy, restaurant, stockCatalog } from './fixtures.ts';
import { event, type Component, type Recipe, type Restaurant, type State } from './types.ts';

export const DEMO_MARKET_VERSION = 1;
const SOURCE = 'fixture_demo_market_v1';
const restaurantIds = ['niko', 'casa', 'panela'] as const;
type RestaurantId = (typeof restaurantIds)[number];

function component(item: string, quantity: string, unit: Component['unit'], basis: Component['basis'], yieldFactor = '1'): Component {
    return { item, quantity, unit, basis, yield: yieldFactor, source: SOURCE };
}
const raw = (item: string, quantity: string) => component(item, quantity, 'g', 'RAW_EDIBLE');
const cooked = (item: string, quantity: string, yieldFactor: string) => component(item, quantity, 'g', 'COOKED_EDIBLE', yieldFactor);
const bought = (item: string, quantity: string, unit: Component['unit'] = 'g') => component(item, quantity, unit, 'AS_PURCHASED');
const rice = () => cooked('arroz', '250', '2.5');
const beans = () => cooked('feijao', '80', '2');

function recipe(restaurantId: RestaurantId, slug: string, name: string, at: string, components: Component[], preparation: string): Recipe {
    return { id: `demo_${restaurantId}_${slug}`, name, version: 1, status: 'CONFIRMED', servings: 1,
        otherVariableCents: 80, preparation, mode: 'ON_DEMAND', confirmedAt: at,
        components: [...components, bought('tempero', '1', 'un'), bought('embalagem', '1', 'un')] };
}

function recipesFor(id: RestaurantId, at: string): Recipe[] {
    const canonical = baseRecipe(at);
    canonical.id = `demo_${id}_bife_a_cavalo`;
    const menu: Record<RestaurantId, Recipe[]> = {
        niko: [
            recipe('niko', 'frango_grelhado', 'Frango grelhado com arroz e feijão', at,
                [raw('frango', '180'), rice(), beans(), raw('cenoura', '80')],
                'Frango grelhado; arroz e feijão cozidos com os rendimentos medidos; cenoura refogada.'),
            recipe('niko', 'omelete_legumes', 'Omelete de legumes com arroz', at,
                [bought('ovo', '2', 'un'), raw('cenoura', '60'), raw('abobrinha', '80'), rice()],
                'Omelete com cenoura e abobrinha, servida com arroz cozido.'),
            recipe('niko', 'macarrao_carne', 'Macarrão com carne e tomate', at,
                [cooked('macarrao', '250', '2.5'), raw('patinho', '120'), raw('tomate', '100')],
                'Macarrão cozido com rendimento medido, patinho picado e tomate refogado.'),
        ],
        casa: [
            recipe('casa', 'frango_legumes', 'Frango com legumes e arroz', at,
                [raw('frango', '180'), raw('cenoura', '80'), raw('abobrinha', '80'), rice()],
                'Frango grelhado, legumes refogados e arroz cozido.'),
            recipe('casa', 'lentilha_arroz', 'Lentilha com arroz e salada', at,
                [cooked('lentilha', '160', '2'), rice(), raw('tomate', '70'), raw('alface', '40')],
                'Lentilha cozida com rendimento medido, arroz e salada de tomate e alface.'),
            recipe('casa', 'macarrao_queijo', 'Macarrão com tomate e queijo', at,
                [cooked('macarrao', '250', '2.5'), raw('tomate', '120'), bought('queijo', '40')],
                'Macarrão cozido, molho de tomate preparado no cenário e queijo muçarela.'),
        ],
        panela: [
            recipe('panela', 'frango_brocolis', 'Frango com brócolis e arroz', at,
                [raw('frango', '180'), raw('brocolis', '100'), rice()],
                'Frango grelhado, brócolis no vapor e arroz cozido.'),
            recipe('panela', 'omelete_tomate', 'Omelete com tomate e arroz', at,
                [bought('ovo', '2', 'un'), raw('tomate', '80'), bought('queijo', '30'), rice()],
                'Omelete de tomate e queijo, servida com arroz cozido.'),
            recipe('panela', 'macarrao_frango', 'Macarrão com frango e brócolis', at,
                [cooked('macarrao', '250', '2.5'), raw('frango', '150'), raw('brocolis', '80')],
                'Macarrão cozido com rendimento medido, frango grelhado e brócolis.'),
        ],
    };
    return [canonical, ...menu[id]];
}

function pristineNiko(s: State, r: Restaurant) {
    return r.name === 'Sua cozinha' && r.address === '' && r.stage === 'START' &&
        !r.recipes.length && !r.draft && !r.policy && !r.policyHistory.length && !r.receiptHistory.length &&
        !r.conversation.some(t => t.role === 'user') && !s.purchases.length &&
        !s.orders.some(o => o.merchantId === r.id) &&
        r.stock.every(i => i.quantity === '0' && i.reserved === '0' && i.safety === '0' &&
            i.costNumerator === null && i.costDenominator === null && !i.eligible && !i.surplus);
}

/** Adds fixtures once within the caller's transaction. Never replenishes existing stock. */
export function ensureDemoMarket(s: State, at: string): void {
    if ((s.demoMarketVersion ?? 0) >= DEMO_MARKET_VERSION) return;
    for (const id of restaurantIds) {
        let r = s.restaurants.find(entry => entry.id === id);
        if (!r) {
            r = restaurant(id, at, id !== 'niko');
            s.restaurants.push(r);
        }
        if (id === 'niko' && pristineNiko(s, r)) {
            r.name = 'Marmita Quentinha do Seu Niko';
            r.address = 'Avenida Corifeu de Azevedo Marques, 488';
            r.stock = stockCatalog(at, true);
            r.policy = demoPolicy(at);
            r.policyHistory = [structuredClone(r.policy)];
            r.stage = 'ACTIVE';
        }
        // Old scenarios retain quantities, costs, reservations, policies, history and recipe versions.
        for (const item of stockCatalog(at, true)) {
            if (!r.stock.some(existing => existing.id === item.id)) r.stock.push(item);
        }
        for (const candidate of recipesFor(id, at)) {
            if (!r.recipes.some(existing => existing.id === candidate.id ||
                existing.name.toLocaleLowerCase('pt-BR') === candidate.name.toLocaleLowerCase('pt-BR'))) {
                r.recipes.push(candidate);
            }
        }
    }
    s.demoMarketVersion = DEMO_MARKET_VERSION;
    event(s, 'DEMO_MARKET_READY', 'buyer', 'Três cozinhas de demonstração disponíveis',
        'Cardápios e estoques fictícios separados por restaurante. Os preços são calculados pelo motor; nenhum pedido foi criado.',
        'demo_market_v1', at);
}
