/**
 * Native ASR provider — Capacitor wrapper around the OS speech recognizer
 * (`@capacitor-community/speech-recognition`: Android `SpeechRecognizer`,
 * iOS `SFSpeechRecognizer`). Used only in the packaged app; on the web the
 * Web Speech path in ./asr.js is used instead.
 *
 * Same shape as ./asr.js so ./asr.js can pick between them:
 *   { supported, start(), stop(), abort() } with onResult / onError / onEnd.
 *
 * Privacy / compliance (see docs/mobile/CAPACITOR_VOICE.md):
 *  - the mic is requested at point of use (first tap), never on launch, and
 *    only held while actively listening;
 *  - audio is processed by the OS recognizer (Google on Android, Apple on
 *    iOS) — a third-party processor disclosed in the privacy notice;
 *  - we keep only the resulting transcript string; no audio is recorded,
 *    stored, or sent anywhere by Product 31.
 */
import { Capacitor } from '@capacitor/core';

export function isNativeAsrPlatform() {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/** BCP-47 tag for the OS recognizer. */
export function bcp47(lang) {
  return lang === 'ta' ? 'ta-IN' : 'en-IN';
}

// The plugin is loaded lazily so it never enters the web bundle.
async function plugin() {
  const mod = await import('@capacitor-community/speech-recognition');
  return mod.SpeechRecognition;
}

/** @returns {Promise<boolean>} whether the device has a usable recognizer. */
export async function nativeAsrAvailable() {
  if (!isNativeAsrPlatform()) return false;
  try {
    const SR = await plugin();
    const res = await SR.available();
    return Boolean(res?.available);
  } catch {
    return false;
  }
}

/**
 * Ensure the speech / mic permission, prompting once if needed.
 * @returns {Promise<'granted'|'denied'|'prompt'>}
 */
export async function ensureSpeechPermission() {
  if (!isNativeAsrPlatform()) return 'denied';
  try {
    const SR = await plugin();
    const cur = await SR.checkPermissions();
    if (cur?.speechRecognition === 'granted') return 'granted';
    const req = await SR.requestPermissions();
    return req?.speechRecognition || 'denied';
  } catch {
    return 'denied';
  }
}

/**
 * @param {{ lang:'ta'|'en', onResult:({interim,final})=>void,
 *           onError:(code)=>void, onEnd:()=>void }} opts
 */
export function createNativeRecognizer({ lang, onResult, onError, onEnd }) {
  let stopped = false;
  let lastText = '';
  let handles = [];

  const cleanup = async () => {
    try {
      const SR = await plugin();
      for (const h of handles) {
        try {
          (await h)?.remove?.();
        } catch {
          /* ignore */
        }
      }
      handles = [];
      await SR.removeAllListeners?.();
    } catch {
      /* ignore */
    }
  };

  const finish = async () => {
    if (stopped) return;
    stopped = true;
    if (lastText) onResult?.({ interim: '', final: lastText });
    await cleanup();
    onEnd?.();
  };

  return {
    supported: true,

    start: async () => {
      stopped = false;
      lastText = '';
      try {
        const SR = await plugin();

        handles.push(
          SR.addListener('partialResults', (data) => {
            const m = (data?.matches || [])[0] || '';
            if (m) {
              lastText = m;
              onResult?.({ interim: m, final: '' });
            }
          }),
        );
        handles.push(
          SR.addListener('listeningState', (data) => {
            if (data?.status === 'stopped') finish();
          }),
        );

        const res = await SR.start({
          language: bcp47(lang),
          partialResults: true,
          popup: false,
          maxResults: 1,
        });
        // iOS resolves start() with the final matches once recognition ends.
        // Android resolves this promise immediately (before the user has
        // finished speaking) when partialResults is on — completion there is
        // signalled only by the 'listeningState' -> 'stopped' event above.
        // Finishing here unconditionally would tear the listeners down
        // before any Android speech is ever captured.
        if (Capacitor.getPlatform() === 'ios') {
          const m = (res?.matches || [])[0] || '';
          if (m) lastText = m;
          finish();
        }
      } catch (e) {
        stopped = true;
        await cleanup();
        onError?.(e?.message === 'Missing permission' ? 'not-allowed' : 'mic-error');
        onEnd?.();
      }
    },

    stop: async () => {
      try {
        const SR = await plugin();
        await SR.stop();
      } catch {
        /* ignore */
      }
      finish();
    },

    abort: async () => {
      stopped = true;
      try {
        const SR = await plugin();
        await SR.stop();
      } catch {
        /* ignore */
      }
      await cleanup();
    },
  };
}
