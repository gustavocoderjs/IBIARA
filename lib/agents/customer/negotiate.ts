import { z } from 'zod';
import { getState, type AggregateStore } from '../../domain/transaction.ts';
import { DomainError, demand, event, nowIso } from '../../domain/types.ts';
import { negotiate, validMandate } from '../../domain/commerce.ts';
import { toRestaurantRequest, toRestaurantOffer } from '../shared/contracts.ts';
import { restaurantIds, type RestaurantId } from '../shared/router.ts';
import { consultRestaurant } from '../restaurants/service.ts';
import type { ChatProvider } from '../shared/neuralake.ts';
import { recordUsage } from '../shared/telemetry.ts';

export const agentNegotiationSchema = z.object({ type: z.literal('agent_negotiate'),
    scope: z.literal('buyer'), rfqId: z.string().min(1).max(100) }).strict();
export type RestaurantConnection = { provider: ChatProvider; mode: 'mock' | 'live' };

export async function negotiateWithAgents(store: AggregateStore, owner: string, rfqId: string,
    key: string, digest: string, connections: Record<RestaurantId, RestaurantConnection>) {
    const row = await getState(store, owner);
    const previous = row.state.idempotency[key];
    if (previous) {
        if (previous.digest !== digest) throw new DomainError('IDEMPOTENCY_CONFLICT', 'Chave já utilizada.', 409);
        return { state: row.state, result: previous.result, replayed: true };
    }
    const q = row.state.rfqs.find(q => q.id === rfqId), at = nowIso(row.state);
    demand(q, 'RFQ_NOT_FOUND', 'Busca não encontrada.');
    demand(q.status === 'QUOTED' && q.expiresAt > at, 'RFQ_CLOSED', 'Esta busca não está aberta para negociação.');
    validMandate(row.state.mandates.find(m => m.id === q.mandateId), at);
    // Only the buyer coordinator can fan out. No arbitrary recipient/body from HTTP or LLM.
    const decisions = await Promise.all(restaurantIds.map(id => {
        const offers = row.state.offers.filter(o => o.rfqId === rfqId && o.merchantId === id &&
            o.status === 'ISSUED' && o.expiresAt > at).map(toRestaurantOffer);
        return consultRestaurant(id, toRestaurantRequest(q, id), offers, connections[id].provider, connections[id].mode);
    }));
    // Inference never runs in a CAS retry. Revalidate the entire operation on the unchanged snapshot.
    const state = structuredClone(row.state), commitAt = nowIso(state);
    for (const d of decisions) {
        recordUsage(state, d.usage);
        for (const offer of state.offers.filter(o => o.rfqId === rfqId && o.merchantId === d.restaurantId && o.status === 'ISSUED'))
            if (offer.id !== d.offerId) offer.status = 'SUPERSEDED';
        event(state, 'RESTAURANT_AGENT_DECISION', 'buyer', 'Restaurante respondeu ao agente comprador',
            `${d.restaurantId}: ${d.offerId ? 'proposta publicada' : 'participação recusada'} (${d.usage.mode}).`, rfqId, commitAt, d.restaurantId);
    }
    const result = { ...negotiate(state, rfqId, commitAt), agents: decisions };
    state.idempotency[key] = { digest, result };
    if (!await store.compareAndSwap(owner, row.revision, state, commitAt)) {
        const latest = await getState(store, owner), replay = latest.state.idempotency[key];
        if (replay?.digest === digest) return { state: latest.state, result: replay.result, replayed: true };
        throw new DomainError('CONCURRENT_UPDATE', 'O cenário mudou. Tente novamente com a mesma solicitação.', 409);
    }
    return { state, result, replayed: false };
}
