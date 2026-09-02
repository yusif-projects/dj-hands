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
                    │   FingerLatch × 2 hands              │
                    │   GestureDebouncer × 2               │
                    │   rotationAmount (right hand)        │
                    └───┬──────────────────┬───────────────┘
                        │                  │
          imperative ───▼──┐            ───▼── canvas
                    ┌──────────────┐   ┌───────────────┐
       getLevel() ─▶│ SynthEngine  │   │ drawOverlay   │
                    │ PolySynth    │   └───────────────┘
                    │  → Filter    │
                    │  → Effects   │  (six of them;
                    │    rack ×6   │   the order is
                    │              │   a setting)     ~10 Hz
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

The one arrow the diagram does not show is `onSelectSection`, the loop's only
call *up* into React. It fires on a right-hand gesture transition rather than per
frame, which is what keeps it compatible with the no-`setState`-per-frame rule,
and `App` turns it back into an `engine.setChordSlots` through the ordinary
settings path.

React owns the *lifecycle* (start, stop, settings) but not the *loop*. The loop
talks to the synth directly.

## Module map

| Module | Responsibility |
| --- | --- |
| [App.tsx](../src/App.tsx) | Start/stop lifecycle, wiring settings into the engine, which settings group the rail has open, error surfacing |
| [vision/useCamera.ts](../src/vision/useCamera.ts) | Owns the `MediaStream` and `<video>` lifecycle, enumerates the video inputs and swaps between them; turns `DOMException`s into readable messages |
| [vision/landmarker.ts](../src/vision/landmarker.ts) | Creates the `HandLandmarker`, WebGL preflight, GPU→CPU delegate fallback |
| [vision/useHandTracking.ts](../src/vision/useHandTracking.ts) | The render loop: detect → count → drive audio → draw → publish |
| [vision/fingerCount.ts](../src/vision/fingerCount.ts) | Pure: landmarks → extended-finger count. Plus `FingerLatch` and `GestureDebouncer`, which carry the per-frame state |
| [vision/handRotation.ts](../src/vision/handRotation.ts) | Pure: landmarks → palm tilt, normalized to a 0–1 filter sweep |
| [vision/drawOverlay.ts](../src/vision/drawOverlay.ts) | Pure canvas drawing: skeleton, volume guides, chord bloom, and the level/cutoff→style math |
| [audio/chords.ts](../src/audio/chords.ts) | Pure chord theory: names ⇄ parts ⇄ note names. No audio |
| [audio/voice.ts](../src/audio/voice.ts) | The waveform + ADSR voice as plain data |
| [audio/adsrShape.ts](../src/audio/adsrShape.ts) | Pure: the envelope as a drawable outline in a unit box |
| [audio/sections.ts](../src/audio/sections.ts) | Named banks of chord slots as plain data, plus their labels |
| [audio/effects.ts](../src/audio/effects.ts) | Pure: the effects rack — each effect's wet mix, the chain order, and their fixed character — as plain data |
| [audio/SynthEngine.ts](../src/audio/SynthEngine.ts) | Imperative wrapper over the Tone graph |
| [state/settings.ts](../src/state/settings.ts) | Settings shape, defaults, `localStorage` load/save with normalization |
| [state/panel.ts](../src/state/panel.ts) | Which settings group the rail has open, and its own `localStorage` key |
| [state/camera.ts](../src/state/camera.ts) | The chosen camera's device id, under its own `localStorage` key |
| [state/firstRun.ts](../src/state/firstRun.ts) | Whether the walkthrough has been seen; its own `localStorage` key |
| [state/coachSteps.ts](../src/state/coachSteps.ts) | Pure: the walkthrough's four steps and how each recognises its gesture |
| [components/](../src/components/) | `StartScreen`, `Landing`, `Coach`, `Hud`, `SettingsPanel`, `PanelRail`, `AdsrGraph`, `FilterGraph`, `Knob`, `IconPicker`, `WaveformPicker` — presentational |
| [components/faq.ts](../src/components/faq.ts) | Pure: the landing FAQ, and the `FAQPage` structured data built from the same array |
| [components/icons.tsx](../src/components/icons.tsx) | One line-art glyph per settings group, stroked in `currentColor` |
| [components/knobMath.ts](../src/components/knobMath.ts) | Pure: knob angles, arcs, and drag/key value maths |
| [components/hudMeter.ts](../src/components/hudMeter.ts) | Pure: the HUD fader's segment count, and how a cutoff and a filter type read |
| [components/waveformPath.ts](../src/components/waveformPath.ts) | Pure: one cycle of each oscillator shape as an SVG polyline |
| [components/filterShape.ts](../src/components/filterShape.ts) | Pure: filter response curves and the shared log-frequency axis |
| [components/effectGlyph.ts](../src/components/effectGlyph.ts) | Pure: each effect drawn from the constants the audio graph is built from |
| [components/pickerMath.ts](../src/components/pickerMath.ts) | Pure: the wrapping index arithmetic behind the icon pickers' arrow keys |
| [analytics.ts](../src/analytics.ts) | `track()`, a no-op unless the GA tag actually loaded; `trackSettled()` debounces controls that are dragged |
| [sessionStats.ts](../src/sessionStats.ts) | Counters the render loop accumulates, summarized into one `session_ended` event |
| [support.ts](../src/support.ts) | Tracks clicks on the Buy Me a Coffee widget and repositions its message bubble |
| [prerender.tsx](../src/prerender.tsx) | Build-only: the start screen as static markup for `dist/index.html`. Never imported by the app |

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
5. **Left hand → chord.** Count fingers through that hand's `FingerLatch`, push
   the count through the debouncer,
   `engine.setChordSlot(n > 0 ? n - 1 : null)`. If the hand has been missing for
   more than `HAND_GRACE_MS` (300 ms), reset both the debouncer and the latch and
   release. The grace period keeps a momentary tracking dropout from cutting the
   chord; resetting the latch keeps a hand that left the frame open from coming
   back still latched extended (see [vision](vision.md#hysteresis)).
6. **Right hand → volume and filter.** The wrist's `y` is mapped through the
   configured volume range; the palm's tilt (`rotationAmount`) is mapped to a 0–1
   filter sweep. Both run through one-pole filters (`VOLUME_SMOOTHING = 0.25`,
   `CUTOFF_SMOOTHING = 0.2`) before reaching the engine, and both simply hold
   when the hand disappears.
7. **Right hand → song section.** The finger count on this hand goes through its
   own debouncer, and only a *transition* calls `onSelectSection(n - 1)` — so a
   hand held steady while it shapes volume does not re-select what is already
   live. A fist selects nothing. This is the one place the loop calls back into
   React rather than into the engine, which is affordable precisely because it
   fires on a transition and not per frame: `App` refuses a section that is
   turned off, and an accepted one flows back through `setChordSlots`.
8. **Draw** the overlay, if enabled.
9. **Publish.** Every frame writes to `liveRef`. React state is only updated
   every `HUD_INTERVAL_MS` (100 ms).
10. **Count.** Frames drawn, frames with a hand in them, and the running fps go
    into `statsRef` ([sessionStats.ts](../src/sessionStats.ts)), alongside the
    chord strikes and section switches counted at steps 5 and 7 and the extremes
    of the two sweeps at step 6. These are plain writes to a ref — the loop never
    calls `track()`, because a chord change is worth an event and sixty a second
    is not. `App` turns the totals into one `session_ended` when the session ends
    (see [deployment](deployment.md#session_ended)).

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
await Tone.start()                    // needs the user gesture
Tone.getContext().lookAhead = 0       // see below
await startCamera()                   // needs the user gesture
await createHandLandmarker()          // ~7 MB model + WASM runtime
new SynthEngine()
```

Both `Tone.start()` and `getUserMedia` require a user gesture, which is why the
app has an explicit start screen rather than booting on load.

`lookAhead` is zeroed because an un-timed trigger otherwise resolves to
`currentTime + lookAhead`, and Tone defaults that to 100 ms. That headroom exists
to keep sequenced material from scheduling late; nothing here is sequenced —
every chord is struck the moment a hand moves — so it is a flat 100 ms between
gesture and sound. Tone floors the ticker's own interval at 10 ms when this is
zero, so the clock still runs. Failures are
caught, run through `describeStartError` — MediaPipe rejects with its full C++
source-location trace attached, so only the first line is kept — and shown on
the start card. A failure also fires the `session_start_failed` analytics event
with the message as its reason.

`handleStop` reverses everything: camera tracks stopped, engine disposed,
landmarker closed. It calls `endSession` first, before clearing `started` —
that clear unmounts the render loop, and the session summary is read from the
loop's `statsRef` on the way out.

`endSession` is shared with a `pagehide` listener, because most sessions end by
closing the tab rather than by pressing Stop; a flag guards against a session
that does both being counted twice. `pagehide` rather than `unload`, since it
still fires when the page goes into the back/forward cache. A second cleanup disposes the engine and closes the
landmarker for the case where the tree goes away without Stop being pressed —
a hot reload — so a dev session does not leak an `AudioContext` per reload.

That cleanup is deliberately keyed on `[]` and reads both handles from refs
rather than from state. Keyed on the handles themselves it would also fire the
moment Stop clears them, tearing the same session down twice, and MediaPipe's
second `close()` traps inside its WASM graph — a throw in React's commit
phase, which takes the whole tree down with it.

### The first-run branch

The start screen is a pitch, not a manual: it says what the instrument is and how
deep it goes, and the gestures are taught by `Coach` once the camera is on, where
a prompt can check itself against the player's actual hands. Everyone sees the
same start screen — the only first-run state is `coach-done` in
[state/firstRun.ts](../src/state/firstRun.ts).

Until that flag is set, `Coach` renders over the stage and the settings panel
starts closed (`loadCoachDone() ? loadPanelGroup() : null`), which also keeps the
mobile bottom sheet from covering the coach card.

The start screen's figures are counted from `CHORDS`, `SECTION_COUNT`,
`DEFAULT_CHORD_SLOTS` and `WAVEFORMS` rather than written out, so adding a chord
quality or a waveform updates the pitch instead of quietly making it wrong. The
chord figure is then rounded down to the ten below and marked `+` — the exact
count is a headline only by accident — which keeps it honest as the real number
grows.

`Coach` reads the same `live` state the HUD does, so it costs no extra tracking
work — the predicates in [state/coachSteps.ts](../src/state/coachSteps.ts) are
pure functions of `LiveState`, and only the 400 ms hold that debounces a gesture
passed through on the way to another lives in the component.

The step order is a constraint, not a narrative: `SynthEngine` builds its
`Tone.Volume` at `MIN_DB` and `useHandTracking` only calls `setVolume` while the
right hand is in frame, so **the instrument is near silent until the right hand
appears**. The walkthrough therefore asks for the right hand before it asks for a
chord, or the first chord anyone plays would be inaudible.

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

**The start screen is prerendered, then thrown away.** A client-only React app
serves an empty `<div id="root">`, which left search engines nothing to read
about the site but its title tag. `scripts/prerender.mjs` runs `StartScreen` and
`Landing` through `renderToStaticMarkup` after every build and writes the result
into `dist/index.html`.

`main.tsx` still calls `createRoot`, not `hydrateRoot`, and that is deliberate:
`createRoot().render()` clears the container's existing children, so the
prerendered markup is replaced rather than adopted. Hydration would be wrong
here — [prerender.tsx](../src/prerender.tsx) renders only the branch of `App`
before Start is pressed, and the trees diverge as soon as a session begins. The
cost is one discarded paint of markup identical to what replaces it; the CSS is
already in a `<link>`, so it paints styled and correct.

The constraint this creates: everything reachable from `StartScreen` must run in
Node. It is the second reason — alongside testability — that `chords.ts`,
`sections.ts`, `voice.ts` and `filter.ts` keep the `tone` import confined to
`SynthEngine.ts`. Full detail in
[deployment](deployment.md#prerendering).

**Dark-only.** `color-scheme: dark` and a single stylesheet; there is no theme
switch and no CSS framework.
