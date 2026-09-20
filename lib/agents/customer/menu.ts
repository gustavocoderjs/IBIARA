import type { State } from '../../domain/types.ts';
import { DomainError } from '../../domain/types.ts';
import { quote, freeCapacity } from '../../domain/pricing.ts';
import { catalog } from '../../domain/fixtures.ts';
import { publicRating } from '../../domain/ratings.ts';

// Explicit public projection. No quantity, cost, floor or policy reaches the customer model.
export function publicMenu(state: State, at: string) {
    return state.restaurants.flatMap(restaurant => restaurant.recipes.filter(recipe =>
        recipe.status === 'CONFIRMED' && !restaurant.recipes.some(newer =>
            newer.id === recipe.id && newer.version > recipe.version)).map(recipe => {
        let totalCents: number | null = null;
        try {
            if (freeCapacity(state, restaurant) > 0)
                totalCents = quote(restaurant, recipe, at).subtotalCents + restaurant.deliveryCents;
        } catch (error) { if (!(error instanceof DomainError)) throw error; }
        return { restaurantId: restaurant.id, restaurantName: restaurant.name, ...publicRating(restaurant.id, restaurant),
            menuItemId: recipe.id, name: recipe.name,
            ingredients: recipe.components.filter(c => !['embalagem', 'tempero'].includes(c.item))
                .map(c => catalog.find(i => i.id === c.item)?.name ?? c.item),
            available: totalCents !== null, totalCents, etaMinutes: restaurant.eta };
    }));
}
