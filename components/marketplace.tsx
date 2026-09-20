'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Activity, AlertCircle, ArrowRight, Check, Clock, Loader2, LockKeyhole, MapPin, Radio, ShieldCheck, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DishPhoto } from '@/components/dish-photo';
import { CustomerConversation } from '@/components/customer-conversation';
import { money, cents } from '@/lib/domain/money';
import { shortTime as time } from '@/lib/client/format';
import type { CustomerDraft } from '@/lib/agents/customer/schemas';
import type { SelectionPreference } from '@/lib/domain/types';
import type { Send, ViewState } from '@/lib/client/workspace-types';
import { toast } from 'sonner';

function Tag({ children, tone = 'green' }: { children: React.ReactNode; tone?: string }) { return <span className={`tag ${tone}`}>{children}</span>; }
const preferenceLabel = (preference?: SelectionPreference | null) => preference === 'BEST_RATED' ? 'Melhor avaliação' : 'Menor preço total';

export function Market({ data, send, busy }: { data: ViewState; send: Send; busy: boolean }) {
    const [description, setDescription] = useState('');
    const [budget, setBudget] = useState('');
    const [minutes, setMinutes] = useState('');
    const [zone, setZone] = useState('');
    const [excluded, setExcluded] = useState('');
    const [selectionPreference, setSelectionPreference] = useState<SelectionPreference>('LOWEST_PRICE');
    const [reviewOpen, setReviewOpen] = useState(false);
    const [phase, setPhase] = useState('');
    const journey = useRef<{ mandateId?: string; rfqId?: string }>({});
    const purchasing = useRef(false);
    const reviewInput = useRef<HTMLTextAreaElement>(null);
    const [resumable, setResumable] = useState(false);
    const current = data.rfqs?.at(-1);
    const offers = data.offers.filter(o => o.rfqId === current?.id && o.status !== 'SUPERSEDED');
    const mandate = data.mandates?.at(-1);
    const currentMandate = data.mandates?.find(m => m.id === current?.mandateId);
    const order = data.orders.find(o => o.rfqId === current?.id && o.status !== 'CANCELLED');
    const latestOrder = data.orders.at(-1);
    const activeMandate = mandate && !mandate.revoked && !mandate.used && mandate.expiresAt > data.now;
    const resumableRfq = activeMandate && data.rfqs?.find(rfq => rfq.mandateId === mandate.id && rfq.status === 'QUOTED' && rfq.expiresAt > data.now);
    const inputsLocked = busy || resumable || !!phase;
    useEffect(() => { if (reviewOpen) reviewInput.current?.focus(); }, [reviewOpen]);

    function invalidateReview() {
        setReviewOpen(false); setDescription(''); setBudget(''); setMinutes(''); setZone(''); setExcluded('');
        setSelectionPreference('LOWEST_PRICE');
    }
    function reviewDraft(draft: CustomerDraft) {
        if (!draft.description || !draft.budget || !draft.maxMinutes || !draft.zone || !draft.excluded) return;
        reviewManually(draft);
    }
    function reviewManually(draft: CustomerDraft, descriptionSeed?: string) {
        setDescription(draft.description ?? descriptionSeed ?? '');
        setBudget(draft.budget ?? ''); setMinutes(draft.maxMinutes === null ? '' : String(draft.maxMinutes));
        setZone(draft.zone ?? ''); setExcluded(draft.excluded?.join(', ') ?? '');
        setSelectionPreference(draft.selectionPreference ?? 'LOWEST_PRICE'); setReviewOpen(true);
    }
    function resumeAuthorizedSearch() {
        if (!mandate || !activeMandate) return;
        journey.current = { mandateId: mandate.id, rfqId: resumableRfq ? resumableRfq.id : undefined };
        setDescription(mandate.description); setBudget((mandate.maxCents / 100).toFixed(2));
        setMinutes(String(mandate.maxMinutes)); setZone(mandate.zone); setExcluded(mandate.excluded.join(', '));
        setSelectionPreference(mandate.selectionPreference ?? 'LOWEST_PRICE');
        setResumable(true); setReviewOpen(true);
    }
    const purchase = async (e: FormEvent) => {
        e.preventDefault();
        if (purchasing.current || busy || !reviewOpen) return;
        purchasing.current = true;
        try {
            if (!journey.current.mandateId) {
                setPhase('Registrando sua autorização…');
                const first = await send({ type: 'mandate', maxCents: cents(budget), description, maxMinutes: Number(minutes), zone, excluded: excluded.split(',').map(x => x.trim()).filter(Boolean), selectionPreference, confirmed: true }, { quiet: true });
                if (!first) return;
                journey.current.mandateId = first.result.mandateId;
                setResumable(true);
            }
            if (!journey.current.rfqId) {
                setPhase('Consultando os agentes dos restaurantes…');
                const second = await send({ type: 'rfq', mandateId: journey.current.mandateId }, { quiet: true });
                if (!second) return;
                journey.current.rfqId = second.result.rfqId;
                if (second.result.status === 'NO_MATCH') { journey.current = {}; setResumable(false); setReviewOpen(false); return; }
            }
            setPhase('Os restaurantes estão avaliando as ofertas…');
            const last = await send({ type: 'agent_negotiate', rfqId: journey.current.rfqId }, { quiet: true });
            if (last) {
                journey.current = {}; setResumable(false); setReviewOpen(false);
                document.getElementById('market-result-title')?.focus();
            }
        } catch (e) { toast.error((e as Error).message); }
        finally { purchasing.current = false; setPhase(''); }
    };
    return <>
        <div className="customer-journey">
            <div className="customer-journey-main">
                <CustomerConversation disabled={busy || resumable || !!phase || Boolean(activeMandate)} completedOrderAt={latestOrder?.at}
                    onReview={reviewDraft} onDraftChanged={invalidateReview} onManualReview={reviewManually} />
                {reviewOpen && <form id="refeicao" className="panel intent-panel" onSubmit={purchase}>
                    <div className="intent-heading"><h2>Revise antes de autorizar.</h2><p>Confira a refeição e os limites que serão usados pelo seu agente.</p></div>
                    <label className="field-label" htmlFor="meal-intent">Refeição desejada · 1 porção</label>
                    <Textarea ref={reviewInput} id="meal-intent" disabled={inputsLocked} rows={3} value={description} maxLength={1000} required onChange={e => setDescription(e.target.value)} placeholder="Descreva o prato e os acompanhamentos…" />
                    <div className="intent-fields"><div><label className="field-label" htmlFor="budget">Limite total, com entrega</label><div className="unit-input budget-input"><Input id="budget" disabled={inputsLocked} inputMode="decimal" required value={budget} onChange={e => setBudget(e.target.value)} /><span>R$</span></div></div><div><label className="field-label" htmlFor="minutes">Prazo máximo</label><div className="unit-input"><Input id="minutes" disabled={inputsLocked} inputMode="numeric" required value={minutes} onChange={e => setMinutes(e.target.value)} /><span>min</span></div></div></div>
                    <div className="delivery-field"><label className="field-label" id="delivery-label"><MapPin size={15} />Região de entrega</label><Select disabled={inputsLocked} value={zone} onValueChange={setZone}><SelectTrigger aria-labelledby="delivery-label" aria-label="Região de entrega"><SelectValue placeholder="Confirme sua região" /></SelectTrigger><SelectContent><SelectItem value="demo_butanta">Butantã · zona de teste</SelectItem><SelectItem value="other">Fora da região de teste</SelectItem></SelectContent></Select></div>
                    <div className="exclusions-field"><label className="field-label" htmlFor="excluded">Ingredientes a excluir</label><Input id="excluded" disabled={inputsLocked} placeholder="Deixe vazio se não houver exclusões" value={excluded} onChange={e => setExcluded(e.target.value)} /><p className="small-note">Sem substituições. Alergênicos e contaminação cruzada não são verificados nesta demonstração.</p></div>
                    <div className="delivery-field"><label className="field-label" id="selection-preference-label">O que você prefere priorizar?</label><Select disabled={inputsLocked} value={selectionPreference} onValueChange={value => setSelectionPreference(value as SelectionPreference)}><SelectTrigger aria-labelledby="selection-preference-label"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="LOWEST_PRICE">Menor preço</SelectItem><SelectItem value="BEST_RATED">Melhor avaliação</SelectItem></SelectContent></Select><p className="small-note mt-2">{selectionPreference === 'BEST_RATED' ? 'A melhor nota pode custar mais ou levar mais tempo, sempre dentro do orçamento e do prazo que você autorizar.' : 'O agente escolhe o menor total entre as ofertas que atendem ao seu pedido.'} As avaliações dos restaurantes são simuladas.</p></div>
                    <div className="authorize-note"><ShieldCheck size={20} /><span>Ao autorizar, o agente pode confirmar <strong>1 compra em sandbox</strong> dentro desses limites, nos próximos 15 minutos. Seu orçamento fica privado.</span></div>
                    <Button type="submit" className="w-full authorize-button" disabled={busy || !!phase || !description.trim() || !budget.trim() || !minutes.trim() || !zone}>{phase ? <><Loader2 className="spin" size={18} />{phase}</> : <>{resumable ? 'Retomar busca autorizada' : 'Autorizar compra e consultar restaurantes'}<ArrowRight size={18} /></>}</Button>
                    {!resumable && <Button type="button" variant="ghost" className="w-full mt-2" disabled={busy || !!phase} onClick={() => { setReviewOpen(false); document.getElementById('customer-message')?.focus(); }}>Voltar à conversa</Button>}
                    <p className="purchase-sandbox">Nenhum pagamento ou entrega real.</p>
                </form>}
                {activeMandate && <div className="mandate-summary"><div><LockKeyhole size={18} /><span>Autorização em aberto<strong>{money(mandate.maxCents)}</strong></span></div><p>Até {time(mandate.expiresAt)} · {preferenceLabel(mandate.selectionPreference)}</p><div className="flex gap-2 flex-wrap">{!resumable && <Button size="sm" variant="outline" disabled={busy || !!phase} onClick={resumeAuthorizedSearch}>Retomar autorização</Button>}<Button size="sm" variant="outline" disabled={busy || !!phase} onClick={async () => { if (await send({ type: 'revoke', mandateId: mandate.id })) { journey.current = {}; setResumable(false); setReviewOpen(false); } }}>Revogar</Button></div></div>}
            </div>
            <aside className="customer-journey-guide" aria-label="Etapas do pedido">
                <h2>Da sua vontade ao pedido.</h2>
                <ol><li><span>1</span><div><strong>Você começa a conversa</strong><p>Conte o que quer comer. A Byara pergunta o que faltar.</p></div></li><li><span>2</span><div><strong>Você revisa e autoriza</strong><p>Confirme refeição, orçamento, região e prazo.</p></div></li><li><span>3</span><div><strong>Os agentes consultam as cozinhas</strong><p>Cada restaurante usa seu próprio cardápio e estoque simulado.</p></div></li><li><span>4</span><div><strong>O pedido respeita seus limites</strong><p>Uma oferta elegível gera a reserva e o pedido em sandbox.</p></div></li></ol>
                <p className="meal-search-note"><Clock size={17} />Preço, ingredientes e prazo são verificados antes da confirmação.</p>
            </aside>
        </div>
        {current && <section className="market-results" aria-labelledby="market-result-title"><div className="view-toolbar"><div><h2 id="market-result-title" tabIndex={-1}>{order ? 'Seu pedido foi confirmado.' : current.status === 'NO_MATCH' ? 'Não encontramos uma oferta elegível.' : 'Resultado da sua última busca.'}</h2><p className="muted mt-1">{current.description} · {preferenceLabel(currentMandate?.selectionPreference)} · restaurantes fictícios</p></div><Tag tone={current.status === 'NO_MATCH' ? 'amber' : 'green'}>{current.status === 'CLOSED' ? 'Negociação concluída' : current.status === 'NO_MATCH' ? 'Nenhuma compra realizada' : 'Propostas recebidas'}</Tag></div>
            {order && <div className="order-success"><span className="success-check"><Check size={24} /></span><div><h3>Pedido {order.id.slice(-6).toUpperCase()} · sandbox</h3><p>{order.dish} · {order.merchantName} · <strong>{money(order.totalCents)}</strong></p><small>Ingredientes reservados. Nenhum pagamento ou entrega real.</small></div><Tag>Confirmado</Tag></div>}
            <div className="offer-grid">{offers.map(o => <article className={`panel offer-card ${current.winnerId === o.id ? 'winner' : ''}`} key={o.id}><DishPhoto dish={o.dish} className="offer-photo" /><div className="offer-top"><span className="restaurant-initial">{o.merchantName.startsWith('Marmita') ? 'N' : o.merchantName[0]}</span>{current.winnerId === o.id ? <Tag>Selecionada pelo agente</Tag> : <Tag tone="neutral">{currentMandate && o.totalCents > currentMandate.maxCents ? 'Acima do seu limite' : o.round ? 'Negociada' : 'Proposta'}</Tag>}</div><h3>{o.merchantName}</h3><p className="small-note inline-flex items-center gap-1 mt-2"><Star size={14} aria-hidden="true" />{o.ratingTenths !== null && o.ratingTenths !== undefined && (o.ratingCount ?? 0) > 0 ? `${(o.ratingTenths / 10).toFixed(1).replace('.', ',')}/5 · ${o.ratingCount} avaliações${o.ratingIsDemo ? ' (simuladas)' : ''}` : 'Sem avaliações'}</p><p>{o.dish}</p><div className="offer-price">{money(o.totalCents)}<span>total com entrega</span></div><div className="offer-details"><span>Prato</span><strong>{money(o.subtotalCents)}</strong><span>Entrega</span><strong>{money(o.deliveryCents)}</strong><span>Prazo</span><strong>{o.eta} min</strong></div><div className="offer-foot"><ShieldCheck size={14} />{current.winnerId === o.id ? currentMandate?.selectionPreference === 'BEST_RATED' ? 'Melhor avaliação dentro dos seus limites' : 'Melhor total entre as ofertas elegíveis' : 'Composição preservada'}</div></article>)}</div>
            {current.status === 'NO_MATCH' && <div className="panel no-match"><AlertCircle size={23} /><div><h3>Nenhuma compra foi realizada.</h3><p>As ofertas não atenderam aos limites de orçamento, prazo, composição ou disponibilidade. Volte à conversa para ajustar sua intenção e revisar uma nova busca.</p></div></div>}
        </section>}
        {data.events.some(e => e.correlationId === current?.id) && <section className="panel negotiation-feed"><div className="panel-top"><h2>Por dentro da negociação</h2><Tag tone="neutral"><Radio size={12} />Eventos do servidor</Tag></div>{data.events.filter(e => e.correlationId === current?.id).slice(-10).map(e => <div className="feed-row" key={e.id}><span className="feed-icon">{e.type === 'ORDER_CONFIRMED' ? <Check size={16} /> : <Activity size={16} />}</span><div><strong>{e.title}</strong><p>{e.detail}</p></div><time>{time(e.at)}</time></div>)}</section>}
    </>;
}
