import type { CustomerSession } from '../agents/customer/schemas.ts';
import type { DemoRestaurantId, DeliveryPointId } from './delivery.ts';
export type Role = 'merchant' | 'buyer';
export type SelectionPreference = 'LOWEST_PRICE' | 'BEST_RATED' | 'NEAREST' | 'FASTEST';
export type Basis = 'AS_PURCHASED' | 'RAW_EDIBLE' | 'COOKED_EDIBLE';
export type Component = {
    item: string;
    quantity: string | null;
    unit: 'g' | 'ml' | 'un';
    basis: Basis | null;
    yield: string | null;
    source: string;
};
export type Recipe = {
    unparsed?: string[];
    id: string;
    name: string;
    version: number;
    status: 'DRAFT' | 'CONFIRMED';
    components: Component[];
    otherVariableCents: number | null;
    servings: number | null;
    preparation: string | null;
    confirmedAt: string | null;
    mode: 'ON_DEMAND' | 'PREPRODUCED';
    preparedItem?: string;
};
export type Stock = {
    id: string;
    name: string;
    unit: 'g' | 'ml' | 'un';
    basis: Basis;
    quantity: string;
    reserved: string;
    safety: string;
    costNumerator: string | null;
    costDenominator: string | null;
    eligible: boolean;
    expiresAt: string;
    surplus: boolean;
};
export type Policy = {
    version: number;
    objective: 'BALANCED' | 'SURPLUS_FIRST';
    referenceCents: number;
    minMarginBps: number;
    maxDiscountBps: number;
    maxMarkupBps: number;
    feeBps: number;
    fixedCents: number;
    minContributionCents: number;
    surplusDiscountBps: number;
    maxRounds: number;
    offerTtlSeconds: number;
    capacity: number;
    confirmedAt: string;
};
export type Restaurant = {
    id: string;
    name: string;
    address: string;
    zone: string;
    eta: number;
    deliveryCents: number;
    fictional: boolean;
    ratingTenths?: number | null;
    ratingCount?: number;
    ratingIsDemo?: boolean;
    recipes: Recipe[];
    stock: Stock[];
    policy: Policy | null;
    policyHistory: Policy[];
    receiptHistory: PricingReceipt[];
    conversation: Turn[];
    draft: Recipe | null;
    stage: string;
};
export type Turn = {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    at: string;
    mode?: string;
};
export type Event = {
    id: number;
    type: string;
    at: string;
    role: Role | 'both';
    merchantId?: string;
    title: string;
    detail: string;
    correlationId: string;
    data?: Record<string, unknown>;
};
export type PricingReceipt = {
    recipeId: string;
    recipeVersion: number;
    policyVersion: number;
    variableCents: number;
    fixedCents: number;
    costCents: number;
    analyticalFloorCents: number;
    discountFloorCents: number;
    floorCents: number;
    ceilingCents: number;
    subtotalCents: number;
    feeCents: number;
    contributionCents: number;
    marginBps: number;
    strategy: string;
    breakdown: {
        item: string;
        quantity: string;
        cents: number;
    }[];
    stockSnapshot: string;
};
export type Offer = {
    id: string;
    rfqId: string;
    merchantId: string;
    merchantName: string;
    distanceMeters?: number | null;
    locationIsDemo?: boolean;
    ratingTenths?: number | null;
    ratingCount?: number;
    ratingIsDemo?: boolean;
    recipeId: string;
    recipeVersion: number;
    dish: string;
    composition: string[];
    subtotalCents: number;
    deliveryCents: number;
    buyerFeeCents: number;
    totalCents: number;
    eta: number;
    expiresAt: string;
    status: 'ISSUED' | 'ACCEPTED' | 'SUPERSEDED';
    round: number;
    previousOfferId: string | null;
    quoteToken: string;
    receipt: PricingReceipt;
    requirements: {
        item: string;
        quantity: string;
    }[];
};
export type Mandate = {
    id: string;
    maxCents: number;
    committedCents: number;
    used: number;
    maxUses: number;
    expiresAt: string;
    revoked: boolean;
    description: string;
    maxMinutes: number;
    selectionPreference?: SelectionPreference;
    restaurantId?: DemoRestaurantId | null;
    deliveryPointId?: DeliveryPointId | null;
    zone: string;
    excluded: string[];
    confirmedAt: string;
};
export type RFQ = {
    id: string;
    mandateId: string;
    restaurantId?: DemoRestaurantId | null;
    deliveryPointId?: DeliveryPointId | null;
    description: string;
    dishName?: string;
    required: string[];
    excluded: string[];
    zone: string;
    maxMinutes: number;
    createdAt: string;
    expiresAt: string;
    status: 'OPEN' | 'QUOTED' | 'CLOSED' | 'NO_MATCH';
    winnerId: string | null;
    reasons: string[];
};
export type Order = {
    id: string;
    offerId: string;
    rfqId: string;
    mandateId: string;
    merchantId: string;
    merchantName: string;
    dish: string;
    totalCents: number;
    subtotalCents: number;
    deliveryCents: number;
    status: 'CONFIRMED' | 'PREPARING' | 'READY' | 'CANCELLED';
    at: string;
    consumed: boolean;
    executionMode: 'SANDBOX';
    requirements: {
        item: string;
        quantity: string;
    }[];
};
export type PurchaseLine = {
    item: string;
    description: string;
    quantity: string;
    unit: string;
    totalCents: number;
};
export type Purchase = {
    id: string;
    key: string;
    environment: string;
    issuer: string;
    lines: PurchaseLine[];
    received: boolean;
    at: string;
    mode: string;
};
export type Count = {
    id: string;
    at: string;
    revision: number;
    lines: {
        item: string;
        quantity: string;
        previous: string;
        basis: Basis;
    }[];
    confirmed: boolean;
    source: string;
};
export type State = {
    demoMarketVersion?: number;
    customerAgent?: CustomerSession;
    inference?: { committedCalls: number; knownTokens: number; unknownTokenCalls: number };
    version: 1;
    ownerId: string;
    restaurants: Restaurant[];
    buyerConversation: Turn[];
    mandates: Mandate[];
    rfqs: RFQ[];
    offers: Offer[];
    orders: Order[];
    events: Event[];
    purchases: Purchase[];
    count: Count | null;
    schedule: {
        days: number;
        hour: string;
        timeZone: string;
        nextAt: string;
        lastFiredAt: string | null;
    };
    clockOffset: number;
    idempotency: Record<string, {
        digest: string;
        result: unknown;
    }>;
    sequence: number;
};
export class DomainError extends Error {
    constructor(public code: string, message: string, public status = 422) { super(message); }
}
export function demand(condition: unknown, code: string, message: string): asserts condition { if (!condition)
    throw new DomainError(code, message); }
export const nowIso = (s: State, realNow = Date.now()) => new Date(realNow + s.clockOffset).toISOString();
export const uid = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;
export function event(s: State, type: string, role: Event['role'], title: string, detail: string, correlationId: string, at: string, merchantId?: string, data?: Record<string, unknown>) { s.events.push({ id: ++s.sequence, type, role, title, detail, correlationId, at, merchantId, data }); }
export function say(s: State, role: Role, text: string, at: string, who: Turn['role'] = 'assistant') { const list = role === 'merchant' ? s.restaurants[0].conversation : s.buyerConversation; list.push({ id: uid('turn'), role: who, text, at, mode: 'LOCAL_MOCK' }); }
