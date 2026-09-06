/**
 * Multi-turn voice session (spec §9.3).
 *
 *  - A shopper can say several items at once ("rendu milk, oru rice, arai kilo
 *    dal"). Each segment is matched; resolved lines go straight to the cart,
 *    unresolved ones queue up as clarifications asked one at a time.
 *  - The next utterance after a question is first tried as an ANSWER to it,
 *    then falls through to a fresh request.
 *  - `spoken` is the same text as `reply` (Web Speech synthesis reads it).
 */
import { tokenize } from './normalize.js';
import { segmentUtterance } from './segment.js';
import {
  matchLine,
  resolvePackSizeAnswer,
  resolveQuantityAnswer,
  packSizeQuestion,
  quantityQuestion,
} from './match.js';

export function createSession({ shopSlug, lang }) {
  return { shopSlug, lang, lines: [], pending: null, queue: [], turns: [] };
}

// ── describe a resolved line in the customer's language ───────────────
function itemOf(line, catalog) {
  return catalog.find((c) => c.id === line.matched_product_id) || null;
}
function nameOf(line, catalog, lang) {
  const it = itemOf(line, catalog);
  if (!it) return line.query;
  return lang === 'ta' && it.name_ta ? it.name_ta : it.name;
}
function describeLine(line, catalog, lang) {
  const name = nameOf(line, catalog, lang);
  if (line.sell_by === 'weight') {
    let amt;
    if (line.unit === 'kg') amt = line.quantity < 1 ? `${Math.round(line.quantity * 1000)} g` : `${line.quantity} kg`;
    else if (line.unit === 'l') amt = line.quantity < 1 ? `${Math.round(line.quantity * 1000)} ml` : `${line.quantity} l`;
    else amt = `${line.quantity} ${line.unit}`;
    return `${amt} ${name}`;
  }
  const size = line.pack_size ? ` ${line.pack_size}` : '';
  return `${line.quantity} × ${name}${size}`;
}

// ── replies ──────────────────────────────────────────────────────────
function addedSummary(lines, catalog, lang) {
  if (!lines.length) return '';
  const parts = lines.map((l) => describeLine(l, catalog, lang));
  return lang === 'ta' ? `${parts.join(', ')} சேர்த்தாச்சு.` : `Added ${parts.join(', ')}.`;
}
function notFoundNote(q, lang) {
  return lang === 'ta'
    ? `"${q}" இந்தக் கடையில கிடைக்கல.`
    : `Couldn't find "${q}" in this shop.`;
}
function oosNote(q, lang) {
  return lang === 'ta' ? `"${q}" இப்போ கையிருப்பில இல்ல.` : `"${q}" is out of stock.`;
}
function anythingElse(lang) {
  return lang === 'ta' ? 'வேற ஏதாவது வேணுமா?' : 'Anything else?';
}
function questionFor(pending, catalog, lang) {
  if (!pending) return '';
  if (pending.needs === 'pack_size') return packSizeQuestion(pending.options, lang);
  if (pending.needs === 'quantity') {
    const it = itemOf(pending.baseLine, catalog) || pending.item;
    return quantityQuestion(it || { base_unit: 'kg' }, lang);
  }
  return '';
}

function emit(session, replyParts, extra = {}) {
  const reply = replyParts.filter(Boolean).join(' ').trim();
  session.turns.push({ role: 'assistant', text: reply });
  return {
    reply,
    spoken: reply,
    options: session.pending?.options || [],
    resolvedLines: extra.resolvedLines || [],
    resolvedLine: (extra.resolvedLines || []).slice(-1)[0] || null,
    done: false,
  };
}

// ── ingest ───────────────────────────────────────────────────────────
export function ingest(session, transcript, catalog) {
  const text = String(transcript || '').trim();
  if (!text) return { reply: '', spoken: '', options: [], resolvedLines: [], resolvedLine: null };
  session.turns.push({ role: 'user', text });

  const segments = segmentUtterance(text);

  // 1. try as an answer to the current pending question (single segment only)
  if (session.pending && segments.length === 1) {
    const p = session.pending;
    let resolved = null;
    if (p.needs === 'pack_size') {
      resolved = resolvePackSizeAnswer(segments[0], p.options, catalog, p.baseLine);
    } else if (p.needs === 'quantity') {
      resolved = resolveQuantityAnswer(segments[0], itemOf(p.baseLine, catalog) || p.item, p.baseLine);
    }
    if (resolved && !resolved.needs) {
      session.lines.push(resolved);
      session.pending = session.queue.shift() || null;
      return emit(
        session,
        [addedSummary([resolved], catalog, session.lang), questionFor(session.pending, catalog, session.lang) || anythingElse(session.lang)],
        { resolvedLines: [resolved] },
      );
    }
    // not a plausible answer → drop everything pending, treat as fresh (§9.3)
    session.pending = null;
    session.queue = [];
  }

  // 2. fresh request — match every segment
  session.pending = null;
  session.queue = [];
  const resolved = [];
  const clarifications = [];
  const notes = [];

  for (const seg of segments) {
    const line = matchLine(seg, catalog, { lang: session.lang });
    if (line.needs === 'not_found') {
      notes.push(notFoundNote(seg, session.lang));
    } else if (line.needs === 'out_of_stock') {
      notes.push(oosNote(seg, session.lang));
    } else if (line.needs === 'pack_size' || line.needs === 'quantity') {
      clarifications.push({
        needs: line.needs,
        options: line.options || [],
        baseLine: line,
        item: line._item || null,
      });
    } else {
      resolved.push(line);
    }
  }

  resolved.forEach((l) => session.lines.push(l));
  if (clarifications.length) {
    session.pending = clarifications[0];
    session.queue = clarifications.slice(1);
  }

  const tail = session.pending
    ? questionFor(session.pending, catalog, session.lang)
    : resolved.length || notes.length
      ? anythingElse(session.lang)
      : notFoundNote(text, session.lang);

  return emit(
    session,
    [addedSummary(resolved, catalog, session.lang), notes.join(' '), tail],
    { resolvedLines: resolved },
  );
}

export function isDoneUtterance(text) {
  return /\b(no|nope|that'?s it|done|thats all|nothing|podhum|போதும்|அவ்வளவுதான்|இல்ல)\b/i.test(
    String(text).trim(),
  );
}
