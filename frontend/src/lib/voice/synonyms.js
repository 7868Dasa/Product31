/**
 * Layer 2 — synonym / alias map. Free, a plain data file.
 *
 * These are LANGUAGE aliases (Tamil word, transliteration, common name) that
 * rewrite to the catalog's canonical English-ish tokens. They are NOT
 * "biscuit means Marie Biscuit" — the fuzzy matcher + the generic-token guard
 * still decide which product. So "paruppu" → "dal" (then the shop's dal wins),
 * not "paruppu" → a specific SKU.
 *
 * Grow this from the logged misses (see misses.js). Order matters: longer /
 * more specific phrases first.
 */

// [ [alias, alias, …], 'canonical phrase' ]
export const SYNONYMS = [
  [['chicken powder', 'chicken masala powder', 'kozhi masala', 'கோழி மசாலா', 'கோழி பொடி'], 'chicken masala'],
  [['masala podi', 'masala powder', 'மசாலா பொடி'], 'masala'],

  [['paal', 'பால்', 'milk packet', 'பால் பாக்கெட்'], 'milk'],
  [['paruppu', 'பருப்பு', 'dhal', 'dhall', 'daal', 'thuvaram paruppu', 'துவரம் பருப்பு'], 'toor dal'],
  [['arisi', 'அரிசி', 'idli arisi', 'இட்லி அரிசி'], 'idli rice'],
  [['ennai', 'எண்ணெய்', 'cooking oil', 'சமையல் எண்ணெய்', 'sunflower ennai'], 'sunflower oil'],
  [['uppu', 'உப்பு'], 'salt'],
  [['sarkkarai', 'சர்க்கரை', 'chini', 'seeni'], 'sugar'],
  [['kaapi', 'காபி', 'coffee podi', 'காபி பொடி'], 'coffee'],
  [['biskoot', 'biskut', 'பிஸ்கட்', 'biscuits'], 'biscuit'],
  [['thengai', 'தேங்காய்', 'nariyal', 'coconut piece'], 'coconut'],
];

const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

const INDEX = SYNONYMS.flatMap(([aliases, canon]) =>
  aliases.map((a) => ({ alias: norm(a), canon: norm(canon) })),
).sort((x, y) => y.alias.length - x.alias.length); // longest alias first

/**
 * Rewrite any alias phrase found in `text` to its canonical form.
 * Whole-phrase, word-boundary aware. Returns the (possibly unchanged) string.
 */
export function applySynonyms(text) {
  let out = ` ${norm(text)} `;
  for (const { alias, canon } of INDEX) {
    if (!alias || alias === canon) continue;
    const re = new RegExp(`(^| )${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`, 'g');
    out = out.replace(re, `$1${canon}$2`);
  }
  return out.trim();
}
