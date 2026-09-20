import { z } from 'zod';
import type { RFQ, Offer, Recipe, Stock } from '../../domain/types.ts';
import { publicRating } from '../../domain/ratings.ts';

const id = z.string().min(1).max(100);
const money = z.number().int().safe().nonnegative();
export const restaurantRequestSchema = z.object({
    protocol: z.literal('ibyara.exchange.v1'), rfqId: id, restaurantId: id,
    dishName: z.string().min(1).max(200).optional(),
    required: z.array(id).max(30), excluded: z.array(id).max(20),
    quantity: z.literal(1), zone: z.string().min(1).max(100),
    maxMinutes: z.number().int().min(1).max(180), expiresAt: z.string().datetime(),
}).strict();
export const priceQuoteSchema = z.object({
    subtotalCents: money, deliveryCents: money, buyerFeeCents: money, totalCents: money,
}).strict().refine(q => q.totalCents === q.subtotalCents + q.deliveryCents + q.buyerFeeCents,
    'Total must include subtotal, delivery and buyer fees');
export const restaurantOfferSchema = z.object({
    protocol: z.literal('ibyara.exchange.v1'), offerId: id, rfqId: id, restaurantId: id,
    recipeId: id, recipeVersion: z.number().int().positive(), dish: z.string().min(1).max(200),
    composition: z.array(z.string().max(200)).max(30), quantity: z.literal(1),
    price: priceQuoteSchema, etaMinutes: z.number().int().positive(),
    ratingTenths: z.number().int().min(0).max(50).nullable(),
    ratingCount: z.number().int().safe().nonnegative(), ratingIsDemo: z.boolean(),
    expiresAt: z.string().datetime(), executionMode: z.literal('SANDBOX'),
}).strict();
export type RestaurantRequest = z.infer<typeof restaurantRequestSchema>;
export type RestaurantOffer = z.infer<typeof restaurantOfferSchema>;
export type PriceQuote = z.infer<typeof priceQuoteSchema>;
export type MenuItem = Pick<Recipe, 'id' | 'name' | 'version' | 'status' | 'components'>;
export type Ingredient = Pick<Stock, 'id' | 'name' | 'unit' | 'basis'>;

export function toRestaurantRequest(q: RFQ, restaurantId: string): RestaurantRequest {
    return restaurantRequestSchema.parse({ protocol: 'ibyara.exchange.v1', rfqId: q.id, restaurantId,
        ...(q.dishName ? { dishName: q.dishName } : {}), required: q.required, excluded: q.excluded, quantity: 1, zone: q.zone,
        maxMinutes: q.maxMinutes, expiresAt: q.expiresAt });
}
export function toRestaurantOffer(o: Offer): RestaurantOffer {
    return restaurantOfferSchema.parse({ protocol: 'ibyara.exchange.v1', offerId: o.id,
        rfqId: o.rfqId, restaurantId: o.merchantId, recipeId: o.recipeId,
        recipeVersion: o.recipeVersion, dish: o.dish, composition: o.composition,
        quantity: 1, price: { subtotalCents: o.subtotalCents, deliveryCents: o.deliveryCents,
            buyerFeeCents: o.buyerFeeCents, totalCents: o.totalCents },
        etaMinutes: o.eta, ...publicRating(o.merchantId, o), expiresAt: o.expiresAt, executionMode: 'SANDBOX' });
}
