/**
 * R146: how "Preporučeno" weighs a listing's rating, freshness, the owner's
 * response time and a random part. Set in Administracija > Istaknuti oglasi
 * (Podešavanja), read by SearchService.
 */
export const RANKING_WEIGHTS_KEY = 'ranking_weights';
export const RANKING_WEIGHTS_CACHE_KEY = 'settings:ranking_weights';

export interface RankingWeights {
  rating: number;
  freshness: number;
  responseTime: number;
  random: number;
}

export const DEFAULT_RANKING_WEIGHTS: RankingWeights = { rating: 0.35, freshness: 0.25, responseTime: 0.2, random: 0.2 };

/** Each weight a number from 0 to 1, two decimals; a missing one keeps its default. */
export function readRankingWeights(value: unknown): RankingWeights {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const weights = { ...DEFAULT_RANKING_WEIGHTS };
  for (const key of Object.keys(DEFAULT_RANKING_WEIGHTS) as Array<keyof RankingWeights>) {
    const number = raw[key];
    if (typeof number === 'number' && Number.isFinite(number)) {
      weights[key] = Math.round(Math.min(1, Math.max(0, number)) * 100) / 100;
    }
  }
  return weights;
}
