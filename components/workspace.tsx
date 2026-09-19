'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { type LucideIcon, Sprout, MessageCircle, UtensilsCrossed, Package, SlidersHorizontal, ShoppingBag, Activity, Plug, ArrowUp, ArrowUpRight, ArrowRight, Check, CheckCheck, ChevronRight, Mic, ShieldCheck, FlaskConical, Store, UserRound, Plus, FileText, Upload, AlertCircle, LockKeyhole, Loader2, Search, Receipt, Leaf, CalendarClock, Play, ChefHat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { money, cents } from '@/lib/domain/money';
import { catalog, demoPolicy } from '@/lib/domain/fixtures';
import type { Role, Policy } from '@/lib/domain/types';
import { registerWorkspaceTools } from '@/lib/webmcp';
import { MobileNavigation } from '@/components/mobile-navigation';
import { QuickAdjustments } from '@/components/quick-adjustments';
import { OrderBoard } from '@/components/order-board';
import { VoiceConversation } from '@/components/voice-conversation';
import { Market } from '@/components/marketplace';
import { DishPhoto } from '@/components/dish-photo';
import type { ViewState, Send, Dish } from '@/lib/client/workspace-types';
const merchantNav = [{ id: 'quick', label: 'Ajustes rápidos', icon: SlidersHorizontal }, { id: 'voice', label: 'Conversa por voz', icon: Mic }, { id: 'conversation', label: 'Conversa com a Byara', icon: MessageCircle }, { id: 'recipes', label: 'Fichas técnicas', icon: UtensilsCrossed }, { id: 'stock', label: 'Estoque e compras', icon: Package }, { id: 'policy', label: 'Limites do agente', icon: SlidersHorizontal }, { id: 'orders', label: 'Pedidos', icon: ShoppingBag }];
const buyerNav = [{ id: 'market', label: 'Meu próximo pedido', icon: Search }, { id: 'orders', label: 'Meus pedidos', icon: ShoppingBag }];
const titles: Record<string, [
    string,
    string
]> = { quick: ['Ajustes rápidos.', 'Pequenos ajustes para a cozinha seguir em frente.'], voice: ['Vamos conversar?', 'Fale, revise e ouça a Byara.'], conversation: ['Receita boa começa com conversa.', 'Conte o que você prepara. A Byara organiza os detalhes com você.'], recipes: ['De dar água na boca.', 'Fichas confirmadas são a base de cada proposta do seu agente.'], stock: ['Uma cozinha em dia.', 'Compras, disponibilidade e contagem no mesmo lugar.'], policy: ['A autonomia tem os seus limites.', 'Você define as regras. Seu agente negocia dentro delas.'], orders: ['Tem coisa boa saindo.', 'Sua operação, do pedido ao prato pronto.'], activity: ['Cada decisão deixa um registro.', 'Eventos da operação, filtrados para esta visão.'], integrations: ['Conexões da sua cozinha.', 'O que está funcionando e o que ainda precisa ser conectado.'], market: ['Hoje pede comida boa.', 'Seu agente encontra uma refeição dentro dos limites que você autorizar.'] };
const requestKey = () => Array.from(crypto.getRandomValues(new Uint8Array(16))).map(x => x.toString(16).padStart(2, '0')).join('');
const date = (v: string) => new Date(v).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const time = (v: string) => new Date(v).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
const amount = (q: string, u: string) => u === 'g' && Number(q) >= 1000 ? `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(Number(q) / 1000)} kg` : `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(Number(q))} ${u}`;
function Mark({ small = false }: {
    small?: boolean;
}) { return <span className={`byara-mark ${small ? 'small' : ''}`}><Sprout size={small ? 19 : 25}/></span>; }
function Tag({ children, tone = 'green' }: {
    children: React.ReactNode;
    tone?: string;
}) { return <span className={`tag ${tone}`}>{children}</span>; }
function Empty({ icon: Icon = Package, title, text, children }: {
    icon?: LucideIcon;
    title: string;
    text: string;
    children?: React.ReactNode;
}) { return <div className="empty"><span className="empty-icon"><Icon size={28}/></span><h3>{title}</h3><p>{text}</p>{children}</div>; }
function NavItem({ item, active, onClick }: {
    item: { id: string; label: string; icon: LucideIcon };
    active: boolean;
    onClick: () => void;
}) { const { setOpenMobile } = useSidebar(); return <SidebarMenuItem><SidebarMenuButton className="nav-item" isActive={active} onClick={() => { onClick(); setOpenMobile(false); }}><item.icon /><span>{item.label}</span>{active && <span className="nav-active-mark"/>}</SidebarMenuButton></SidebarMenuItem>; }
export default function Workspace() {
    const [role, setRole] = useState<Role>('merchant'), [view, setView] = useState('conversation'), [data, setData] = useState<ViewState | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
    const roleRef = useRef<Role>(role), inflight = useRef(false), initialView = useRef(false), lastContact = useRef(0);
    const [draft, setDraft] = useState('');
    useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); }, [view, role]);
    const [connection, setConnection] = useState('connecting');
    const replayRef = useRef<{
        body: string;
        key: string;
    } | null>(null);
    const load = useCallback(() => fetch(`/api/v1/state?role=${role}`, { signal: AbortSignal.timeout(15000) }).then(async response => {
        const value = await response.json() as ViewState & { error?: { message: string } };
        if (!response.ok) throw new Error(value.error?.message ?? 'Não foi possível carregar.');
        if (roleRef.current !== role) return;
        if (!initialView.current) {
            initialView.current = true;
            if (value.role === 'merchant' && value.restaurant?.recipes.length)
                setView(window.matchMedia('(max-width: 767px)').matches ? 'quick' : 'orders');
        }
        setData(previous => previous && previous.role === role && previous.sequence > value.sequence ? previous : value);
        lastContact.current = Date.now();
        setConnection('connected'); setError('');
    }).catch((error: unknown) => {
        if (roleRef.current !== role) return;
        setConnection('reconnecting'); setError((error as Error).message);
    }), [role]);
    useEffect(() => { void load(); }, [load]);
    useEffect(() => {
        const source = new EventSource(`/api/v1/events?role=${role}&after=${data?.sequence ?? 0}`);
        source.onopen = () => { lastContact.current = Date.now(); setConnection('connected'); };
        // The server sends finite SSE batches. Normal 3-second reconnects are not outages.
        const checkConnection = () => { if (!navigator.onLine || Date.now() - lastContact.current > 20000) setConnection('reconnecting'); };
        source.onerror = checkConnection;
        source.addEventListener('change', () => { if (!inflight.current) void load(); });
        const check = setInterval(checkConnection, 3000);
        const fallback = setInterval(() => { if (!document.hidden && !inflight.current) void load(); }, 15000);
        const refresh = () => { if (!document.hidden && !inflight.current) void load(); };
        document.addEventListener('visibilitychange', refresh);
        window.addEventListener('online', refresh);
        window.addEventListener('offline', checkConnection);
        return () => { source.close(); clearInterval(check); clearInterval(fallback); document.removeEventListener('visibilitychange', refresh); window.removeEventListener('online', refresh); window.removeEventListener('offline', checkConnection); };
    }, [role, load, data?.sequence]);
    const send: Send = async (command, options) => { if (inflight.current)
        return null; inflight.current = true; setBusy(true); setError(''); const body = JSON.stringify({ ...command, scope: role }); const key = replayRef.current?.body === body ? replayRef.current.key : requestKey(); replayRef.current = { body, key }; try {
        const response = await fetch('/api/v1/commands', { signal: AbortSignal.timeout(20000), method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body });
        const value = await response.json() as NonNullable<Awaited<ReturnType<Send>>> & { error?: { code: string; message: string } };
        if (!response.ok) {
            if (response.status < 500 && value.error?.code !== 'CONCURRENT_UPDATE')
                replayRef.current = null;
            throw new Error(value.error?.message ?? 'Não foi possível salvar.');
        }
        replayRef.current = null;
        if (roleRef.current === role)
            setData(value.state);
        if (!options?.quiet)
            toast.success('Atualização salva');
        return value;
    }
    catch (e) {
        setError((e as Error).message);
        toast.error((e as Error).message);
        return null;
    }
    finally {
        inflight.current = false;
        setBusy(false);
    } };
    useEffect(() => registerWorkspaceTools(() => roleRef.current, async () => { const response = await fetch(`/api/v1/state?role=${roleRef.current}`); if (!response.ok)
        throw new Error('Não foi possível ler o contexto.'); return response.json(); }, setView), []);
    const changeRole = (v: string) => { if (inflight.current) { toast.info('Aguarde a atualização atual.'); return; } initialView.current = false; roleRef.current = v as Role; setData(null); setDraft(''); setRole(v as Role); setView(v === 'merchant' ? 'conversation' : 'market'); setError(''); };
    const r = data?.restaurant;
    return <SidebarProvider style={{ '--sidebar-width': '246px' } as React.CSSProperties}><Sidebar className="app-sidebar"><SidebarHeader className="brand-header"><Link className="wordmark" href="/" aria-label="i.byara, início">i<span>.</span>byara</Link><span className="brand-caption">Comida boa conecta.</span></SidebarHeader><SidebarContent><div className="role-switch"><Tabs value={role} onValueChange={changeRole}><TabsList><TabsTrigger value="merchant"><Store size={14}/>Restaurante</TabsTrigger><TabsTrigger value="buyer"><UserRound size={14}/>Consumidor</TabsTrigger></TabsList></Tabs></div><SidebarGroup><SidebarGroupLabel className="nav-label">{role === 'merchant' ? 'MINHA COZINHA' : 'MEU AGENTE'}</SidebarGroupLabel><SidebarMenu>{(role === 'merchant' ? merchantNav : buyerNav).map(i => <NavItem key={i.id} item={i} active={view === i.id} onClick={() => setView(i.id)}/>)}</SidebarMenu></SidebarGroup><SidebarGroup className="secondary-nav"><SidebarGroupLabel className="nav-label">ACOMPANHAMENTO</SidebarGroupLabel><SidebarMenu>{[{ id: 'activity', label: 'Atividade dos agentes', icon: Activity }, { id: 'integrations', label: 'Integrações', icon: Plug }].map(i => <NavItem key={i.id} item={i} active={view === i.id} onClick={() => setView(i.id)}/>)}</SidebarMenu></SidebarGroup></SidebarContent><SidebarFooter className="sidebar-bottom"><div className="demo-note"><FlaskConical size={19}/><div><strong>Espaço de demonstração</strong><p>Explore com dados fictícios.<br />Nenhuma cobrança real.</p></div></div><div className="operator"><span className="operator-avatar">{role === 'merchant' ? 'SN' : 'EU'}</span><div><strong>{role === 'merchant' ? 'Seu restaurante' : 'Seu consumidor'}</strong><span>Operador da demonstração</span></div><ChevronRight size={15}/></div></SidebarFooter></Sidebar>
 <div className={`workspace view-${view}`}><header className="topbar"><div className="breadcrumb"><SidebarTrigger className="mobile-nav"/><span>i.byara</span><ChevronRight size={14}/><strong>{role === 'merchant' ? 'Sua cozinha' : 'Consumidor'}</strong></div><div className="topbar-right"><Button className="role-shortcut" variant="ghost" disabled={busy} onClick={() => changeRole(role === 'merchant' ? 'buyer' : 'merchant')}><UtensilsCrossed size={16}/>{role === 'merchant' ? 'Quero comer' : 'Minha cozinha'}</Button>{role === 'merchant' && <Button className="header-voice" variant="outline" onClick={() => setView('voice')}><Mic size={16}/>Modo de voz</Button>}<span className={`connection-status ${connection}`} role="status">{connection === 'connected' ? 'Sincronizado' : connection === 'reconnecting' ? 'Reconectando…' : 'Conectando…'}</span><Tag tone="neutral"><FlaskConical size={13}/>Sandbox</Tag><span className="release-label">Release 0.3.0</span></div></header><main className="main"><div className="page-heading"><div><h1>{titles[view]?.[0]}</h1><p>{titles[view]?.[1]}</p></div>{view === 'conversation' && <Tag><LockKeyhole size={13}/>Conversa privada</Tag>}</div>
 {error && <div className="error-banner" role="alert"><AlertCircle size={18}/><span>{error}</span><Button variant="ghost" onClick={load} size="sm">Tentar novamente</Button></div>}
 {!data ? <div className="loading-grid" aria-label="Carregando cozinha"><Skeleton className="h-[540px] rounded-2xl"/><Skeleton className="h-[400px] rounded-2xl"/></div> : <>
 {view === 'conversation' && r && <Conversation data={data} send={send} busy={busy} navigate={setView} input={draft} setInput={setDraft}/>}
 {view === 'quick' && r && <QuickAdjustments data={data} send={send} busy={busy} navigate={setView}/>}
 {view === 'voice' && r && <VoiceConversation data={data} send={send} busy={busy} draft={draft} setDraft={setDraft} navigate={setView}/>}
 {view === 'recipes' && r && <Recipes data={data} send={send} busy={busy} navigate={setView}/>}
 {view === 'stock' && r && <Inventory data={data} send={send} busy={busy}/>}
 {view === 'policy' && r && <PolicyPanel data={data} send={send} busy={busy}/>}
 {view === 'orders' && (role === 'merchant' ? <OrderBoard data={data} send={send} busy={busy} navigate={setView}/> : <Orders data={data} send={send} busy={busy}/>)}
 {view === 'activity' && <ActivityPanel data={data}/>}
 {view === 'integrations' && <Integrations />}
 {view === 'market' && role === 'buyer' && <Market data={data} send={send} busy={busy}/>}
 </>}
 <footer className="page-footer"><span><Sprout size={13}/>i.byara</span><span>{role === 'merchant' ? 'Sua cozinha. Seus limites. Agentes negociando.' : 'Sua intenção. Seus limites. Agentes negociando.'}</span><span>NeuraLake + Agora · mocks</span></footer></main></div><MobileNavigation role={role} view={view} navigate={setView} pending={data?.orders.filter(o => o.status === 'CONFIRMED' || o.status === 'PREPARING').length ?? 0}/><Toaster richColors position="top-right"/></SidebarProvider>;
}
function Conversation({ data, send, busy, navigate, input, setInput }: {
    input: string;
    setInput: (value: string) => void;
    data: ViewState;
    send: Send;
    busy: boolean;
    navigate: (v: string) => void;
}) {
    const r = data.restaurant!;
    const messagesRef = useRef<HTMLDivElement>(null);
    useEffect(() => { messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: 'smooth' }); }, [r.conversation.length]);
    const submit = async (e?: FormEvent) => { e?.preventDefault(); if (!input.trim() || busy)
        return; const result = await send({ type: 'turn', text: input }, { quiet: true }); if (result) {
        setInput('');
    } };
    const d = r.draft;
    const steps = [r.stage !== 'START', r.recipes.length > 0, !!r.policy && r.stock.some(i => i.costNumerator !== null)];
    return <div className="conversation-grid"><section className="conversation-card panel"><div className="conversation-head"><div className="inline-flex items-center gap-3"><Mark /><div><h2>Byara</h2><p>Sua assistente de cozinha</p></div></div><div className="chat-head-actions"><Tag tone="neutral">Interpretador local</Tag><Button onClick={() => navigate('voice')} variant="outline"><Mic size={18}/>Voz</Button></div></div><div className="chat-scroll" ref={messagesRef} role="log" aria-live="polite"><div className="chat-date">HOJE · SEU ESPAÇO DE CONVERSA</div>{r.conversation.map(m => <div className={`message ${m.role}`} key={m.id}>{m.role === 'assistant' && <Mark small/>}<div className="message-content"><div className="message-author">{m.role === 'assistant' ? 'Byara' : 'Você'}<time>{time(m.at)}</time></div><div className="message-bubble">{m.text}</div>{m.role === 'user' && <span className="message-saved"><CheckCheck size={12}/>Salvo</span>}</div></div>)}{busy && <div className="thinking"><Mark small/><span>Organizando sua cozinha<Loader2 className="spin" size={14}/></span></div>}</div><form className="composer" onSubmit={submit}><Textarea aria-label="Mensagem para a Byara" placeholder="Conte para a Byara…" disabled={busy} maxLength={4000} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void submit();
    } }} rows={2}/><div className="composer-actions"><div><Button type="button" onClick={() => navigate('voice')} variant="ghost" size="icon" aria-label="Abrir conversa por voz"><Mic size={18}/></Button><span>Conversar por voz</span></div><Button className="send-button" type="submit" size="icon" disabled={!input.trim() || busy} aria-label="Enviar mensagem"><ArrowUp size={21}/></Button></div></form><div className="chat-disclaimer"><ShieldCheck size={13}/>Você confirma os dados antes de a ficha entrar em operação.</div></section>
 <aside className="context-column"><section className="journey-card"><h2>Da conversa ao primeiro pedido.</h2><ol className="journey-steps">{[['Conhecer sua cozinha', 'Nome e localização'], ['Montar a ficha técnica', 'Ingredientes, porções e preparo'], ['Preparar seu agente', 'Custos e limites de negociação']].map(([title, desc], i) => <li className={steps[i] ? 'done' : ''} key={title}><span className="step-number">{steps[i] ? <Check size={15}/> : String(i + 1).padStart(2, '0')}</span><div><strong>{title}</strong><p>{desc}</p></div></li>)}</ol><Progress value={steps.filter(Boolean).length / 3 * 100} aria-label="Progresso da configuração"/></section>
 {d ? <section className="panel recipe-live"><div className="section-heading"><span className="section-kicker">FICHA EM CONSTRUÇÃO</span><Tag tone="amber">Rascunho</Tag></div><h3>{d.name}</h3><div className="recipe-components">{d.components.map(c => <div key={c.item}><span>{catalog.find(i => i.id === c.item)?.name ?? c.item}</span><strong className={!c.quantity ? 'pending-value' : ''}>{c.quantity ? `${c.quantity} ${c.unit}` : 'Falta o peso'}</strong></div>)}</div><div className="pending-box"><AlertCircle size={16}/><span>{r.pending.length ? `${r.pending.length} detalhe(s) para esclarecer` : 'Pronta para sua confirmação'}</span></div>{!r.pending.length && <Button disabled={busy} onClick={() => send({ type: 'confirm_recipe', expectedVersion: d.version })} className="w-full">Confirmar ficha <Check size={16}/></Button>}</section> : r.recipes.length ? <section className="panel ready-card"><DishPhoto dish={r.recipes[0].name} className="ready-photo"/><h3>{r.recipes.length} ficha(s) confirmada(s)</h3><p>{r.name}</p><Button onClick={() => navigate('recipes')} variant="outline">Ver fichas técnicas <ArrowRight size={15}/></Button></section> : <section className="conversation-tip"><DishPhoto className="conversation-photo"/><p>Você conhece a receita.<br /><strong>A Byara cuida dos detalhes.</strong></p><span>Se faltar uma quantidade, ela pergunta. Você continua no controle.</span></section>}
 <section className="demo-tools"><div className="section-kicker"><FlaskConical size={13}/>EXPERIMENTAR O CENÁRIO DO GUIA</div><p>Use falas fictícias do Seu Niko para conhecer o fluxo.</p><Button variant="outline" disabled={busy} onClick={() => setInput(r.suggested)} className="w-full">Preencher uma fala de exemplo <ArrowUpRight size={14}/></Button>{!r.recipes.length && !data.purchases?.length && <button className="text-button" disabled={busy} onClick={() => send({ type: 'seed_demo' })}>Ou carregar a cozinha pronta</button>}</section>
 </aside></div>;
}
function Recipes({ data, send, busy, navigate }: {
    data: ViewState;
    send: Send;
    busy: boolean;
    navigate: (v: string) => void;
}) {
    const r = data.restaurant!, [selected, setSelected] = useState<Dish | null>(null);
    return <><div className="view-toolbar"><span>{r.recipes.length} ficha(s) · versões preservadas</span><Button onClick={async () => { if (await send({ type: 'new_recipe' }, { quiet: true }))
        navigate('conversation'); }} disabled={busy || !!r.draft}><Plus size={16}/>Adicionar prato por conversa</Button></div>{!r.recipes.length ? <div className="panel"><Empty icon={UtensilsCrossed} title="O primeiro prato começa na conversa." text="Conte os ingredientes e quantidades para a Byara. Ela pergunta o que falta."><Button onClick={() => navigate('conversation')}>Conversar com a Byara<ArrowRight size={16}/></Button></Empty></div> : <div className="dish-grid">{r.recipes.map(d => <article className="panel dish-card" key={d.id}><DishPhoto dish={d.name} className="recipe-photo"/><div className="dish-card-top"><div className="dish-icon"><UtensilsCrossed size={28}/></div><Tag tone={d.blocked ? 'amber' : 'green'}>{d.blocked ? 'Venda bloqueada' : 'Disponível para negociar'}</Tag></div><span className="section-kicker">VERSÃO {d.version} · {d.mode === 'PREPRODUCED' ? 'PRÉ-PRODUZIDO' : 'PREPARO SOB PEDIDO'}</span><h2>{d.name}</h2><p>{d.components.length} componentes · {d.servings} porção(ões)</p>{d.pricing ? <div className="dish-financials"><div><span>Custo total por pedido</span><strong>{money(d.pricing.costCents)}</strong></div><div><span>Proposta atual</span><strong>{money(d.pricing.subtotalCents)}</strong></div></div> : <div className="pending-box"><AlertCircle size={17}/>{d.blocked?.message}</div>}<div className="dish-actions"><Button onClick={() => setSelected(d)} variant="outline">Ver composição <ArrowUpRight size={15}/></Button><Button variant="ghost" disabled={busy || !!r.draft} onClick={async () => { if (await send({ type: 'revise_recipe', recipeId: d.id }, { quiet: true }))
        navigate('conversation'); }}>Revisar ficha</Button></div></article>)}</div>}
 <Sheet open={!!selected} onOpenChange={v => !v && setSelected(null)}><SheetContent className="detail-sheet"><SheetHeader><SheetTitle>{selected?.name}</SheetTitle><SheetDescription>Ficha v{selected?.version} · dados privados do restaurante</SheetDescription></SheetHeader>{selected && <div className="sheet-body"><Table><TableHeader><TableRow><TableHead>Ingrediente</TableHead><TableHead>Quantidade</TableHead><TableHead>Rendimento</TableHead></TableRow></TableHeader><TableBody>{selected.components.map(c => <TableRow key={c.item}><TableCell>{catalog.find(i => i.id === c.item)?.name ?? c.item}<small className="block muted">{c.basis === 'COOKED_EDIBLE' ? 'Pronto' : 'Cru / comprado'}</small></TableCell><TableCell>{c.quantity} {c.unit}</TableCell><TableCell>{c.yield}</TableCell></TableRow>)}</TableBody></Table>{selected.pricing && <><h3 className="mt-8 mb-4">Memória do cálculo</h3><div className="receipt-lines">{selected.pricing.breakdown.map(b => <div key={b.item}><span>{b.item} <small>{b.quantity}</small></span><strong>{money(b.cents)}</strong></div>)}<div><span>Outros variáveis</span><strong>{money(selected.otherVariableCents ?? 0)}</strong></div><div><span>Encargo fixo</span><strong>{money(selected.pricing.fixedCents)}</strong></div><div className="receipt-total"><span>Custo total</span><strong>{money(selected.pricing.costCents)}</strong></div><div><span>Piso analítico</span><strong>{money(selected.pricing.analyticalFloorCents)}</strong></div><div><span>Piso efetivo</span><strong>{money(selected.pricing.floorCents)}</strong></div><div><span>Contribuição da proposta</span><strong>{money(selected.pricing.contributionCents)}</strong></div></div><p className="small-note">Contribuição não é lucro líquido. Taxas e custos são os parâmetros confirmados deste cenário.</p></>}{selected.mode === 'ON_DEMAND' && <Button className="mt-6 w-full" disabled={busy || !!selected.blocked} variant="outline" onClick={async () => { if (await send({ type: 'produce', recipeId: selected.id, portions: 3 })) {
        setSelected(null);
    } }}><ChefHat size={16}/>Produzir lote de teste · 3 porções</Button>}</div>}</SheetContent></Sheet></>;
}
function Inventory({ data, send, busy }: {
    data: ViewState;
    send: Send;
    busy: boolean;
}) { const r = data.restaurant!, [tab, setTab] = useState('stock'), [countText, setCountText] = useState(''), [days, setDays] = useState(String(data.schedule?.days ?? 3)), [hour, setHour] = useState(data.schedule?.hour ?? '09:00'); const file = useRef<HTMLInputElement>(null); const count = data.count; return <Tabs value={tab} onValueChange={setTab}><TabsList className="section-tabs"><TabsTrigger value="stock">Estoque</TabsTrigger><TabsTrigger value="purchases">Compras</TabsTrigger><TabsTrigger value="count">Contagem e rotina</TabsTrigger></TabsList><TabsContent value="stock"><div className="metric-row"><div className="panel metric"><span>Insumos cadastrados</span><strong>{r.stock.length}<Package size={23}/></strong></div><div className="panel metric"><span>Excedentes declarados</span><strong>{r.stock.filter(i => i.surplus).length}<Leaf size={23}/></strong></div><div className="panel metric"><span>Próxima contagem</span><strong className="date-metric">{data.schedule ? date(data.schedule.nextAt) : '—'}<CalendarClock size={23}/></strong></div></div><section className="panel stock-panel"><div className="panel-top"><div><h2>Disponibilidade da cozinha</h2><p>Saldo teórico menos reservas e estoque de segurança.</p></div><Tag tone="neutral">Estoque principal</Tag></div><Table><TableHeader><TableRow><TableHead>Insumo</TableHead><TableHead>Saldo</TableHead><TableHead>Reservado</TableHead><TableHead>Disponível</TableHead><TableHead>Condição</TableHead><TableHead>Excedente</TableHead></TableRow></TableHeader><TableBody>{r.stock.map(i => <TableRow key={i.id}><TableCell><strong>{i.name}</strong><small className="block muted">{i.basis === 'COOKED_EDIBLE' ? 'Pronto' : 'Cru / comprado'}</small></TableCell><TableCell>{amount(i.quantity, i.unit)}</TableCell><TableCell>{amount(i.reserved, i.unit)}</TableCell><TableCell><strong>{amount(String(Math.max(0, Number(i.quantity) - Number(i.reserved) - Number(i.safety))), i.unit)}</strong></TableCell><TableCell><button className="status-toggle" disabled={busy} title={i.eligible ? 'Bloquear insumo' : 'Declarar insumo elegível'} onClick={() => send({ type: 'eligibility', item: i.id, eligible: !i.eligible })}><Tag tone={i.eligible ? 'green' : 'amber'}>{i.eligible ? 'Elegível' : 'Bloqueado'}</Tag></button></TableCell><TableCell><Switch aria-label={`Excedente de ${i.name}`} checked={i.surplus} disabled={busy || !i.eligible || Number(i.quantity) <= 0} onCheckedChange={enabled => send({ type: 'surplus', item: i.id, enabled })}/></TableCell></TableRow>)}</TableBody></Table><div className="panel-foot"><ShieldCheck size={15}/>Excedente declarado não comprova desperdício evitado. Condição informada pelo operador.</div></section></TabsContent><TabsContent value="purchases"><div className="view-toolbar"><span>Nota registrada e recebimento são etapas diferentes.</span><div className="flex gap-2 flex-wrap"><Button variant="outline" disabled={busy} onClick={() => send({ type: 'purchase', source: 'fixture' })}><FileText size={16}/>Importar nota de exemplo</Button><Button disabled={busy} onClick={() => file.current?.click()}><Upload size={16}/>Importar XML</Button><input ref={file} hidden type="file" accept=".xml,text/xml,application/xml" onChange={async (e) => { const f = e.target.files?.[0]; if (f) {
    if (f.size > 250000) {
        toast.error('O XML deve ter até 250 KB.');
        return;
    }
    await send({ type: 'purchase', source: 'xml', xml: await f.text() });
    e.target.value = '';
} }}/></div></div>{!data.purchases?.length ? <div className="panel"><Empty icon={Receipt} title="Quanto custa o que entra na sua cozinha?" text="Importe um XML NF-e/NFC-e compatível ou use a nota fictícia do cenário. Consulta por QR ainda não está conectada."/></div> : <div className="purchase-list">{data.purchases.map(p => <section className="panel purchase-card" key={p.id}><div className="purchase-heading"><span className="icon-tile"><Receipt size={22}/></span><div><h3>{p.issuer}</h3><p>{p.lines.length} itens · {p.mode === 'FIXTURE' ? 'Nota fictícia' : `XML ${p.environment.toLowerCase()}`} · {date(p.at)}</p></div><Tag tone={p.received ? 'green' : 'amber'}>{p.received ? 'Recebido' : 'Aguardando recebimento'}</Tag></div><div className="receipt-lines compact">{p.lines.map((l, j) => <div key={j}><span>{l.description} <small>{amount(l.quantity, l.unit)}</small></span><strong>{money(l.totalCents)}</strong></div>)}</div>{!p.received && <div className="receive-prompt"><p>Confirme que os itens chegaram e estão em condição de uso. A nota, sozinha, não libera estoque.</p><Button disabled={busy} onClick={() => send({ type: 'receive', purchaseId: p.id, eligible: true })}><Check size={16}/>Confirmar recebimento e elegibilidade</Button></div>}</section>)}</div>}</TabsContent><TabsContent value="count"><div className="two-column"><section className="panel padded"><div className="section-kicker">CONTAGEM CONVERSACIONAL</div><h2>O que temos hoje?</h2><p className="muted mt-2">Informe quantidade, insumo cru ou pronto, local e precisão. Somente os itens citados serão atualizados.</p><Textarea className="mt-5" rows={4} aria-label="Contagem de estoque" placeholder="6 kg de patinho cru, 2 kg de frango cru. Contagem exata, estoque principal, agora." value={countText} onChange={e => setCountText(e.target.value)}/><Button className="mt-4" disabled={busy || !countText.trim()} onClick={() => send({ type: 'count', text: countText })}>Revisar contagem <ArrowRight size={16}/></Button>{count && !count.confirmed && <div className="count-review"><h3>Confira antes de reconciliar</h3>{count.lines.map(l => <div key={l.item}><span>{r.stock.find(i => i.id === l.item)?.name}</span><strong>{l.previous} → {l.quantity} {r.stock.find(i => i.id === l.item)?.unit}</strong></div>)}<Button className="w-full mt-3" disabled={busy} onClick={() => send({ type: 'confirm_count', countId: count.id })}>Confirmar contagem</Button></div>}{count?.confirmed && <div className="success-note"><Check size={16}/>Contagem reconciliada. Os itens omitidos foram preservados.</div>}</section><section className="panel padded schedule-panel"><span className="icon-tile"><CalendarClock size={23}/></span><h2>Uma rotina que cabe na cozinha.</h2><label className="field-label mt-5">Repetir a cada</label><Select value={days} onValueChange={setDays}><SelectTrigger aria-label="Periodicidade da contagem"><SelectValue /></SelectTrigger><SelectContent>{[1, 3, 5, 7].map(d => <SelectItem key={d} value={String(d)}>{d} dia(s)</SelectItem>)}</SelectContent></Select><label className="field-label mt-4" htmlFor="schedule-hour">Horário · São Paulo</label><Input id="schedule-hour" type="time" value={hour} onChange={e => setHour(e.target.value)}/><Button className="mt-5 w-full" disabled={busy} onClick={() => send({ type: 'schedule', days: Number(days), hour })}>Salvar rotina</Button><div className="scheduler-test"><span className="section-kicker">RELÓGIO DE TESTE</span><p>Avance três dias para verificar o lembrete. Isso também avança as validades do cenário.</p><Button variant="outline" className="w-full" disabled={busy} onClick={() => send({ type: 'tick', days: 3 })}><Play size={14}/>Avançar 3 dias no cenário</Button><small>Avanço acumulado: {data.clockOffset / 86400000} dia(s)</small></div></section></div></TabsContent></Tabs>; }
function PolicyPanel({ data, send, busy }: {
    data: ViewState;
    send: Send;
    busy: boolean;
}) {
    const r = data.restaurant!, p = r.policy ?? demoPolicy(data.now);
    const [values, setValues] = useState({ reference: (p.referenceCents / 100).toFixed(2), margin: String(p.minMarginBps / 100), discount: String(p.maxDiscountBps / 100), markup: String(p.maxMarkupBps / 100), fee: String(p.feeBps / 100), fixed: (p.fixedCents / 100).toFixed(2), surplus: String(p.surplusDiscountBps / 100), capacity: String(p.capacity), objective: p.objective });
    const field = (key: keyof typeof values, label: string, suffix: string) => <div className="form-field"><label htmlFor={`policy-${key}`}>{label}</label><div className="unit-input"><Input id={`policy-${key}`} inputMode="decimal" value={values[key]} onChange={e => setValues(v => ({ ...v, [key]: e.target.value }))}/><span>{suffix}</span></div></div>;
    const save = async (e: FormEvent) => { e.preventDefault(); try {
        await send({ type: 'policy', expectedVersion: r.policy?.version ?? 0, objective: values.objective, referenceCents: cents(values.reference), minMarginBps: cents(values.margin), maxDiscountBps: cents(values.discount), maxMarkupBps: cents(values.markup), feeBps: cents(values.fee), fixedCents: cents(values.fixed), minContributionCents: 0, surplusDiscountBps: cents(values.surplus), capacity: Number(values.capacity) });
    }
    catch (e) {
        toast.error((e as Error).message);
    } };
    return <div className="two-column policy-layout"><form className="panel padded" onSubmit={save}><div className="section-heading"><h2>Política comercial</h2><Tag tone={r.policy ? 'green' : 'amber'}>{r.policy ? `Versão ${r.policy.version} confirmada` : 'Exemplo · ainda não confirmado'}</Tag></div><p className="muted mt-2">Parâmetros de demonstração. Revise os valores e confirme sua autorização.</p><label className="field-label mt-6">Objetivo do agente</label><Select value={values.objective} onValueChange={v => setValues(s => ({ ...s, objective: v as Policy['objective'] }))}><SelectTrigger aria-label="Objetivo comercial"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="SURPLUS_FIRST">Priorizar excedente elegível</SelectItem><SelectItem value="BALANCED">Manter preço de referência</SelectItem></SelectContent></Select><div className="form-grid mt-6">{field('reference', 'Preço de referência', 'R$')}{field('margin', 'Margem mínima de contribuição', '%')}{field('discount', 'Desconto máximo', '%')}{field('markup', 'Aumento máximo permitido', '%')}{field('surplus', 'Desconto por excedente', '%')}{field('capacity', 'Capacidade simultânea', 'pedidos')}</div><div className="form-divider"/><h3>Custos da transação</h3><p className="small-note mb-4">Valores fictícios do cenário, sem comissão comercial definida.</p><div className="form-grid">{field('fee', 'Taxas sobre o subtotal', '%')}{field('fixed', 'Encargo fixo por pedido', 'R$')}</div><div className="policy-confirm"><ShieldCheck size={20}/><p>Ao confirmar, você autoriza seu agente a operar dentro destes limites. Políticas anteriores permanecem no histórico.</p></div><Button type="submit" disabled={busy} className="w-full">Confirmar limites do agente <Check size={16}/></Button></form><aside><section className="forest-card"><LockKeyhole size={25}/><h2>Autonomia para negociar.<br />Critérios para decidir.</h2><p>O comprador recebe preço, composição, prazo e entrega. Seu custo e sua margem ficam com o seu agente.</p><ul><li><Check size={15}/>Preço calculado pelo motor</li><li><Check size={15}/>Total com taxas e entrega</li><li><Check size={15}/>Até duas contrapropostas</li><li><Check size={15}/>Validade da oferta: 90 segundos</li></ul></section><section className="panel padded mt-5"><h3>Como o piso é protegido</h3><p className="muted mt-3">O motor considera custos, taxas, margem mínima e desconto máximo. A proposta precisa respeitar todos os limites.</p><div className="formula">piso = maior limite aplicável</div><p className="small-note">Se não houver um preço possível, a venda é bloqueada. Margem de contribuição não é lucro líquido.</p></section></aside></div>;
}
function Orders({ data, send, busy }: {
    data: ViewState;
    send: Send;
    busy: boolean;
}) { const status: Record<string, string> = { CONFIRMED: 'Confirmado', PREPARING: 'Em preparo', READY: 'Pronto', CANCELLED: 'Cancelado' }; return data.orders.length ? <div className="orders-list">{[...data.orders].reverse().map(o => <article className="panel order-card" key={o.id}><div className="order-heading"><DishPhoto dish={o.dish} className="order-photo"/><div><span className="section-kicker">PEDIDO {o.id.slice(-6).toUpperCase()} · SANDBOX</span><h2>{o.dish}</h2><p>{o.merchantName} · {date(o.at)}</p></div><Tag tone={o.status === 'CANCELLED' ? 'neutral' : 'green'}>{status[o.status]}</Tag></div><div className="order-body"><div className="order-money"><span>Prato {money(o.subtotalCents)} + entrega {money(o.deliveryCents)}</span><strong>{money(o.totalCents)}</strong></div><p><ShieldCheck size={15}/>{o.consumed ? 'Consumo dos ingredientes registrado.' : 'Ingredientes reservados; sem baixa de consumo.'}</p><div className="flex gap-2 flex-wrap">{data.role === 'merchant' && o.status === 'CONFIRMED' && <Button disabled={busy} onClick={() => send({ type: 'order', orderId: o.id, action: 'prepare' })}><ChefHat size={16}/>Iniciar preparo</Button>}{data.role === 'merchant' && o.status === 'PREPARING' && <Button disabled={busy} onClick={() => send({ type: 'order', orderId: o.id, action: 'ready' })}><Check size={16}/>Marcar como pronto</Button>}{o.status === 'CONFIRMED' && <Button variant="outline" disabled={busy} onClick={() => send({ type: 'order', orderId: o.id, action: 'cancel' })}>Cancelar pedido</Button>}</div></div><div className="panel-foot"><FlaskConical size={14}/>Pedido de demonstração. Nenhum débito, reembolso ou entrega real.</div></article>)}</div> : <div className="panel"><Empty icon={ShoppingBag} title="O próximo pedido aparece aqui." text="Autorize uma busca na visão Consumidor. Quando houver uma oferta elegível, o agente confirma o pedido em sandbox."/></div>; }
function ActivityPanel({ data }: {
    data: ViewState;
}) { return <section className="panel activity-panel"><div className="panel-top"><div><h2>Histórico da operação</h2><p>{data.events.length} eventos disponíveis nesta visão</p></div><Tag tone="neutral">{data.role === 'merchant' ? 'Contexto do restaurante' : 'Contexto do consumidor'}</Tag></div>{data.events.length ? <div className="activity-list">{[...data.events].reverse().map(e => <div className="activity-item" key={e.id}><span className={`activity-icon ${e.type.includes('CONFIRM') ? 'confirmed' : ''}`}>{e.type.includes('CONFIRM') ? <Check size={17}/> : <Activity size={17}/>}</span><div><h3>{e.title}</h3><p>{e.detail}</p><details><summary>{e.type} · #{e.id}</summary><div className="event-meta">Correlação: {e.correlationId}<br />Instante: {e.at}{e.data && <pre>{JSON.stringify(e.data, null, 2)}</pre>}</div></details></div><time>{date(e.at)}</time></div>)}</div> : <Empty icon={Activity} title="A história começa com a primeira ação." text="Conversas, confirmações, propostas e movimentos de estoque serão registrados aqui."/>}</section>; }
function Integrations() { return <><div className="integration-banner"><ShieldCheck size={22}/><div><h2>Uma demonstração transparente.</h2><p>Cálculos, negociação, persistência e reservas executam código real. Os provedores externos estão desconectados nesta release.</p></div></div><div className="integration-grid">{[{ title: 'NeuraLake', subtitle: 'Interpretação e memória', icon: Sprout, tag: 'Mock local', tone: 'amber', text: 'A conversa usa regras locais e um vocabulário limitado. Não há chamadas a modelos nem Cross Memory.', todo: 'Próximo: autenticação, saída estruturada, limites de inferência, métricas e isolamento de contexto.' }, { title: 'Agora', subtitle: 'Conversa por voz', icon: Mic, tag: 'Mock · não conectado', tone: 'amber', text: 'Ditado e leitura do navegador podem ser usados, quando disponíveis. Nenhum áudio é enviado ao Agora.', todo: 'Próximo: contrato de voz, tokens por sessão, transcrição em português e reconexão.' }, { title: 'Documentos fiscais', subtitle: 'Custos e compras', icon: Receipt, tag: 'XML + exemplo', tone: 'green', text: 'Importação de XML NF-e/NFC-e com itens reconhecidos, deduplicação e confirmação separada de recebimento.', todo: 'Pendente: consulta por QR, novos emissores e conversões de embalagens não cadastradas.' }, { title: 'Comércio em sandbox', subtitle: 'Propostas, reservas e pedidos', icon: ShoppingBag, tag: 'Operacional', tone: 'green', text: 'Três agentes de restaurante com políticas próprias, ranking por total, reservas atômicas e pedidos idempotentes.', todo: 'Pagamento e entrega são simulados. Integrações comerciais dependem de homologação.' }].map(x => <section className="panel integration-card" key={x.title}><div className="section-heading"><span className="icon-tile"><x.icon size={24}/></span><Tag tone={x.tone}>{x.tag}</Tag></div><h2>{x.title}</h2><span className="integration-subtitle">{x.subtitle}</span><p>{x.text}</p><div className="integration-todo">{x.todo}</div></section>)}</div><div className="panel telemetry-card"><h3>Métricas de inferência</h3><div><span>Chamadas de LLM<strong>0 <small>modo mock</small></strong></span><span>Tokens<strong>Indisponível</strong></span><span>Custo de inferência<strong>Indisponível</strong></span><span>Cross Memory<strong>Desativada</strong></span></div></div></>; }
