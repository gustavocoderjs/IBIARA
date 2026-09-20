import type { Offer } from '../domain/types.ts';
import type { Send } from './workspace-types.ts';
import { money } from '../domain/money.ts';

export type ConversationState = 'IDLE' | 'LISTENING' | 'UNDERSTANDING' | 'SEARCHING' | 'NEGOTIATING' | 'PROPOSAL_READY' | 'AWAITING_APPROVAL' | 'CONFIRMED' | 'NO_MATCH' | 'ERROR' | 'DECLINED';
export type PublicProposal = {
  offerId: string; rfqId: string; quoteToken: string; expiresAt: string;
  merchantName: string; itemName: string; totalCents: number; etaMinutes: number;
  status: Offer['status'];
};
export function proposalFromOffer(offer: Omit<Offer, 'receipt' | 'requirements'>): PublicProposal {
  return { offerId: offer.id, rfqId: offer.rfqId, quoteToken: offer.quoteToken, expiresAt: offer.expiresAt,
    merchantName: offer.merchantName, itemName: offer.dish, totalCents: offer.totalCents,
    etaMinutes: offer.eta, status: offer.status };
}
export const noMatchMessage = 'Não encontrei uma opção compatível com seu orçamento e prazo.';
export function proposalMessage(p: PublicProposal): string {
  return `Encontrei uma opção no ${p.merchantName} por ${money(p.totalCents)}, com previsão de ${p.etaMinutes} min. Quer que eu confirme?`;
}

// Transport-neutral input. A verified VoiceAdapter transcript may supply text here
// in the future; interpretation remains in the existing backend, not the provider.
export type ConversationInput = { text: string; maxCents: number; maxMinutes: number; zone: 'demo_butanta' | 'other' };
export const demoIntent: ConversationInput = {
  text: 'Quero bife a cavalo com arroz, feijão e batata, gastar até R$35 e receber em até 40 minutos.',
  maxCents: 3500, maxMinutes: 40, zone: 'demo_butanta',
};
export type ConversationSnapshot = {
  state: ConversationState; message: string; proposal?: PublicProposal;
  responses: number; initialOffers: string[]; negotiation: string[]; orderId?: string; confirmationUncertain?: boolean;
};
export const idleConversation: ConversationSnapshot = {
  state: 'IDLE', message: 'Sou a Byara. Posso buscar e negociar sua refeição. Você decide se confirma a proposta.', responses: 0, initialOffers: [], negotiation: [],
};

/** Presentation orchestration only. All economic decisions use existing commands. */
export class BuyerConversation {
  snapshot = idleConversation;
  private locked = false;
  private disposed = false;
  private mandateId?: string;
  constructor(private send: Send, private publish: (snapshot: ConversationSnapshot) => void) {}
  dispose() { this.disposed = true; }
  private update(patch: Partial<ConversationSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    if (!this.disposed) this.publish(this.snapshot);
  }
  private async command(command: Record<string, unknown>) {
    if (this.disposed) throw new Error('Conversa encerrada.');
    const response = await this.send({ ...command, scope: 'buyer' }, { quiet: true });
    if (!response || response.state.role !== 'buyer') throw new Error('Não consegui concluir a operação. Verifique a conexão e tente novamente.');
    return response;
  }
  async start(input: ConversationInput) {
    if (this.locked || this.snapshot.state !== 'IDLE') return;
    this.locked = true;
    try {
      this.update({ state: 'UNDERSTANDING', message: `Vou buscar uma refeição de até ${money(input.maxCents)}, com entrega em até ${input.maxMinutes} min. A compra depende da sua autorização final.` });
      const mandate = await this.command({ type: 'mandate', description: input.text, maxCents: input.maxCents, maxMinutes: input.maxMinutes, zone: input.zone, excluded: [], confirmed: true });
      this.mandateId = mandate.result.mandateId;
      if (!this.mandateId) throw new Error('Não recebi o mandato. Nenhuma compra foi solicitada.');
      this.update({ state: 'SEARCHING', message: 'Exchange consultando Merchant Agents…' });
      const search = await this.command({ type: 'rfq', mandateId: this.mandateId });
      const rfqId = search.result.rfqId;
      if (!rfqId) throw new Error('Não recebi a busca. Nenhuma compra foi solicitada.');
      const initial = search.state.offers.filter(o => o.rfqId === rfqId);
      this.update({ responses: initial.length, initialOffers: initial.map(o => `${o.merchantName}: ${money(o.totalCents)} com entrega · ${o.eta} min`) });
      this.update({ state: 'NEGOTIATING', message: 'Buyer Agent comparando condições e negociando…' });
      const negotiated = await this.command({ type: 'negotiate', rfqId, proposalOnly: true });
      const negotiation = negotiated.state.events.filter(e => e.correlationId === rfqId && ['COUNTER_ACCEPTED', 'COUNTER_REJECTED'].includes(e.type)).map(e => `${e.title}: ${e.detail}`);
      this.update({ negotiation });
      if (negotiated.result.status === 'NO_MATCH') {
        this.update({ state: 'NO_MATCH', message: noMatchMessage }); return;
      }
      const offer = negotiated.state.offers.find(o => o.id === negotiated.result.offerId && o.rfqId === rfqId);
      if (!offer || offer.status !== 'ISSUED') throw new Error('A proposta não está disponível. Inicie uma nova conversa.');
      const proposal = proposalFromOffer(offer);
      this.update({ state: 'PROPOSAL_READY', proposal, message: proposalMessage(proposal) });
      this.update({ state: 'AWAITING_APPROVAL' });
    } catch (e) { this.update({ state: 'ERROR', message: (e as Error).message }); }
    finally { this.locked = false; }
  }
  async authorize() {
    const proposal = this.snapshot.proposal;
    if (this.locked || !proposal || !['AWAITING_APPROVAL', 'ERROR'].includes(this.snapshot.state)) return;
    this.locked = true;
    try {
      this.update({ confirmationUncertain: true, message: 'Enviando sua autorização. O restaurante vai revalidar a disponibilidade…' });
      const accepted = await this.command({ type: 'accept', offerId: proposal.offerId, quoteToken: proposal.quoteToken });
      const order = accepted.state.orders.find(o => o.id === accepted.result.orderId && o.offerId === proposal.offerId);
      if (!order || order.status !== 'CONFIRMED') throw new Error('Não recebi a confirmação. Consulte Meus pedidos antes de tentar outra compra.');
      this.update({ state: 'CONFIRMED', confirmationUncertain: false, proposal: { ...proposal, status: 'ACCEPTED' }, orderId: order.id, message: 'Pedido confirmado em sandbox. Nenhum pagamento ou entrega real foi executado.' });
    } catch { this.update({ state: 'ERROR', message: 'Não consegui verificar a confirmação. O pedido pode ter sido criado. Consulte Meus pedidos ou reenvie a mesma autorização; não inicie outra compra antes de verificar.' }); }
    finally { this.locked = false; }
  }
  async decline() {
    if (this.locked || !this.mandateId || this.snapshot.state === 'CONFIRMED' || this.snapshot.confirmationUncertain) return;
    this.locked = true;
    // Remove the approval action even if revocation fails; retry only revokes.
    this.update({ proposal: undefined });
    try {
      await this.command({ type: 'revoke', mandateId: this.mandateId });
      this.update({ state: 'DECLINED', message: 'Proposta recusada e mandato revogado. Nenhum pedido foi solicitado por esta conversa.' });
    } catch (e) { this.update({ state: 'ERROR', message: (e as Error).message }); }
    finally { this.locked = false; }
  }
}
