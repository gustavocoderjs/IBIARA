import { DomainError } from '../../domain/types.ts';
import type { ChatMessage, ChatProvider, Completion } from '../shared/neuralake.ts';
import { agentDecisionSchema } from './schemas.ts';

const FORMAT_REPAIR = `Sua resposta anterior não respeitou o contrato. Corrija somente o formato,
reinterpretando a última mensagem do cliente sem inventar valores ausentes.
Retorne UM objeto JSON puro, sem markdown ou explicação.
tool deve ser propose_request, consult_menu ou inspect_offers.
propose_request exige patch; as outras ferramentas aceitam patch opcional.
patch aceita somente: description (string ou null), budget (string decimal em reais ou null),
portions (inteiro 1 a 20 ou null), maxMinutes (inteiro 1 a 180 ou null),
zone (demo_butanta, other ou null), excluded (array de strings ou null),
foodSafetyConcern (boolean ou null), selectionPreference (LOWEST_PRICE, BEST_RATED ou null).
Omitir campos não informados NA ÚLTIMA MENSAGEM. Não reescrever dados do rascunho.
Não incluir preços de ofertas, autorização, ingredients, quantity, respostas ou perguntas.
Cardápio/opções disponíveis usam consult_menu. Ofertas cotadas usam inspect_offers.`;

/** At most one format repair. Both responses still pass the same strict schema. */
export async function customerDecision(provider: ChatProvider, messages: ChatMessage[], remainingCalls: number) {
    const completions: Completion[] = [];
    const attempts = Math.min(2, remainingCalls);
    for (let attempt = 0; attempt < attempts; attempt++) {
        const completion = await provider.complete(attempt === 0 ? messages : [
            ...messages, { role: 'system', content: FORMAT_REPAIR },
        ]);
        completions.push(completion);
        let value: unknown;
        let syntaxValid = true;
        try { value = JSON.parse(completion.content); }
        catch { syntaxValid = false; }
        const parsed = agentDecisionSchema.safeParse(value);
        if (parsed.success) return { decision: parsed.data, completion, completions };
        // Log categories only: no message content, provider response, headers or secrets.
        console.error('customer_agent_invalid_output', { attempt: attempt + 1,
            reason: syntaxValid ? 'SCHEMA' : 'JSON', issues: parsed.error.issues.map(issue => issue.code) });
        if (completion.usage.mode !== 'NEURALAKE') break;
    }
    throw new DomainError('PROVIDER_INVALID_OUTPUT',
        'Não consegui interpretar a resposta da IA. Seus dados foram mantidos. Tente enviar novamente ou revise pelo formulário.', 502);
}
