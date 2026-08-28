# Architecture

## Shape of the app

A single React root, no router, no server. Three subsystems meet in
[App.tsx](../src/App.tsx):

```
                    ┌──────────────────────────────────────┐
   getUserMedia ───▶│ useCamera        <video>             │
                    └──────────────┬───────────────────────┘
                                   │ frames
                    ┌──────────────▼───────────────────────┐
                    │ useHandTracking  (requestAnimationFrame)
                    │   HandLandmarker.detectForVideo      │
                    │   countExtendedFingers × 2 hands     │
                    │   GestureDebouncer × 2               │
                    │   rotationAmount (right hand)        │
                    └───┬──────────────────┬───────────────┘
                        │                  │
          imperative ───▼──┐            ───▼── canvas
                    ┌──────────────┐   ┌───────────────┐
       getLevel() ─▶│ SynthEngine  │   │ drawOverlay   │
                    │ PolySynth    │   └───────────────┘
                    │  → Filter    │
                    │  → Delay     │
                    │  → Reverb    │        ~10 Hz
                    │  → Volume ───┼─▶ setLive() ──▶ <Hud/>
                    │      │       │
                    │      └─▶ Meter (analysis only)
                    └──────┬───────┘
                           ▼
                      destination 🔊
```

The overlay's level flows the same way everything else does: the loop calls
`getLevel()` and hands the number to `drawOverlay`, which imports nothing from
`audio/`.

React owns the *lifecycle* (start, stop, settings) but not the *loop*. The loop
talks to the synth directly.

## Module map

| Module | Responsibility |
| --- | --- |
| [App.tsx](../src/App.tsx) | Start/stop lifecycle, wiring settings into the engine, error surfacing |
| [vision/useCamera.ts](../src/vision/useCamera.ts) | Owns the `MediaStream` and `<video>` lifecycle; turns `DOMException`s into readable messages |
| [vision/landmarker.ts](../src/vision/landmarker.ts) | Creates the `HandLandmarker`, WebGL preflight, GPU→CPU delegate fallback |
| [vision/useHandTracking.ts](../src/vision/useHandTracking.ts) | The render loop: detect → count → drive audio → draw → publish |
| [vision/fingerCount.ts](../src/vision/fingerCount.ts) | Pure: landmarks → extended-finger count. Plus `GestureDebouncer` |
| [vision/handRotation.ts](../src/vision/handRotation.ts) | Pure: landmarks → palm tilt, normalized to a 0–1 filter sweep |
| [vision/drawOverlay.ts](../src/vision/drawOverlay.ts) | Pure canvas drawing: skeleton, volume guides, chord bloom, and the level/cutoff→style math |
| [audio/chords.ts](../src/audio/chords.ts) | Pure chord theory: names ⇄ parts ⇄ note names. No audio |
| [audio/voice.ts](../src/audio/voice.ts) | The waveform + ADSR voice as plain data |
| [audio/effects.ts](../src/audio/effects.ts) | Pure: the send target and its wet mix as plain data |
| [audio/SynthEngine.ts](../src/audio/SynthEngine.ts) | Imperative wrapper over the Tone graph |
| [state/settings.ts](../src/state/settings.ts) | Settings shape, defaults, `localStorage` load/save with normalization |
| [components/](../src/components/) | `StartScreen`, `Hud`, `SettingsPanel` — presentational |
| [analytics.ts](../src/analytics.ts) | `track()`, a no-op unless the GA tag actually loaded |
| [support.ts](../src/support.ts) | Tracks clicks on the Buy Me a Coffee widget and repositions its message bubble |

The dependency direction is one-way: `audio/` and `vision/` know nothing about
React or about each other's internals. `useHandTracking` is the only place they
meet.

## The render loop

[useHandTracking.ts](../src/vision/useHandTracking.ts) is the heart of the app.
One `requestAnimationFrame` loop, started when the app goes active and torn down
on stop.

Per frame:

1. **Bail early** if the video has no frame yet (`readyState < 2`), or if
   `video.currentTime` has not advanced. `detectForVideo` requires strictly
   increasing timestamps, so feeding it a repeated frame is both wasteful and
   invalid.
