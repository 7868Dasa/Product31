/**
 * Bump this whenever the Privacy Policy or Terms change materially — every
 * signed-in user is then re-prompted for consent (DPDP: consent is tied to a
 * specific version of the notice).
 */
export const CONSENT_VERSION = '2026-09-01';

export function needsConsent(user) {
  return Boolean(user) && user.consent_version !== CONSENT_VERSION;
}
