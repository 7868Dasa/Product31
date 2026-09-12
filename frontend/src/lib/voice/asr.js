/**
 * ASR selector (spec §9.5). Two providers behind one shape
 * ({ supported, start(), stop(), abort() } + onResult/onError/onEnd):
 *
 *   - web:    Web Speech API (this file). Free, no key, no server round trip.
 *             Present in Chrome / Android Chrome; absent in the packaged
 *             app's WebView and in Safari.
 *   - native: the OS speech recognizer via Capacitor (./nativeAsr.js) —
 *             used only when running inside the Android / iOS wrapper.
 *
 * When neither is available the UI shows a text box instead — never a dead
 * end. Any server ASR plugs in behind the same shape.
 */
import {
  isNativeAsrPlatform,
  nativeAsrAvailable,
  ensureSpeechPermission,
  createNativeRecognizer,
  bcp47,
} from './nativeAsr.js';

export { bcp47 };

const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

/** 'native' | 'web' | 'none' — which provider this device will use. */
export function asrKind() {
  if (isNativeAsrPlatform()) return 'native';
  return SR ? 'web' : 'none';
}

/**
 * True if a mic button should be offered. On native we assume yes and verify
 * lazily in prepareAsr() (both OSes ship a recognizer); tapping it can still
 * fail gracefully to the text box.
 */
export function asrSupported() {
  return asrKind() !== 'none';
}

/**
 * Call on the first mic tap. Resolves the async setup the web path doesn't
 * need: capability check + one-time permission prompt on native.
 * @returns {Promise<{ ok: boolean, reason?: 'unsupported'|'denied'|'dismissed' }>}
 */
export async function prepareAsr() {
  if (!isNativeAsrPlatform()) {
    return SR ? { ok: true } : { ok: false, reason: 'unsupported' };
  }
  if (!(await nativeAsrAvailable())) return { ok: false, reason: 'unsupported' };
  const perm = await ensureSpeechPermission();
  if (perm === 'granted') return { ok: true };
  return { ok: false, reason: perm === 'denied' ? 'denied' : 'dismissed' };
}

/**
 * @param {{ lang: 'ta'|'en', onResult: ({interim,final})=>void,
 *           onError: (code)=>void, onEnd: ()=>void }} opts
 * @returns {{ supported: boolean, start, stop, abort } | null}
 */
export function createRecognizer(opts) {
  if (isNativeAsrPlatform()) return createNativeRecognizer(opts);
  return createWebRecognizer(opts);
}

// ── Web Speech API provider ───────────────────────────────────────────
export function createWebRecognizer({ lang, onResult, onError, onEnd }) {
  if (!SR) return null;
  const rec = new SR();
  rec.lang = bcp47(lang);
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  rec.continuous = false;

  rec.onresult = (e) => {
    let interim = '';
    let final = '';
    for (let i = e.resultIndex; i < e.results.length; i += 1) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) final += t;
      else interim += t;
    }
    onResult({ interim, final });
  };
  rec.onerror = (e) => onError?.(e.error || 'error');
  rec.onend = () => onEnd?.();

  return {
    supported: true,
    start: () => {
      try {
        rec.start();
      } catch {
        /* already started */
      }
    },
    stop: () => {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    },
    abort: () => {
      try {
        rec.abort();
      } catch {
        /* ignore */
      }
    },
  };
}
