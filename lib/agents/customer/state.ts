import type { CustomerSession } from './schemas.ts';

export function emptyCustomerSession(): CustomerSession {
    return {
        version: 0,
        draft: { description: null, budget: null, portions: null, maxMinutes: null,
            zone: null, excluded: null, foodSafetyConcern: null },
        turns: [], calls: 0, lastUsage: null,
    };
}
