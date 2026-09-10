import { describe, it, expect } from 'vitest';
import { asrKind, asrSupported, prepareAsr, createRecognizer, bcp47 } from '../src/lib/voice/asr.js';
import {
  isNativeAsrPlatform,
  nativeAsrAvailable,
  ensureSpeechPermission,
} from '../src/lib/voice/nativeAsr.js';

// In vitest/jsdom there is no native Capacitor bridge and no window.SpeechRecognition,
// so the selector must resolve to the text-box path without touching the plugin.
describe('ASR selector on web (Capacitor present but not native)', () => {
  it('is not a native platform', () => {
    expect(isNativeAsrPlatform()).toBe(false);
  });

  it('asrKind() is "web" or "none", never "native"', () => {
    expect(['web', 'none']).toContain(asrKind());
  });

  it('asrSupported() matches asrKind()', () => {
    expect(asrSupported()).toBe(asrKind() !== 'none');
  });

  it('prepareAsr() resolves (no throw) with the documented shape', async () => {
    const r = await prepareAsr();
    expect(r).toHaveProperty('ok');
    if (!r.ok) expect(['unsupported', 'denied', 'dismissed']).toContain(r.reason);
  });

  it('createRecognizer() returns the web recognizer or null — never throws', () => {
    const rec = createRecognizer({ lang: 'ta', onResult() {}, onError() {}, onEnd() {} });
    expect(rec === null || typeof rec.start === 'function').toBe(true);
  });

  it('bcp47 maps ta -> ta-IN, else en-IN', () => {
    expect(bcp47('ta')).toBe('ta-IN');
    expect(bcp47('en')).toBe('en-IN');
  });
});

describe('native provider is inert off-device', () => {
  it('nativeAsrAvailable() resolves false without loading the plugin', async () => {
    await expect(nativeAsrAvailable()).resolves.toBe(false);
  });

  it('ensureSpeechPermission() resolves "denied" off-device', async () => {
    await expect(ensureSpeechPermission()).resolves.toBe('denied');
  });
});
