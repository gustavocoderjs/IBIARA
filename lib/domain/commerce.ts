import { type State, type RFQ, type Offer, type Restaurant, type Recipe, type Mandate, DomainError, demand, event, uid } from './types.ts';
import { quote, requirements, available, freeCapacity } from './pricing.ts';
import { qadd, qsub, money } from './money.ts';
import { normalize } from '../adapters/neuralake.ts';
import { catalog } from './fixtures.ts';
import { mealIntentIssue } from './meal-intent.ts';
import { compareOffers, publicRating } from './ratings.ts';
const dishIdentity = (recipe: Recipe) => normalize(recipe.mode === 'PREPRODUCED' ?
    recipe.name.replace(/ \(pré-produzido\)$/, '') : recipe.name);
const currentRecipes = (restaurant: Restaurant) => restaurant.recipes.filter(recipe =>
    recipe.status === 'CONFIRMED' && !restaurant.recipes.some(newer =>
        newer.status === 'CONFIRMED' && newer.id === recipe.id && newer.version > recipe.version));
export function validMandate(m: Mandate | undefined, at: string): asserts m is Mandate { demand(m, 'MANDATE_REQUIRED', 'Autorize um limite antes de negociar.'); demand(!m.revoked, 'MANDATE_REVOKED', 'A autorização foi revogada.'); demand(m.expiresAt > at, 'MANDATE_EXPIRED', 'A autorização expirou.'); demand(m.used < m.maxUses, 'MANDATE_EXHAUSTED', 'Esta autorização já foi utilizada.'); }
// Only the public RFQ enters the merchant service. No buyer mandate/budget.
export function merchantOffer(r: Restaurant, recipe: Recipe, rfq: RFQ, at: string, requested?: number, previous?: Offer): Offer {
    const receipt = quote(r, recipe, at, requested);
    const subtotalCents = receipt.subtotalCents;
    return { id: uid('offer'), rfqId: rfq.id, merchantId: r.id, merchantName: r.name, ...publicRating(r.id, r), recipeId: recipe.id, recipeVersion: recipe.version, dish: recipe.name, composition: recipe.components.map(c => catalog.find(i => i.id === c.item)?.name ?? c.item), subtotalCents, deliveryCents: r.deliveryCents, buyerFeeCents: 0, totalCents: subtotalCents + r.deliveryCents, eta: r.eta, expiresAt: new Date(Math.min(Date.parse(at) + r.policy!.offerTtlSeconds * 1000, Date.parse(rfq.expiresAt))).toISOString(), status: 'ISSUED', round: previous ? previous.round + 1 : 0, previousOfferId: previous?.id ?? null, quoteToken: uid('quote'), receipt, requirements: requirements(recipe) };
}
export function createRfq(s: State, mandateId: string, at: string) {
    const m = s.mandates.find(m => m.id === mandateId);
    validMandate(m, at);
    demand(m.excluded.every(id => catalog.some(i => i.id === id)), 'RESTRICTION_UNVERIFIED', 'Não consigo verificar um dos ingredientes excluídos nesta demonstração.');
    const text = normalize(m.description);
    demand(!/alerg|celiac|anafil|contaminacao/.test(text), 'RESTRICTION_UNVERIFIED', 'Esta demonstração não verifica alergênicos nem contaminação cruzada. Não posso executar essa compra.');
    const portions = text.match(/(\d+)\s*(?:porcoes|marmitas|pratos|pessoas)/);
    demand(!portions || Number(portions[1]) === 1, 'INTENT_UNSUPPORTED', 'Esta release autoriza uma porção por compra.');
    demand(!mealIntentIssue(m.description, s), 'INTENT_UNSUPPORTED', 'Refeição não reconhecida no cardápio da demo. Escolha um prato ou ingredientes cadastrados; não farei substituições.');
    const namedRecipe = s.restaurants.flatMap(currentRecipes).filter(r =>
        text.includes(dishIdentity(r))).sort((a, b) => dishIdentity(b).length - dishIdentity(a).length)[0];
    const required: string[] = catalog.filter(i => !m.excluded.includes(i.id) && i.aliases.some(a => new RegExp(`\\b${a}\\b`).test(text))).map(i => i.id);
    if (!required.length && namedRecipe)
        required.push(...namedRecipe.components.filter(c => !['tempero', 'embalagem'].includes(c.item)).map(c => c.item));
    if (/bife a cavalo/.test(text))
        for (const id of ['patinho', 'ovo', 'arroz', 'feijao'])
            if (!required.includes(id as never))
                required.push(id as never);
    demand(required.length > 0, 'INTENT_UNSUPPORTED', 'Descreva os ingredientes desejados; o interpretador local não entendeu esta intenção.');
    const rfq: RFQ = { id: uid('rfq'), mandateId: m.id, description: required.map(id => catalog.find(i => i.id === id)?.name ?? id).join(', '), required, excluded: m.excluded, zone: m.zone, maxMinutes: m.maxMinutes, createdAt: at, expiresAt: new Date(Date.parse(at) + 120000).toISOString(), status: 'OPEN', winnerId: null, reasons: [] };
    if (namedRecipe) rfq.dishName = namedRecipe.name.replace(/ \(pré-produzido\)$/, '');
    s.rfqs.push(rfq);
    event(s, 'RFQ_CREATED', 'buyer', 'Busca aberta', 'Seu agente enviou composição, região e prazo. O limite autorizado continua privado.', rfq.id, at, undefined, { required, zone: rfq.zone, maxMinutes: rfq.maxMinutes });
    for (const r of s.restaurants) {
        if (r.zone !== rfq.zone || r.eta > rfq.maxMinutes || !r.policy || freeCapacity(s, r) <= 0)
            continue;
        const recipes = currentRecipes(r).filter(x =>
            (!rfq.dishName || dishIdentity(x) === normalize(rfq.dishName)) &&
            (!/\bomelete\b/.test(text) || /\bomelete\b/.test(dishIdentity(x))) &&
            rfq.required.every(id => x.components.some(c => c.item === id)) && !rfq.excluded.some(id => x.components.some(c => c.item === id)));
        const issued: Offer[] = [];
        for (const recipe of recipes) {
            try {
                issued.push(merchantOffer(r, recipe, rfq, at));
            }
            catch (e) {
                if (!(e instanceof DomainError))
                    throw e;
                rfq.reasons.push(e.code);
            }
        }
        const offer = issued.sort((a, b) => a.totalCents - b.totalCents || (r.recipes.find(x => x.id === a.recipeId)?.mode === 'PREPRODUCED' ? -1 : 1) || a.recipeId.localeCompare(b.recipeId))[0];
        if (offer) {
            s.offers.push(offer);
            r.receiptHistory.push(offer.receipt);
            event(s, 'OFFER_ISSUED', 'both', `${r.name} enviou uma proposta`, `${money(offer.totalCents)} com entrega · ${offer.eta} min`, rfq.id, at, r.id);
        }
        else if (recipes.length) {
            event(s, 'MERCHANT_DECLINED', 'merchant', 'Participação recusada', 'Nenhuma ficha com custo, política e estoque elegíveis.', rfq.id, at, r.id);
        }
    }
    rfq.status = s.offers.some(o => o.rfqId === rfq.id) ? 'QUOTED' : 'NO_MATCH';
    if (rfq.status === 'NO_MATCH')
        event(s, 'NO_ELIGIBLE_OFFER', 'buyer', 'Nenhuma proposta compatível', 'Nenhuma compra foi realizada. Reveja a composição, o prazo ou a disponibilidade.', rfq.id, at);
    return { rfqId: rfq.id, status: rfq.status };
}
export function counter(s: State, offerId: string, requested: number, at: string) {
    const old = s.offers.find(o => o.id === offerId);
    demand(old, 'OFFER_NOT_FOUND', 'Proposta não encontrada.');
    demand(old.status === 'ISSUED' && old.expiresAt > at, 'OFFER_EXPIRED', 'A proposta expirou ou já foi substituída.');
    const rfq = s.rfqs.find(q => q.id === old.rfqId)!;
    const m = s.mandates.find(m => m.id === rfq.mandateId);
    validMandate(m, at);
    demand(requested + old.deliveryCents <= m.maxCents - m.committedCents, 'BUDGET_EXCEEDED', 'A contraproposta excede o limite total autorizado.');
    const r = s.restaurants.find(r => r.id === old.merchantId)!;
    demand(old.round < r.policy!.maxRounds, 'MAX_ROUNDS', 'Limite de rodadas atingido.');
    const recipe = r.recipes.find(x => x.id === old.recipeId && x.version === old.recipeVersion)!;
    const offer = merchantOffer(r, recipe, rfq, at, requested, old);
    old.status = 'SUPERSEDED';
    s.offers.push(offer);
    r.receiptHistory.push(offer.receipt);
    event(s, 'COUNTER_ACCEPTED', 'both', 'Contraproposta aceita', `${r.name} aceitou ${money(requested)} + ${money(offer.deliveryCents)} de entrega.`, rfq.id, at, r.id);
    return offer;
}
export function accept(s: State, offerId: string, quoteToken: string, at: string) {
    const o = s.offers.find(o => o.id === offerId);
    demand(o && o.quoteToken === quoteToken, 'INVALID_QUOTE', 'Proposta inválida.');
    demand(o.status === 'ISSUED' && o.expiresAt > at, 'OFFER_EXPIRED', 'Proposta expirada ou indisponível.');
    const rfq = s.rfqs.find(q => q.id === o.rfqId)!;
    demand(!['CLOSED', 'NO_MATCH'].includes(rfq.status), 'RFQ_CLOSED', 'Esta busca já foi encerrada.');
    const m = s.mandates.find(m => m.id === rfq.mandateId);
    validMandate(m, at);
    demand(o.totalCents <= m.maxCents - m.committedCents, 'BUDGET_EXCEEDED', 'O total com entrega excede o limite.');
    demand(o.eta <= m.maxMinutes, 'DELIVERY_WINDOW_UNAVAILABLE', 'Prazo indisponível.');
    const r = s.restaurants.find(r => r.id === o.merchantId)!;
    demand(freeCapacity(s, r) > 0, 'CAPACITY_UNAVAILABLE', 'A cozinha está sem capacidade.');
    const recipe = r.recipes.find(x => x.id === o.recipeId && x.version === o.recipeVersion)!;
    available(r, recipe, at);
    // Issued quotes retain their economic snapshot; eligibility and availability
    // are revalidated. All effects commit through repository compare-and-swap.
    for (const need of o.requirements) {
        const item = r.stock.find(i => i.id === need.item)!;
        item.reserved = qadd(item.reserved, need.quantity);
    }
    m.committedCents += o.totalCents;
    m.used++;
    o.status = 'ACCEPTED';
    rfq.status = 'CLOSED';
    rfq.winnerId = o.id;
    const order = { id: uid('order'), offerId: o.id, rfqId: rfq.id, mandateId: m.id, merchantId: r.id, merchantName: r.name, dish: o.dish, totalCents: o.totalCents, subtotalCents: o.subtotalCents, deliveryCents: o.deliveryCents, status: 'CONFIRMED' as const, at, consumed: false, executionMode: 'SANDBOX' as const, requirements: structuredClone(o.requirements) };
    s.orders.push(order);
    event(s, 'STOCK_RESERVED', 'merchant', 'Insumos reservados', 'Todos os componentes foram reservados. A baixa acontece ao iniciar o preparo.', rfq.id, at, r.id, { requirements: o.requirements, offerId: o.id });
    event(s, 'ORDER_CONFIRMED', 'both', 'Pedido confirmado em sandbox', `${o.dish} · ${money(o.totalCents)}. Nenhum pagamento real foi realizado.`, rfq.id, at, r.id);
    return { orderId: order.id };
}
export function negotiate(s: State, rfqId: string, at: string) {
    const rfq = s.rfqs.find(r => r.id === rfqId);
    demand(rfq, 'RFQ_NOT_FOUND', 'Busca não encontrada.');
    if (rfq.status === 'CLOSED') {
        const order = s.orders.find(o => o.rfqId === rfq.id);
        return { orderId: order?.id };
    }
    demand(rfq.expiresAt > at, 'OFFER_EXPIRED', 'A busca expirou. Autorize uma nova busca.');
    const m = s.mandates.find(m => m.id === rfq.mandateId);
    validMandate(m, at);
    // Buyer sees public prices, terms and its own mandate, never merchant receipts.
    const publicCandidates = s.offers.filter(o => o.rfqId === rfq.id && o.status === 'ISSUED' && o.expiresAt > at).map(o => ({ id: o.id, subtotal: o.subtotalCents, delivery: o.deliveryCents, total: o.totalCents, eta: o.eta, merchant: o.merchantId, round: o.round }));
    for (const o of publicCandidates) {
        const requested = Math.floor((o.subtotal - 1) / 100) * 100;
        if (requested > 0 && requested + o.delivery <= m.maxCents - m.committedCents) {
            try {
                counter(s, o.id, requested, at);
            }
            catch (e) {
                if (!(e instanceof DomainError))
                    throw e;
                event(s, 'COUNTER_REJECTED', 'buyer', 'Condição mantida', `${s.restaurants.find(r => r.id === o.merchant)!.name} manteve a proposta original.`, rfq.id, at, o.merchant);
            }
        }
    }
    const eligible = s.offers.filter(o => o.rfqId === rfq.id && o.status === 'ISSUED' && o.expiresAt > at && o.totalCents <= m.maxCents - m.committedCents && o.eta <= m.maxMinutes).sort((a, b) => compareOffers(a, b, m.selectionPreference));
    for (const o of eligible) {
        try {
            return accept(s, o.id, o.quoteToken, at);
        }
        catch (e) {
            if (!(e instanceof DomainError))
                throw e;
            rfq.reasons.push(e.code);
        }
    }
    rfq.status = 'NO_MATCH';
    rfq.reasons.push(eligible.length ? 'STOCK_INSUFFICIENT' : 'BUDGET_EXCEEDED');
    event(s, 'NO_ELIGIBLE_OFFER', 'buyer', 'Nenhuma oferta dentro dos seus limites', 'A busca terminou sem compra. O agente preservou a sua autorização.', rfq.id, at);
    return { status: 'NO_MATCH' };
}
export function orderAction(s: State, id: string, action: 'prepare' | 'ready' | 'cancel', at: string, scope: 'buyer' | 'merchant') {
    const o = s.orders.find(o => o.id === id);
    demand(o, 'ORDER_NOT_FOUND', 'Pedido não encontrado.');
    if (scope === 'merchant')
        demand(o.merchantId === 'niko', 'UNAUTHORIZED_SCOPE', 'Este pedido pertence a outro restaurante.');
    const r = s.restaurants.find(r => r.id === o.merchantId)!;
    if (action === 'prepare') {
        demand(scope === 'merchant', 'UNAUTHORIZED_SCOPE', 'Apenas o restaurante inicia o preparo.');
        if (o.consumed)
            return { orderId: o.id };
        demand(o.status === 'CONFIRMED', 'INVALID_STATE', 'Este pedido não pode iniciar preparo.');
        for (const x of o.requirements) {
            const i = r.stock.find(i => i.id === x.item)!;
            demand(i.eligible && i.expiresAt > at, 'STOCK_INELIGIBLE', 'Um insumo ficou inelegível. Cancele o pedido.');
            i.quantity = qsub(i.quantity, x.quantity);
            i.reserved = qsub(i.reserved, x.quantity);
        }
        o.consumed = true;
        o.status = 'PREPARING';
        event(s, 'INGREDIENT_CONSUMED', 'merchant', 'Preparo iniciado', 'Ingredientes baixados uma única vez.', o.rfqId, at, r.id, { orderId: o.id, requirements: o.requirements });
    }
    if (action === 'ready') {
        demand(scope === 'merchant', 'UNAUTHORIZED_SCOPE', 'Apenas o restaurante conclui o preparo.');
        demand(o.status === 'PREPARING', 'INVALID_STATE', 'Inicie o preparo antes de concluir.');
        o.status = 'READY';
        event(s, 'ORDER_READY', 'both', 'Pedido pronto em sandbox', 'Entrega não executada.', o.rfqId, at, r.id);
    }
    if (action === 'cancel') {
        if (o.status === 'CANCELLED')
            return { orderId: o.id };
        demand(o.status === 'CONFIRMED', 'CANCELLATION_UNAVAILABLE', 'O preparo já começou; cancelamento automático indisponível.');
        for (const x of o.requirements) {
            const i = r.stock.find(i => i.id === x.item)!;
            i.reserved = qsub(i.reserved, x.quantity);
        }
        const m = s.mandates.find(m => m.id === o.mandateId)!;
        m.committedCents -= o.totalCents;
        o.status = 'CANCELLED';
        event(s, 'RESERVATION_RELEASED', 'both', 'Pedido cancelado em sandbox', 'Reserva de insumos e orçamento liberada. Nenhum reembolso real.', o.rfqId, at, r.id);
    }
    return { orderId: o.id };
}
