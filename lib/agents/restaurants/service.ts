import { z } from 'zod';
import { DomainError } from '../../domain/types.ts';
import type { ChatProvider } from '../shared/neuralake.ts';
import type { RestaurantRequest, RestaurantOffer } from '../shared/contracts.ts';
import { routeAgentMessage, type RestaurantId } from '../shared/router.ts';
import { restaurantPrompt } from './prompts.ts';
import type { AgentUsage } from '../customer/schemas.ts';

const decisionSchema = z.discriminatedUnion('tool', [
    z.object({ tool: z.literal('submit_offer'), offerId: z.string().min(1).max(100) }).strict(),
    z.object({ tool: z.literal('decline'), reason: z.literal('NO_COMPATIBLE_OFFER') }).strict(),
]);
export type RestaurantDecision = { restaurantId: RestaurantId; offerId: string | null; usage: AgentUsage };

export async function consultRestaurant(id: RestaurantId, request: RestaurantRequest,
    candidates: RestaurantOffer[], provider: ChatProvider, mode: 'mock' | 'live'): Promise<RestaurantDecision> {
    const incoming = routeAgentMessage('buyer', { kind: 'request', from: 'buyer', to: id, payload: request });
    if (request.restaurantId !== id || candidates.some(o => o.restaurantId !== id || o.rfqId !== request.rfqId))
        throw new DomainError('UNAUTHORIZED_AGENT_CONTEXT', 'Contexto de restaurante inválido.', 403);
    // Each invocation owns a fresh context. Never append a shared/global chat history.
    const completion = mode === 'mock' ? {
        content: JSON.stringify(candidates.length ? { tool: 'submit_offer', offerId: candidates[0].offerId } :
            { tool: 'decline', reason: 'NO_COMPATIBLE_OFFER' }),
        usage: { mode: 'LOCAL_MOCK' as const, model: null, tokens: null, cost: null },
    } : await provider.complete([
        { role: 'system', content: restaurantPrompt(id) },
        { role: 'user', content: JSON.stringify({ message: incoming, ownCalculatedOffers: candidates }) },
    ]);
    let decision;
    try { decision = decisionSchema.parse(JSON.parse(completion.content)); }
    catch { throw new DomainError('PROVIDER_INVALID_OUTPUT', 'O restaurante não retornou uma decisão válida.', 502); }
    if (decision.tool === 'decline') return { restaurantId: id, offerId: null, usage: completion.usage };
    const offer = candidates.find(o => o.offerId === decision.offerId);
    if (!offer) throw new DomainError('UNAUTHORIZED_AGENT_OFFER', 'Proposta fora do contexto do restaurante.', 403);
    routeAgentMessage(id, { kind: 'offer', from: id, to: 'buyer', payload: offer });
    return { restaurantId: id, offerId: offer.offerId, usage: completion.usage };
}
