export const MAP_PROVIDER = import.meta.env.PUBLIC_MAP_PROVIDER || 'leaflet';
export const GOOGLE_MAPS_API_KEY = import.meta.env.PUBLIC_GOOGLE_MAPS_API_KEY || '';

export const MONAD_CENTER = { lat: 37.7749, lng: -122.4194 };
export const DEFAULT_ZOOM = 12;
export const MARKETPLACE_ZOOM = 11;

export const PIN_COLORS = {
  pickup: '#22c55e',
  delivery: '#ef4444',
  job: '#3b82f6',
  accepted: '#f59e0b',
};

export const PRICING_USD = {
  baseFeeUsd: 1.50,
  tiers: [
    { maxKm: 10, perKmUsd: 0.40 },
    { maxKm: 30, perKmUsd: 0.25 },
    { maxKm: Infinity, perKmUsd: 0.15 },
  ],
  platformFeeBps: 120,
};

export function calculateDistanceFee(distanceKm) {
  let fee = 0;
  let remaining = distanceKm;
  let prevMax = 0;

  for (const tier of PRICING_USD.tiers) {
    const tierRange = tier.maxKm - prevMax;
    const inTier = Math.min(remaining, tierRange);
    fee += inTier * tier.perKmUsd;
    remaining -= inTier;
    prevMax = tier.maxKm;
    if (remaining <= 0) break;
  }

  return Math.round(fee * 100) / 100;
}

export function getDistanceTierLabel(distanceKm) {
  if (distanceKm <= 10) return 'Local delivery';
  if (distanceKm <= 30) return 'City delivery';
  return 'Long distance';
}

export const FALLBACK_MON_USD = 0.50;

export function isLeaflet() {
  return MAP_PROVIDER === 'leaflet';
}

export function isGoogleMaps() {
  return MAP_PROVIDER === 'google';
}
