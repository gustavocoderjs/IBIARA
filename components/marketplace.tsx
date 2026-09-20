'use client';

import { useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Bot, Check, CheckCircle2, Loader2, Radio, ShieldCheck, Store, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DishPhoto } from '@/components/dish-photo';
import { money, cents } from '@/lib/domain/money';
import type { Event } from '@/lib/domain/types';
import type { Send, ViewState } from '@/lib/client/workspace-types';

type Journey = { mandateId?: string; rfqId?: string };
function Tag({ children, tone = 'green' }: { children: React.ReactNode; tone?: string }) { return <span className={`tag ${tone}`}>{children}</span>; }

function AgentMap({ active }: { active: 1 | 2 | 3 | 4 }) {
  return <section className="agent-map panel" aria-label="Como os agentes colaboram nesta demonstração">
    <div className="agent-map-head"><div><span>COMO A i.byara FUNCIONA</span><h2>Uma intenção, vários agentes.</h2></div><Tag tone="neutral">Demo interativa · dados simulados</Tag></div>
    <div className="agent-flow">
      <div className={`agent-node ${active >= 1 ? 'is-active' : ''}`}><UserRound size={16}/><strong>Você</strong><small>intenção</small></div><i>↓</i>
      <div className={`agent-node ${active >= 1 ? 'is-active' : ''}`}><Bot size={16}/><strong>Buyer Agent</strong><small>entende limites</small></div><i>↓</i>
      <div className={`agent-node exchange ${active >= 2 ? 'is-active' : ''}`}><Radio size={16}/><strong>Exchange</strong><small>consulta o mercado</small></div><i>↓</i>
      <div className="merchant-nodes">{['Marmita Quentinha do Seu Niko', 'Casa da Dona Ana', 'Panela Brasileira'].map((name, index) => <div className={`agent-node merchant ${active >= 2 ? 'is-active' : ''}`} key={name}><Store size={15}/><strong>Agent {index + 1}</strong><small>{name}</small></div>)}</div>
      <i>↓</i><div className={`agent-node offers ${active >= 3 ? 'is-active' : ''}`}><CheckCircle2 size={16}/><strong>Ofertas</strong><small>preço e prazo</small></div><i>↓</i>
      <div className={`agent-node order ${active >= 4 ? 'is-active' : ''}`}><Check size={16}/><strong>Pedido</strong><small>reserva confirmada</small></div>
    </div>
  </section>;
}

function MarketTrail({ events, current, offers, mandate }: { events: Event[]; current: NonNullable<ViewState['rfqs']>[number]; offers: ViewState['offers']; mandate?: NonNullable<ViewState['mandates']>[number] }) {
  const rfqEvents = events.filter(event => event.correlationId === current.id);
  const sent = rfqEvents.filter(event => event.type === 'OFFER_ISSUED');
  const negotiation = rfqEvents.filter(event => event.type === 'COUNTER_ACCEPTED' || event.type === 'COUNTER_REJECTED');
  const considered = offers.filter(offer => offer.status !== 'SUPERSEDED');
  return <section className="market-trail panel" aria-label="Trilha de atividade do mercado">
    <div className="market-trail-heading"><div><span>TRILHA DE MERCADO</span><h2>O que aconteceu nos bastidores</h2></div><Tag tone="neutral">Eventos públicos</Tag></div>
     <div className="trail-step done"><span><Check size={14}/></span><div><strong>Buyer Agent estruturou a demanda</strong><p>Mandato criado{mandate ? <> para até {money(mandate.maxCents)} em até {mandate.maxMinutes} min.</> : ' com limite privado.'}</p></div></div>
    <div className="trail-step done"><span><Check size={14}/></span><div><strong>Exchange criou a RFQ</strong><p>{rfqEvents.find(event => event.type === 'RFQ_CREATED')?.detail ?? 'Composição, região e prazo foram enviados sem compartilhar o teto privado.'}</p></div></div>
    <div className="trail-step"><span>{sent.length ? <Check size={14}/> : <Radio size={14}/>}</span><div><strong>Merchant Agents responderam</strong><p>{sent.length ? `${sent.length} oferta${sent.length === 1 ? '' : 's'} emitida${sent.length === 1 ? '' : 's'} por restaurantes elegíveis.` : 'Aguardando respostas do mercado.'}</p>{sent.length > 0 && <div className="merchant-status-list">{sent.map(event => <div key={event.id}><Store size={14}/><span><strong>{event.merchantId === 'niko' ? 'Marmita Quentinha do Seu Niko' : event.title.replace(' enviou uma proposta', '')}</strong><small>Oferta enviada · {event.detail}</small></span></div>)}</div>}</div></div>
    <div className={`trail-step ${considered.length ? 'done' : ''}`}><span>{considered.length ? <Check size={14}/> : <Bot size={14}/>}</span><div><strong>Buyer Agent analisou as condições</strong><p>{considered.length ? `${considered.length} proposta${considered.length === 1 ? '' : 's'} comparada${considered.length === 1 ? '' : 's'} por total, prazo e validade.` : 'As propostas serão comparadas quando chegarem.'}</p>{negotiation.length > 0 && <div className="negotiation-note">{negotiation.map(event => <span key={event.id}><Radio size={13}/>{event.title}: {event.detail}</span>)}</div>}</div></div>
  </section>;
}

