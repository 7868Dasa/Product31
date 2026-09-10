# Voice ordering on the packaged app — Capacitor speech recognition

Phase 1 uses **`@capacitor-community/speech-recognition`** (MIT) — a thin
wrapper over the OS recognizer: Android `SpeechRecognizer`, iOS
`SFSpeechRecognizer`. No API key, no model to bundle, no server.

The web app keeps the **Web Speech API** path; the text box is the fallback
on every platform (spec §9.5 — never a dead end).

Code:
- `frontend/src/lib/voice/nativeAsr.js` — the native provider.
- `frontend/src/lib/voice/asr.js` — picks `native` inside the wrapper, `web`
  in a browser, `none` → text box. `prepareAsr()` does the capability check +
  one-time permission prompt.
- `frontend/capacitor.config.json` — `appId` is a **placeholder**
  (`in.product31.app`); set the real reverse-DNS id (must match the entity
  that owns the store listings) before the first `cap add`.

The transcript string is the only thing that leaves the recognizer. It flows
straight into the deterministic matcher (`match.js`) — no `eval`, no dynamic
query, no network call Product 31 makes. No audio is recorded or stored.

---

## 1. Bootstrap the native projects (not in the repo yet)

```bash
cd frontend
npm i -D @capacitor/cli@6
npm i @capacitor/android@6 @capacitor/ios@6
npx cap add android
npx cap add ios
npm run build && npx cap sync
```

Pin `@capacitor/cli` to a version whose bundled `tar` is patched
(older CLI trees pull a vulnerable `tar` — check `npm audit` right after
adding it; it is build-time only and never ships to users).

## 2. iOS — `ios/App/App/Info.plist`

Both keys are **required**; App Review rejects the build if either is
missing or vague. Keep them specific and plain.

| Key | Value |
|---|---|
| `NSMicrophoneUsageDescription` | `Product 31 uses the microphone only while you are speaking your order, so you don't have to type it.` |
| `NSSpeechRecognitionUsageDescription` | `Your speech is turned into text so Product 31 can add the items you say to your order. Audio is not recorded or stored.` |

Add Tamil localisations in `ios/App/App/ta.lproj/InfoPlist.strings` with the
same meaning.

`SFSpeechRecognizer` supports Tamil (`ta-IN`) server-side; on-device Tamil is
not guaranteed on older iOS, so voice may need a connection on iPhone. The
text box covers the offline case.

## 3. Android — `android/app/src/main/AndroidManifest.xml`

The plugin merges `RECORD_AUDIO`. Also declare the recognizer service query
(Android 11+ package visibility) so `available()` works:

```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />

<queries>
  <intent>
    <action android:name="android.speech.RecognitionService" />
  </intent>
</queries>
```

Do **not** add `READ_SMS` / `RECEIVE_SMS` for OTP (separate concern) — broad
SMS permissions are a top Play rejection reason; the OTP flow uses the SMS
Retriever API / manual entry.

Android Tamil recognition runs through Google's speech service (present on
any device with the Google app / Play Services — which a Play-Store target
has). On-device Tamil packs exist on newer Android; older devices need a
connection.

## 4. Permission UX (implemented)

- Requested **at point of use** — the first tap on the mic, never on launch.
- One short in-context line is always shown above the control
  (`voice.privacyNote`): *"Your speech is turned into text by your phone's
  voice service (Google on Android, Apple on iPhone). We keep only the text
  of your order."*
- `prepareAsr()` result → UI:
  - `granted` → start listening.
  - `denied` → `voice.micDenied` ("… turn it on in Settings, or just type
    your order.") — the text box stays fully functional.
  - `dismissed` / `prompt` → `voice.micDismissed` (soft, no nagging).
  - `unsupported` → `voice.unsupported`.
- The mic is released as soon as listening stops (`stop()` / `listeningState`
  → cleanup + `removeAllListeners`).

---

## 5. Compliance checklist

### DPDP Act 2023

| Item | Position |
|---|---|
| Lawful basis | The user initiates capture by tapping the mic — voice is an optional convenience; the text box gives the same outcome without it. |
| Purpose limitation | Speech → transcript → order lines. Nothing else. |
| Data minimisation | Only the final transcript is kept. No audio is recorded or stored. Unmatched phrases are logged **locally** (`p31.voice.misses`, cap 200) to grow the synonym list — no PII, device-local until a future opt-in `POST /voice/misses`. |
| Third-party processor disclosure | The OS recognizer sends audio to Google (Android) / Apple (iOS). Named in `Privacy.jsx` → "What we collect → Voice" and in the in-app note. Add Google & Apple to the processor list + DPAs (they publish standard terms). |
| Cross-border transfer | Google/Apple may process outside India — covered by the transfer disclosure already in `Privacy.jsx` → "Sharing". |
| Retention | Transcript lives only as long as the resulting order record (same retention as any order). No separate voice store. |
| Children | App is 18+; unchanged. |
| Withdraw | Not using the mic = not granting it; OS Settings revokes any time; the feature degrades to text with no loss of function. |

### Play Data Safety form

- **Audio → Voice or sound recordings**: *Collected? * → the recognizer
  accesses the mic, but Product 31 does **not** collect or store audio.
  Declare per Google's guidance for ephemeral processing; if "collected" is
  forced, mark **not shared**, purpose *App functionality*, **not** linked to
  identity, deletable (nothing persists).
- Mention voice in the review notes: *"Tap the mic on a shop page and speak
  an item (English or Tamil) to add it to the cart. Mic is used only while
  listening."*

### Apple privacy

- Privacy Nutrition Label: **Audio Data → not collected** (transcript only,
  used for app functionality, not linked to the user, not for tracking).
- `SFSpeechRecognizer` on iOS may fall back to Apple's servers — this is
  Apple's own processing; still disclose it in the privacy notice (done).
- Review notes: same wording as Play.

### Security

- Transcript is untrusted input → consumed only by the rule-based matcher;
  no `eval`/`Function`, no string-built SQL, no shell. ✅
- Plugin is MIT, pinned (`@capacitor/core` + plugin added **0** advisories;
  `@capacitor/cli` is build-time only — audit when added). ✅
- No secrets, no keys, no Product 31 network call in the voice path. ✅
- Mic held only during active listening; listeners removed on stop. ✅
