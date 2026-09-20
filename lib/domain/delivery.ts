import { demand } from './types.ts';

export const deliveryPointIds = ['butanta_centro', 'usp', 'vila_indiana'] as const;
export type DeliveryPointId = typeof deliveryPointIds[number];
export const demoRestaurantIds = ['niko', 'casa', 'panela'] as const;
export type DemoRestaurantId = typeof demoRestaurantIds[number];

/** Synthetic points and restaurant positions for this sandbox, not delivery addresses. */
export const deliveryPoints = [
    { id: 'butanta_centro', label: 'Butantã Centro', lat: -23.5708, lon: -46.7080, simulation: true },
    { id: 'usp', label: 'USP', lat: -23.5580, lon: -46.7300, simulation: true },
    { id: 'vila_indiana', label: 'Vila Indiana', lat: -23.5820, lon: -46.7260, simulation: true },
] as const;
const restaurantLocations: Record<DemoRestaurantId, { lat: number; lon: number; radiusMeters: number }> = {
    niko: { lat: -23.5700, lon: -46.7100, radiusMeters: 2600 },
    casa: { lat: -23.5760, lon: -46.7250, radiusMeters: 2600 },
    panela: { lat: -23.5570, lon: -46.7240, radiusMeters: 2400 },
};

/** Approximate straight-line distance. This is neither a route nor an ETA. */
export function distanceMeters(restaurantId: string, deliveryPointId: string): number | null {
    if (!Object.hasOwn(restaurantLocations, restaurantId)) return null;
    const restaurant = restaurantLocations[restaurantId as DemoRestaurantId];
    const point = deliveryPoints.find(point => point.id === deliveryPointId);
    if (!restaurant || !point) return null;
    const rad = (value: number) => value * Math.PI / 180;
    const deltaLat = rad(point.lat - restaurant.lat), deltaLon = rad(point.lon - restaurant.lon);
    const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(rad(restaurant.lat)) * Math.cos(rad(point.lat)) * Math.sin(deltaLon / 2) ** 2;
    return Math.round(6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function servesDeliveryPoint(restaurantId: string, deliveryPointId: string): boolean {
    const distance = distanceMeters(restaurantId, deliveryPointId);
    return distance !== null && distance <= restaurantLocations[restaurantId as DemoRestaurantId].radiusMeters;
}

export function assertDeliverySelection(selection: {
    restaurantId?: string | null; deliveryPointId?: string | null;
    selectionPreference?: string; zone?: string;
}) {
    demand(selection.restaurantId == null || demoRestaurantIds.some(id => id === selection.restaurantId),
        'RESTAURANT_NOT_FOUND', 'Escolha um restaurante cadastrado na demonstração.');
    demand(selection.deliveryPointId == null || deliveryPointIds.some(id => id === selection.deliveryPointId),
        'DELIVERY_POINT_UNSUPPORTED', 'Escolha um dos pontos de entrega simulados.');
    demand(selection.deliveryPointId == null || selection.zone === 'demo_butanta',
        'DELIVERY_POINT_UNSUPPORTED', 'Os pontos de entrega simulados pertencem à região Butantã da demo.');
    demand(selection.selectionPreference !== 'NEAREST' || selection.deliveryPointId != null,
        'DELIVERY_POINT_REQUIRED', 'Informe um ponto de entrega simulado para comparar proximidade.');
    demand(selection.restaurantId == null || selection.deliveryPointId == null ||
        servesDeliveryPoint(selection.restaurantId, selection.deliveryPointId),
        'DELIVERY_UNAVAILABLE', 'O restaurante escolhido não atende esse ponto na simulação. Escolha outro restaurante ou ponto.');
}
