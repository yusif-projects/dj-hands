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
  volumeTop: number        // frame y that reads as volume 1.0
  volumeBottom: number     // frame y that reads as volume 0.0
  cutoffMin: number        // Hz at full anticlockwise right-hand rotation
  cutoffMax: number        // Hz at full clockwise rotation
  sendTarget: SendTarget   // 'reverb' | 'delay' | 'both'
  sendAmount: number       // wet mix the assigned effect sits at
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
| `sections[].slots[].chord` | `C · G · Am · F · Em` | any of the 180 names | See [audio](audio.md#chord-model) |
| `sections[].slots[].inversion` | `0` | 0…`maxInversion(quality)` | 0 is root position |
| `sections[].slots[].bass` | `null` | any root, or `null` | Slash bass; `null` is the chord's own root |
| `sections[].slots[].octave` | `0` | −2…+2 | Added to `octave`, result clamped to 0…7 |
| `activeSection` | `0` | 0…4 | Written by the right hand as well as the panel |
| `voice` | sawtooth, 0.15/0.3/0.8/0.8 | fully editable | See [audio](audio.md#the-voice) |
| `octave` | `3` | 1…5 (slider) | Clamped to 0…7 after offsets |
| `volumeTop` | `0.15` | 0…0.5 | Normalized frame coordinate, 0 = top edge |
| `volumeBottom` | `0.85` | 0.5…1 | 1 = bottom edge |
| `cutoffMin` | `200` | 50…1000 Hz | Sweep floor |
| `cutoffMax` | `8000` | 1000…12000 Hz | Sweep ceiling |
| `sendTarget` | `reverb` | `reverb`, `delay`, `both` | Which effect the send feeds |
| `sendAmount` | `0.25` | 0…1 | Wet mix; 0 is fully dry |
| `debounceFrames` | `4` | 1…12 | "Steadiness" in the UI |
| `swapHands` | `false` | — | |
| `showOverlay` | `true` | — | |
| `reactiveOverlay` | `true` | — | Ignored while `showOverlay` is off; the UI disables it |

If `volumeBottom <= volumeTop` the span is non-positive and volume reads as 0;
the slider ranges make that unreachable through the UI. The two cutoff sliders
have deliberately disjoint ranges, so `cutoffMin < cutoffMax` holds structurally
and needs no cross-field validation.

## Persistence

Settings are written to `localStorage` under **`gesture-music.settings.v4`** on
every change, via a `useEffect` in `App.tsx`.

The key carries the schema version, and a bump normally orphans the older blob
instead of upgrading it — v2 dropped the five-preset array for a single `voice`,
and v3 folded the parallel `chords` and `chordOctaves` arrays into `chordSlots`.
Neither old shape is merge-compatible, and its dead keys would otherwise be
re-saved forever.

**v4 is the exception.** It wraps `chordSlots` in a section rather than replacing
it, which is a pure reshape with nothing to lose, so `migrateV3` carries the old
chords across: the progression the player had built becomes section 1, every
other v3 key spreads over as usual, and the v3 key is then deleted. It is deleted
even when the blob fails to parse — otherwise a bad payload would be retried on
every load forever. A v4 blob short-circuits the migration entirely, so the two
never race.

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
- `cutoffMin` / `cutoffMax` are clamped to their slider ranges.
- `activeSection` is clamped to 0…4 and then checked against the *normalized*
  sections: an index pointing at a section that has since been turned off falls
  back to the lowest one that is on.
- `sendTarget` is validated against `SEND_TARGETS` with `isSendTarget`, and
  `sendAmount` is clamped to `SEND_AMOUNT_RANGE`.

**v1 → v2:** v1 stored a five-entry `presets` array selected by finger count. It
is not merge-compatible with a single `voice`, and its dead key would have been
re-saved forever, so the key was bumped rather than migrated — a v1 user gets the
defaults back once.

Writes are wrapped in try/catch: storage can be unavailable in private-browsing
modes, in which case settings simply do not persist and the app carries on.

**To reset:** use **Reset to defaults** in the settings panel, or clear the key
from the browser's devtools.

### Changing the schema

Bump `STORAGE_KEY` (currently `…v4`) only for a change the normalizers cannot
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
