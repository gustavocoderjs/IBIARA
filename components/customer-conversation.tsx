'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Loader2, MessageCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { CustomerDraft, CustomerSession } from '@/lib/agents/customer/schemas';
import { emptyCustomerSession } from '@/lib/agents/customer/state';
import { deliveryPoints } from '@/lib/domain/delivery';
import { preferenceLabel, restaurantLabel } from '@/lib/client/customer-options';

type ConversationView = { session: CustomerSession; readiness: { ready: boolean; missing: string[]; unsupported: string[] }; mode?: string };
type ConversationProps = {
    disabled: boolean;
    completedOrderAt?: string;
    prefill?: string;
    onPrefillConsumed?(): void;
    onReview(draft: CustomerDraft): void;
    onDraftChanged(): void;
    onManualReview(draft: CustomerDraft, descriptionSeed?: string): void;
};

export function CustomerConversation({ disabled, completedOrderAt, prefill = '', onPrefillConsumed, onReview, onDraftChanged, onManualReview }: ConversationProps) {
    const [view, setView] = useState<ConversationView | null>(null);
    const [text, setText] = useState(prefill);
    const [handoffResolved, setHandoffResolved] = useState(!prefill);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadAttempt, setLoadAttempt] = useState(0);
    const [pending, setPending] = useState<'message' | 'reset' | null>(null);
    const inFlight = useRef(false);
    const retry = useRef<{ body: string; key: string } | null>(null);
    const alive = useRef(true);
    const input = useRef<HTMLTextAreaElement>(null);
    const log = useRef<HTMLDivElement>(null);
    useEffect(() => {
        alive.current = true;
        const controller = new AbortController();
        fetch('/api/v1/customer-agent', { signal: controller.signal }).then(async r => {
            if (!r.ok) throw new Error('Não foi possível abrir a conversa. Você pode tentar novamente ou preencher seu pedido.');
            return r.json() as Promise<ConversationView>;
        }).then(value => { if (alive.current && !controller.signal.aborted) setView(value); })
            .catch((e: Error) => { if (alive.current && e.name !== 'AbortError') setError(e.message); })
            .finally(() => { if (alive.current && !controller.signal.aborted) setLoading(false); });
        return () => { alive.current = false; controller.abort(); };
    }, [loadAttempt]);
    useEffect(() => { log.current?.scrollTo({ top: log.current.scrollHeight }); }, [view?.session.version, pending]);
    const lastUserTurn = view?.session.turns.findLast(t => t.role === 'user');
    const draft = view?.session.draft;
    const hasDraft = draft && (Boolean(draft.selectionPreference && draft.selectionPreference !== 'LOWEST_PRICE') ||
        Object.entries(draft).some(([field, value]) => field !== 'selectionPreference' && value != null));
    const needsNewRequest = Boolean(completedOrderAt && lastUserTurn && lastUserTurn.at <= completedOrderAt);
    const needsHandoffDecision = Boolean(prefill && !handoffResolved && (lastUserTurn || hasDraft));

    async function request(reset = false) {
        if (!view || inFlight.current || disabled || (!reset && (!text.trim() || text.length > 1000 || needsNewRequest || needsHandoffDecision))) return;
        inFlight.current = true;
        setPending(reset ? 'reset' : 'message'); setError('');
        onDraftChanged();
        const body = JSON.stringify(reset ? { reset: true, expectedVersion: view.session.version } : { message: text, expectedVersion: view.session.version });
        const key = retry.current?.body === body ? retry.current.key : crypto.randomUUID();
        retry.current = { body, key };
        try {
            const r = await fetch('/api/v1/customer-agent', { method: 'POST', signal: AbortSignal.timeout(45000),
                headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body });
            const result = await r.json() as { result?: ConversationView; error?: { message?: string } };
            if (!r.ok) {
                if (r.status === 409) {
                    const refreshed = await fetch('/api/v1/customer-agent');
                    if (refreshed.ok && alive.current) setView(await refreshed.json());
                }
                throw new Error(result.error?.message ?? 'Não foi possível enviar. Tente novamente.');
            }
            if (!result.result) throw new Error('Resposta incompleta. Tente novamente.');
            if (alive.current) {
                setView({ ...result.result, mode: view.mode });
                if (!reset) { setText(''); onPrefillConsumed?.(); }
                else if (!prefill) setText('');
                if (reset) setHandoffResolved(true);
                retry.current = null;
                if (reset) requestAnimationFrame(() => input.current?.focus());
            }
        } catch (e) { if (alive.current) setError(e instanceof Error ? e.message : 'Falha na conversa.'); }
        finally { inFlight.current = false; if (alive.current) setPending(null); }
    }
    function submit(e: FormEvent) { e.preventDefault(); void request(); }
    const mode = view?.session.lastUsage?.mode ?? view?.mode;
    const unresolvedRestriction = draft?.foodSafetyConcern === true || (draft?.portions != null && draft.portions !== 1);
    const canUseFallback = !needsNewRequest && !needsHandoffDecision && !unresolvedRestriction && Boolean(error || (mode === 'LOCAL_MOCK' && lastUserTurn));

    return <section className="panel customer-conversation" aria-labelledby="customer-chat-title">
        <div className="customer-chat-heading"><span className="icon-tile"><MessageCircle size={23}/></span><div><h2 id="customer-chat-title">Primeiro, conte para a Byara.</h2><p>O que você gostaria de comer hoje?</p></div></div>
        <p className="small-note">Seu agente entende o pedido, pergunta o que falta e consulta os restaurantes. A compra só começa depois da sua autorização.</p>
        {prefill && <p className="small-note my-3" role="status">Mensagem recuperada da área do restaurante. Nenhum dado privado da cozinha foi transferido. O envio continua dependendo de você.</p>}
        {mode === 'LOCAL_MOCK' && <p className="customer-mode" role="status">Modo simulado · IA desconectada. A conversa não interpreta pedidos neste modo.</p>}
        {mode === 'NEURALAKE' && <p className="customer-mode live">Byara conectada à NeuraLake · restaurantes e pedidos de demonstração</p>}
        {!view && loading && <p role="status" className="small-note my-4">Abrindo sua conversa…</p>}
        <div ref={log} className="customer-chat-log" role="log" aria-live="polite" aria-label="Conversa com a Byara">
            {view?.session.turns.map((t, i) => <div key={`${t.at}-${i}`} className={`customer-message ${t.role}`}><strong>{t.role === 'user' ? 'Você' : 'Byara'}</strong><p>{t.text}</p></div>)}
            {pending === 'message' && <p className="customer-thinking"><Loader2 className="spin" size={16}/>Byara está consultando seu pedido…</p>}
        </div>
        {needsHandoffDecision ? <div className="customer-next-order"><p>Já existe uma conversa anterior. Comece um novo pedido para evitar misturar prato, orçamento e prazo. As restrições alimentares declaradas continuam preservadas.</p><blockquote className="my-3">{text}</blockquote><Button type="button" disabled={disabled || !!pending} onClick={() => void request(true)}><RotateCcw size={16}/>{pending === 'reset' ? 'Abrindo nova conversa…' : 'Começar novo pedido com esta mensagem'}</Button></div> : needsNewRequest ? <div className="customer-next-order"><p>Seu último pedido foi registrado. Comece uma nova conversa para escolher outra refeição e definir novos limites.</p><Button type="button" disabled={disabled || !!pending} onClick={() => void request(true)}><RotateCcw size={16}/>{pending === 'reset' ? 'Abrindo nova conversa…' : 'Começar novo pedido'}</Button></div> : <form onSubmit={submit} className="customer-composer">
            <label htmlFor="customer-message">Sua mensagem</label>
            <Textarea ref={input} id="customer-message" value={text} onChange={e => setText(e.target.value)} maxLength={1000} rows={3}
                disabled={!!pending || disabled} placeholder="Conte sua vontade ou pergunte quais pratos estão disponíveis…" />
            {text.length > 1000 && <p className="customer-chat-error">Resuma sua mensagem em até 1.000 caracteres. O texto original foi preservado para revisão.</p>}
            <div className="customer-composer-footer"><span className="small-note">Você pode enviar os detalhes aos poucos.</span><Button disabled={!view || !!pending || disabled || !text.trim() || text.length > 1000} type="submit">{pending === 'message' ? 'Enviando…' : 'Enviar para a Byara'}<ArrowRight size={17}/></Button></div>
        </form>}
        {error && <p role="alert" className="customer-chat-error">{error}</p>}
        {!view && error && <Button type="button" variant="outline" className="mt-3" disabled={disabled || loading}
            onClick={() => { setError(''); setLoading(true); setLoadAttempt(attempt => attempt + 1); }}>Tentar carregar conversa novamente</Button>}
        {view && error && <p className="small-note mt-2">Seu rascunho continua salvo e sua mensagem ficou no campo. Tente enviá-la novamente ou revise os dados manualmente.</p>}
        {disabled && <p className="small-note mt-3">Há uma operação em andamento ou uma autorização em aberto. Retome ou revogue a autorização abaixo antes de iniciar outro pedido.</p>}
        {draft && hasDraft && !needsNewRequest && !needsHandoffDecision && <div className="customer-draft">
            <h3>Seu pedido em construção</h3><p>{draft.description ?? 'Refeição ainda a escolher.'}</p>
            <p>{draft.portions ?? '—'} porção(ões) · limite R$ {draft.budget ?? '—'} · {draft.maxMinutes ?? '—'} min · {draft.zone === 'demo_butanta' ? 'Butantã' : draft.zone === 'other' ? 'Outra região' : 'Região pendente'}</p>
            <p>Ingredientes a excluir: {draft.excluded === null ? 'a confirmar' : draft.excluded.join(', ') || 'nenhum'}.</p>
            <p>Critério de escolha: {preferenceLabel(draft.selectionPreference)}.</p>
            <p>Restaurante: {restaurantLabel(draft.restaurantId)}.</p>
            {draft.deliveryPointId && <p>Ponto de entrega: {deliveryPoints.find(point => point.id === draft.deliveryPointId)?.label} · localização simulada.</p>}
            {view?.readiness.unsupported.map(x => <p className="customer-chat-error" key={x}>{x}</p>)}
            {!!view?.readiness.missing.length && <div className="small-note mt-3"><strong>Falta confirmar:</strong><ul className="list-disc pl-5 mt-1">{view.readiness.missing.map(item => <li key={item}>{item}</li>)}</ul></div>}
            {view?.readiness.ready && <Button type="button" className="mt-3" disabled={disabled || !!pending} onClick={() => onReview(draft)}>Revisar pedido<ArrowRight size={17}/></Button>}
        </div>}
        {canUseFallback && <div className="customer-fallback"><p className="small-note">Você pode continuar por aqui. Os dados já organizados serão mantidos para revisão.</p><Button type="button" variant="outline" disabled={disabled || !!pending || loading} onClick={() => onManualReview(draft ?? emptyCustomerSession().draft)}>Preencher pedido manualmente</Button></div>}
        {view && lastUserTurn && !needsNewRequest && !needsHandoffDecision && <Button className="mt-4" variant="ghost" type="button" disabled={disabled || !!pending} onClick={() => void request(true)}><RotateCcw size={15}/>Descartar rascunho e começar de novo</Button>}
    </section>;
}
