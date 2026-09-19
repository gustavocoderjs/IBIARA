import type { Role, Restaurant, Recipe, Turn, Event, Offer, Order, Count, Purchase, Mandate, RFQ, PricingReceipt } from '../domain/types';
export type Dish = Recipe & {
    pricing: PricingReceipt | null;
    blocked: {
        code: string;
        message: string;
    } | null;
};
export type ViewState = {
    role: Role;
    now: string;
    sequence: number;
    events: Event[];
    clockOffset: number;
    integrations: Record<string, unknown>;
    restaurant?: Omit<Restaurant, 'recipes'> & {
        recipes: Dish[];
        pending: string[];
        suggested: string;
    };
    orders: Order[];
    offers: Offer[];
    count?: Count | null;
    purchases?: Purchase[];
    schedule?: {
        days: number;
        hour: string;
        nextAt: string;
    };
    mandates?: Mandate[];
    rfqs?: RFQ[];
    conversation?: Turn[];
};
export type Send = (c: Record<string, unknown>, options?: {
    quiet?: boolean;
}) => Promise<{
    result: { mandateId?: string; rfqId?: string; [key: string]: unknown };
    state: ViewState;
} | null>;
