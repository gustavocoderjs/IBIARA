import { type State, type Role, DomainError } from './types.ts';
import { quote } from './pricing.ts';
import { pending, suggested, providerCapabilities } from '../adapters/neuralake.ts';
import { agoraCapabilities } from '../adapters/agora.ts';
export function visibleEvents(s: State, role: Role) { return s.events.filter(e => (e.role === 'both' || e.role === role) && (role !== 'merchant' || !e.merchantId || e.merchantId === 'niko')); }
export function project(s: State, role: Role, at: string) {
    const common = { version: '0.3.0', mode: 'SANDBOX', role, now: at, sequence: s.sequence, events: visibleEvents(s, role).slice(-120), integrations: { neuralake: providerCapabilities, agora: agoraCapabilities, fiscal: { mode: 'XML_UPLOAD', qrConnected: false }, execution: { mode: 'SANDBOX', paymentReal: false, deliveryReal: false } }, telemetry: { llmCalls: 0, tokens: null, inferenceCost: null, priceEngine: 'EXACT_RATIONAL', protocol: 'ibyara.exchange.v1' }, clockOffset: s.clockOffset };
    if (role === 'buyer')
        return { ...common, conversation: s.buyerConversation, mandates: s.mandates, rfqs: s.rfqs.map(({ mandateId, ...q }) => q), offers: s.offers.map(({ receipt, requirements, ...o }) => o), orders: s.orders.map(({ requirements, ...o }) => o), restaurants: s.restaurants.map(r => ({ id: r.id, name: r.name, eta: r.eta, fictional: r.fictional, zone: r.zone })) };
    const r = s.restaurants[0];
    const active = r.recipes.filter(x => !r.recipes.some(y => y.id === x.id && y.version > x.version));
    const recipes = active.map(recipe => { try {
        return { ...recipe, pricing: quote(r, recipe, at), blocked: null };
    }
    catch (e) {
        return { ...recipe, pricing: null, blocked: e instanceof DomainError ? { code: e.code, message: e.message } : { code: 'INTERNAL_ERROR', message: 'Não foi possível calcular.' } };
    } });
    return { ...common, restaurant: { id: r.id, name: r.name, address: r.address, stage: r.stage, policy: r.policy, policyHistory: r.policyHistory, stock: r.stock, recipes, draft: r.draft, pending: r.draft ? pending(r.draft) : [], suggested: suggested(r), conversation: r.conversation, receiptHistory: r.receiptHistory }, purchases: s.purchases, count: s.count, schedule: s.schedule, offers: s.offers.filter(o => o.merchantId === r.id), orders: s.orders.filter(o => o.merchantId === r.id) };
}
export type Projection = ReturnType<typeof project>;
