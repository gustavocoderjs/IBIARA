import type { Offer, SelectionPreference } from './types.ts';

export type PublicRating = {
    ratingTenths: number | null;
    ratingCount: number;
    ratingIsDemo: boolean;
};

// Synthetic demo data only. No customer reviews are collected in this MVP.
const demoRatings: Record<string, readonly [number, number]> = {
    niko: [46, 128], casa: [49, 86], panela: [43, 214],
};

/** Read-only defaults let existing D1 scenarios gain ratings without resetting stock or orders. */
export function publicRating(id: string, stored: Partial<PublicRating> = {}): PublicRating {
    if (stored.ratingTenths === undefined && stored.ratingCount === undefined) {
        const demo = demoRatings[id];
        return demo ? { ratingTenths: demo[0], ratingCount: demo[1], ratingIsDemo: true } :
            { ratingTenths: null, ratingCount: 0, ratingIsDemo: false };
    }
    const score = stored.ratingTenths, count = stored.ratingCount;
    if (typeof score !== 'number' || !Number.isInteger(score) || score < 0 || score > 50 ||
        typeof count !== 'number' || !Number.isSafeInteger(count) || count <= 0)
        return { ratingTenths: null, ratingCount: 0, ratingIsDemo: stored.ratingIsDemo ?? false };
    return { ratingTenths: score, ratingCount: count, ratingIsDemo: stored.ratingIsDemo ?? true };
}

export function compareOffers(a: Offer, b: Offer, preference: SelectionPreference = 'LOWEST_PRICE'): number {
    if (preference === 'NEAREST') {
        const distanceA = a.distanceMeters ?? Infinity, distanceB = b.distanceMeters ?? Infinity;
        if (distanceA !== distanceB) return distanceA < distanceB ? -1 : 1;
    }
    if (preference === 'FASTEST' && a.eta !== b.eta) return a.eta - b.eta;
    if (preference === 'BEST_RATED') {
        const scoreA = publicRating(a.merchantId, a).ratingTenths ?? -1;
        const scoreB = publicRating(b.merchantId, b).ratingTenths ?? -1;
        if (scoreA !== scoreB) return scoreB - scoreA;
    }
    return a.totalCents - b.totalCents || a.eta - b.eta || a.merchantId.localeCompare(b.merchantId);
}
