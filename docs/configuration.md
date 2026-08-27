# Configuration

## Settings

All user configuration lives in one object, defined in
[state/settings.ts](../src/state/settings.ts).

```ts
interface Settings {
  chords: ChordName[]      // 5 entries, index 0 = one finger
  chordOctaves: number[]   // 5 entries, −2…+2, same indexing
  voice: Voice             // waveform + ADSR, one for the whole instrument
  octave: number           // global base octave
  volumeTop: number        // frame y that reads as volume 1.0
  volumeBottom: number     // frame y that reads as volume 0.0
  cutoffMin: number        // Hz at full anticlockwise right-hand rotation
  cutoffMax: number        // Hz at full clockwise rotation
  debounceFrames: number   // frames a gesture must hold before committing
  swapHands: boolean       // flips MediaPipe's handedness labels
  showOverlay: boolean     // draw the hand skeleton
}
```

### Defaults and ranges

| Field | Default | Range | Notes |
| --- | --- | --- | --- |
| `chords` | `C · G · Am · F · Em` | any of the 180 names | See [audio](audio.md#chord-model) |
| `chordOctaves` | `[0,0,0,0,0]` | −2…+2 | Added to `octave`, result clamped to 0…7 |
| `voice` | sawtooth, 0.15/0.3/0.8/0.8 | fully editable | See [audio](audio.md#the-voice) |
| `octave` | `3` | 1…5 (slider) | Clamped to 0…7 after offsets |
| `volumeTop` | `0.15` | 0…0.5 | Normalized frame coordinate, 0 = top edge |
| `volumeBottom` | `0.85` | 0.5…1 | 1 = bottom edge |
| `cutoffMin` | `200` | 50…1000 Hz | Sweep floor |
| `cutoffMax` | `8000` | 1000…12000 Hz | Sweep ceiling |
| `debounceFrames` | `4` | 1…12 | "Steadiness" in the UI |
| `swapHands` | `false` | — | |
| `showOverlay` | `true` | — | |

If `volumeBottom <= volumeTop` the span is non-positive and volume reads as 0;
the slider ranges make that unreachable through the UI. The two cutoff sliders
have deliberately disjoint ranges, so `cutoffMin < cutoffMax` holds structurally
and needs no cross-field validation.

## Persistence

Settings are written to `localStorage` under **`gesture-music.settings.v2`** on
every change, via a `useEffect` in `App.tsx`.

Loading is defensive on purpose — a stored blob may come from an older build, a
different schema, or a user who edited it by hand:

- A parse failure or missing key falls back to `DEFAULT_SETTINGS` wholesale.
- Scalars are shallow-merged over the defaults, so a field added in a later
  version appears with its default instead of `undefined`.
- `chords` are validated name-by-name with `isChordName`; anything unrecognized
  falls back to that slot's default. A stored array of the wrong length is
  normalized to five entries.
- `chordOctaves` are coerced to finite integers and clamped to ±2.
- `voice` is rebuilt field-by-field: the waveform is validated against
  `WAVEFORMS` and each ADSR number is clamped to its `ADSR_RANGES` bounds, so a
  partial or hand-edited object still yields a complete, playable envelope.
- `cutoffMin` / `cutoffMax` are clamped to their slider ranges.

**v1 → v2:** v1 stored a five-entry `presets` array selected by finger count. It
is not merge-compatible with a single `voice`, and its dead key would have been
re-saved forever, so the key was bumped rather than migrated — a v1 user gets the
defaults back once.

Writes are wrapped in try/catch: storage can be unavailable in private-browsing
modes, in which case settings simply do not persist and the app carries on.

**To reset:** use **Reset to defaults** in the settings panel, or clear the key
from the browser's devtools.

### Changing the schema

Bump `STORAGE_KEY` (currently `…v2`) only for a change the normalizers cannot
absorb.
Adding a field with a sensible default does not need a bump — the shallow merge
handles it. Changing the *meaning* of an existing field does.

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
