/**
 * Great-circle distance. Used for tests and any non-SQL distance math; the
 * nearby-shops query does the same calculation in Postgres for index-friendly
 * filtering.
 */
const toRad = (deg) => (deg * Math.PI) / 180;

export function haversineKm(aLat, aLng, bLat, bLng) {
  const R = 6371; // km
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}
