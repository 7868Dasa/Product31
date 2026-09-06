/**
 * Shopper location. Tries the browser's geolocation; falls back to a saved
 * choice, then to a sensible default (a Tier-3 TN town) so the shop list is
 * never empty just because permission was denied (spec §2).
 */
const KEY = 'p31.loc';

export const DEFAULT_LOCATION = { lat: 11.7401, lng: 78.9597, label: 'Kallakurichi' };

export function getSavedLocation() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (v && typeof v.lat === 'number' && typeof v.lng === 'number') return v;
  } catch {
    /* ignore */
  }
  return null;
}

export function saveLocation(loc) {
  try {
    localStorage.setItem(KEY, JSON.stringify(loc));
  } catch {
    /* ignore */
  }
}

export function requestBrowserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('geolocation unavailable'));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: null }),
      (err) => reject(err),
      { timeout: 8000, maximumAge: 60_000, enableHighAccuracy: false },
    );
  });
}

/** Best-effort starting location: saved -> default. Geolocation is opt-in via a button. */
export function initialLocation() {
  return getSavedLocation() || DEFAULT_LOCATION;
}
