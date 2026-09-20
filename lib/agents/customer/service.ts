import { getState, type AggregateStore } from '../../domain/transaction.ts';
import { DomainError, event, nowIso } from '../../domain/types.ts';
import type { ChatProvider, ChatMessage } from '../shared/neuralake.ts';
import { CUSTOMER_SYSTEM_PROMPT } from './prompt.ts';
import { agentDecisionSchema, type CustomerTurn } from './schemas.ts';
import { emptyCustomerSession } from './state.ts';
import { draftReadiness, runCustomerTool } from './tools.ts';
import { recordUsage } from '../shared/telemetry.ts';
import { ensureDemoMarket } from '../../domain/demo-market.ts';
import { publicMenu } from './menu.ts';

export async function customerTurn(store: AggregateStore, owner: string, input: CustomerTurn,
    key: string, digest: string, provider: ChatProvider, maxCalls = 24) {
    const row = await getState(store, owner);
    const previous = row.state.idempotency[key];
    if (previous) {
        if (previous.digest !== digest) throw new DomainError('IDEMPOTENCY_CONFLICT', 'Chave já utilizada.', 409);
        return { result: previous.result, replayed: true };
    }
    const session = row.state.customerAgent ?? emptyCustomerSession();
    if (session.version !== input.expectedVersion)
        throw new DomainError('VERSION_CONFLICT', 'A conversa mudou. Atualize antes de reenviar.', 409);
    const state = structuredClone(row.state), at = nowIso(state);
    if ('reset' in input) {
        state.customerAgent = { ...emptyCustomerSession(), version: session.version + 1,
            calls: session.calls, lastUsage: session.lastUsage };
        const result = { session: state.customerAgent, readiness: draftReadiness(state.customerAgent.draft), offers: [] };
        state.idempotency[key] = { digest, result };
        if (!await store.compareAndSwap(owner, row.revision, state, at))
            throw new DomainError('CONCURRENT_UPDATE', 'A conversa mudou. Atualize e tente novamente.', 409);
        return { result, replayed: false };
    }
    if (session.calls >= maxCalls)
        throw new DomainError('INFERENCE_BUDGET_EXCEEDED', 'Limite de chamadas desta demo atingido. Use o formulário.', 429);
    // Initialize only in response to a person's message, never on page load or an LLM tool.
    // Persist only with a valid turn; a provider failure keeps the previous workspace intact.
    ensureDemoMarket(state, at);
    const messages: ChatMessage[] = [
        { role: 'system', content: CUSTOMER_SYSTEM_PROMPT },
        { role: 'user', content: `Contexto não confirmado do comprador: ${JSON.stringify(session.draft)}` },
        { role: 'user', content: `Cardápio público simulado (não é uma oferta reservada): ${JSON.stringify(publicMenu(state, at))}` },
        ...session.turns.slice(-8).map(t => ({ role: t.role, content: t.text })),
        { role: 'user', content: input.message },
    ];
    // External inference is outside the CAS transaction; never retry it inside a write loop.
    const completion = await provider.complete(messages);
    let decision;
    try { decision = agentDecisionSchema.parse(JSON.parse(completion.content)); }
    catch { throw new DomainError('PROVIDER_INVALID_OUTPUT', 'A Byara não produziu um rascunho válido. Reformule a mensagem.', 502); }
    const tool = runCustomerTool(decision, session.draft, state, at, input.message);
    const reply = completion.usage.mode === 'LOCAL_MOCK' ?
        'Modo de teste local: a IA não está conectada. Use o formulário abaixo para definir e autorizar seu pedido.' : tool.reply;
    state.customerAgent = {
        version: session.version + 1, draft: tool.draft,
        turns: [...session.turns, { role: 'user' as const, text: input.message, at },
            { role: 'assistant' as const, text: reply, at }].slice(-12),
        calls: session.calls + (completion.usage.mode === 'NEURALAKE' ? 1 : 0), lastUsage: completion.usage,
    };
    const result = { session: state.customerAgent, readiness: draftReadiness(tool.draft, state), offers: tool.offers };
    state.idempotency[key] = { digest, result };
    recordUsage(state, completion.usage);
    event(state, 'CUSTOMER_DRAFT_UPDATED', 'buyer', 'Conversa do comprador atualizada',
        'Rascunho não autoriza compra. Revise antes de continuar.', `customer_${state.customerAgent.version}`, at);
    if (!await store.compareAndSwap(owner, row.revision, state, at)) {
        const latest = await getState(store, owner);
        const replay = latest.state.idempotency[key];
        if (replay?.digest === digest) return { result: replay.result, replayed: true };
        throw new DomainError('CONCURRENT_UPDATE', 'Os dados mudaram durante a conversa. Atualize e tente novamente.', 409);
    }
    return { result, replayed: false };
}
