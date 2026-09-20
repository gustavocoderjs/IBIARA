import { DomainError, type Restaurant } from './types.ts';

const normalized = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const clarification = (text: string) => /^(?:como assim|nao entendi|nao compreendi|pode explicar|explique melhor|o que voce quer dizer)[?!.\s]*$/.test(normalized(text));
const merchantWork = (text: string) => /\b(?:cadastrar|cadastro|criar|montar|revisar|alterar|editar|registrar)\b.{0,45}\b(?:receita|ficha|restaurante|cardapio)\b|\b(?:minha receita|minha ficha|ingredientes da receita|ficha tecnica|rende \d+ porco|rendimento|outros custos|custo variavel)\b/.test(text);

/** A narrow entry guard, not a second language model or a recipe parser. */
export function isCustomerRequest(text: string): boolean {
    const value = normalized(text);
    if (merchantWork(value) || /\b(?:o|meu) restaurante (?:fica|esta|se chama)\b/.test(value)) return false;
    return /\b(?:estou|to|estamos) (?:com )?fome\b|\bquero (?:comer|almocar|jantar|pedir|comprar uma refeicao)\b|\b(?:me indique|indique|procuro|busco)\b.{0,35}\b(?:restaurante|refeicao|comida)\b|\brestaurantes?\b.{0,30}\b(?:proxim|perto|avaliad)|\b(?:proxim|perto)\w*\b.{0,25}\brestaurantes?\b|\bquero\b.{0,25}\b(?:prato|marmita|bife|carne vermelha|refeicao)\b|\balgo (?:mais )?(?:parrudo|reforcado)\b/.test(value);
}

export function assertMerchantConversationEntry(restaurant: Restaurant, text: string): void {
    const value = normalized(text);
    const recentUsers = restaurant.conversation.filter(turn => turn.role === 'user').slice(-4).reverse();
    let previousCustomerRequest = false;
    for (const turn of recentUsers) {
        const previousText = normalized(turn.text);
        if (merchantWork(previousText) || /\d+\s*(?:g|gramas?|kg|ml)\b/.test(previousText)) break;
        if (isCustomerRequest(turn.text)) { previousCustomerRequest = true; break; }
    }
    const customerFollowup = previousCustomerRequest && !merchantWork(value)
        && (clarification(text) || /\b(?:carne|prato|refeicao|comer|restaurante|fome|parrudo|reforcado)\b/.test(value));
    if (isCustomerRequest(text) || customerFollowup) {
        throw new DomainError('CUSTOMER_FLOW_REQUIRED', 'Você está na gestão do restaurante, onde a Byara monta fichas técnicas. Para escolher comida, continue como consumidor. Sua mensagem foi preservada e nenhuma ficha foi alterada.');
    }
    if (clarification(text)) {
        const explanation = restaurant.draft
            ? 'Esta conversa cadastra a receita do seu restaurante. As perguntas sobre pesos e rendimento servem para montar a ficha técnica. Você pode descrever as quantidades medidas ou usar Fazer pedido para escolher uma refeição.'
            : 'Esta conversa gerencia o restaurante e suas receitas. Para cadastrar um prato, diga o nome, os ingredientes e as quantidades. Para escolher uma refeição, use Fazer pedido.';
        throw new DomainError('CONVERSATION_CLARIFICATION_REQUIRED', explanation);
    }
}
