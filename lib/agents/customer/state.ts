import type { CustomerSession } from './schemas.ts';

export function emptyCustomerSession(): CustomerSession {
    return {
        version: 0,
        draft: { description: null, budget: null, portions: null, maxMinutes: null,
            zone: null, excluded: null, foodSafetyConcern: null, selectionPreference: 'LOWEST_PRICE' },
        turns: [], calls: 0, lastUsage: null,
    };
}
