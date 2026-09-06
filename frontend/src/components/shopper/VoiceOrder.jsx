import { useMemo, useRef, useState, useEffect } from 'react';
import { Mic, MicOff, Send, Sparkles, Volume2, VolumeX } from 'lucide-react';
import { useI18n } from '../../i18n/index.jsx';
import { useStore } from '../../store.jsx';
import { asrSupported, createRecognizer } from '../../lib/voice/asr.js';
import { createSession, ingest } from '../../lib/voice/session.js';
import { ttsSupported, primeVoices, canSpeak, speak, cancelSpeech } from '../../lib/voice/tts.js';
import { logVoiceMiss } from '../../lib/voice/misses.js';

const MUTE_KEY = 'p31.voice.muted';

/**
 * Shopper voice ordering (spec §9). Rule-based, no API key. Voice is a
 * shortcut — the text box works everywhere (§9.5), and tap-to-add on the list
 * is always there too. Replies are spoken via free browser TTS with a mute
 * toggle; text is always shown regardless.
 */
export function VoiceOrder({ shop, items }) {
  const { t, lang } = useI18n();
  const { addToCart } = useStore();

  const supported = asrSupported();
  const session = useMemo(() => createSession({ shopSlug: shop.slug, lang }), [shop.slug, lang]);

  const [turns, setTurns] = useState([]);
  const [lines, setLines] = useState([]);
  const [options, setOptions] = useState([]);
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [note, setNote] = useState(null);
  const [muted, setMuted] = useState(() => {
    try {
      return localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const recRef = useRef(null);
  const logRef = useRef(null);

  useEffect(() => {
    primeVoices();
  }, []);

  // keep the latest message in view — conversation scrolls inside a fixed box
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns, interim]);

  const ttsAvailable = ttsSupported(); // control shown whenever the browser can speak
  const noVoiceForLang = ttsAvailable && !canSpeak(lang); // on, but no voice for this language
  const voiceOn = !muted;

  function toggleVoice() {
    setMuted((m) => {
      const next = !m;
      try {
        localStorage.setItem(MUTE_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      if (next) cancelSpeech();
      return next;
    });
  }

  function lineToCartItem(line) {
    const it = items.find((i) => i.id === line.matched_product_id);
    if (!it) return null;
    return {
      id: it.id,
      name: it.name,
      name_ta: it.name_ta,
      pack_size: it.pack_size,
      unit_price: it.price ?? it.price_min ?? 0,
      qty: line.quantity,
      sell_by: line.sell_by,
      unit: line.unit,
      price_basis: line.price_basis,
      base_unit: it.base_unit,
      min_qty: it.min_qty,
      max_qty: it.max_qty,
      step_qty: it.step_qty,
    };
  }

  function handleUtterance(utterance) {
    const u = utterance.trim();
    if (!u) return;
    const res = ingest(session, u, items);
    setTurns([...session.turns]);
    setOptions(res.options || []);
    (res.resolvedLines || []).forEach((line) => {
      const ci = lineToCartItem(line);
      if (ci) addToCart(shop.slug, ci);
    });
    (res.unmatched || []).forEach((seg) => logVoiceMiss(seg, shop.slug, lang));
    setLines([...session.lines]);
    if (!muted && res.spoken) speak(res.spoken, lang);
  }

  // ── compact order table (spec §9.5 — text alongside every reply) ──────
  const rows = lines
    .map((l) => {
      const it = items.find((i) => i.id === l.matched_product_id);
      if (!it) return null;
      const name = lang === 'ta' && it.name_ta ? it.name_ta : it.name;
      let qty;
      if (l.sell_by === 'weight') {
        const u = l.unit || 'kg';
        qty = l.quantity < 1 ? `${Math.round(l.quantity * 1000)} ${u === 'kg' ? 'g' : 'ml'}` : `${l.quantity} ${u}`;
      } else {
        qty = `${l.quantity}${l.pack_size ? ` × ${l.pack_size}` : ''}`;
      }
      const unitPrice = it.price ?? it.price_min ?? 0;
      return { name, qty, total: Math.round(unitPrice * l.quantity) };
    })
    .filter(Boolean);
  const rowsTotal = rows.reduce((s, r) => s + r.total, 0);

  function toggleMic() {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    setNote(null);
    setInterim('');
    cancelSpeech();
    const rec = createRecognizer({
      lang,
      onResult: ({ interim: iv, final }) => {
        setInterim(iv);
        if (final) {
          setInterim('');
          handleUtterance(final);
        }
      },
      onError: (code) => {
        setListening(false);
        setNote(code === 'no-speech' ? t('voice.noSpeech') : t('voice.micError'));
      },
      onEnd: () => setListening(false),
    });
    if (!rec) {
      setNote(t('voice.unsupported'));
      return;
    }
    recRef.current = rec;
    rec.start();
    setListening(true);
  }

  return (
    <section className="rounded-xl2 border-2 border-primary/30 bg-primary-tint/40 p-4">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Sparkles size={18} className="text-primary" />
        <h2 className="text-lg font-bold">{t('voice.title')}</h2>
        {ttsAvailable && (
          <button
            onClick={toggleVoice}
            role="switch"
            aria-checked={voiceOn}
            aria-label={`${t('voice.spokenReply')} ${voiceOn ? t('voice.on') : t('voice.off')}`}
            className={`ml-auto flex shrink-0 items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-sm font-bold ${
              voiceOn ? 'border-primary bg-primary text-white' : 'border-sand bg-white text-ink-soft'
            }`}
          >
            {voiceOn ? <Volume2 size={15} /> : <VolumeX size={15} />}
            {t('voice.spokenReply')} · {voiceOn ? t('voice.on') : t('voice.off')}
          </button>
        )}
      </div>
      <p className="mt-1 text-sm text-ink-soft">{t(lang === 'ta' ? 'voice.hintTa' : 'voice.hintEn')}</p>
      {ttsAvailable && voiceOn && noVoiceForLang && (
        <p className="mt-1 text-xs text-ink-soft">{t('voice.noVoiceForLang')}</p>
      )}

      {turns.length > 0 && (
        <div
          ref={logRef}
          className="mt-3 max-h-56 space-y-2 overflow-y-auto overscroll-contain rounded-xl2 border border-sand bg-white/50 p-2"
        >
          {turns.map((turn, i) => (
            <div
              key={i}
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                turn.role === 'user' ? 'ml-auto bg-primary text-white' : 'bg-white text-ink'
              }`}
            >
              {turn.text}
            </div>
          ))}
        </div>
      )}

      {rows.length > 0 && (
        <table className="mt-3 w-full border-collapse overflow-hidden rounded-xl2 bg-white text-sm">
          <thead>
            <tr className="text-left text-xs font-bold uppercase tracking-wide text-ink-soft">
              <th className="px-3 py-2">{t('voice.tblItem')}</th>
              <th className="px-3 py-2">{t('voice.tblQty')}</th>
              <th className="px-3 py-2 text-right">₹</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-sand">
                <td className="px-3 py-2 font-semibold">{r.name}</td>
                <td className="px-3 py-2 tabular-nums">{r.qty}</td>
                <td className="px-3 py-2 text-right tabular-nums">₹{r.total}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-sand font-bold">
              <td className="px-3 py-2" colSpan={2}>
                {t('voice.tblTotal')}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">₹{rowsTotal}</td>
            </tr>
          </tbody>
        </table>
      )}

      {options.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => handleUtterance(opt)}
              className="rounded-full bg-white px-4 py-2 text-base font-bold text-primary shadow-sm active:bg-sand"
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        {supported && (
          <button
            onClick={toggleMic}
            aria-label={listening ? t('voice.stop') : t('voice.speak')}
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white ${
              listening ? 'animate-pulse bg-stop' : 'bg-primary active:bg-primary-dark'
            }`}
          >
            {listening ? <MicOff size={22} /> : <Mic size={22} />}
          </button>
        )}
        <form
          className="flex flex-1 items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            handleUtterance(text);
            setText('');
          }}
        >
          <input
            value={interim || text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('voice.typePlaceholder')}
            className="w-full rounded-full border-2 border-sand bg-white px-4 py-2.5 text-base outline-none focus:border-primary"
            lang={lang}
          />
          <button
            type="submit"
            aria-label={t('voice.send')}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-white active:bg-primary-dark"
          >
            <Send size={18} />
          </button>
        </form>
      </div>

      {listening && <p className="mt-2 text-sm font-semibold text-stop">● {t('voice.listening')}</p>}
      {note && <p className="mt-2 text-sm text-ink-soft">{note}</p>}
      {!supported && <p className="mt-2 text-xs text-ink-soft">{t('voice.unsupported')}</p>}
    </section>
  );
}
