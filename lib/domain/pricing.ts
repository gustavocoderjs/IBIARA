import { DomainError, type Restaurant, type Recipe, type PricingReceipt, type State } from './types.ts';
import { rational, mul, div, ceil, round, integer, decimal, add, compare, qsub } from './money.ts';
export function requirements(recipe: Recipe) {
    if (recipe.status !== 'CONFIRMED' || !recipe.servings)
        throw new DomainError('RECIPE_INCOMPLETE', 'Confirme a ficha técnica antes de vender.');
    if (recipe.mode === 'PREPRODUCED')
        return [{ item: recipe.preparedItem!, quantity: '1' }];
    return recipe.components.map(c => { if (!c.quantity || !c.yield || !c.basis)
        throw new DomainError('RECIPE_INCOMPLETE', 'A ficha ainda tem quantidades ou rendimentos pendentes.'); return { item: c.item, quantity: decimal(div(div(rational(c.quantity), rational(c.yield)), rational(String(recipe.servings)))) }; });
}
export function available(r: Restaurant, recipe: Recipe, at: string) {
    for (const x of requirements(recipe)) {
        const i = r.stock.find(i => i.id === x.item);
        if (!i || !i.eligible || i.expiresAt <= at || compare(qsub(qsub(i.quantity, i.reserved), i.safety), x.quantity) < 0)
            throw new DomainError('STOCK_INSUFFICIENT', 'Não há estoque elegível para todos os componentes.');
    }
}
export function quote(r: Restaurant, recipe: Recipe, at: string, requestedCents?: number): PricingReceipt {
    const p = r.policy;
    if (!p)
        throw new DomainError('POLICY_REQUIRED', 'Confirme a política comercial.');
    if (p.minMarginBps + p.feeBps >= 10000)
        throw new DomainError('POLICY_INFEASIBLE', 'Margem e taxas devem somar menos de 100%.');
    available(r, recipe, at);
    let total = { n: 0n, d: 1n };
    const breakdown = requirements(recipe).map(c => { const i = r.stock.find(i => i.id === c.item)!; if (i.costNumerator === null || i.costDenominator === null)
        throw new DomainError('COST_UNAVAILABLE', `Custo de ${i.name} não confirmado.`); const v = mul(rational(c.quantity), { n: BigInt(i.costNumerator), d: BigInt(i.costDenominator) }); total = add(total, v); return { item: i.name, quantity: `${c.quantity} ${i.unit}`, cents: integer(round(v)) }; });
    if (recipe.otherVariableCents === null)
        throw new DomainError('COST_UNAVAILABLE', 'Informe os demais custos variáveis.');
    const variableCents = integer(ceil(total)) + recipe.otherVariableCents;
    const costCents = variableCents + p.fixedCents;
    const analyticalFloorCents = integer(ceil({ n: BigInt(costCents) * 10000n, d: BigInt(10000 - p.feeBps - p.minMarginBps) }));
    const discountFloorCents = integer(ceil({ n: BigInt(p.referenceCents) * BigInt(10000 - p.maxDiscountBps), d: 10000n }));
    const ceilingCents = integer(BigInt(p.referenceCents) * BigInt(10000 + p.maxMarkupBps) / 10000n);
    const fee = (v: number) => integer(round({ n: BigInt(v) * BigInt(p.feeBps), d: 10000n }));
    const valid = (v: number) => { const contribution = v - fee(v) - costCents; return contribution >= p.minContributionCents && BigInt(contribution) * 10000n >= BigInt(v) * BigInt(p.minMarginBps); };
    let floorCents = Math.max(analyticalFloorCents, discountFloorCents);
    while (floorCents <= ceilingCents && !valid(floorCents))
        floorCents++;
    if (floorCents > ceilingCents)
        throw new DomainError('POLICY_INFEASIBLE', 'Os custos e limites atuais não permitem uma oferta.');
    const surplus = p.objective === 'SURPLUS_FIRST' && requirements(recipe).some(c => r.stock.find(i => i.id === c.item)?.surplus);
    const target = integer(round({ n: BigInt(p.referenceCents) * BigInt(10000 - (surplus ? p.surplusDiscountBps : 0)), d: 10000n }));
    const subtotalCents = requestedCents ?? Math.max(floorCents, Math.min(ceilingCents, target));
    if (subtotalCents < floorCents || subtotalCents > ceilingCents || !valid(subtotalCents))
        throw new DomainError('COUNTER_REJECTED', 'Não posso atender a esse valor dentro das condições autorizadas.');
    const feeCents = fee(subtotalCents), contributionCents = subtotalCents - feeCents - costCents;
    return { recipeId: recipe.id, recipeVersion: recipe.version, policyVersion: p.version, variableCents, fixedCents: p.fixedCents, costCents, analyticalFloorCents, discountFloorCents, floorCents, ceilingCents, subtotalCents, feeCents, contributionCents, marginBps: integer(BigInt(contributionCents) * 10000n / BigInt(subtotalCents)), strategy: surplus ? 'SURPLUS_FIRST' : 'BALANCED', breakdown, stockSnapshot: JSON.stringify(r.stock.map(i => ({ id: i.id, quantity: i.quantity, reserved: i.reserved, eligible: i.eligible, cost: [i.costNumerator, i.costDenominator] }))) };
}
export function freeCapacity(s: State, r: Restaurant) { return (r.policy?.capacity ?? 0) - s.orders.filter(o => o.merchantId === r.id && ['CONFIRMED', 'PREPARING'].includes(o.status)).length; }
