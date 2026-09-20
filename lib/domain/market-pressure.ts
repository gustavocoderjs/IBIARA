import type { Policy, PricingReceipt } from './types.ts';

export type DemandState = 'LOW' | 'NORMAL' | 'HIGH';

export type MarketContext = {
    simulatedBuyerCount: number;
    demandState: DemandState;
    availableCapacity: number;
    activeOrders: number;
    surplusState: boolean;
    commercialPolicy: Pick<Policy, 'maxDiscountBps' | 'maxMarkupBps' | 'surplusDiscountBps'>;
    baseReceipt: Pick<PricingReceipt, 'subtotalCents' | 'floorCents' | 'ceilingCents'>;
};

export type MarketPressure = {
    pressure: number;
    publicSignal: string;
    commercialAdjustment: {
        direction: 'DISCOUNT' | 'MARKUP' | 'NONE';
        bps: number;
    };
    simulatedPriceCents: number;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const demandScore: Record<DemandState, number> = { LOW: 0, NORMAL: 40, HIGH: 100 };

/**
 * Evaluates market pressure for the sandbox only. It consumes an existing
 * pricing receipt and never creates RFQs, orders, stock movements or events.
 */
export function evaluateMarketPressure(context: MarketContext): MarketPressure {
    const policy = context.commercialPolicy;
    const capacity = Math.max(0, context.availableCapacity + context.activeOrders);
    const capacityPressure = capacity === 0 ? 100 : Math.round((context.activeOrders * 100) / capacity);
    const pressure = clamp(Math.round(demandScore[context.demandState] * 0.6 + capacityPressure * 0.4), 0, 100);
    const discountCap = Math.min(policy.maxDiscountBps, policy.surplusDiscountBps);
    const discountBps = context.surplusState && pressure < 70
        ? Math.round(discountCap * (100 - pressure) / 100)
        : 0;
    const markupBps = pressure >= 75
        ? Math.round(policy.maxMarkupBps * (pressure - 75) / 25)
        : 0;
    const adjustmentBps = discountBps > 0 ? -discountBps : markupBps;
    const candidate = Math.round(context.baseReceipt.subtotalCents * (10000 + adjustmentBps) / 10000);
    const simulatedPriceCents = clamp(candidate, context.baseReceipt.floorCents, context.baseReceipt.ceilingCents);
    const direction = discountBps > 0 ? 'DISCOUNT' : markupBps > 0 ? 'MARKUP' : 'NONE';
    const capacitySignal = context.availableCapacity <= 0 ? 'Limite operacional atingido' : pressure >= 75 ? 'Capacidade pressionada' : 'Capacidade disponível';
    const publicSignal = direction === 'DISCOUNT' ? (context.surplusState ? 'Excedente disponível · condição favorável' : 'Condição comercial favorável') : direction === 'MARKUP' ? `${capacitySignal} · condição normal` : `${capacitySignal} · condição normal`;
    return { pressure, publicSignal, commercialAdjustment: { direction, bps: Math.abs(adjustmentBps) }, simulatedPriceCents };
}