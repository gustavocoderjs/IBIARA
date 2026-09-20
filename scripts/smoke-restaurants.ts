// Opt-in live diagnostic: three calls, or one with --agent=<id>, using fixture-only contexts.
// Does not persist data, reserve stock or create an order. Never prints keys or headers.
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { initialState } from '../lib/domain/fixtures.ts';
import { ensureDemoMarket } from '../lib/domain/demo-market.ts';
import { execute } from '../lib/domain/commands.ts';
import { createRfq } from '../lib/domain/commerce.ts';
import { configForAgent, type AgentEnvironment } from '../lib/agents/shared/config.ts';
import { NeuraLakeChat, type ChatProvider } from '../lib/agents/shared/neuralake.ts';
import { toRestaurantRequest, toRestaurantOffer } from '../lib/agents/shared/contracts.ts';
import { restaurantIds } from '../lib/agents/shared/router.ts';
import { consultRestaurant } from '../lib/agents/restaurants/service.ts';
import { DomainError } from '../lib/domain/types.ts';

if (!process.argv.includes('--live')) throw new Error('Pass --live explicitly; this diagnostic consumes quota for three real calls.');
const env = Object.fromEntries(readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8')
    .split(/\r?\n/).filter(line => line.trim() && !line.trim().startsWith('#')).map(line => {
        const at = line.indexOf('='); return [line.slice(0, at).trim(), line.slice(at + 1).trim()];
    })) as AgentEnvironment;
const keys = [env.NEURALAKE_API_KEY, env.NEURALAKE_CUSTOMER_API_KEY, env.NEURALAKE_NIKO_API_KEY,
    env.NEURALAKE_CASA_API_KEY, env.NEURALAKE_PANELA_API_KEY].filter((key): key is string => !!key);
const redact = (text: string) => keys.reduce((value, key) => value.replaceAll(key, '[REDACTED]'), text)
    .replace(/nlk-[a-z0-9_-]+/gi, '[REDACTED]').slice(0, 200);
const decisionSchema = z.discriminatedUnion('tool', [
    z.object({ tool: z.literal('submit_offer'), offerId: z.string().min(1).max(100) }).strict(),
    z.object({ tool: z.literal('decline'), reason: z.literal('NO_COMPATIBLE_OFFER') }).strict(),
]);

const at = new Date().toISOString(), state = initialState('synthetic_restaurant_diagnostic', at);
ensureDemoMarket(state, at);
const mandate = execute(state, { type: 'mandate', scope: 'buyer',
    description: 'Frango grelhado com arroz e feijão', maxCents: 4500, maxMinutes: 40,
    zone: 'demo_butanta', excluded: [], confirmed: true }, at) as { mandateId: string };
const created = createRfq(state, mandate.mandateId, at);
const request = state.rfqs.find(q => q.id === created.rfqId)!;
const selected = process.argv.find(arg => arg.startsWith('--agent='))?.slice('--agent='.length);
if (selected && !restaurantIds.some(id => id === selected)) throw new Error('Unknown --agent value.');
const targets = restaurantIds.filter(id => !selected || id === selected);
const results = await Promise.all(targets.map(async id => {
    const candidates = state.offers.filter(o => o.rfqId === request.id && o.merchantId === id).map(toRestaurantOffer);
    let diagnostic: Record<string, unknown> = { response: 'NOT_RECEIVED' };
    try {
        const config = configForAgent(env, id);
        if (config.mode !== 'live') throw new DomainError('PROVIDER_CONFIGURATION', 'Enable live mode for this opt-in diagnostic.');
        const live = new NeuraLakeChat(config);
        const capture: ChatProvider = { async complete(messages) {
            const response = await live.complete(messages);
            let parsed;
            try { parsed = decisionSchema.safeParse(JSON.parse(response.content)); }
            catch { parsed = null; }
            const decision = parsed?.success ? parsed.data : null;
            diagnostic = { schemaValid: !!decision,
                decision: decision?.tool === 'submit_offer' ? { tool: decision.tool, offerId: redact(decision.offerId) } : decision,
                invalidResponse: decision ? undefined : redact(response.content),
                offerBelongsToContext: decision?.tool === 'submit_offer' ? candidates.some(o => o.offerId === decision.offerId) : null,
                usage: response.usage };
            return response;
        } };
        const decision = await consultRestaurant(id, toRestaurantRequest(request, id), candidates, capture, 'live');
        return { restaurantId: id, status: 'PASS', candidateOfferIds: candidates.map(o => o.offerId),
            published: !!decision.offerId, ...diagnostic };
    } catch (error) {
        return { restaurantId: id, status: 'FAIL', candidateOfferIds: candidates.map(o => o.offerId),
            code: error instanceof DomainError ? error.code : 'DIAGNOSTIC_FAILED', ...diagnostic };
    }
}));
console.log(JSON.stringify({ dish: request.dishName, restaurants: results, persisted: false, ordersCreated: 0 }, null, 2));
if (results.some(result => result.status !== 'PASS')) process.exitCode = 1;
