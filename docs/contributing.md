# Contributing

## Before you push

```bash
npm run lint       # oxlint
npm run typecheck  # tsc -b --noEmit
npm test           # vitest, single run
npm run build      # the real gate — typecheck + bundle
```

CI runs `npm ci && npm run build` on every push to `main`, which deploys. There
is no separate test job, so run the suite locally.

## Testing strategy

Tests cover the **pure logic** — the parts where a bug is silent and a test is
cheap. There are no DOM tests, no camera mocking, and no `AudioContext`.

| Suite | Covers |
| --- | --- |
| [chords.test.ts](../src/__tests__/chords.test.ts) | Interval spelling, octave rollover at B→C, inversion rotation and clamping, slash-bass placement below the chord, parser edge cases (`C#` vs `C`, `m7b5` vs `m7`), round-tripping all 252 names, and flat respelling of roots and slash basses leaving the quality suffix and the stored name alone |
| [sections.test.ts](../src/__tests__/sections.test.ts) | `DEFAULT_SECTIONS` length and enabled flags, every section owning its own slot objects rather than sharing them, `sectionLabel` falling back to the number, `firstEnabled` |
| [fingerCount.test.ts](../src/__tests__/fingerCount.test.ts) | Counting on synthetic hands, including rotated ones; thumb abduction; `GestureDebouncer` streak behaviour |
| [handRotation.test.ts](../src/__tests__/handRotation.test.ts) | Palm tilt sign and mirroring, the 0–1 sweep, clamping past the range, unmeasurable hands |
| [SynthEngine.test.ts](../src/__tests__/SynthEngine.test.ts) | Voice diffing — common tones keep ringing, only changed notes are attacked; slot/octave transitions; waveform vs. envelope edits; the `cutoffHz` curve; the `levelFromDb` window and its `-Infinity` floor; the meter tap being read and disposed; the send reaching the right effect's `wet` |
| [effects.test.ts](../src/__tests__/effects.test.ts) | `sendWet` routing — an unassigned effect stays at 0 — amount clamping, and `isSendTarget` rejecting a stale stored value |
| [adsrShape.test.ts](../src/__tests__/adsrShape.test.ts) | The envelope filling the unit box exactly whatever the times are, the peak and the floor, the sustain plateau staying flat at the sustain level and collapsing to the baseline at zero, a stage widening with its seconds, and the shortest stage staying visible beside the longest |
| [waveformPath.test.ts](../src/__tests__/waveformPath.test.ts) | Every shape drawn inside its box and out to both edges, the padding holding on both axes, the sine's sample count and its monotonic x, square and sawtooth keeping a vertical edge where triangle has none, and cycles joining without a doubled point |
| [knobMath.test.ts](../src/__tests__/knobMath.test.ts) | The 270° sweep hitting both bounds and pointing up at the midpoint, drag direction and distance, clamping instead of wrapping past either end, step quantisation leaving no float drift on a grid offset from zero, and the arc path's large-arc flag |
| [drawOverlay.test.ts](../src/__tests__/drawOverlay.test.ts) | `handColor` reducing to the flat hand colour at `cutoff: 1, level: 0`, and clamping out-of-range inputs; the asymmetric `followLevel` follower rising faster than it falls and never overshooting; `bloomProgress` expiring rather than clamping |
| [settings.test.ts](../src/__tests__/settings.test.ts) | Load/save round-tripping, the section and slot arrays being pinned to length, section 1 forced on, `activeSection` falling back off a disabled section, `accidental` falling back to sharps on an unknown value, and the v3 → v4 migration — chords carried over, the old key consumed once, a v4 blob short-circuiting it |

`SynthEngine.test.ts` mocks the whole `tone` module with stub nodes that record
attacks and releases into an array, then asserts on which notes are sounding.
This is what makes the engine testable at all: no audio hardware, no timing, and
the assertions are about the rule that actually matters (never retrigger a
sounding note).

`fingerCount.test.ts` builds synthetic 21-point hands from a helper, so a test
reads as `makeHand([true, true, false, false, false])` rather than a wall of
coordinates. Rotation invariance is tested by rotating the same synthetic hand
and asserting the count is unchanged.

`settings.test.ts` is the one suite that needs a browser API. Tests run in node,
so it installs a `Map`-backed `localStorage` on `globalThis` in a `beforeEach`
and drives the real `loadSettings`. Going through the public function rather than
exporting the normalizers keeps the migration and the normalizers tested as one
path, which is how they actually run.

**What to add a test for:** anything in `audio/chords.ts`, `audio/sections.ts`,
`audio/effects.ts`, `vision/fingerCount.ts`, the pure style math in
`vision/drawOverlay.ts`, the normalizers in `state/settings.ts`, or the
voice-handling rules in `SynthEngine`. A regression in any of these is
inaudible until someone plays the exact chord that breaks.

