'use client';

import { useState } from 'react';
import { Activity, ArrowDown, Bot, Check, CircleDollarSign, Gauge, Leaf, Minus, Plus, ShieldCheck, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { money } from '@/lib/domain/money';
import type { ViewState } from '@/lib/client/workspace-types';
import { marketSimulation, demandLabel } from '@/lib/client/market-simulation';
import { evaluateMarketPressure } from '@/lib/domain/market-pressure';

function Tag({ children, tone = 'green' }: { children: React.ReactNode; tone?: string }) {
    return <span className={'tag ' + tone}>{children}</span>;
}

const strategyLabel: Record<string, string> = {
    SURPLUS_FIRST: 'Priorizar excedente elegível',
    BALANCED: 'Manter preço de referência',
};

export function MerchantEconomy({ data }: { data: ViewState }) {
    const restaurant = data.restaurant!;
    const policy = restaurant.policy;
    const recipe = restaurant.recipes[0];
    const [buyerCount, setBuyerCount] = useState(0);
    const [history, setHistory] = useState<Array<{ round: number; buyers: number; price: number }>>([]);
    const simulation = marketSimulation(buyerCount);
    const activeOrders = data.orders.filter(order => ['CONFIRMED', 'PREPARING'].includes(order.status)).length;
    const capacity = policy?.capacity ?? 0;
    const availableCapacity = Math.max(0, capacity - activeOrders);
    const availableInputs = restaurant.stock.filter(item => item.eligible && Number(item.quantity) - Number(item.reserved) - Number(item.safety) > 0).length;
    const currentPrice = recipe?.pricing?.subtotalCents ?? policy?.referenceCents ?? null;
    const pressure = policy && recipe?.pricing ? evaluateMarketPressure({ simulatedBuyerCount: simulation.simulatedBuyerCount, demandState: simulation.demandState, availableCapacity, activeOrders, surplusState: recipe.pricing.strategy === 'SURPLUS_FIRST', commercialPolicy: policy, baseReceipt: recipe.pricing }) : null;
    const setSimulationCount = (next: number) => { const value = marketSimulation(next).simulatedBuyerCount; setBuyerCount(value); if (policy && recipe?.pricing) { const nextSimulation = marketSimulation(value); const nextPressure = evaluateMarketPressure({ simulatedBuyerCount: nextSimulation.simulatedBuyerCount, demandState: nextSimulation.demandState, availableCapacity, activeOrders, surplusState: recipe.pricing.strategy === 'SURPLUS_FIRST', commercialPolicy: policy, baseReceipt: recipe.pricing }); setHistory(previous => [...previous.slice(-4), { round: previous.length + 1, buyers: value, price: nextPressure.simulatedPriceCents }]); } };

    return <div className="merchant-economy-layout">
        <section className="merchant-agent-hero panel">
            <div className="merchant-agent-heading">
                <div className="merchant-agent-icon"><Bot size={27}/></div>
                <div><span className="section-kicker">MERCHANT AGENT</span><h2>Representando {restaurant.name}</h2><p>Você define os limites. O agente responde ao mercado dentro deles.</p></div>
                <Tag tone="green"><span className="status-dot"/>Ativo</Tag>
            </div>
            <div className="merchant-agent-flow" aria-label="Como o Merchant Agent atua">
                <div><Store size={17}/><span>Restaurante</span><strong>Parâmetros definidos</strong></div>
                <ArrowDown className="merchant-flow-arrow" size={16}/>
                <div><Bot size={17}/><span>Merchant Agent</span><strong>Condições verificadas</strong></div>
                <ArrowDown className="merchant-flow-arrow" size={16}/>
                <div><Activity size={17}/><span>Exchange</span><strong>Ofertas respondidas</strong></div>
            </div>
        </section>

        <section className="merchant-economy-grid">
            <article className="panel merchant-control-card">
                <div className="panel-top"><div><span className="section-kicker">CONFIGURAÇÃO PRIVADA</span><h2>Como seu agente pode atuar</h2></div><ShieldCheck size={20}/></div>
                {policy ? <>
                    <div className="merchant-dish-row"><div className="merchant-dish-icon"><CircleDollarSign size={22}/></div><div><span>Prato monitorado</span><strong>{recipe?.name ?? 'Nenhuma ficha confirmada'}</strong></div><Tag tone="neutral">Política v{policy.version}</Tag></div>
                    <div className="merchant-parameter-grid">
                        <Parameter label="Preço de referência" value={money(policy.referenceCents)} />
                        <Parameter label="Estratégia" value={strategyLabel[policy.objective] ?? policy.objective} />
                        <Parameter label="Margem mínima" value={`${policy.minMarginBps / 100}%`} privateValue />
                        <Parameter label="Desconto máximo" value={`${policy.maxDiscountBps / 100}%`} privateValue />
                        <Parameter label="Aumento máximo" value={`${policy.maxMarkupBps / 100}%`} privateValue />
                        <Parameter label="Rodadas permitidas" value={String(policy.maxRounds)} />
                    </div>
                    <p className="merchant-private-note"><ShieldCheck size={14}/>Limites comerciais visíveis somente nesta visão do restaurante.</p>
                </> : <p className="small-note">Confirme uma política comercial para autorizar o agente.</p>}
            </article>
            <article className="panel merchant-derived-card">
                <div className="panel-top"><div><span className="section-kicker">ESTADO DERIVADO</span><h2>Condição operacional</h2></div><Gauge size={20}/></div>
                <div className="derived-metrics"><div><span>Capacidade disponível</span><strong>{availableCapacity}<small> / {capacity || '—'}</small></strong><em>{activeOrders} pedido(s) em andamento</em></div><div><span>Insumos elegíveis</span><strong>{availableInputs}</strong><em>com saldo utilizável</em></div><div><span>Excedentes declarados</span><strong><Leaf size={17}/>{restaurant.stock.filter(item => item.surplus).length}</strong><em>considerados pela política</em></div></div>
                <div className="derived-availability"><Check size={16}/><span>{availableCapacity > 0 && availableInputs > 0 ? 'Disponibilidade compatível para receber novas propostas.' : 'A operação precisa ser revisada antes de receber novas propostas.'}</span></div>
            </article>
        </section>

        <section className="panel market-simulator-card">
            <div className="market-simulator-heading"><div><span className="section-kicker"><Activity size={13}/>SIMULAÇÃO DE MERCADO · SANDBOX</span><h2>Observe o mercado se preparando</h2><p>Agentes simulados representam demanda futura. Eles não criam RFQs, ofertas ou pedidos reais.</p></div><Tag tone="amber">AGENTES SIMULADOS</Tag></div>
            <div className="market-simulator-grid">
                <div className="simulator-control"><span className="simulator-label">Buyer Agents simulados</span><div className="simulator-stepper"><Button variant="outline" size="icon" aria-label="Remover Buyer Agent simulado" onClick={() => setSimulationCount(buyerCount - 1)} disabled={buyerCount === 0}><Minus size={16}/></Button><strong>{simulation.simulatedBuyerCount}</strong><Button variant="outline" size="icon" aria-label="Adicionar Buyer Agent simulado" onClick={() => setSimulationCount(buyerCount + 1)}><Plus size={16}/></Button></div><span className="small-note">Controle local de sandbox</span></div>
                <div className="simulator-state"><span className="simulator-label">Demanda observada</span><strong className={`demand-state demand-${simulation.demandState.toLowerCase()}`}>{demandLabel[simulation.demandState]}</strong><span>{simulation.marketActivity}</span></div>
                <div className="simulator-state"><span className="simulator-label">Exchange</span><strong><span className="status-dot"/>Ativo</strong><span>Recebendo intenções simuladas</span></div>
                <div className="simulator-state"><span className="simulator-label">Preço/condição simulada</span><strong>{pressure ? money(pressure.simulatedPriceCents) : currentPrice === null ? '—' : money(currentPrice)}</strong><span>{pressure?.publicSignal ?? 'Derivado do pricing engine atual'}</span></div>
            </div>
            <div className="market-simulation-history"><div className="simulator-label">HISTÓRICO LOCAL DA SIMULAÇÃO</div>{history.length ? <div className="simulation-history-list">{history.map(item => <div key={`${item.round}-${item.buyers}`}><span>ROUND {item.round}</span><strong>{item.buyers} Buyer Agent{item.buyers === 1 ? '' : 's'}</strong><b>{money(item.price)}</b></div>)}</div> : <span className="small-note">Ajuste a demanda para registrar uma rodada.</span>}</div>{<div className="market-simulator-foot"><ShieldCheck size={15}/><span>Esta condição sandbox usa pressão, capacidade e limites existentes. Ela não altera RFQs, pedidos ou o preço transacional normal.</span></div>}
        </section>
    </div>;
}

function Parameter({ label, value, privateValue = false }: { label: string; value: string; privateValue?: boolean }) {
    return <div className="merchant-parameter"><span>{label}{privateValue && <ShieldCheck size={12}/>}</span><strong>{value}</strong></div>;
}
