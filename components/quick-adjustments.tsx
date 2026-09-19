'use client';
import { useState } from 'react';
import { ArrowRight, Check, ChefHat, ClipboardCheck, Leaf, Mic, Package, Search, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { DishPhoto } from '@/components/dish-photo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { toast } from 'sonner';
import { money, cents, qsub, compare } from '@/lib/domain/money';
import { catalog } from '@/lib/domain/fixtures';
import { quantity } from '@/lib/client/format';
import type { Policy, Stock } from '@/lib/domain/types';
import type { Send, ViewState } from '@/lib/client/workspace-types';

const available = (item: Stock) => {
  const result = qsub(qsub(item.quantity, item.reserved), item.safety);
  return compare(result, '0') > 0 ? result : '0';
};
export function QuickAdjustments({ data, send, busy, navigate }: {
  data: ViewState; send: Send; busy: boolean; navigate: (view: string) => void;
}) {
  const restaurant = data.restaurant!;
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const active = data.orders.filter(order => ['CONFIRMED', 'PREPARING'].includes(order.status));
  const selectedItem = restaurant.stock.find(item => item.id === selected);
  const filtered = restaurant.stock.filter(item => item.name.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')));
  return <div className="quick-layout">
    <section className="quick-overview"><DishPhoto className="quick-photo" caption={false} priority/><small className="quick-image-note">Imagem ilustrativa · IA</small>
      <div><h2>Sua cozinha, na mão.</h2><span className="kitchen-name">{restaurant.name}</span><p>Confira o movimento e ajuste o que mudou.</p></div>
      <div className="quick-numbers"><button onClick={() => navigate('orders')}><strong>{active.length}</strong><span>em andamento <ArrowRight size={14}/></span></button><div><strong>{restaurant.policy?.capacity ?? '—'}</strong><span>capacidade simultânea</span></div></div>
      <Button variant="secondary" onClick={() => navigate('voice')}><Mic size={18}/>Conversar com a Byara <ArrowRight size={16}/></Button>
    </section>
    <section className="quick-controls" aria-label="Atalhos da cozinha">
      <button className="quick-action panel" onClick={() => restaurant.policy ? setPolicy({ ...restaurant.policy }) : navigate('policy')}><span className="icon-tile"><SlidersHorizontal size={22}/></span><div><h3>Limites do agente</h3><p>{restaurant.policy ? `Referência ${money(restaurant.policy.referenceCents)} · até ${restaurant.policy.maxDiscountBps / 100}% de desconto` : 'Defina preço, margem e capacidade'}</p></div><ArrowRight size={18}/></button>
      <button className="quick-action panel" onClick={() => navigate('orders')}><span className="icon-tile"><ChefHat size={22}/></span><div><h3>Fila de preparo</h3><p>{data.orders.filter(order => order.status === 'CONFIRMED').length} aguardando · {data.orders.filter(order => order.status === 'PREPARING').length} em preparo</p></div><ArrowRight size={18}/></button>
      {!restaurant.recipes.length && <button className="quick-action panel" onClick={() => navigate('conversation')}><span className="icon-tile"><ClipboardCheck size={22}/></span><div><h3>Vamos montar sua primeira ficha?</h3><p>Conte os ingredientes para a Byara.</p></div><ArrowRight size={18}/></button>}
    </section>
    <section className="quick-stock panel">
      <div className="quick-stock-heading"><div><span className="section-kicker">DISPONIBILIDADE</span><h2>O que mudou na cozinha?</h2></div><Button variant="ghost" onClick={() => navigate('stock')}>Ver estoque <ArrowRight size={16}/></Button></div>
      <div className="stock-search"><Search size={18}/><Input aria-label="Buscar insumo" placeholder="Buscar insumo…" value={search} onChange={event => setSearch(event.target.value)}/></div>
      <div className="quick-stock-list">{filtered.map(item => <article className="stock-touch-card" key={item.id}>
        <div className="stock-touch-heading"><span className="stock-symbol"><Package size={19}/></span><div><h3>{item.name}</h3><p>{quantity(available(item), item.unit)} disponíveis <span>· {item.basis === 'COOKED_EDIBLE' ? 'pronto' : 'cru / comprado'}</span></p></div><button className="count-link" aria-label={`Conferir quantidade de ${item.name}`} onClick={() => setSelected(item.id)}><ClipboardCheck size={20}/></button></div>
        <div className="stock-touch-controls"><label className="touch-switch" htmlFor={`quick-eligible-${item.id}`}><span>{item.eligible ? 'Liberado' : 'Bloqueado'}</span><Switch id={`quick-eligible-${item.id}`} aria-label={`Liberar ${item.name}`} checked={item.eligible} disabled={busy} onCheckedChange={eligible => send({ type: 'eligibility', item: item.id, eligible })}/></label><label className="touch-switch" htmlFor={`quick-surplus-${item.id}`}><span><Leaf size={15}/>Excedente</span><Switch id={`quick-surplus-${item.id}`} aria-label={`Excedente de ${item.name}`} checked={item.surplus} disabled={busy || !item.eligible || compare(item.quantity, '0') <= 0} onCheckedChange={enabled => send({ type: 'surplus', item: item.id, enabled })}/></label></div>
      </article>)}</div>
      {!filtered.length && <p className="quick-empty">Nenhum insumo com esse nome.</p>}
      <div className="panel-foot"><ShieldCheck size={16}/><span>Libere somente itens em condição de uso. Excedentes seguem os limites confirmados do agente.</span></div>
    </section>
    <Sheet open={!!selectedItem} onOpenChange={open => { if (!open) setSelected(null); }}><SheetContent className="adjustment-sheet"><SheetHeader><SheetTitle>Conferir quantidade</SheetTitle><SheetDescription>Contagem exata no estoque principal, realizada agora.</SheetDescription></SheetHeader>{selectedItem && <QuickCount key={selectedItem.id} item={selectedItem} data={data} send={send} busy={busy} close={() => setSelected(null)}/>}</SheetContent></Sheet>
    <Sheet open={!!policy} onOpenChange={open => { if (!open) setPolicy(null); }}><SheetContent className="adjustment-sheet"><SheetHeader><SheetTitle>Ajustar limites</SheetTitle><SheetDescription>Revise os valores e confirme a nova política.</SheetDescription></SheetHeader>{policy && <QuickPolicy policy={policy} currentVersion={restaurant.policy?.version ?? 0} send={send} busy={busy} close={() => setPolicy(null)}/>}</SheetContent></Sheet>
  </div>;
}

function QuickCount({ item, data, send, busy, close }: { item: Stock; data: ViewState; send: Send; busy: boolean; close: () => void }) {
  const [value, setValue] = useState(item.quantity);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const pending = data.count?.id === reviewId && !data.count.confirmed ? data.count : null;
  const recognized = catalog.find(entry => entry.id === item.id);
  const propose = async () => {
    if (!recognized) return;
    const result = await send({ type: 'count', text: `${value.replace(',', '.')} ${item.unit} de ${recognized.aliases[0]} ${item.basis === 'COOKED_EDIBLE' ? 'pronto' : 'cru'}, contagem exata, estoque principal, agora.` }, { quiet: true });
    if (result) setReviewId(result.state.count?.id ?? null);
  };
  return <div className="adjustment-body"><div className="adjustment-item"><span className="icon-tile"><Package size={24}/></span><div><h2>{item.name}</h2><p>Saldo teórico: {quantity(item.quantity, item.unit)}</p></div></div>
    <label className="field-label" htmlFor="quick-count">Quantidade contada · {item.unit}</label><Input id="quick-count" inputMode="decimal" value={value} onChange={event => { setValue(event.target.value); setReviewId(null); }} disabled={busy}/>
    <p className="small-note">Inclua os itens reservados: {quantity(item.reserved, item.unit)}. Os demais insumos mantêm o saldo atual.</p>
    {pending ? <div className="quick-review"><h3>Confira a alteração</h3>{pending.lines.map(line => <p key={line.item}>{quantity(line.previous, item.unit)} <ArrowRight size={16}/> <strong>{quantity(line.quantity, item.unit)}</strong></p>)}<Button className="w-full" disabled={busy} onClick={async () => { if (await send({ type: 'confirm_count', countId: pending.id })) close(); }}><Check size={17}/>Confirmar contagem</Button></div>
      : <Button className="w-full mt-5" disabled={busy || !/^\d+(?:[.,]\d{1,6})?$/.test(value) || !recognized} onClick={propose}>Revisar contagem <ArrowRight size={17}/></Button>}
    {!recognized && <p className="small-note">Este item preparado ainda não é reconhecido pelo interpretador local de contagens.</p>}
  </div>;
}

function QuickPolicy({ policy, currentVersion, send, busy, close }: { policy: Policy; currentVersion: number; send: Send; busy: boolean; close: () => void }) {
  const [values, setValues] = useState({ reference: (policy.referenceCents / 100).toFixed(2), discount: String(policy.maxDiscountBps / 100), surplus: String(policy.surplusDiscountBps / 100), capacity: String(policy.capacity) });
  const stale = currentVersion !== policy.version;
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const result = await send({ type: 'policy', expectedVersion: policy.version, objective: policy.objective, referenceCents: cents(values.reference), minMarginBps: policy.minMarginBps, maxDiscountBps: cents(values.discount), maxMarkupBps: policy.maxMarkupBps, feeBps: policy.feeBps, fixedCents: policy.fixedCents, minContributionCents: policy.minContributionCents, surplusDiscountBps: cents(values.surplus), capacity: Number(values.capacity) });
      if (result) close();
    } catch (error) { toast.error((error as Error).message); }
  };
  return <form className="adjustment-body" onSubmit={save}><div className="quick-policy-context"><ShieldCheck size={21}/><span>Margem mínima protegida: <strong>{policy.minMarginBps / 100}%</strong></span></div>
    {([{ key: 'reference', label: 'Preço de referência · R$', before: money(policy.referenceCents) }, { key: 'discount', label: 'Desconto máximo · %', before: `${policy.maxDiscountBps / 100}%` }, { key: 'surplus', label: 'Desconto por excedente · %', before: `${policy.surplusDiscountBps / 100}%` }, { key: 'capacity', label: 'Pedidos simultâneos', before: String(policy.capacity) }] as const).map(field => <div className="quick-policy-field" key={field.key}><label className="field-label" htmlFor={`quick-${field.key}`}>{field.label}<span>Atual: {field.before}</span></label><Input required id={`quick-${field.key}`} inputMode={field.key === 'capacity' ? 'numeric' : 'decimal'} value={values[field.key]} onChange={event => setValues(previous => ({ ...previous, [field.key]: event.target.value }))}/></div>)}
    <p className="small-note">Aplicável às próximas propostas. Pedidos já confirmados mantêm seus valores. A confirmação registra uma nova versão da política.</p>
    {stale && <p role="alert" className="voice-error">A política mudou enquanto você editava. Feche e abra novamente para revisar os valores atuais.</p>}
    <Button className="w-full mt-5" disabled={busy || stale} type="submit"><Check size={17}/>Confirmar ajustes</Button>
  </form>;
}