export function Market({ data, send, busy, guided = false, onExitGuided }: { data: ViewState; send: Send; busy: boolean; guided?: boolean; onExitGuided?: () => void }) {
  const [description, setDescription] = useState('Quero um bife a cavalo com arroz, feijão e batata, para agora.'), [budget, setBudget] = useState('35,00'), [minutes, setMinutes] = useState('40');
  const [phase, setPhase] = useState(''), [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const journey = useRef<Journey>({});
  const current = data.rfqs?.at(-1);
  const allOffers = data.offers.filter(offer => offer.rfqId === current?.id);
  const offers = allOffers.filter(offer => offer.status !== 'SUPERSEDED');
  const order = data.orders.find(item => item.rfqId === current?.id && item.status !== 'CANCELLED');
  const mandate = data.mandates?.at(-1);
  const activeStep = order ? 4 : current?.status === 'NO_MATCH' ? step : current ? 3 : step;

  const openSearch = async () => {
    try {
      setPhase('Registrando o mandato…');
      const mandate = await send({ type: 'mandate', maxCents: cents(budget), description, maxMinutes: Number(minutes), zone: 'demo_butanta', excluded: [], confirmed: true }, { quiet: true });
      if (!mandate) return;
      journey.current.mandateId = mandate.result.mandateId;
      setPhase('Exchange consultando restaurantes…');
      const rfq = await send({ type: 'rfq', mandateId: journey.current.mandateId }, { quiet: true });
      if (!rfq) return;
      journey.current.rfqId = rfq.result.rfqId;
      setStep(3);
    } finally { setPhase(''); }
  };
  const choose = async () => {
    const rfqId = journey.current.rfqId ?? current?.id;
    if (!rfqId) return;
    try {
      setPhase('Buyer Agent analisando e negociando…');
      const result = await send({ type: 'negotiate', rfqId }, { quiet: true });
      if (result) setStep(4);
    } finally { setPhase(''); }
  };
  const submit = (event: FormEvent) => { event.preventDefault(); void openSearch(); };

  return <div className={`marketplace ${guided ? 'guided-marketplace' : ''}`}>
    {guided && <AgentMap active={activeStep} />}
    {guided && <section className="demo-progress" aria-label={activeStep >= 4 ? 'Pedido confirmado' : `Etapa ${activeStep} de 3`}>
      {[['1', 'Eu digo o que quero'], ['2', 'O mercado responde'], ['3', 'Escolho e compro']].map(([number, label], index) => <div className={activeStep >= index + 1 ? 'done' : ''} key={number}><span>{activeStep > index + 1 ? <Check size={14}/> : number}</span>{label}</div>)}
    </section>}

    {guided && activeStep === 1 && <section className="guided-stage panel"><Tag tone="neutral">ETAPA 1 · INTENÇÃO</Tag><h2>Eu digo o que quero.</h2><p className="guided-intent">“{description}”</p><div className="buyer-agent-card"><Bot size={23}/><div><span>BUYER AGENT</span><h3>Intenção identificada</h3><dl><div><dt>Prato</dt><dd>Bife a cavalo</dd></div><div><dt>Orçamento</dt><dd>Até {money(cents(budget))}</dd></div><div><dt>Momento</dt><dd>Agora · até {minutes} min</dd></div></dl></div></div><div className="guided-actions"><Button variant="outline" onClick={onExitGuided}>Sair da demo</Button><Button onClick={() => setStep(2)}>Continuar <ArrowRight size={17}/></Button></div></section>}

    {guided && activeStep === 2 && <section className="guided-stage panel"><Tag tone="amber">ETAPA 2 · EXCHANGE</Tag><h2>O mercado responde.</h2><p>O Buyer Agent envia a mesma intenção ao Exchange. Cada Merchant Agent verifica suas próprias condições antes de responder.</p><div className="consulting-row"><Radio size={22}/><div><strong>{phase || 'Pronto para consultar restaurantes.'}</strong><span>As respostas são calculadas pelo backend; esta tela apenas apresenta os eventos concluídos.</span></div></div><div className="merchant-preview">{['Marmita Quentinha do Seu Niko', 'Casa da Dona Ana', 'Panela Brasileira'].map(name => <div key={name}><Store size={16}/><span>MERCHANT AGENT</span><strong>{name}</strong><small>aguardando a mesma solicitação</small></div>)}</div><div className="guided-actions"><Button variant="outline" onClick={() => setStep(1)} disabled={!!phase}><ArrowLeft size={17}/>Voltar</Button><Button onClick={() => void openSearch()} disabled={busy || !!phase}>{phase ? <><Loader2 className="spin" size={17}/>{phase}</> : <>Consultar o mercado <ArrowRight size={17}/></>}</Button></div></section>}

    {!guided && <form className="panel intent-panel" onSubmit={submit}><div className="intent-heading"><h2>Vamos matar essa fome?</h2><p>Conte sua vontade. A Byara cuida da busca.</p></div><label className="field-label" htmlFor="meal-intent">O que você quer comer?</label><Textarea id="meal-intent" rows={3} value={description} onChange={event => setDescription(event.target.value)}/><div className="intent-fields"><div><label className="field-label" htmlFor="budget">Seu limite, com entrega</label><Input id="budget" inputMode="decimal" value={budget} onChange={event => setBudget(event.target.value)}/></div><div><label className="field-label" htmlFor="minutes">Prazo máximo</label><Input id="minutes" inputMode="numeric" value={minutes} onChange={event => setMinutes(event.target.value)}/></div></div><Button type="submit" className="w-full authorize-button" disabled={busy || !!phase}>{phase || 'Autorizar compra e buscar refeição'}<ArrowRight size={18}/></Button></form>}

    {guided && current && activeStep >= 3 && <MarketTrail events={data.events} current={current} offers={offers} mandate={data.mandates?.at(-1)} />}
    {current && (!guided || activeStep >= 3) && <section className="market-results" aria-live="polite"><div className="view-toolbar"><div><Tag tone="amber">ETAPA 3 · OFERTAS</Tag><h2>{current.status === 'NO_MATCH' ? 'Nenhuma oferta atende ao seu mandato.' : 'Seu Buyer Agent encontrou ofertas disponíveis agora.'}</h2><p className="muted mt-1">{current.status === 'NO_MATCH' ? 'O Exchange não encontrou uma combinação compatível de composição, prazo e disponibilidade.' : 'As propostas abaixo são respostas independentes do mercado, com total e prazo públicos.'}</p></div><Tag tone={current.status === 'NO_MATCH' ? 'amber' : 'green'}>{offers.length} oferta{offers.length === 1 ? '' : 's'} recebida{offers.length === 1 ? '' : 's'}</Tag></div><div className="offer-grid">{offers.map(offer => <article className={`panel offer-card ${offer.status === 'ACCEPTED' ? 'winner' : ''}`} key={offer.id}><DishPhoto dish={offer.dish} className="offer-photo"/><div className="offer-top"><Tag tone="neutral"><Store size={12}/>MERCHANT AGENT</Tag>{offer.status === 'ACCEPTED' ? <Tag>Condição aceita</Tag> : offer.round > 0 ? <Tag>Oferta negociada</Tag> : <Tag tone="neutral">Oferta inicial</Tag>}</div><h3>{offer.merchantName}</h3><p>{offer.dish}</p><div className="offer-price">{money(offer.totalCents)}<span>total com entrega</span></div><div className="offer-details"><span>Prato</span><strong>{money(offer.subtotalCents)}</strong><span>Entrega</span><strong>{money(offer.deliveryCents)}</strong><span>Prazo</span><strong>{offer.eta} min</strong></div><p className="offer-condition"><ShieldCheck size={14}/>{offer.status === 'ACCEPTED' ? 'Oferta validada e reservada.' : offer.round > 0 ? `Round ${offer.round} · condição revisada pelo agente.` : 'Oferta inicial enviada pelo restaurante.'}</p>{offer.status === 'ISSUED' && (mandate && offer.totalCents <= mandate.maxCents - mandate.committedCents && offer.eta <= mandate.maxMinutes ? <Button className="w-full" disabled={busy || !!phase} onClick={() => void choose()}>{phase ? <><Loader2 className="spin" size={16}/>{phase}</> : <>Pedir ao Buyer Agent para escolher <ArrowRight size={16}/></>}</Button> : <p className="offer-condition offer-ineligible"><ShieldCheck size={14}/>Fora do mandato autorizado.</p>)}</article>)}</div>{current.status === 'NO_MATCH' && <div className="panel no-match"><p>Nenhum pedido foi criado. Volte à intenção para tentar outro mandato.</p><Button variant="outline" onClick={() => setStep(1)}>Voltar à intenção</Button></div>}</section>}

    {order && <section className="guided-confirmation"><span><Check size={26}/></span><div><Tag>PEDIDO CONFIRMADO</Tag><h2>{order.dish}</h2><p>{order.merchantName} · <strong>{money(order.totalCents)}</strong> · {data.offers.find(offer => offer.id === order.offerId)?.eta ?? '—'} min</p><p className="confirmation-copy">Seu Buyer Agent comparou as respostas públicas e encontrou uma condição compatível com o mandato. A reserva foi confirmada pelo backend.</p><div className="eligibility-list"><span>✓ respeitou o orçamento autorizado</span><span>✓ atende ao prazo solicitado</span><span>✓ disponibilidade validada na aceitação</span></div><small>Sandbox: pagamento e entrega não são executados.</small></div></section>}
  </div>;
}