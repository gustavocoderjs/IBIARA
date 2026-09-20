import { catalog } from './fixtures.ts';
import { normalize } from '../adapters/neuralake.ts';
import type { State } from './types.ts';

const words = (text: string) => normalize(text).match(/[a-z]+/g) ?? [];
/** Conservative demo grammar: unknown food types cannot disappear into a known ingredient. */
export function mealIntentIssue(description: string, state: State): string | null {
    const known = new Set([
        ...words('quero gostaria de comer pedir um uma porcao porcoes refeicao prato marmita para mim com e a ao da do os as o por favor grelhado grelhada cozido cozida frito frita'),
        ...catalog.flatMap(item => item.aliases.flatMap(words)),
        ...state.restaurants.flatMap(r => r.recipes.filter(recipe => recipe.status === 'CONFIRMED')
            .flatMap(recipe => words(recipe.name))),
    ]);
    const unknown = words(description).find(word => !known.has(word));
    return unknown ? 'Essa refeição contém um termo que o cardápio da demo não reconhece. Consulte os pratos disponíveis; não farei substituições.' : null;
}
