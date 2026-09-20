import { z } from 'zod';
import { DomainError } from '../../domain/types.ts';
import type { AgentId } from './config.ts';
import { restaurantRequestSchema, restaurantOfferSchema } from './contracts.ts';

export const restaurantIds = ['niko', 'casa', 'panela'] as const;
export type RestaurantId = typeof restaurantIds[number];
export const agentMessageSchema = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('request'), from: z.literal('buyer'),
        to: z.enum(restaurantIds), payload: restaurantRequestSchema }).strict(),
    z.object({ kind: z.literal('offer'), from: z.enum(restaurantIds),
        to: z.literal('buyer'), payload: restaurantOfferSchema }).strict(),
]);
export type AgentMessage = z.infer<typeof agentMessageSchema>;
export function routeAgentMessage(sender: AgentId, input: unknown): AgentMessage {
    const parsed = agentMessageSchema.safeParse(input);
    if (!parsed.success || parsed.data.from !== sender ||
        parsed.data.payload.restaurantId !== (sender === 'buyer' ? parsed.data.to : sender))
        throw new DomainError('UNAUTHORIZED_AGENT_ROUTE', 'Rota entre agentes não permitida.', 403);
    return parsed.data;
}