2. **Resize the canvas** to match the video's intrinsic size when it changes.
3. **Detect** — `landmarker.detectForVideo(video, now)` returns up to two hands,
   each with 21 landmarks and a handedness label.
4. **Assign hands** via `isUserLeftHand`, which inverts MediaPipe's label by
   default (see [vision](vision.md#handedness)).
5. **Left hand → chord.** Count fingers, push through the debouncer,
   `engine.setChordSlot(n > 0 ? n - 1 : null)`. If the hand has been missing for
   more than `HAND_GRACE_MS` (300 ms), reset to 0 and release. The grace period
   keeps a momentary tracking dropout from cutting the chord.
6. **Right hand → volume and filter.** The wrist's `y` is mapped through the
   configured volume range; the palm's tilt (`rotationAmount`) is mapped to a 0–1
   filter sweep. Both run through one-pole filters (`VOLUME_SMOOTHING = 0.25`,
   `CUTOFF_SMOOTHING = 0.2`) before reaching the engine, and both simply hold
   when the hand disappears. Fingers on this hand are still counted, but only for
   the HUD — the count drives nothing.
7. **Draw** the overlay, if enabled.
8. **Publish.** Every frame writes to `liveRef`. React state is only updated
   every `HUD_INTERVAL_MS` (100 ms).

### Why the HUD is throttled

A `setState` per frame would put a React render between every detection and the
audio call that follows it. Decoupling them means the loop's cost is bounded by
detection and canvas work; the HUD refreshing at ~10 Hz is imperceptible and
costs one render per ten frames instead of one per frame.

### Why settings live in a ref

```ts
const settingsRef = useRef(settings)
settingsRef.current = settings
```

The effect that owns the loop deliberately excludes `settings` from its
dependencies. If it did not, changing a chord — or dragging a slider — would
tear down and restart the loop, dropping the `MediaStream` frame cadence and
releasing held notes mid-performance. Reading config from a ref means edits take
effect on the very next frame without disturbing anything.

The settings that need to reach the *engine* rather than the loop (chords,
octaves, the voice, the cutoff range) are pushed through `useEffect`s in
`App.tsx`, which call the corresponding `SynthEngine` setters.

## Start and stop lifecycle

`handleStart` in [App.tsx](../src/App.tsx):

```ts
await Tone.start()          // needs the user gesture
await startCamera()         // needs the user gesture
await createHandLandmarker()  // ~7 MB model + WASM runtime
new SynthEngine()
```

Both `Tone.start()` and `getUserMedia` require a user gesture, which is why the
app has an explicit start screen rather than booting on load. Failures are
caught, run through `describeStartError` — MediaPipe rejects with its full C++
source-location trace attached, so only the first line is kept — and shown on
the start card. A failure also fires the `session_start_failed` analytics event
with the message as its reason.

`handleStop` reverses everything: camera tracks stopped, engine disposed,
landmarker closed. An unmount-time cleanup does the same, so a hot reload does
not leak an `AudioContext` or a camera light.

## Design decisions worth knowing

**No CDN in the critical path.** `scripts/fetch-assets.mjs` downloads the model
and copies the MediaPipe WASM runtime into `public/` before dev and before
build, so nothing the instrument needs is fetched from a third party at runtime
and the app works offline once loaded.

The one exception is the Buy Me a Coffee widget, loaded from `cdnjs` by a script
tag at the end of [index.html](../index.html). It is deliberately outside
everything above: it renders its own floating button, it is not awaited, and if
the CDN is blocked the instrument is unaffected — only the support button is
missing. `support.ts` handles it from the React side without assuming it loaded.

**Chord theory is pure and tested; audio is not.** `chords.ts` and
`fingerCount.ts` have no side effects and carry the real test suite.
`SynthEngine` is tested against a fake `tone` module that records
attacks/releases, which is enough to pin the voice-handling rules without
booting an `AudioContext`.

**Relative asset base.** `vite.config.ts` sets `base: './'` so `dist/` can be
served from any static server or subdirectory, not just a domain root.

**Dark-only.** `color-scheme: dark` and a single stylesheet; there is no theme
switch and no CSS framework.