**What not to bother with:** React components here are presentational, and the
loop's value is in its timing, which a unit test cannot capture. Test those by
running the app.

## Conventions

**Purity boundaries are load-bearing.** `audio/chords.ts`, `audio/sections.ts`,
`audio/effects.ts`, `vision/fingerCount.ts`, and `vision/drawOverlay.ts` have no
side effects and no React. `audio/` and
`vision/` do not import from each other; they meet only in `useHandTracking`.
Keep it that way — it is why the test suite is small and fast.

**Never make the render loop depend on settings.** The loop effect in
`useHandTracking` deliberately excludes `settings` from its dependency array and
reads through `settingsRef`. Adding `settings` back would restart the loop on
every slider drag, dropping frames and releasing held notes. If you add a
setting the loop needs, read it from `settingsRef.current` inside the loop; if
the *engine* needs it, push it through a `useEffect` in `App.tsx` that calls a
setter.

**Do not `setState` per frame.** The HUD is published every `HUD_INTERVAL_MS`
(100 ms) from a mutable ref. Per-frame state would put a React render between
detection and audio.

**Comments explain why, not what.** The existing comments in this codebase are
almost all about a non-obvious constraint — the mirrored display flipping the
sign of the rotation reading, Tone's voice recycling, the strictly-increasing
timestamp requirement, Chrome's WebGL blocklisting. Match that: if a line looks
gratuitously complicated, say what would break if it were simpler.

**TypeScript settings that will bite you:** `verbatimModuleSyntax` means
type-only imports must be written `import type`, and `erasableSyntaxOnly` means
no enums and no constructor parameter properties. `noUnusedLocals` and
`noUnusedParameters` fail the build, not just the lint.

**Constants at the top of the module**, named and commented, rather than magic
numbers inline — `HAND_GRACE_MS`, `VOLUME_SMOOTHING`, `EXTENDED_RATIO`,
`MIN_DB`. Tuning happens by editing one named value.

## Adding things

**A new chord quality:** add an entry to `QUALITIES` in
[chords.ts](../src/audio/chords.ts), in note-count order — the array is the
picker order, sorted by `intervals.length`. Nothing else changes — `CHORDS`, the
picker, and validation are all derived from it — including its inversion range,
which comes from `intervals.length` via `maxInversion`. Two things to watch. The
suffix collision rule: qualities are matched longest-first, so a new id that is a
prefix of an existing one is fine, but one that *contains* an existing id needs
to be longer than it. And `INVERSION_LABELS` is indexed by inversion, so a
quality with more notes than any existing one needs a label appended or the
picker will silently drop its top inversion.

**A new waveform:** add it to `WAVEFORMS` in
[voice.ts](../src/audio/voice.ts), and check Tone's `Synth` accepts the name as
an oscillator type. The picker draws one button per entry and the load-time
validation is derived from the same array, so the only other thing it needs is
one cycle of its shape in `CYCLES` in
[waveformPath.ts](../src/components/waveformPath.ts). Give that cycle the same
level at both ends — the drawing strings cycles together end to end, and one
that starts and finishes at different heights leaves a diagonal at the seam.
Past four buttons the strip's four columns want revisiting too.

**A new effect on the send:** add its id to `SEND_TARGETS` in
[effects.ts](../src/audio/effects.ts) — the dropdown, the type guard, and the
load-time validation all derive from that array. Then build the node in
`SynthEngine`'s constructor, insert it into the chain, ramp its `wet` in
`applySend`, and dispose it. `sendWet` needs a case for it, and so does the
`tone` mock in `SynthEngine.test.ts`, which is a whitelist: a node it does not
stub is a missing constructor at test time.

**A new setting:** add the field to `Settings` and `DEFAULT_SETTINGS`, add a
control to `SettingsPanel`, and — if it needs validation on load — a normalizer
in `loadSettings`. The shallow merge means existing stored blobs pick up the
default automatically; no `STORAGE_KEY` bump is needed unless you changed the
*meaning* of an existing field. See
[configuration](configuration.md#changing-the-schema).

## Repository conventions

Work on `main` deploys immediately. Branch for anything you are not ready to
publish. Commit messages in this repo are short, imperative, and describe the
user-visible change ("Fall back to CPU inference when the GPU delegate fails").

## Credits

Built by **Yusif Aliyev** —
[LinkedIn](https://www.linkedin.com/in/yusif-programmer/) ·
[Joe in the Studio](https://www.joeinthestudio.com).

Inspired by [gesture-synth](https://gesture-synth-weld.vercel.app) — respect to
the original for the idea of turning a webcam into an instrument. DJ Hands is an
independent take on it: chord slots with inversion and slash bass, an editable
ADSR voice, a rotation-swept filter, and a rotation-invariant finger counter.
