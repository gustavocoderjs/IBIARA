'use client';
import { useRef, useState, type FormEvent } from 'react';
import { Activity, AlertCircle, ArrowRight, Check, Clock, Loader2, LockKeyhole, MapPin, Radio, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DishPhoto } from '@/components/dish-photo';
import { money, cents } from '@/lib/domain/money';
import { shortTime as time } from '@/lib/client/format';
import type { Send, ViewState } from '@/lib/client/workspace-types';
import { toast } from 'sonner';
function Tag({children,tone='green'}:{children:React.ReactNode;tone?:string}) {return <span className={`tag ${tone}`}>{children}</span>;}
export function Market({ data, send, busy }: {
    data: ViewState;
    send: Send;
    busy: boolean;
}) {
    const [description, setDescription] = useState('Quero um bife a cavalo com arroz, feijão e batata.'), [budget, setBudget] = useState('35,00'), [minutes, setMinutes] = useState('40'), [zone, setZone] = useState('demo_butanta'), [excluded, setExcluded] = useState('');
    const [phase, setPhase] = useState('');
    const journey = useRef<{mandateId?:string;rfqId?:string}>({});
    const [resumable,setResumable] = useState(false);
    const current = data.rfqs?.at(-1), offers = data.offers.filter(o => o.rfqId === current?.id && o.status !== 'SUPERSEDED');
    const mandate = data.mandates?.at(-1);
    const order = data.orders.find(o => o.rfqId === current?.id && o.status !== 'CANCELLED');
    const purchase = async (e: FormEvent) => {
        e.preventDefault();
        try {
            if (!journey.current.mandateId) {
                setPhase('Registrando sua autorização…');
                const first = await send({ type:'mandate', maxCents:cents(budget), description, maxMinutes:Number(minutes), zone, excluded:excluded.split(',').map(x=>x.trim()).filter(Boolean), confirmed:true }, {quiet:true});
                if (!first) return;
                journey.current.mandateId = first.result.mandateId;
                setResumable(true);
            }
            if (!journey.current.rfqId) {
                setPhase('Consultando os agentes dos restaurantes…');
                const second = await send({type:'rfq',mandateId:journey.current.mandateId},{quiet:true});
                if (!second) return;
                journey.current.rfqId = second.result.rfqId;
                if (second.result.status==='NO_MATCH') {journey.current={};setResumable(false);return;}
            }
            setPhase('Negociando e conferindo os limites…');
            const last=await send({type:'negotiate',rfqId:journey.current.rfqId},{quiet:true});
            if(last){journey.current={};setResumable(false);}
        } catch(e){toast.error((e as Error).message);}
        finally {setPhase('');}
    };
    return <>
      <div className="meal-experience">
        <section className="meal-feature" aria-label="Inspiração para sua refeição">
          <div className="meal-picture"><DishPhoto priority className="meal-hero"/><span className="meal-stamp">Bom de<br/><em>verdade.</em></span></div>
          <div className="meal-story"><h2>Bife a cavalo.<br/><em>Vontade de repetir.</em></h2><p>Arroz soltinho, feijão e batata dourada. Aquela combinação que faz a pausa do dia valer a pena.</p><a className="meal-jump" href="#refeicao">Montar meu pedido <ArrowRight size={17}/></a><div className="meal-ingredients"><span>Bife + ovo</span><span>Arroz e feijão</span><span>Batatas</span></div></div>
          <div className="meal-promise"><LockKeyhole size={19}/><p><strong>A vontade é sua. O limite também.</strong><span>A Byara negocia uma refeição com a composição, o total e o prazo que você autorizar.</span></p></div>
        </section>
        <div className="meal-request">
          <form id="refeicao" className="panel intent-panel" onSubmit={purchase}>
            <div className="intent-heading"><h2>Vamos matar essa fome?</h2><p>Conte sua vontade. A Byara cuida da busca.</p></div>
            <label className="field-label" htmlFor="meal-intent">O que você quer comer?</label>
            <Textarea id="meal-intent" disabled={resumable || !!phase} rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Uma refeição brasileira com…"/>
            <div className="intent-fields"><div><label className="field-label" htmlFor="budget">Seu limite, com entrega</label><div className="unit-input budget-input"><Input id="budget" disabled={resumable || !!phase} inputMode="decimal" value={budget} onChange={e => setBudget(e.target.value)}/><span>R$</span></div></div><div><label className="field-label" htmlFor="minutes">Prazo máximo</label><div className="unit-input"><Input id="minutes" disabled={resumable || !!phase} inputMode="numeric" value={minutes} onChange={e => setMinutes(e.target.value)}/><span>min</span></div></div></div>
            <div className="delivery-field"><label className="field-label" id="delivery-label"><MapPin size={15}/>Onde você está?</label><Select disabled={resumable || !!phase} value={zone} onValueChange={setZone}><SelectTrigger aria-labelledby="delivery-label" aria-label="Região de entrega"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="demo_butanta">Butantã · zona de teste</SelectItem><SelectItem value="other">Fora da região de teste</SelectItem></SelectContent></Select></div>
            <div className="exclusions-field"><label className="field-label" htmlFor="excluded">Algum ingrediente para excluir?</label><Input id="excluded" disabled={resumable || !!phase} placeholder="Ex.: ovo (opcional)" value={excluded} onChange={e => setExcluded(e.target.value)}/><p className="small-note">Sem substituições. Alergênicos e contaminação cruzada não são verificados nesta demonstração.</p></div>
            <div className="authorize-note"><ShieldCheck size={20}/><span>Ao autorizar, o agente pode confirmar <strong>1 compra</strong> dentro do seu limite, nos próximos 15 minutos. Orçamento privado.</span></div>
            <Button type="submit" className="w-full authorize-button" disabled={busy || !!phase || !description.trim()}>{phase ? <><Loader2 className="spin" size={18}/>{phase}</> : <>{resumable ? 'Retomar busca autorizada' : 'Autorizar compra e buscar refeição'}<ArrowRight size={18}/></>}</Button>
            <p className="purchase-sandbox">Demonstração · nenhum pagamento ou entrega real.</p>
          </form>
          {mandate && <div className="mandate-summary"><div><LockKeyhole size={18}/><span>Sua autorização<strong>{money(mandate.maxCents)}</strong></span></div><p>{mandate.revoked ? 'Revogada' : mandate.used ? 'Utilizada' : `Até ${time(mandate.expiresAt)}`}</p>{!mandate.revoked && !mandate.used && <Button size="sm" variant="outline" disabled={busy} onClick={async () => { if(await send({ type: 'revoke', mandateId: mandate.id })){journey.current={};setResumable(false);} }}>Revogar</Button>}</div>}
          <p className="meal-search-note"><Clock size={16}/>Preço e prazo são verificados antes da confirmação.</p>
        </div>
      </div>
 {current && <section className="market-results"><div className="view-toolbar"><div><h2>O mercado respondeu.</h2><p className="muted mt-1">Propostas calculadas para a sua intenção · restaurantes fictícios</p></div><Tag tone={current.status === 'NO_MATCH' ? 'amber' : 'green'}>{current.status === 'CLOSED' ? 'Negociação concluída' : current.status === 'NO_MATCH' ? 'Sem oferta elegível' : 'Propostas recebidas'}</Tag></div><div className="offer-grid">{offers.map(o => <article className={`panel offer-card ${current.winnerId === o.id ? 'winner' : ''}`} key={o.id}><DishPhoto dish={o.dish} className="offer-photo"/><div className="offer-top"><span className="restaurant-initial">{o.merchantName.startsWith('Marmita') ? 'N' : o.merchantName[0]}</span>{current.winnerId === o.id ? <Tag>Selecionada pelo agente</Tag> : <Tag tone="neutral">{mandate && o.totalCents>mandate.maxCents?'Acima do seu limite':o.round ? 'Negociada' : 'Proposta'}</Tag>}</div><h3>{o.merchantName}</h3><p>{o.dish}</p><div className="offer-price">{money(o.totalCents)}<span>total com entrega</span></div><div className="offer-details"><span>Prato</span><strong>{money(o.subtotalCents)}</strong><span>Entrega</span><strong>{money(o.deliveryCents)}</strong><span>Prazo</span><strong>{o.eta} min</strong></div><div className="offer-foot"><ShieldCheck size={14}/>{current.winnerId === o.id ? 'Melhor total entre as ofertas elegíveis' : 'Composição preservada'}</div></article>)}</div>{current.status === 'NO_MATCH' && <div className="panel no-match"><AlertCircle size={23}/><div><h3>Nenhuma compra foi realizada.</h3><p>As ofertas não atenderam aos limites de orçamento, prazo, composição ou disponibilidade. Você pode revisar sua intenção e autorizar uma nova busca.</p></div></div>}{order && <div className="order-success"><span className="success-check"><Check size={24}/></span><div><h3>Pedido confirmado em sandbox.</h3><p>{order.dish} · {order.merchantName} · <strong>{money(order.totalCents)}</strong></p><small>Nenhum pagamento real. Entrega não executada.</small></div><Tag>Ingredientes reservados</Tag></div>}</section>}
 {data.events.length > 0 && <section className="panel negotiation-feed"><div className="panel-top"><h2>Por dentro da negociação</h2><Tag tone="neutral"><Radio size={12}/>Eventos do servidor</Tag></div>{data.events.filter(e => e.correlationId === current?.id).slice(-10).map(e => <div className="feed-row" key={e.id}><span className="feed-icon">{e.type === 'ORDER_CONFIRMED' ? <Check size={16}/> : <Activity size={16}/>}</span><div><strong>{e.title}</strong><p>{e.detail}</p></div><time>{time(e.at)}</time></div>)}</section>}
 </>;
}
