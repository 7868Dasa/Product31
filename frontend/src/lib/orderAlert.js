/**
 * Lightweight "a new order came in" alert for the shopkeeper dashboard.
 * No FCM, no service worker, no asset — a WebAudio blip + the Notification
 * API + a tab-title badge. Works while the dashboard tab is open (which is
 * where a shopkeeper lives during business hours).
 */

let audioCtx = null;

/** Two short rising blips. Safe to call with no user gesture after the first. */
export function beep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audioCtx = audioCtx || new Ctx();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;
    [880, 1175].forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.25, now + i * 0.18 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.18 + 0.16);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(now + i * 0.18);
      osc.stop(now + i * 0.18 + 0.18);
    });
  } catch {
    /* audio not available — the title badge still updates */
  }
}

export function notificationsSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function notificationsGranted() {
  return notificationsSupported() && Notification.permission === 'granted';
}

/** Must be called from a user gesture (a button click). */
export async function askNotificationPermission() {
  if (!notificationsSupported()) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

export function notify(title, body) {
  try {
    if (notificationsGranted()) {
      const n = new Notification(title, { body, tag: 'p31-order', renotify: true });
      n.onclick = () => {
        window.focus();
        n.close();
      };
    }
  } catch {
    /* ignore */
  }
}

/** Set / clear the "(2) …" prefix on the tab title. */
export function setTitleBadge(count) {
  try {
    const base = document.title.replace(/^\(\d+\)\s*/, '');
    document.title = count > 0 ? `(${count}) ${base}` : base;
  } catch {
    /* ignore */
  }
}
