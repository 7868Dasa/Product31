/**
 * Stage 3 — spoken replies via Web Speech `SpeechSynthesis`. Free, built into
 * the browser, no key, no download (same story as recognition).
 *
 * Text is ALWAYS shown too (spec §9.5 — never audio-only). Speaking is
 * opt-in / mutable in the UI. For Tamil we only speak if a Tamil voice is
 * actually installed — an English voice reading Tamil is worse than silence.
 */
const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;

export function ttsSupported() {
  return Boolean(synth);
}

/** Voices load async on some browsers; call once on mount to prime the list. */
export function primeVoices() {
  if (!synth) return;
  synth.getVoices();
  // Chrome fires this once voices are ready.
  synth.addEventListener?.('voiceschanged', () => synth.getVoices(), { once: true });
}

function voiceForLang(lang) {
  if (!synth) return null;
  const want = lang === 'ta' ? 'ta' : 'en';
  const voices = synth.getVoices();
  return (
    voices.find((v) => v.lang?.toLowerCase().startsWith(`${want}-`)) ||
    voices.find((v) => v.lang?.toLowerCase().startsWith(want)) ||
    null
  );
}

/** True if we can speak in this language on this device. */
export function canSpeak(lang) {
  if (!synth) return false;
  if (lang === 'ta') return Boolean(voiceForLang('ta')); // don't fake Tamil in an English voice
  return true;
}

export function speak(text, lang) {
  if (!synth || !text || !canSpeak(lang)) return false;
  try {
    synth.cancel(); // stop anything mid-utterance, avoid pile-up
    const u = new SpeechSynthesisUtterance(String(text));
    const v = voiceForLang(lang);
    if (v) u.voice = v;
    u.lang = lang === 'ta' ? 'ta-IN' : 'en-IN';
    u.rate = 0.98;
    u.pitch = 1;
    synth.speak(u);
    return true;
  } catch {
    return false;
  }
}

export function cancelSpeech() {
  try {
    synth?.cancel();
  } catch {
    /* ignore */
  }
}
