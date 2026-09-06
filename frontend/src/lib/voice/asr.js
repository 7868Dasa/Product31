/**
 * Stage 1 ASR — Web Speech API provider (spec §9.5). Free, no server round
 * trip, no API key. Capability-detected: if unsupported, the UI shows a text
 * box instead (never a dead end).
 *
 * Vosk offline fallback and any server ASR plug in behind the same shape:
 *   { supported, start(), stop(), abort() } with onResult/onError/onEnd.
 */
const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

export function asrSupported() {
  return Boolean(SR);
}

export function bcp47(lang) {
  return lang === 'ta' ? 'ta-IN' : 'en-IN';
}

/**
 * @param {{ lang: 'ta'|'en', onResult: ({interim,final})=>void,
 *           onError: (code)=>void, onEnd: ()=>void }} opts
 * @returns {{ supported: boolean, start: ()=>void, stop: ()=>void, abort: ()=>void } | null}
 */
export function createRecognizer({ lang, onResult, onError, onEnd }) {
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
