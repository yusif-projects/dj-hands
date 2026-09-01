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
| [chords.test.ts](../src/__tests__/chords.test.ts) | Interval spelling, octave rollover at B→C, inversion rotation and clamping, slash-bass placement below the chord, parser edge cases (`C#` vs `C`, `m7b5` vs `m7`, `mmaj7` vs `maj7`), round-tripping all 480 names, `QUALITY_GROUPS` flattening to exactly `QUALITIES` with each label matching its own suffix, flat respelling of roots and slash basses leaving the quality suffix — sharp ones like `maj7#11` included — and the stored name alone, `formatQuality` engraving a suffix's own accidental so no formatted name shows a `#` or a `b`, and `formatSlotNotes` dropping octave digits while keeping the voiced order and the doubled note a slash bass adds |
| [sections.test.ts](../src/__tests__/sections.test.ts) | `DEFAULT_SECTIONS` length and enabled flags, every section owning its own slot objects rather than sharing them, `sectionLabel` falling back to the number, `firstEnabled` |
| [fingerCount.test.ts](../src/__tests__/fingerCount.test.ts) | Counting on synthetic hands, including rotated ones; thumb abduction; hysteresis — the same landmarks reading differently depending on the last frame, and a finger held through a dip below the stateless threshold; `FingerLatch` riding out chatter the stateless count flips on, committing once the enter edge is cleared, and `reset` dropping state that would otherwise hold a finger extended; `GestureDebouncer` streak behaviour |
| [handRotation.test.ts](../src/__tests__/handRotation.test.ts) | Palm tilt sign and mirroring, the 0–1 sweep, clamping past the range, unmeasurable hands |
| [SynthEngine.test.ts](../src/__tests__/SynthEngine.test.ts) | Voice diffing — common tones keep ringing, only changed notes are attacked; slot/octave transitions; waveform vs. envelope edits; the `cutoffHz` curve; the `levelFromDb` window and its `-Infinity` floor; the meter tap being read and disposed; the filter type switching without disturbing the sweep; and the effects rack — the default chain wired in order, the chorus LFO started, each effect holding its own amount, and a reorder rewiring without leaving a node feeding the chain it was moved out of |
| [effects.test.ts](../src/__tests__/effects.test.ts) | `moveEffect` carrying amounts with the entry and leaving the chain alone when a move runs off either end, `normalizeEffects` returning every id exactly once whatever it was handed — duplicates, junk, missing entries — amount clamping, and `isEffectId` rejecting a stale stored value |
| [adsrShape.test.ts](../src/__tests__/adsrShape.test.ts) | The envelope filling the unit box exactly whatever the times are, the peak and the floor, the sustain plateau staying flat at the sustain level and collapsing to the baseline at zero, a stage widening with its seconds, and the shortest stage staying visible beside the longest |
| [waveformPath.test.ts](../src/__tests__/waveformPath.test.ts) | Every shape drawn inside its box and out to both edges, the padding holding on both axes, the sine's sample count and its monotonic x, square and sawtooth keeping a vertical edge where triangle has none, and cycles joining without a doubled point |
| [filterShape.test.ts](../src/__tests__/filterShape.test.ts) | The log axis putting its ends at the box ends and the geometric middle halfway, each type keeping the side of the cutoff its name promises, the bandpass falling away on both sides, every curve staying inside 0–1 and inside its padding, and a curve sliding with its cutoff rather than reshaping |
| [effectGlyph.test.ts](../src/__tests__/effectGlyph.test.ts) | Every effect drawing something inside its padding, chorus as two offset voices, the delay bars falling away from the dry hit and stopping where feedback takes them under the floor, and the reverb tail decaying away from its hit |
| [pickerMath.test.ts](../src/__tests__/pickerMath.test.ts) | `wrapIndex` stepping both ways, wrapping at both ends and past the list length, landing somewhere real from a `findIndex` miss of -1, and an empty list having nowhere to go |
| [knobMath.test.ts](../src/__tests__/knobMath.test.ts) | The 270° sweep hitting both bounds and pointing up at the midpoint, drag direction and distance, clamping instead of wrapping past either end, step quantisation leaving no float drift on a grid offset from zero, and the arc path's large-arc flag |
| [hudMeter.test.ts](../src/__tests__/hudMeter.test.ts) | The fader lighting none, half and all of its segments and clamping past both ends of the range, and `formatCutoff` rounding *before* it picks a unit — 999.6 Hz reads `1.0 kHz`, not `1000 Hz` — plus every filter type having an abbreviation |
| [drawOverlay.test.ts](../src/__tests__/drawOverlay.test.ts) | `handColor` reducing to the flat hand colour at `cutoff: 1, level: 0`, and clamping out-of-range inputs; the asymmetric `followLevel` follower rising faster than it falls and never overshooting; `bloomProgress` expiring rather than clamping |
| [settings.test.ts](../src/__tests__/settings.test.ts) | Load/save round-tripping, the section and slot arrays being pinned to length, section 1 forced on, `activeSection` falling back off a disabled section, `accidental` falling back to sharps on an unknown value, the v3 → v4 migration — chords carried over, the old key consumed once, a newer blob short-circuiting it — and the v4 → v5 migration, where the old send lands on the effects it named, `both` splits across delay and reverb, a blob with no send falls back to the old defaults rather than to silence, and a v4 blob is taken over an older v3 one |
| [camera.test.ts](../src/__tests__/camera.test.ts) | The chosen camera's device id round-tripping, nothing stored before one is picked, clearing removing the key rather than storing an empty string, and an unreachable `localStorage` failing closed instead of throwing |
| [panel.test.ts](../src/__tests__/panel.test.ts) | The open settings group round-tripping, an empty store opening the default group, a closed panel staying closed rather than falling back to that default, an unknown group name falling back, and every group having a label |
| [firstRun.test.ts](../src/__tests__/firstRun.test.ts) | The walkthrough flag round-tripping both ways so **Replay walkthrough** can clear it, an empty store and a value we did not write both reading as not-yet-done, and an unreachable `localStorage` failing closed instead of throwing |
| [coachSteps.test.ts](../src/__tests__/coachSteps.test.ts) | The walkthrough's step order, and each step's `satisfied` predicate — firing on its own gesture, not on a neighbouring finger count, and not on a stale count or a held volume left behind by a hand that has gone out of frame |
| [sessionStats.test.ts](../src/__tests__/sessionStats.test.ts) | The accumulator counting nothing on a session where no hand moved — and the inverted sweep bounds not leaking out of that as a full-range sweep — chords struck counted apart from the slots reached, a span measuring what a sweep covered rather than where it ended, rounding to two places, hand detection and fps read as rates over frames drawn rather than divided by no frames, and a section reached twice counting once |
| [analytics.test.ts](../src/__tests__/analytics.test.ts) | `track` passing the event straight through and staying silent when the tag never loaded, `trackSettled` waiting for a control to stop moving and reporting only the value it settled on, two controls moved together staying apart, the wait restarting on every move, and `flushSettled` sending what is pending without letting it fire a second time on its own timer |

