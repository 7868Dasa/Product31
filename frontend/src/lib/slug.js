/**
 * Non-guessable 8-char shop slug (mirrors backend src/lib/ids.js). Uses
 * crypto.getRandomValues so URLs can't be walked (spec §4/§8).
 */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ'; // no look-alikes

export function newShopSlug(len = 8) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < len; i += 1) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}
