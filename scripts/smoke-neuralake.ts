// Opt-in live smoke. Secrets stay in the ignored .dev.vars file; output is synthetic only.
import { readFileSync } from 'node:fs';
import { configForAgent, type AgentEnvironment } from '../lib/agents/shared/config.ts';
import { NeuraLakeChat } from '../lib/agents/shared/neuralake.ts';
import { CUSTOMER_SYSTEM_PROMPT } from '../lib/agents/customer/prompt.ts';
import { agentDecisionSchema } from '../lib/agents/customer/schemas.ts';
import { initialState } from '../lib/domain/fixtures.ts';
import { ensureDemoMarket } from '../lib/domain/demo-market.ts';
import { emptyCustomerSession } from '../lib/agents/customer/state.ts';
import { publicMenu } from '../lib/agents/customer/menu.ts';
import { runCustomerTool } from '../lib/agents/customer/tools.ts';

if (!process.argv.includes('--live')) throw new Error('Use --live explicitly; this smoke consumes provider quota.');
const env = Object.fromEntries(readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8')
    .split(/\r?\n/).filter(line => line && !line.startsWith('#')).map(line => {
        const at = line.indexOf('='); return [line.slice(0, at), line.slice(at + 1)];
    })) as AgentEnvironment;
const partial = process.argv.includes('--partial');
const at = new Date().toISOString(), state = initialState('synthetic_customer_diagnostic', at);
ensureDemoMarket(state, at);
const draft = emptyCustomerSession().draft;
const menuReply = runCustomerTool({ tool: 'consult_menu' }, draft, state, at, 'Quais pratos posso pedir?').reply;
const secrets = Object.entries(env).filter(([name, value]) => name.endsWith('_API_KEY') && value).map(([, value]) => value!);
const redact = (text: string) => secrets.reduce((value, key) => value.replaceAll(key, '[REDACTED]'), text)
    .replace(/nlk-[a-z0-9_-]+/gi, '[REDACTED]').slice(0, 1600);
try {
    const config = configForAgent(env, 'buyer');
    if (config.mode !== 'live') throw new Error('Enable live mode for this opt-in smoke.');
    const response = await new NeuraLakeChat(config).complete([
        { role: 'system', content: CUSTOMER_SYSTEM_PROMPT },
        ...(partial ? [
            { role: 'user' as const, content: `Contexto não confirmado do comprador: ${JSON.stringify(draft)}` },
            { role: 'user' as const, content: `Cardápio público simulado (não é uma oferta reservada): ${JSON.stringify(publicMenu(state, at))}` },
            { role: 'user' as const, content: 'Quais pratos posso pedir?' },
            { role: 'assistant' as const, content: menuReply },
        ] : []),
        { role: 'user', content: partial ? 'Quero uma porção de Bife a cavalo.' :
            'Quero uma porção de frango grelhado com arroz, até 45 reais com entrega no Butantã, em até 40 minutos. Não tenho alergias nem ingredientes a excluir.' },
    ]);
    let parsed;
    try { parsed = agentDecisionSchema.safeParse(JSON.parse(response.content)); }
    catch { parsed = null; }
    const decision = parsed?.success ? parsed.data : undefined;
    const extractionValid = !partial || (decision?.tool === 'propose_request' &&
        decision.patch.description === 'Bife a cavalo' && decision.patch.portions === 1 &&
        Object.keys(decision.patch).every(key => ['description', 'portions'].includes(key)));
    const passed = !!parsed?.success && extractionValid;
    console.log(JSON.stringify({ status: passed ? 'PASS' : 'INVALID_DECISION', agent: 'buyer',
        scenario: partial ? 'partial_after_menu' : 'complete_input', usage: response.usage,
        decision, extractionValid,
        invalidResponse: parsed?.success ? undefined : redact(response.content) }, null, 2));
    if (!passed) process.exitCode = 1;
} catch (error) {
    console.log(JSON.stringify({ status: 'FAIL', code: error instanceof Error && 'code' in error ? error.code : 'INVALID_OUTPUT' }));
    process.exitCode = 1;
}