`SynthEngine.test.ts` mocks the whole `tone` module with stub nodes that record
attacks and releases into an array, then asserts on which notes are sounding.
This is what makes the engine testable at all: no audio hardware, no timing, and
the assertions are about the rule that actually matters (never retrigger a
sounding note).

`fingerCount.test.ts` builds synthetic 21-point hands from a helper, so a test
reads as `makeHand([true, true, false, false, false])` rather than a wall of
coordinates. Rotation invariance is tested by rotating the same synthetic hand
and asserting the count is unchanged.

`settings.test.ts`, `panel.test.ts` and `firstRun.test.ts` are the three suites
that need a browser API. Tests run in node, so each installs a `Map`-backed
`localStorage` on `globalThis` in a `beforeEach` and drives the real loader.
Going through the public function rather than exporting the normalizers keeps
the migration and the normalizers tested as one path, which is how they actually
run. `firstRun.test.ts` also swaps in an accessor that throws, since private
browsing does not merely return `null` — reading the property is itself the
failure.

`coachSteps.test.ts` is the reason the walkthrough's recognition lives in
`state/coachSteps.ts` rather than inside the `Coach` component: the predicates
are plain functions of `LiveState`, so the cases that actually matter — a stale
finger count from a hand that has left the frame, a volume still held high from
a hand that has gone — are testable without a camera or a render.

**What to add a test for:** anything in `audio/chords.ts`, `audio/sections.ts`,
`audio/effects.ts`, `vision/fingerCount.ts`, the pure style math in
`vision/drawOverlay.ts`, the normalizers in `state/settings.ts`, the arithmetic
in `sessionStats.ts`, or the voice-handling rules in `SynthEngine`. A regression
in any of these is inaudible until someone plays the exact chord that breaks —
or, for the last two, silent forever, since a wrong number in a report looks
exactly like a right one.

**What not to bother with:** React components here are presentational, and the
loop's value is in its timing, which a unit test cannot capture. Test those by
running the app.

## Conventions

**Purity boundaries are load-bearing.** `audio/chords.ts`, `audio/sections.ts`,
`audio/effects.ts`, `vision/fingerCount.ts`, `vision/drawOverlay.ts` and
`sessionStats.ts` have no side effects and no React. `audio/` and
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

**A new chord quality:** add an entry to its family in `QUALITY_GROUPS` in
[chords.ts](../src/audio/chords.ts) — pick the family it is *heard* as, not the
one its note count implies. `QUALITIES` is flattened from that, and everything
else derives in turn: `CHORDS`, the picker's optgroups, validation, and its
inversion range via `maxInversion`. Label it with its own suffix — major is the
only entry whose label is a name rather than the notation. Two things to watch.
The suffix collision rule: qualities are matched longest-first, so a new id that is a
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
that starts and finishes at different heights leaves a diagonal at the seam. The
strip sizes itself — `IconPicker` sets `--picker-cols` from the option count — so
the layout needs nothing.

**A new effect in the rack:** add its id to `EFFECT_IDS` and an entry to
`DEFAULT_EFFECTS` in [effects.ts](../src/audio/effects.ts) — the rows, the type
guard, `normalizeEffects` and the chain builder all derive from those. Then build
the node into `SynthEngine`'s `nodes` record; `setEffects`, `rewire` and
`dispose` iterate it, so they need no editing. Give it a glyph in
`effectGlyphPaths` and a `--fx-*` colour with its `.knob-*` and `.fx-*` rules in
[styles.css](../src/styles.css). The `tone` mock in `SynthEngine.test.ts` needs a
stub too — it is a whitelist, and a node it does not stub is a missing
constructor at test time.

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
