'use client';
import { useEffect, useState } from 'react';
import { Check, ChefHat, Clock, Search, ShoppingBag, SlidersHorizontal, X } from 'lucide-react';
import { DishPhoto } from '@/components/dish-photo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { money } from '@/lib/domain/money';
import { elapsed, shortTime } from '@/lib/client/format';
import type { Order } from '@/lib/domain/types';
import type { Send, ViewState } from '@/lib/client/workspace-types';

const lanes = [{ id: 'CONFIRMED', label: 'A preparar', icon: ShoppingBag }, { id: 'PREPARING', label: 'Em preparo', icon: ChefHat }, { id: 'READY', label: 'Prontos', icon: Check }] as const;
const statusLabel: Record<Order['status'], string> = { CONFIRMED: 'A preparar', PREPARING: 'Em preparo', READY: 'Pronto', CANCELLED: 'Cancelado' };
const day = (at: string) => new Date(at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

export function OrderBoard({ data, send, busy, navigate }: { data: ViewState; send: Send; busy: boolean; navigate: (view: string) => void }) {
  const [filter, setFilter] = useState('');
  const [mode, setMode] = useState('service');
  const [mobileLane, setMobileLane] = useState<string>('CONFIRMED');
  const [selected, setSelected] = useState<string | null>(null);
  const [cancel, setCancel] = useState<string | null>(null);
  const [tick, setNow] = useState(Date.parse(data.now));
  useEffect(() => {
    const server = Date.parse(data.now), start = Date.now();
    const timer = setInterval(() => setNow(server + Date.now() - start), 15000);
    return () => clearInterval(timer);
  }, [data.now]);
  const now = Math.max(tick, Date.parse(data.now));
  const today = day(new Date(now).toISOString());
  const search = filter.trim().toLocaleLowerCase('pt-BR');
  const filtered = data.orders.filter(order => `${order.dish} ${order.id}`.toLocaleLowerCase('pt-BR').includes(search));
  const queue = filtered.filter(order => order.status === 'CONFIRMED' || order.status === 'PREPARING' || (order.status === 'READY' && day(order.at) === today)).sort((a, b) => a.at.localeCompare(b.at));
  const active = data.orders.filter(order => order.status === 'CONFIRMED' || order.status === 'PREPARING');
  const selectedOrder = data.orders.find(order => order.id === selected);
  const cancelledOrder = data.orders.find(order => order.id === cancel);
  const action = (order: Order) => order.status === 'CONFIRMED' ? <Button className="order-next" disabled={busy} onClick={() => send({ type: 'order', orderId: order.id, action: 'prepare' })}><ChefHat size={17}/>Iniciar preparo</Button> : order.status === 'PREPARING' ? <Button className="order-next" disabled={busy} onClick={() => send({ type: 'order', orderId: order.id, action: 'ready' })}><Check size={17}/>Marcar como pronto</Button> : null;
  return <div className="service-view">
    <div className="service-summary"><DishPhoto className="service-photo" priority/><div><span className="service-date">{today} · São Paulo</span><strong>{active.length} <span>em andamento</span></strong></div><div className="service-summary-side"><span>Capacidade <strong>{data.restaurant?.policy?.capacity ?? '—'}</strong></span><Button variant="outline" onClick={() => navigate('quick')}><SlidersHorizontal size={17}/>Ajustes rápidos</Button></div></div>
    <div className="service-toolbar"><Tabs value={mode} onValueChange={setMode}><TabsList><TabsTrigger value="service">Neste serviço</TabsTrigger><TabsTrigger value="history">Histórico</TabsTrigger></TabsList></Tabs><div className="order-search"><Search size={17}/><Input aria-label="Buscar pedido" placeholder="Prato ou código do pedido" value={filter} onChange={event => setFilter(event.target.value)}/></div></div>
    {mode === 'service' ? <>
      <p className="service-note"><Clock size={14}/>Mais antigos primeiro. Prontos de hoje; pedidos em andamento de qualquer dia.</p>
      <Tabs className="mobile-order-tabs" value={mobileLane} onValueChange={setMobileLane}><TabsList>{lanes.map(lane => <TabsTrigger key={lane.id} value={lane.id}>{lane.label}<span>{queue.filter(order => order.status === lane.id).length}</span></TabsTrigger>)}</TabsList></Tabs>
      <div className="order-board">{lanes.map(lane => <section className={`order-lane lane-${lane.id.toLowerCase()}`} data-mobile-active={mobileLane === lane.id} key={lane.id} aria-label={lane.label}>
        <header className="order-lane-header"><lane.icon size={18}/><h2>{lane.label}</h2><span>{queue.filter(order => order.status === lane.id).length}</span></header>
        <div className="order-lane-body">{queue.filter(order => order.status === lane.id).map(order => <article className="kitchen-ticket" key={order.id}>
          <button className="ticket-details" aria-label={`Detalhes do pedido ${order.id.slice(-6).toUpperCase()}`} onClick={() => setSelected(order.id)}><span className="ticket-meta"><strong>#{order.id.slice(-6).toUpperCase()}</strong><span><Clock size={13}/>{lane.id === 'READY' ? shortTime(order.at) : elapsed(order.at, now)}</span></span><h3>{order.dish}</h3><p>1 refeição · entrou às {shortTime(order.at)}</p><span className="ticket-total">{money(order.totalCents)} <small>com entrega</small></span></button>
          {action(order)}{order.status === 'READY' && <div className="ticket-ready"><Check size={16}/>Preparo concluído</div>}
        </article>)}{!queue.some(order => order.status === lane.id) && <div className="lane-empty"><lane.icon size={23}/><p>{search ? 'Nenhum pedido encontrado.' : lane.id === 'CONFIRMED' ? 'Novos pedidos aparecem aqui.' : lane.id === 'PREPARING' ? 'Sua bancada está livre.' : 'Os próximos pratos prontos ficam aqui.'}</p></div>}</div>
      </section>)}</div>
    </> : <div className="order-history">{[...filtered].reverse().map(order => <button key={order.id} className="history-row panel" onClick={() => setSelected(order.id)}><span><strong>#{order.id.slice(-6).toUpperCase()} · {order.dish}</strong><small>{day(order.at)} às {shortTime(order.at)}</small></span><span className="tag neutral">{statusLabel[order.status]}</span><strong>{money(order.totalCents)}</strong></button>)}{!filtered.length && <p className="quick-empty">Nenhum pedido no histórico.</p>}</div>}
    <p className="service-footnote">Atualização automática · pedidos em sandbox, sem cobrança ou entrega real.</p>
    <Sheet open={!!selectedOrder} onOpenChange={open => { if (!open) setSelected(null); }}><SheetContent className="adjustment-sheet"><SheetHeader><SheetTitle>Pedido #{selectedOrder?.id.slice(-6).toUpperCase()}</SheetTitle><SheetDescription>Detalhes e andamento do preparo em sandbox.</SheetDescription></SheetHeader>{selectedOrder && <div className="adjustment-body"><span className="tag">{statusLabel[selectedOrder.status]}</span><h2 className="mt-4">{selectedOrder.dish}</h2><p className="small-note">{day(selectedOrder.at)} às {shortTime(selectedOrder.at)} · {selectedOrder.merchantName}</p><div className="receipt-lines mt-5"><div><span>Prato</span><strong>{money(selectedOrder.subtotalCents)}</strong></div><div><span>Entrega</span><strong>{money(selectedOrder.deliveryCents)}</strong></div><div className="receipt-total"><span>Total</span><strong>{money(selectedOrder.totalCents)}</strong></div></div><p className="small-note mb-5">{selectedOrder.status === 'CANCELLED' ? 'Reserva liberada. Pedido cancelado.' : selectedOrder.consumed ? 'Consumo dos ingredientes registrado.' : 'Ingredientes reservados; o consumo acontece ao iniciar o preparo.'}</p>{action(selectedOrder)}{selectedOrder.status === 'CONFIRMED' && <Button className="w-full mt-3" variant="outline" disabled={busy} onClick={() => setCancel(selectedOrder.id)}><X size={16}/>Cancelar pedido</Button>}</div>}</SheetContent></Sheet>
    <Dialog open={!!cancelledOrder} onOpenChange={open => { if (!open) setCancel(null); }}><DialogContent><DialogHeader><DialogTitle>Cancelar este pedido?</DialogTitle><DialogDescription>A reserva de ingredientes e o valor autorizado serão liberados. O pedido continuará no histórico.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setCancel(null)}>Manter pedido</Button><Button disabled={busy || cancelledOrder?.status !== 'CONFIRMED'} onClick={async () => { if (cancelledOrder && await send({ type: 'order', orderId: cancelledOrder.id, action: 'cancel' })) setCancel(null); }}>Confirmar cancelamento</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
