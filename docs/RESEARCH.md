# Research notes / candidate tech (not adopted)

Things evaluated but deliberately deferred. Nothing here is a dependency yet.

## Needle 2 — Cactus Compute (on-device tiny LLM)

- **Link:** https://cactuscompute.com/needle
- **What:** 45M-param model, ~14 MB binary, ~28 MB session RAM, no GPU/NPU
  needed. Purpose-built for tool-calling / device control / structured
  extraction. Runs on budget phones, microcontrollers, and **WASM in the
  browser**. Fully offline.
- **License:** Apache 2.0 — OK for commercial use in this project.
- **Where it could fit:** the spec §9.4 *optional* "LLM upgrade" layer for
  voice ordering, as an **on-device alternative to Groq**. Benefits: no API
  key, no per-call cost, no network round-trip (helps the "time saved"
  motto), privacy-friendly. Sidesteps §9.4.3's "no GPU on free hosting"
  constraint because inference happens on the client, not the server.
- **Why deferred / open risks:**
  1. **Tamil.** A 45M English-centric tool-calling model is unlikely to
     handle Tamil / code-mixed Tamil well. §9 makes Tamil non-negotiable and
     demands testing with real messy phrasing. Needs a dedicated spike
     (feed it `name_ta` + candidate list, test "aachi chicken masala onnu"
     → size-disambiguation) before any commitment.
  2. It only replaces the "choose item + phrase clarifying question" step.
     Retrieval (shop's real catalog as candidates) and the multi-turn
     pending-clarification state machine are still ours to build.
  3. Brand new (v2); maturity, JS/WASM binding ergonomics, and Tamil eval
     all unverified.
- **Decision:** keep **Groq free tier** as the documented path (spec §12).
  Re-evaluate Needle at **build step 12**, and only after the rule-based
  Tamil+English matcher is built and fully passing its §9.6 tests.

---

## Voice input stack — ASR + matching (spec §9, build step 12)

### The key distinction

A voice order / voice inventory-update is **three stages**, and they use
different tech:

1. **ASR** (speech → text): mic audio → Tamil / English transcript.
2. **Matching** (text → intent): transcript → structured intent against *that
   shop's* catalog, with multi-turn clarification (§9.2, §9.3).
3. **Emit** (intent → standard format): a canonical JSON object.

"Low-cost Indian LLM" only helps stage 2. **Stage 1 (Tamil ASR) is the real
constraint on cheap hardware.**

### Progressive enhancement, never required (decision)

Voice is an **opt-in shortcut**, not a gate. The manual tap-through path is
always primary and complete (spec §9.5 fallback). Rules:

- **Feature-detect, don't device-detect.** Show the mic button only when
  `SpeechRecognition` exists AND the chosen language is supported AND (for the
  network-based engine) we're online. Never sniff "is this a good phone".
- **Graceful mid-use fallback.** If recognition errors or returns nothing,
  drop to the list with any partial transcript preserved — the user is never
  stuck.
- **Same result either way.** Tap or talk both produce the same cart / intent
  state; voice just pre-fills it.
- Some elderly / low-literacy users find voice *easier* than tapping tiny
  rows; others find it stressful. Offering both covers both (spec §2).

### Stage 1 — ASR options

| Option | On-device? | Tamil quality | Cost / infra | Verdict |
|---|---|---|---|---|
| **Web Speech API** (`ta-IN` / `en-IN`) | No — Android Chrome uses Google's server ASR | Strong on Android | Free, zero RAM/ROM, zero infra | **Primary.** Needs network; iOS Safari `ta-IN` unreliable. |
| **Vosk** (`vosk-browser`, WASM) | Yes (~50 MB model, ~200 MB RAM) | Only community Tamil models, uncertain accuracy ([official list has no Tamil](https://github.com/alphacep/vosk-api)) | Free, fully offline | **Offline fallback only**, accept lower accuracy. |
| **AI4Bharat IndicWhisper** (IIT-Madras, MIT/Apache) | No — ≈ Whisper-medium, ~1.5 GB | Best open Tamil ASR | Free model, **server GPU/CPU** to run | **Server-side accuracy upgrade** if we want to cut Google dependence. Not for phones. |
| **Bhashini** (Govt of India API) | No | Good (aggregates Indian ASR) | Free / subsidised API, zero infra | Pluggable ASR provider alongside Web Speech. Network-dependent. |
| Moonshine / whisper-tiny WASM | Yes | No usable Tamil | Free | Not viable for Tamil. |

### Stage 2 — matching / optional LLM

- **Layer 1 (build first, mandatory):** rule-based matcher — fuzzy + token
  overlap over `name` / `name_ta` / `brand`, Tamil+English filler lists,
  `variant_group` disambiguation, pending-clarification state (§9.4.1). Tiny,
  instant, offline, **deterministic** — which is what you want when the output
  must be a reliable standard format.
- **Layer 2 (optional, pluggable, server-side / shop-PC only):**
  | Model | Notes |
  |---|---|
  | **Sarvam-1** (~2B, open weights, Tamil-heavy) — Sarvam AI | Best Tamil quality of the small models; run on a shop PC or Sarvam's cheap hosted API. Needs ~1.5–2 GB RAM — **not a ₹8k phone**. |
  | Groq free tier (generic OSS model) | Spec §12 default; weak Tamil. |
  | Needle 2 (on-device) | See above; Tamil unproven. |
  | Bhashini LLM endpoints | Free API, Indian-language tuned. |
  Any Layer-2 call is **constrained to the shop's real catalog** (the "RAG" of
  §9.4.2), must output the Layer-1 JSON schema, and **falls back to Layer 1 on
  any error** (test with a deliberately bad key, §9.4.2).

### "AI Bharat" — disambiguation

- **AI4Bharat** (IIT-Madras lab): IndicWhisper (ASR), IndicTrans2 (MT),
  IndicBERT (embeddings). Open, MIT/Apache. Server-side use.
- **Sarvam AI** (startup): Sarvam-1 small LLM + speech models. Open weights +
  cheap API. Best Layer-2 candidate.
- **Bhashini** (Govt of India): free/subsidised aggregator API for
  ASR + MT + TTS across Indian languages. Zero infra.
- **BharatGPT** (CoRover.ai): commercial platform, **not open source** — skip.

### The canonical "standard format"

Independent of which ASR / LLM ran, the pipeline always emits one shape, e.g.:

```json
{ "type": "order_draft", "shop_slug": "MRGNKLKI", "lang": "ta",
  "transcript": "aachi chicken masala onnu",
  "lines": [{ "query": "aachi chicken masala", "qty": 1,
              "matched_product_id": "…", "pack_size": null, "needs": "pack_size" }],
  "confidence": 0.82 }
```

For shopkeeper voice inventory-update (Phase 2 — see below) the same envelope
carries `"type": "stock_update"` with `{ product_id, field, value }` lines.

### Recommended architecture (implement at step 12)

**Pluggable ASR provider** (Web Speech default → Vosk offline fallback →
optional Bhashini / IndicWhisper server endpoint) → **rule-based matcher
emitting the canonical JSON** → **optional pluggable Layer-2 LLM** (Sarvam /
Groq / Needle / Bhashini) held to the same schema, falling back to rules.
**Nothing downloads a model to a phone by default.**

### Scope flags

- **Shopper voice ordering** — spec §9, Phase 1, build step 12. Planned.
- **Shopkeeper voice inventory update** — the primary spec **§6 lists this as
  out of Phase 1** ("voice/photo-based inventory input by the shopkeeper").
  Same ASR + a different intent grammar would support it later; treat as a
  deliberate **Phase 2** item unless the owner explicitly overrides. User has
  expressed interest — noted, still deferred.
- **Sources:** [Vosk browser (npm)](https://www.npmjs.com/package/vosk-browser),
  [Vosk API / language list](https://github.com/alphacep/vosk-api),
  [open-source STT overview 2025/26](https://www.assemblyai.com/blog/top-open-source-stt-options-for-voice-applications).
