'use client';

import { useEffect, useRef, useState } from 'react';
import { Bot, CheckCircle2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DishPhoto } from '@/components/dish-photo';
import { BuyerConversation, demoIntent, idleConversation, type ConversationState } from '@/lib/client/buyer-conversation';
import type { Send } from '@/lib/client/workspace-types';
import { money } from '@/lib/domain/money';

const labels: Record<ConversationState, string> = {
  IDLE: 'Pronta para conversar', LISTENING: 'Ouvindo', UNDERSTANDING: 'Entendendo sua intenção',
  SEARCHING: 'Consultando restaurantes', NEGOTIATING: 'Negociando', PROPOSAL_READY: 'Proposta pronta',
  AWAITING_APPROVAL: 'Aguardando sua autorização', CONFIRMED: 'ORDER_CONFIRMED',
  NO_MATCH: 'Nenhuma opção compatível', ERROR: 'Operação não concluída', DECLINED: 'Proposta recusada',
};

export function BuyerExperience({ send, busy }: { send: Send; busy: boolean }) {
  const [snapshot, setSnapshot] = useState(idleConversation);
  const controller = useRef<BuyerConversation | null>(null);
  const latestSend = useRef(send);
  useEffect(() => { latestSend.current = send; }, [send]);
  useEffect(() => {
    const session = new BuyerConversation((command, options) => latestSend.current(command, options), setSnapshot);
    controller.current = session;
    return () => { session.dispose(); controller.current?.dispose(); controller.current = null; };
  }, []);
  const proposal = snapshot.proposal;
  const processing = ['UNDERSTANDING', 'SEARCHING', 'NEGOTIATING'].includes(snapshot.state);
  const restart = () => {
    controller.current?.dispose();
    controller.current = new BuyerConversation((command, options) => latestSend.current(command, options), setSnapshot);
    setSnapshot(idleConversation);
  };
  return <section className="buyer-experience panel" aria-label="Conversa com seu Buyer Agent">
    <header className="buyer-experience-header">
      <span className="buyer-avatar" aria-hidden="true"><Bot size={32}/></span>
      <div><h2>Vamos encontrar seu almoço?</h2><p>Byara · seu Buyer Agent</p></div>
      <span className="tag neutral">Texto · intenção de demo</span>
    </header>
    <p className="buyer-intent">“{demoIntent.text}”</p>
    <p className="muted">Uma porção · região de demonstração: Butantã. Buscar e negociar não confirma o pedido.</p>
    <div className="buyer-speech" role={snapshot.state === 'ERROR' ? 'alert' : 'status'} aria-live="polite" aria-atomic="true">
      <strong>{labels[snapshot.state]}</strong><p>{snapshot.message}</p>
    </div>
    {snapshot.state === 'IDLE' && <Button className="authorize-button" disabled={busy} onClick={() => void controller.current?.start(demoIntent)}>Buscar e negociar <ArrowRight size={18}/></Button>}
    {snapshot.state !== 'IDLE' && <div className="buyer-agent-trail" aria-label="Atividade desta busca">
      <p>Buyer Agent → Exchange → Merchant Agents</p>
      <p>{snapshot.responses} oferta{snapshot.responses === 1 ? '' : 's'} recebida{snapshot.responses === 1 ? '' : 's'} nesta busca.</p>
      {snapshot.initialOffers.length > 0 && <details><summary>Ofertas iniciais</summary><ul>{snapshot.initialOffers.map((line, i) => <li key={i}>{line}</li>)}</ul></details>}
      {snapshot.negotiation.length > 0 && <ul>{snapshot.negotiation.map((line, i) => <li key={i}>{line}</li>)}</ul>}
    </div>}
    {proposal && <article className="buyer-proposal" aria-label="Proposta selecionada pelo Buyer Agent">
      <DishPhoto dish={proposal.itemName} className="buyer-proposal-photo"/>
      <div><h3>{proposal.itemName}</h3><p>{proposal.merchantName}</p><strong className="buyer-proposal-total">{money(proposal.totalCents)}</strong><p>Total com entrega · previsão de {proposal.etaMinutes} min</p>
        {snapshot.state !== 'CONFIRMED' && <p className="muted">Condição sujeita à validade e à disponibilidade na confirmação.</p>}
      </div>
    </article>}
    {proposal && ['AWAITING_APPROVAL', 'ERROR'].includes(snapshot.state) && <div className="buyer-approval">
      <Button className="authorize-button" disabled={busy} onClick={() => void controller.current?.authorize()}>{snapshot.confirmationUncertain ? 'Reenviar autorização de' : 'Autorizar'} {money(proposal.totalCents)}</Button>
      {!snapshot.confirmationUncertain && <Button variant="outline" disabled={busy} onClick={() => void controller.current?.decline()}>Recusar</Button>}
    </div>}
    {snapshot.state === 'CONFIRMED' && <p className="buyer-confirmed"><CheckCircle2 size={20}/>Reserva confirmada · pedido {snapshot.orderId}</p>}
    {snapshot.state === 'ERROR' && !proposal && <Button variant="outline" disabled={busy} onClick={() => void controller.current?.decline()}>Revogar mandato pendente</Button>}
    {!processing && !proposal && snapshot.state !== 'IDLE' && <Button variant="outline" disabled={busy} onClick={restart}>Nova conversa</Button>}
    <p className="buyer-experience-note">Sandbox: restaurantes e intenção de demonstração. Ofertas e negociação calculadas pelo domínio. Avatar ilustrativo; voz não conectada.</p>
  </section>;
}
