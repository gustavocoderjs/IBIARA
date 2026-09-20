import { z } from 'zod';
import { type State, type Policy, demand, event, say, uid } from './types.ts';
import { demoPolicy, baseRecipe, stockCatalog, purchaseFixture, nextCount } from './fixtures.ts';
import { normalize, registration, newDraft, recipePatch, pending, identify } from '../adapters/neuralake.ts';
import { importXml } from '../adapters/fiscal.ts';
import { quote, requirements } from './pricing.ts';
import { createRfq, negotiate, counter, accept, orderAction } from './commerce.ts';
import { rational, decimal, mul, div, add, compare, qadd, qsub, money } from './money.ts';
import { assertCustomerPurchaseSupported } from './customer-purchase.ts';
import { assertDeliverySelection, deliveryPointIds, demoRestaurantIds } from './delivery.ts';
import { assertMerchantConversationEntry } from './conversation-entry.ts';
const scope = z.enum(['merchant', 'buyer']);
const str = z.string().min(1).max(4000);
const integer = z.number().int().safe();
const policyFields = { objective: z.enum(['BALANCED', 'SURPLUS_FIRST']), referenceCents: integer.min(1).max(1000000), minMarginBps: integer.min(0).max(9999), maxDiscountBps: integer.min(0).max(9999), maxMarkupBps: integer.min(0).max(10000), feeBps: integer.min(0).max(9999), fixedCents: integer.min(0).max(100000), minContributionCents: integer.min(0).max(100000), surplusDiscountBps: integer.min(0).max(9999), capacity: integer.min(1).max(1000) };
export const commandSchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('turn'), scope, text: str }).strict(),
    z.object({ type: z.literal('seed_demo'), scope: z.literal('merchant') }).strict(),
    z.object({ type: z.literal('new_recipe'), scope: z.literal('merchant') }).strict(),
    z.object({ type: z.literal('revise_recipe'), scope: z.literal('merchant'), recipeId: str }).strict(),
    z.object({ type: z.literal('confirm_recipe'), scope: z.literal('merchant'), expectedVersion: integer.min(1) }).strict(),
    z.object({ type: z.literal('policy'), scope: z.literal('merchant'), expectedVersion: integer.min(0), ...policyFields }).strict(),
    z.object({ type: z.literal('purchase'), scope: z.literal('merchant'), source: z.enum(['fixture', 'xml']), xml: z.string().max(250000).optional() }).strict(),
    z.object({ type: z.literal('receive'), scope: z.literal('merchant'), purchaseId: str, eligible: z.literal(true) }).strict(),
    z.object({ type: z.literal('count'), scope: z.literal('merchant'), text: str }).strict(),
    z.object({ type: z.literal('confirm_count'), scope: z.literal('merchant'), countId: str }).strict(),
    z.object({ type: z.literal('surplus'), scope: z.literal('merchant'), item: str, enabled: z.boolean() }).strict(),
    z.object({ type: z.literal('eligibility'), scope: z.literal('merchant'), item: str, eligible: z.boolean() }).strict(),
    z.object({ type: z.literal('schedule'), scope: z.literal('merchant'), days: integer.min(1).max(30), hour: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) }).strict(),
    z.object({ type: z.literal('tick'), scope: z.literal('merchant'), days: integer.min(0).max(7) }).strict(),
    z.object({ type: z.literal('mandate'), scope: z.literal('buyer'), maxCents: integer.min(1).max(1000000), description: str, maxMinutes: integer.min(1).max(180), selectionPreference: z.enum(['LOWEST_PRICE', 'BEST_RATED', 'NEAREST', 'FASTEST']).optional(), restaurantId: z.enum(demoRestaurantIds).nullable().optional(), deliveryPointId: z.enum(deliveryPointIds).nullable().optional(), zone: z.enum(['demo_butanta', 'other']), excluded: z.array(z.string().max(100)).max(20), confirmed: z.literal(true) }).strict(),
    z.object({ type: z.literal('revoke'), scope: z.literal('buyer'), mandateId: str }).strict(),
    z.object({ type: z.literal('rfq'), scope: z.literal('buyer'), mandateId: str }).strict(),
    z.object({ type: z.literal('negotiate'), scope: z.literal('buyer'), rfqId: str }).strict(),
    z.object({ type: z.literal('counter'), scope: z.literal('buyer'), offerId: str, subtotalCents: integer.min(1).max(1000000) }).strict(),
    z.object({ type: z.literal('accept'), scope: z.literal('buyer'), offerId: str, quoteToken: str }).strict(),
    z.object({ type: z.literal('order'), scope, orderId: str, action: z.enum(['prepare', 'ready', 'cancel']) }).strict(),
    z.object({ type: z.literal('produce'), scope: z.literal('merchant'), recipeId: str, portions: integer.min(1).max(50) }).strict(),
]);
export type Command = z.infer<typeof commandSchema>;
function confirmRecipe(s: State, at: string, expected: number) { const r = s.restaurants[0], d = r.draft; demand(d, 'RECIPE_NOT_FOUND', 'Não há ficha em rascunho.'); demand(d.version === expected, 'VERSION_CONFLICT', 'A ficha foi alterada. Revise o resumo.'); demand(pending(d).length === 0, 'RECIPE_INCOMPLETE', pending(d).join(' ')); d.status = 'CONFIRMED'; d.confirmedAt = at; r.recipes.push(structuredClone(d)); r.draft = null; r.stage = 'RECIPE_CONFIRMED'; event(s, 'RECIPE_CONFIRMED', 'merchant', 'Ficha técnica confirmada', `${d.name} · versão ${d.version}`, d.id, at, 'niko'); say(s, 'merchant', `Ficha de ${d.name} confirmada. Agora importe uma nota de compra e confirme o recebimento para custear o prato. Depois, defina os limites de negociação.`, at); return { recipeId: d.id, version: d.version }; }
function turn(s: State, text: string, at: string) {
    const r = s.restaurants[0];
    say(s, 'merchant', text, at, 'user');
    const t = normalize(text);
    if (/ignore.*instruc|system prompt|senha|api.key|revele.*(custo|limite)|mude.*margem/.test(t)) {
        say(s, 'merchant', 'Mensagens não alteram identidade, permissões ou limites financeiros. Use a política comercial para propor uma alteração explícita.', at);
        return {};
    }
    if (r.stage === 'START') {
        const fields = registration(text);
        if (fields.name)
            r.name = fields.name;
        if (fields.address)
            r.address = fields.address;
        if (r.name === 'Sua cozinha' || !r.address) {
            say(s, 'merchant', 'Preciso do nome e endereço. Você pode dizer: “O nome do restaurante é … Estamos localizados na …”.', at);
            return {};
        }
        r.stage = 'RESTAURANT_DRAFT';
        say(s, 'merchant', `Vou cadastrar ${r.name} nesse endereço. Qual é o primeiro prato? Me conte os ingredientes e as quantidades.`, at);
        event(s, 'RESTAURANT_DRAFT', 'merchant', 'Sua cozinha foi cadastrada', r.name, 'onboarding', at, 'niko');
        return {};
    }
    if (!r.draft && /confirm/.test(t)) {
        say(s, 'merchant', 'Não há ficha pendente. Você pode adicionar outro prato ou configurar os custos.', at);
        return {};
    }
    if (r.draft && /^(?:eu )?confirmo(?: a)? (?:ficha|receita)|^confirmar ficha/.test(t)) {
        return confirmRecipe(s, at, r.draft.version);
    }
    if (!r.draft) {
        r.draft = newDraft(text);
        r.stage = 'DISH_DRAFT';
    }
    r.draft = recipePatch(r.draft, text);
    const missing = pending(r.draft);
    r.stage = missing.length ? 'CLARIFYING' : 'RECIPE_REVIEW';
    say(s, 'merchant', missing.length ? `${missing.slice(0, 3).join('\n\n')}` : `A ficha está pronta para sua revisão: ${r.draft.components.length} componentes, ${r.draft.servings} porção(ões), preparo e rendimentos informados. Confira o resumo ao lado e diga “Confirmo a ficha técnica”.`, at);
    event(s, 'RECIPE_DRAFT_UPDATED', 'merchant', missing.length ? 'Ficha em construção' : 'Ficha pronta para confirmar', `${r.draft.name} · ${missing.length} pendência(s)`, r.draft.id, at, 'niko');
    return {};
}
function receive(s: State, id: string, at: string) {
    const p = s.purchases.find(p => p.id === id);
    demand(p, 'PURCHASE_NOT_FOUND', 'Nota não encontrada.');
    if (p.received)
        return { purchaseId: p.id, duplicate: true };
    const r = s.restaurants[0];
    for (const line of p.lines) {
        const i = r.stock.find(i => i.id === line.item);
        demand(i, 'FISCAL_ITEM_UNMAPPED', 'Insumo não vinculado.');
        demand(i.costNumerator !== null || compare(i.quantity, '0') === 0, 'COST_UNAVAILABLE', 'Estoque anterior sem custo confirmado.');
        const oldCost = i.costNumerator !== null ? mul(rational(i.quantity), { n: BigInt(i.costNumerator), d: BigInt(i.costDenominator!) }) : { n: 0n, d: 1n };
        const q = qadd(i.quantity, line.quantity);
        const avg = div(add(oldCost, { n: BigInt(line.totalCents), d: 1n }), rational(q));
        i.quantity = q;
        i.costNumerator = String(avg.n);
        i.costDenominator = String(avg.d);
        i.eligible = true;
    }
    p.received = true;
    event(s, 'GOODS_RECEIVED', 'merchant', 'Recebimento confirmado', 'Estoque atualizado e custo médio ponderado recalculado. Elegibilidade declarada pelo operador.', p.id, at, 'niko', { lines: p.lines });
    return { purchaseId: p.id };
}
export function runScheduler(s: State, at: string) { if (at >= s.schedule.nextAt) {
    const due = s.schedule.nextAt;
    if (s.schedule.lastFiredAt !== due) {
        event(s, 'COUNT_DUE', 'merchant', 'É hora de conferir a cozinha', 'O que temos hoje? Conte as quantidades, o estado cru/pronto e confirme uma contagem exata.', `count_${due}`, at, 'niko');
        say(s, 'merchant', 'Chegou a hora da contagem combinada. Na área Estoque, me diga o que temos hoje. Itens não informados continuam com o saldo anterior.', at);
        s.schedule.lastFiredAt = due;
    }
    s.schedule.nextAt = nextCount(at, s.schedule.days, s.schedule.hour);
} }
export function execute(s: State, c: Command, at: string): unknown {
    if (c.type === 'turn' && c.scope === 'merchant')
        assertMerchantConversationEntry(s.restaurants[0], c.text);
    // Reject before the scheduler or any authorization side effects. Direct commerce
    // entry points repeat this check because agents also call them without execute.
    if (['mandate', 'rfq', 'negotiate', 'counter', 'accept'].includes(c.type))
        assertCustomerPurchaseSupported(s);
    if (c.type === 'mandate') assertDeliverySelection({ ...c,
        restaurantId: c.restaurantId === undefined ? s.customerAgent?.draft.restaurantId : c.restaurantId,
        deliveryPointId: c.deliveryPointId === undefined ? s.customerAgent?.draft.deliveryPointId : c.deliveryPointId });
    const r = s.restaurants[0];
    runScheduler(s, at);
    switch (c.type) {
        case 'turn':
            demand(c.scope === 'merchant', 'UNAUTHORIZED_SCOPE', 'Use o formulário de intenção para autorizar a compra.');
            return turn(s, c.text, at);
        case 'seed_demo':
            demand(!r.recipes.length && !s.orders.length && !s.purchases.length, 'DEMO_ALREADY_STARTED', 'O cenário já tem dados. Continue a partir deles para preservar o histórico.');
            r.name = 'Marmita Quentinha do Seu Niko';
            r.address = 'Avenida Corifeu de Azevedo Marques, 488';
            r.recipes = [baseRecipe(at)];
            r.stock = stockCatalog(at, true);
            r.policy = demoPolicy(at);
            r.policyHistory = [structuredClone(r.policy)];
            r.draft = null;
            r.stage = 'ACTIVE';
            event(s, 'DEMO_FIXTURE_LOADED', 'merchant', 'Cenário de exemplo carregado', 'Receita, custos, estoque, elegibilidade e política são dados fictícios do guia.', 'demo_v1', at, 'niko');
            say(s, 'merchant', 'Carreguei o cenário fictício do Seu Niko. O bife a cavalo já pode receber propostas. Você pode testar uma compra na visão Consumidor ou ajustar os limites e o estoque.', at);
            return {};
        case 'new_recipe':
            demand(!r.draft, 'DRAFT_EXISTS', 'Conclua a ficha atual antes de abrir outra.');
            r.stage = 'DISH_DRAFT';
            say(s, 'merchant', 'Qual é o próximo prato? Me conte o nome, ingredientes e quantidades.', at);
            return {};
        case 'revise_recipe': {
            demand(!r.draft, 'DRAFT_EXISTS', 'Conclua a ficha atual antes de revisar outra.');
            const recipe = r.recipes.filter(x => x.id === c.recipeId).at(-1);
            demand(recipe, 'RECIPE_NOT_FOUND', 'Ficha não encontrada.');
            r.draft = { ...structuredClone(recipe), version: recipe.version + 1, status: 'DRAFT', confirmedAt: null };
            say(s, 'merchant', `Vamos revisar ${recipe.name}. Diga as novas quantidades; esta alteração criará a versão ${r.draft.version}.`, at);
            return {};
        }
        case 'confirm_recipe': return confirmRecipe(s, at, c.expectedVersion);
        case 'policy': {
            demand((r.policy?.version ?? 0) === c.expectedVersion, 'VERSION_CONFLICT', 'A política mudou. Atualize e revise.');
            demand(c.minMarginBps + c.feeBps < 10000, 'POLICY_INFEASIBLE', 'Margem e taxas devem somar menos de 100%.');
            demand(c.surplusDiscountBps <= c.maxDiscountBps, 'POLICY_INFEASIBLE', 'O desconto por excedente excede o máximo autorizado.');
            const { type, scope, expectedVersion, ...values } = c;
            const p: Policy = { ...values, version: expectedVersion + 1, maxRounds: 2, offerTtlSeconds: 90, confirmedAt: at };
            r.policy = p;
            r.policyHistory.push(structuredClone(p));
            event(s, 'POLICY_CONFIRMED', 'merchant', 'Limites comerciais confirmados', `Política v${p.version} · referência ${money(p.referenceCents)}`, 'policy', at, 'niko');
            return {};
        }
        case 'purchase': {
            const parsed = c.source === 'fixture' ? structuredClone(purchaseFixture) : importXml(c.xml ?? '');
            const same = s.purchases.find(p => p.key === parsed.key && p.environment === parsed.environment);
            if (same) {
                demand(JSON.stringify(same.lines) === JSON.stringify(parsed.lines), 'IDEMPOTENCY_CONFLICT', 'A mesma chave fiscal contém itens diferentes.');
                return { purchaseId: same.id, duplicate: true };
            }
            const p = { ...parsed, id: uid('purchase'), at, received: false, mode: c.source === 'fixture' ? 'FIXTURE' : 'XML_UPLOADED' };
            s.purchases.push(p);
            event(s, 'PURCHASE_RECORDED', 'merchant', 'Compra registrada', 'Confirme o recebimento e a condição dos insumos antes de liberar estoque.', p.id, at, 'niko', { lines: p.lines });
            return { purchaseId: p.id };
        }
        case 'receive': return receive(s, c.purchaseId, at);
        case 'count': {
            const t = normalize(c.text);
            demand(/exata?|precisa/.test(t), 'AMBIGUOUS_QUANTITY', 'Confirme que esta contagem é exata. Contagens aproximadas precisam de buffer ainda não configurado.');
            demand(/agora|hoje/.test(t) && !/ontem|anteontem|semana passada/.test(t), 'STALE_COUNT', 'Esta release recebe contagens do instante atual. Informe “agora”.');
            demand(/principal/.test(t), 'AMBIGUOUS_QUANTITY', 'Informe o local da contagem: estoque principal.');
            const matches = [...t.matchAll(/(\d+(?:[.,]\d+)?)\s*(kg|g|gramas?|unidades?|un|ml)\s*(?:de\s+)?([a-z ]+?)(?=,|\.|;|\s+e\s+\d|$)/g)];
            const lines = matches.map(m => { const cat = identify(m[3]); demand(cat, 'UNKNOWN_ITEM', `Não identifiquei o insumo “${m[3]}”.`); const i = r.stock.find(i => i.id === cat.id)!; let quantity = m[1].replace(',', '.'); if (m[2] === 'kg' && i.unit === 'g')
                quantity = decimal(mul(rational(quantity), rational('1000')));
            else
                demand(m[2] === i.unit || (i.unit === 'un' && m[2].startsWith('un')) || (i.unit === 'g' && m[2].startsWith('grama')), 'UNIT_MISMATCH', 'Unidade incompatível.'); if (i.unit === 'g')
                demand(/cru|comprad/.test(m[3]) && !/pront|cozid/.test(m[3]), 'AMBIGUOUS_QUANTITY', 'Diferencie o estoque cru/comprado do alimento pronto.'); return { item: i.id, quantity, previous: i.quantity, basis: i.basis }; });
            demand(lines.length > 0, 'AMBIGUOUS_QUANTITY', 'Diga, por exemplo: 6 kg de patinho cru, contagem exata, estoque principal, agora.');
            demand(new Set(lines.map(l => l.item)).size === lines.length, 'DUPLICATE_ITEM', 'Informe cada insumo uma única vez.');
            s.count = { id: uid('count'), at, revision: s.sequence, lines, confirmed: false, source: c.text };
            event(s, 'COUNT_PROPOSED', 'merchant', 'Contagem pronta para revisar', `${lines.length} insumo(s). Os demais serão preservados.`, s.count.id, at, 'niko');
            return { countId: s.count.id };
        }
        case 'confirm_count': {
            const count = s.count;
            demand(count && count.id === c.countId, 'COUNT_NOT_FOUND', 'Contagem não encontrada.');
            if (count.confirmed)
                return {};
            demand(Date.parse(at) - Date.parse(count.at) < 300000, 'STALE_COUNT', 'Refaça a contagem; passaram mais de cinco minutos.');
            for (const l of count.lines) {
                const i = r.stock.find(i => i.id === l.item)!;
                demand(i.quantity === l.previous, 'STOCK_COUNT_CONFLICT', 'Houve movimento desde a contagem. Confira novamente.');
                demand(compare(l.quantity, i.reserved) >= 0, 'STOCK_COUNT_CONFLICT', 'A contagem é menor que as reservas. Resolva os pedidos antes de confirmar.');
            }
            for (const l of count.lines) {
                const i = r.stock.find(i => i.id === l.item)!;
                const adjustment = qsub(l.quantity, i.quantity);
                i.quantity = l.quantity;
                event(s, 'STOCK_COUNT_CONFIRMED', 'merchant', `${i.name}: saldo reconciliado`, `${l.previous} → ${l.quantity} ${i.unit} · ajuste ${adjustment} ${i.unit}`, count.id, at, 'niko', { countedAt: count.at, recordedAt: at, previous: l.previous, quantity: l.quantity, adjustment, location: 'estoque principal', precision: 'EXACT', basis: l.basis, ledgerSequence: count.revision });
            }
            count.confirmed = true;
            return {};
        }
        case 'surplus': {
            const i = r.stock.find(i => i.id === c.item);
            demand(i, 'UNKNOWN_ITEM', 'Insumo não encontrado.');
            demand(!c.enabled || (i.eligible && i.expiresAt > at && compare(qsub(i.quantity, i.reserved), '0') > 0), 'STOCK_INELIGIBLE', 'Excedente precisa de saldo elegível disponível.');
            i.surplus = c.enabled;
            event(s, 'SURPLUS_DECLARED', 'merchant', c.enabled ? 'Excedente declarado' : 'Excedente encerrado', `${i.name} · não representa desperdício evitado comprovado.`, i.id, at, 'niko');
            return {};
        }
        case 'eligibility': {
            const i = r.stock.find(i => i.id === c.item);
            demand(i, 'UNKNOWN_ITEM', 'Insumo não encontrado.');
            demand(!c.eligible || i.expiresAt > at, 'STOCK_INELIGIBLE', 'Lote expirado. Registre um novo recebimento validado.');
            i.eligible = c.eligible;
            event(s, 'STOCK_ELIGIBILITY_CHANGED', 'merchant', c.eligible ? 'Insumo liberado' : 'Insumo bloqueado', `${i.name}. Pedidos reservados precisam ser conferidos antes do preparo.`, i.id, at, 'niko');
            return {};
        }
        case 'schedule':
            s.schedule = { days: c.days, hour: c.hour, timeZone: 'America/Sao_Paulo', nextAt: nextCount(at, c.days, c.hour), lastFiredAt: null };
            event(s, 'SCHEDULE_CHANGED', 'merchant', 'Rotina de contagem atualizada', `A cada ${c.days} dia(s), às ${c.hour}, em São Paulo.`, 'schedule', at, 'niko');
            return {};
        case 'tick':
            s.clockOffset += c.days * 86400000;
            runScheduler(s, new Date(Date.parse(at) + c.days * 86400000).toISOString());
            return { clockOffset: s.clockOffset };
        case 'mandate': {
            const excluded = c.excluded.map(x => identify(x)?.id ?? normalize(x));
            const restaurantId = c.restaurantId === undefined ? s.customerAgent?.draft.restaurantId ?? null : c.restaurantId;
            const deliveryPointId = c.deliveryPointId === undefined ? s.customerAgent?.draft.deliveryPointId ?? null : c.deliveryPointId;
            const m = { id: uid('mandate'), maxCents: c.maxCents, committedCents: 0, used: 0, maxUses: 1, expiresAt: new Date(Date.parse(at) + 15 * 60000).toISOString(), revoked: false, description: c.description, maxMinutes: c.maxMinutes, selectionPreference: c.selectionPreference ?? 'LOWEST_PRICE', restaurantId, deliveryPointId, zone: c.zone, excluded, confirmedAt: at };
            s.mandates.push(m);
            say(s, 'buyer', c.description, at, 'user');
            const priority = { LOWEST_PRICE: 'menor preço', BEST_RATED: 'melhor avaliação, mesmo com maior espera dentro desse prazo', NEAREST: 'menor distância simulada em linha reta', FASTEST: 'menor prazo de entrega informado' }[m.selectionPreference];
            say(s, 'buyer', `Autorização registrada: uma compra de até ${money(c.maxCents)}, já com entrega, em até ${c.maxMinutes} minutos. Prioridade: ${priority}.${restaurantId ? ` Restaurante escolhido: ${s.restaurants.find(restaurant => restaurant.id === restaurantId)?.name}.` : ''} Seu teto não será compartilhado com os restaurantes.`, at);
            event(s, 'MANDATE_CONFIRMED', 'buyer', 'Compra autorizada', 'Uma compra em sandbox · autorização válida por 15 minutos.', m.id, at);
            return { mandateId: m.id };
        }
        case 'revoke': {
            const m = s.mandates.find(m => m.id === c.mandateId);
            demand(m, 'MANDATE_REQUIRED', 'Autorização não encontrada.');
            m.revoked = true;
            event(s, 'MANDATE_REVOKED', 'buyer', 'Autorização revogada', 'Novos aceites estão bloqueados. Pedidos já confirmados mantêm seus termos.', m.id, at);
            return {};
        }
        case 'rfq': return createRfq(s, c.mandateId, at);
        case 'negotiate': return negotiate(s, c.rfqId, at);
        case 'counter': return { offerId: counter(s, c.offerId, c.subtotalCents, at).id };
        case 'accept': return accept(s, c.offerId, c.quoteToken, at);
        case 'order': return orderAction(s, c.orderId, c.action, at, c.scope);
        case 'produce': {
            const recipe = r.recipes.filter(x => x.id === c.recipeId).at(-1);
            demand(recipe && recipe.mode === 'ON_DEMAND', 'RECIPE_NOT_FOUND', 'Selecione uma ficha sob pedido.');
            const receipt = quote(r, recipe, at);
            const needs = requirements(recipe).map(x => ({ ...x, quantity: decimal(mul(rational(x.quantity), rational(String(c.portions)))) }));
            for (const n of needs) {
                const i = r.stock.find(i => i.id === n.item)!;
                demand(compare(qsub(qsub(i.quantity, i.reserved), i.safety), n.quantity) >= 0, 'STOCK_INSUFFICIENT', 'Sem insumos para esse lote.');
            }
            for (const n of needs) {
                const i = r.stock.find(i => i.id === n.item)!;
                i.quantity = qsub(i.quantity, n.quantity);
            }
            const item = uid('prep');
            r.stock.push({ id: item, name: `${recipe.name} pronto`, unit: 'un', basis: 'COOKED_EDIBLE', quantity: String(c.portions), reserved: '0', safety: '0', costNumerator: String(receipt.variableCents), costDenominator: '1', eligible: true, expiresAt: new Date(Date.parse(at) + 86400000).toISOString(), surplus: false });
            r.recipes.push({ ...structuredClone(recipe), id: uid('recipe'), name: `${recipe.name} (pré-produzido)`, version: 1, mode: 'PREPRODUCED', preparedItem: item, otherVariableCents: 0 });
            event(s, 'PRODUCTION_COMPLETED', 'merchant', 'Lote de teste produzido', `${c.portions} porções. Matéria-prima baixada; vendas deste lote consumirão somente o item pronto. Validade sintética da fixture.`, item, at, 'niko', { inputs: needs, output: { item, portions: c.portions } });
            return {};
        }
    }
}
