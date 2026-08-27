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
| [chords.test.ts](../src/__tests__/chords.test.ts) | Interval spelling, octave rollover at B→C, parser edge cases (`C#` vs `C`, `m7b5` vs `m7`), round-tripping all 180 names |
| [fingerCount.test.ts](../src/__tests__/fingerCount.test.ts) | Counting on synthetic hands, including rotated ones; thumb abduction; `GestureDebouncer` streak behaviour |
| [SynthEngine.test.ts](../src/__tests__/SynthEngine.test.ts) | Voice diffing — common tones keep ringing, only changed notes are attacked; slot/preset/octave transitions |

`SynthEngine.test.ts` mocks the whole `tone` module with stub nodes that record
attacks and releases into an array, then asserts on which notes are sounding.
This is what makes the engine testable at all: no audio hardware, no timing, and
the assertions are about the rule that actually matters (never retrigger a
sounding note).

`fingerCount.test.ts` builds synthetic 21-point hands from a helper, so a test
reads as `makeHand([true, true, false, false, false])` rather than a wall of
coordinates. Rotation invariance is tested by rotating the same synthetic hand
and asserting the count is unchanged.

**What to add a test for:** anything in `audio/chords.ts`, `vision/fingerCount.ts`,
or the voice-handling rules in `SynthEngine`. A regression in any of these is
inaudible until someone plays the exact chord that breaks.

**What not to bother with:** React components here are presentational, and the
loop's value is in its timing, which a unit test cannot capture. Test those by
running the app.

## Conventions

**Purity boundaries are load-bearing.** `audio/chords.ts`, `vision/fingerCount.ts`,
and `vision/drawOverlay.ts` have no side effects and no React. `audio/` and
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
almost all about a non-obvious constraint — MediaPipe's mirrored handedness
assumption, Tone's voice recycling, the strictly-increasing timestamp
requirement, Chrome's WebGL blocklisting. Match that: if a line looks
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
[chords.ts](../src/audio/chords.ts). Nothing else changes — `CHORDS`, the
picker, and validation are all derived from it. Watch the suffix collision rule:
qualities are matched longest-first, so a new id that is a prefix of an existing
one is fine, but one that *contains* an existing id needs to be longer than it.

**A new preset:** the count is currently fixed at five by the 1–5 finger mapping.
Editing `PRESETS` changes the voices; adding a sixth entry would need the
gesture range and the settings UI to change with it.

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
independent take on it: assignable chord slots, per-preset oscillators, and a
rotation-invariant finger counter.
