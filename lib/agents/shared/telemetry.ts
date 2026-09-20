import type { State } from '../../domain/types.ts';
import type { AgentUsage } from '../customer/schemas.ts';

// Counts successfully persisted calls only; not a provider billing ledger.
export function recordUsage(state: State, usage: AgentUsage) {
    if (usage.mode !== 'NEURALAKE') return;
    state.inference ??= { committedCalls: 0, knownTokens: 0, unknownTokenCalls: 0 };
    state.inference.committedCalls++;
    if (usage.tokens === null) state.inference.unknownTokenCalls++;
    else state.inference.knownTokens += usage.tokens;
}
