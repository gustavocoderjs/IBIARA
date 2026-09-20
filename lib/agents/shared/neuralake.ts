import { z } from 'zod';
import { DomainError } from '../../domain/types.ts';
import type { AgentConfig } from './config.ts';
import type { AgentUsage } from '../customer/schemas.ts';

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };
export type Completion = { content: string; usage: AgentUsage };
export interface ChatProvider { complete(messages: ChatMessage[]): Promise<Completion> }
const responseSchema = z.object({
    model: z.string().optional(),
    choices: z.array(z.object({
        finish_reason: z.string().nullable().optional(),
        message: z.object({ content: z.string().min(1).max(12000) }),
    })).min(1),
    usage: z.object({ total_tokens: z.number().int().nonnegative().nullable().optional() }).nullable().optional(),
});

export class NeuraLakeChat implements ChatProvider {
    constructor(private config: AgentConfig, private http: typeof fetch = fetch) {}

    async complete(messages: ChatMessage[]): Promise<Completion> {
        if (this.config.mode === 'mock') return {
            content: '{"tool":"propose_request","patch":{}}',
            usage: { mode: 'LOCAL_MOCK', model: null, tokens: null, cost: null },
        };
        const abort = new AbortController();
        const timer = setTimeout(() => abort.abort(), this.config.timeoutMs);
        try {
            // Preserve the native receiver; reject redirects below without forwarding credentials.
            const response = await this.http.call(globalThis, `${this.config.baseUrl}/chat/completions`, {
                method: 'POST', redirect: 'manual', signal: abort.signal,
                headers: { Authorization: `Bearer ${this.config.apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: this.config.model, messages, temperature: 0.2,
                    max_tokens: this.config.maxTokens, stream: false }),
            });
            if (!response.ok) {
                await response.body?.cancel();
                const code = response.status === 429 ? 'PROVIDER_RATE_LIMITED' :
                    [401, 403].includes(response.status) ? 'PROVIDER_AUTHENTICATION' : 'PROVIDER_UNAVAILABLE';
                console.error('neuralake_http_error', { status: response.status });
                throw new DomainError(code,
                    'Não consegui consultar a Byara agora. Seu rascunho foi preservado.', 503);
            }
            const reader = response.body?.getReader();
            if (!reader) throw new Error('missing_body');
            let bytes = 0, text = '';
            const decoder = new TextDecoder();
            try {
                while (true) {
                    const part = await reader.read();
                    if (part.done) break;
                    bytes += part.value.byteLength;
                    if (bytes > 65536) { await reader.cancel(); throw new Error('response_too_large'); }
                    text += decoder.decode(part.value, { stream: true });
                }
                text += decoder.decode();
            } finally { reader.releaseLock(); }
            const parsed = responseSchema.safeParse(JSON.parse(text));
            if (!parsed.success || parsed.data.choices[0].finish_reason === 'length')
                throw new DomainError('PROVIDER_INVALID_OUTPUT', 'A resposta ficou incompleta. Tente reformular.', 502);
            return { content: parsed.data.choices[0].message.content, usage: {
                mode: 'NEURALAKE', model: parsed.data.model ?? null,
                tokens: parsed.data.usage?.total_tokens ?? null, cost: null,
            } };
        } catch (error) {
            if (error instanceof DomainError) throw error;
            console.error('neuralake_transport_error', { name: error instanceof Error ? error.name : 'unknown',
                reason: error instanceof Error && /certificate|tls|ssl/i.test(error.message) ? 'TLS' :
                    error instanceof Error && /connection|fetch|network/i.test(error.message) ? 'NETWORK' : 'RESPONSE',
                timedOut: abort.signal.aborted });
            // Never surface/log provider bodies, request headers or credential-bearing errors.
            throw new DomainError(abort.signal.aborted ? 'PROVIDER_TIMEOUT' : 'PROVIDER_UNAVAILABLE',
                'A conversa está indisponível. Você pode continuar pelo formulário.', 503);
        } finally { clearTimeout(timer); }
    }
}
