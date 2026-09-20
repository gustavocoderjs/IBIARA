import type { DemandState } from '../domain/market-pressure.ts';

export type { DemandState } from '../domain/market-pressure.ts';

export type MarketSimulation = {
    simulatedBuyerCount: number;
    demandState: DemandState;
    marketActivity: string;
};

/**
 * Presentation-only sandbox state. It deliberately does not change pricing,
 * RFQs, inventory or orders. A future domain adapter can consume this
 * contract once demand pressure has an explicit commercial rule.
 */
export function marketSimulation(simulatedBuyerCount: number): MarketSimulation {
    const count = Math.max(0, Math.min(50, Math.trunc(simulatedBuyerCount)));
    const demandState: DemandState = count === 0 ? 'LOW' : count < 4 ? 'NORMAL' : 'HIGH';
    const marketActivity = count === 0
        ? 'Exchange aguardando intenções simuladas'
        : `${count} demanda${count === 1 ? '' : 's'} simulada${count === 1 ? '' : 's'} no sandbox`;
    return { simulatedBuyerCount: count, demandState, marketActivity };
}

export const demandLabel: Record<DemandState, string> = {
    LOW: 'Baixa',
    NORMAL: 'Normal',
    HIGH: 'Alta',
};
