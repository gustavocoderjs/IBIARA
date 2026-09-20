import type { SelectionPreference } from '../domain/types';

export const customerRestaurants = [
    { id: 'niko', name: 'Marmita Quentinha do Seu Niko' },
    { id: 'casa', name: 'Sabor de Casa' },
    { id: 'panela', name: 'Cozinha Expressa' },
] as const;
export const restaurantLabel = (id?: string | null) => customerRestaurants.find(restaurant => restaurant.id === id)?.name ?? 'Comparar restaurantes elegíveis';
export const preferenceLabel = (preference?: SelectionPreference | null) => ({
    LOWEST_PRICE: 'Menor preço total', BEST_RATED: 'Melhor avaliação', NEAREST: 'Mais próximo', FASTEST: 'Menor prazo',
})[preference ?? 'LOWEST_PRICE'];
