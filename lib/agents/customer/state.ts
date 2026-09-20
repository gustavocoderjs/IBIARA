import type { CustomerSession } from './schemas.ts';

export function emptyCustomerSession(): CustomerSession {
    return {
        version: 0,
        draft: { description: null, budget: null, portions: null, maxMinutes: null,
            zone: null, excluded: null, foodSafetyConcern: null, selectionPreference: 'LOWEST_PRICE', restaurantId: null, deliveryPointId: null },
        turns: [], calls: 0, lastUsage: null,
        discovery: { ingredientIds: [], preferences: [], choices: [], offset: 0 }, pendingQuestion: 'description',
        question: { kind: 'field', field: 'description', text: 'Qual refeição você quer?' },
    };
}
