# Configuration

## Settings

All user configuration lives in one object, defined in
[state/settings.ts](../src/state/settings.ts).

```ts
interface Settings {
  sections: SongSection[]  // 5 named chord banks, index 0 = one right-hand finger
  activeSection: number    // which bank the left hand is playing
  voice: Voice             // waveform + ADSR, one for the whole instrument
  octave: number           // global base octave
  accidental: Accidental   // 'sharp' | 'flat' — how black keys are named
  volumeTop: number        // frame y that reads as volume 1.0
  volumeBottom: number     // frame y that reads as volume 0.0
  filterType: FilterType   // 'lowpass' | 'highpass' | 'bandpass'
  cutoffMin: number        // Hz at full anticlockwise right-hand rotation
  cutoffMax: number        // Hz at full clockwise rotation
  effects: EffectSetting[] // { id, amount } per effect; array order is chain order
  debounceFrames: number   // frames a gesture must hold before committing
  swapHands: boolean       // flips MediaPipe's handedness labels
  showOverlay: boolean     // draw the hand skeleton
  reactiveOverlay: boolean // let the skeleton react to the sound
}
```

### Defaults and ranges

| Field | Default | Range | Notes |
| --- | --- | --- | --- |
| `sections[].name` | `Verse`, then empty | up to 18 characters | Empty renders as `Section N` |
| `sections[].enabled` | only section 1 | — | Section 1 can never be turned off |
| `sections[].slots[].chord` | `C · G · Am · F · Em` | any of the 480 names | See [audio](audio.md#chord-model) |
| `sections[].slots[].inversion` | `0` | 0…`maxInversion(quality)` | 0 is root position |
| `sections[].slots[].bass` | `null` | any root, or `null` | Slash bass; `null` is the chord's own root |
| `sections[].slots[].octave` | `0` | −2…+2 | Added to `octave`, result clamped to 0…7 |
| `activeSection` | `0` | 0…4 | Written by the right hand as well as the panel |
| `voice` | sawtooth, 0.15/0.3/0.8/0.8 | fully editable | See [audio](audio.md#the-voice) |
| `octave` | `3` | 1…5 (slider) | Clamped to 0…7 after offsets |
| `accidental` | `sharp` | `sharp`, `flat` | Naming only; chords are always stored as sharps — see [audio](audio.md#roots) |
| `volumeTop` | `0.15` | 0…0.5 | Normalized frame coordinate, 0 = top edge |
| `volumeBottom` | `0.85` | 0.5…1 | 1 = bottom edge |
| `filterType` | `lowpass` | `lowpass`, `highpass`, `bandpass` | Which side of the cutoff the sweep keeps |
| `cutoffMin` | `200` | 50…1000 Hz | Sweep floor |
| `cutoffMax` | `8000` | 1000…12000 Hz | Sweep ceiling |
| `effects` | reverb `0.25`, the other five 0 | amount 0…1, step 0.05 | Wet mix per effect; 0 is fully bypassed. The array's order is the order they run in. Tremolo, phaser and delay also carry a `timing` |
| `bpm` | `120` | 40…240, step 1 | Tempo the locked effects snap their rate to; nothing else reads it |
| `debounceFrames` | `2` | 1…12 | "Steadiness" in the UI |
| `swapHands` | `false` | — | |
| `showOverlay` | `true` | — | |
| `reactiveOverlay` | `true` | — | Ignored while `showOverlay` is off; the UI disables it |

If `volumeBottom <= volumeTop` the span is non-positive and volume reads as 0;
the slider ranges make that unreachable through the UI. The two cutoff sliders
have deliberately disjoint ranges, so `cutoffMin < cutoffMax` holds structurally
and needs no cross-field validation.

## Persistence

Settings are written to `localStorage` under **`gesture-music.settings.v5`** on
every change, via a `useEffect` in `App.tsx`.

The key carries the schema version, and a bump normally orphans the older blob
instead of upgrading it — v2 dropped the five-preset array for a single `voice`,
and v3 folded the parallel `chords` and `chordOctaves` arrays into `chordSlots`.
Neither old shape is merge-compatible, and its dead keys would otherwise be
re-saved forever.

**v4 and v5 are the exceptions**, both pure reshapes with nothing to lose.

v4 wraps `chordSlots` in a section rather than replacing it, so `migrateV3`
carries the old chords across: the progression the player had built becomes
section 1, and every other v3 key spreads over as usual.

v5 splits the single send — one target and one amount shared between reverb and
delay — into a rack of effects with their own amounts. `fromSend` lands the old
amount on whichever effects the old target named, `both` reaching delay and
reverb; the send could never reach anything else, so every other effect starts
silent. A blob with no send stored still played the old defaults, so it migrates
to those rather than to silence.

Effects added to the rack after v5 need no key bump and no migration of their
own: `normalizeEffects` appends anything a stored blob is missing at its default,
which for a new effect is silence.

The tempo and the per-effect `timing` were added the same way. `bpm` is a scalar,
so the shallow merge hands an older blob the default; `timing` is filled in by
`normalizeEffects` at the rate each effect ran at when it was a fixed constant.
A rack stored before either existed therefore loads unlocked and sounding exactly
as it did.

Both old keys are deleted once read, even when the blob fails to parse —
otherwise a bad payload would be retried on every load forever. A newer blob
short-circuits the older migrations entirely, so they never race.

Loading is defensive on purpose — a stored blob may come from an older build, a
different schema, or a user who edited it by hand:

- A parse failure or missing key falls back to `DEFAULT_SETTINGS` wholesale.
- Scalars are shallow-merged over the defaults, so a field added in a later
  version appears with its default instead of `undefined`.
- `sections` is mapped over the defaults, so a stored array of the wrong length
  is normalized to five sections. Per section: `name` is truncated to
  `MAX_SECTION_NAME`, `enabled` must be exactly `true` — except on section 1,
  which is forced on because it is what everything else falls back to — and
  `slots` goes through the same slot normalizer below.
- `slots` is likewise mapped over the defaults, so a stored array of the wrong
  length is normalized to five entries. Per slot: `chord` is validated with
  `isChordName` and falls back to that slot's default; `bass` is accepted only if
  it is one of `ROOTS`, else `null`; `octave` is coerced to a finite integer and
  clamped to ±2; and `inversion` is clamped against the *resolved* chord's note
  count, which is known by that point, rather than against a generic ceiling.
- `voice` is rebuilt field-by-field: the waveform is validated against
  `WAVEFORMS` and each ADSR number is clamped to its `ADSR_RANGES` bounds, so a
  partial or hand-edited object still yields a complete, playable envelope.
- `filterType` is kept only if it names a known type, else it falls back to its
  default.
- `cutoffMin` / `cutoffMax` are clamped to their slider ranges.
- `activeSection` is clamped to 0…4 and then checked against the *normalized*
  sections: an index pointing at a section that has since been turned off falls
  back to the lowest one that is on.
- `effects` goes through `normalizeEffects`, which guarantees every id appears
  **exactly once**: valid stored entries keep their order, junk and duplicates are
  dropped, anything missing is appended in canonical order at its default, and
  each amount is clamped to `EFFECT_AMOUNT_RANGE`. The engine walks this array to
  build its chain, so a missing id would strand that node outside the signal path
  and a duplicate would try to wire one node in twice.
- `timing` is held to the same promise, so neither the panel nor the engine has to
  defend against a half-built object: every effect in `TIMED_EFFECT_IDS` comes
  back with a complete one and every other effect with none at all. `ms` is
  clamped to that effect's own `EFFECT_MS_RANGES` entry — they differ by a factor
  of ten across the three — an unknown `division` falls back to the default, and
  `lock` must be exactly `true`, so a truthy string in a hand-edited blob cannot
  silently put an effect on the grid where it would then ignore the milliseconds
  shown beside it.
- `bpm` is clamped to `BPM_RANGE` and falls back to `DEFAULT_BPM` when unreadable.
- `accidental` is validated with `isAccidental` and falls back to `sharp`.

**v1 → v2:** v1 stored a five-entry `presets` array selected by finger count. It
is not merge-compatible with a single `voice`, and its dead key would have been
re-saved forever, so the key was bumped rather than migrated — a v1 user gets the
defaults back once.

Writes are wrapped in try/catch: storage can be unavailable in private-browsing
modes, in which case settings simply do not persist and the app carries on.

**To reset:** use **Reset to defaults** in the settings panel, or clear the key
from the browser's devtools.

### The panel's own key

A second key, **`gesture-music.panel-group`**, holds the settings group the icon
rail has open — one of the ids in `PANEL_GROUPS`, or `none` for a closed panel.
It lives in [state/panel.ts](../src/state/panel.ts) rather than in `Settings`
because it is UI chrome, not sound configuration: **Reset to defaults** spreads
`DEFAULT_SETTINGS` wholesale, so a group stored in there would make resetting the
sound slam the panel shut as a side effect. It carries no schema version — an
unrecognised value simply falls back to the default group — and its writes are
wrapped in the same try/catch.

### The camera's key

A third key, **`gesture-music.camera-id`**, holds the device id of the camera the
player picked. It is separate for the same reason: the camera is device chrome
rather than sound configuration, and **Reset to defaults** would otherwise swap
the camera out from under a running session.

A device id is per-browser and per-origin, and it survives a replug only
sometimes, so a stored one is a preference to try rather than a guarantee —
[useCamera](vision.md#choosing-a-camera) asks for it with `ideal` and stores
whatever actually opened. Clearing it removes the key rather than writing an
empty string, which would otherwise have the next start ask for a camera whose id
is `""`. Its reads and writes are wrapped in the same try/catch.

### The walkthrough's key

A fourth key, **`gesture-music.coach-done`**, records that the first-run
walkthrough has been finished or skipped. It lives in
[state/firstRun.ts](../src/state/firstRun.ts) for the same reason the panel's key
is separate: **Reset to defaults** must not replay the walkthrough as a side
effect of resetting the sound.

It stores `1` or is absent, and anything else reads as not-yet-done — a garbage
value costs a repeat rather than silently skipping what the flag gates. It is
cleared as well as set: **Replay walkthrough**, in the **How to play** panel
group, removes it.

### Changing the schema

Bump `STORAGE_KEY` (currently `…v5`) only for a change the normalizers cannot
absorb.
Adding a field with a sensible default does not need a bump — the shallow merge
handles it. Changing the *meaning* of an existing field does.

`reactiveOverlay` is the worked example of the additive case: it is purely new,
so a stored blob without the key picks up the `true` default from the spread in
`loadSettings` and keeps every other setting the player had.

A bump does not have to mean losing the old blob. `migrateV3` is the worked
example of the other case: the reshape it handles is a pure widening, so it reads
the old key, moves the one field that moved, and deletes it. Write a migration
when the old data still has an obvious home in the new shape, and orphan only
when it genuinely does not — v1's five-preset array had nowhere to go, a chord
progression does.

## Environment variables

Only one, and only for production builds:

| Variable | Where | Purpose |
| --- | --- | --- |
| `VITE_GA_ID` | [.env.production](../.env.production) | GA4 measurement id, `G-XXXXXXXXXX` |

The `googleAnalytics` plugin in [vite.config.ts](../vite.config.ts) reads it at
build time and injects the tag into `index.html`. The id is validated against
`/^G-[A-Z0-9]+$/`; a missing, empty, or malformed value emits **no tag at all**,
which keeps `npm run dev` and forked builds free of a broken — or somebody
else's — analytics tag. See [deployment](deployment.md#analytics).

## Build configuration

**`base: './'`** in `vite.config.ts`. Relative asset paths mean the built
`dist/` works from any static server and any subdirectory — GitHub Pages project
paths, `python -m http.server`, VS Code Live Server — not only a domain root.

Note that `import.meta.env.BASE_URL` is what `landmarker.ts` uses to locate the
model and WASM runtime, so it stays consistent with wherever the bundle is
served from.

**TypeScript** is a project build (`tsc -b`) with `tsconfig.app.json` for `src/`
and `tsconfig.node.json` for the Vite config. Strictness worth knowing:
`noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax` (so type-only
imports must say `import type`), and `erasableSyntaxOnly` (no enums, no
parameter properties).

**Linting** is oxlint, configured in [.oxlintrc.json](../.oxlintrc.json) with
the react, typescript, and oxc plugins. `react/rules-of-hooks` is an error;
`react/only-export-components` is a warning.

## Static site files

Everything in `public/` is copied verbatim into `dist/`:

| File | Purpose |
| --- | --- |
| `CNAME` | Custom domain for GitHub Pages (`www.dj-hands.com`) |
| `site.webmanifest` | PWA manifest — standalone, landscape, dark theme |
| `favicon.svg`, `favicon-96.png`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png` | Icons |
| `og.png` | 1200×630 social preview image |
| `robots.txt`, `sitemap.xml` | Crawling |
| `models/hand_landmarker.task` | Vendored model — gitignored, fetched at build |
| `wasm/*` | Vendored MediaPipe runtime — gitignored, copied at build |
