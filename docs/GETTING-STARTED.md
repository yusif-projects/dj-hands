# Getting started

## Requirements

| Thing | Why |
| --- | --- |
| Node 22+ | Matches the CI runner; the asset script uses `Readable.fromWeb` and top-level `await` |
| A webcam | The only input device |
| A browser with WebGL | MediaPipe uploads every frame through a WebGL context, even on the CPU delegate |
| A secure origin | `getUserMedia` refuses to run on plain HTTP (`localhost` counts as secure) |

Tested on current Chrome, Safari, and Firefox on desktop. Mobile works but the
manifest asks for landscape, and small frames make five-finger counts less
reliable.

## Install and run

```bash
npm install
npm run dev
```

Open <http://localhost:5173>, click **Start camera & audio**, and allow webcam
access when the browser asks.

`predev` runs `scripts/fetch-assets.mjs` before the dev server starts. On the
first run that downloads the MediaPipe hand-landmark model (~7 MB) into
`public/models/` and copies the WASM runtime out of `node_modules` into
`public/wasm/`. Subsequent runs see the model already on disk and skip the
download. Both directories are gitignored — the app has no CDN dependency at
runtime because the assets are vendored at build time instead.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with hot reload (runs `fetch-assets` first) |
| `npm run build` | `tsc -b` project build, then `vite build` into `dist/` (runs `fetch-assets` first) |
| `npm run preview` | Serves the built `dist/` locally |
| `npm test` | Vitest, single run — pure-logic tests only |
| `npm run typecheck` | `tsc -b --noEmit` |
| `npm run lint` | oxlint |
| `npm run fetch-assets` | Vendors the model + WASM runtime into `public/` on demand |
| `npm run check-commits` | Validates a commit message file, or `-- --range main..HEAD` |
| `prepare` | Runs on `npm install`; points `core.hooksPath` at `.githooks/` |

`prepare` is what installs the `commit-msg` hook, so commit messages are checked
against [Conventional Commits](https://www.conventionalcommits.org) from your
first commit after `npm install` — see
[contributing](CONTRIBUTING.md#commit-messages) for the format.

## First-run checklist

1. **Start camera & audio** must be clicked — both `AudioContext` and
   `getUserMedia` require a user gesture, so there is no way to auto-start.
2. Hold your **left** hand up with 1–5 fingers extended. The matching chord pad
   in the HUD bar should light up, and the note line beneath it should name the
   chord's notes.
3. Hold your **right** hand up. Moving it up and down fills the fader; rotating
   it sweeps the filter arc and its cutoff.
4. If left and right come out backwards, tick **Swap hands** in the settings
   panel — see [troubleshooting](TROUBLESHOOTING.md#left-and-right-are-reversed).

## Project layout

```
src/
├── audio/         chords.ts · voice.ts · effects.ts · filter.ts · arp.ts
│                  SynthEngine.ts  (lazy: pulls in Tone)
├── vision/        landmarker.ts · useCamera.ts · useHandTracking.ts
│                  fingerCount.ts · handRotation.ts · drawOverlay.ts
├── components/    StartScreen.tsx · Landing.tsx · faq.ts
│                  Coach.tsx · Hud.tsx · hudMeter.ts
│                  SettingsPanel.tsx · PanelRail.tsx
├── state/         settings.ts · presets.ts · panel.ts · firstRun.ts
│                  (localStorage-backed)
│                  coachSteps.ts (the walkthrough, as pure data)
├── __tests__/     pure-logic tests
├── analytics.ts   no-op-safe wrapper over the GA tag
├── support.ts     click tracking + bubble placement for the coffee widget
├── styles.css     the entire stylesheet, dark-only
├── App.tsx        wiring: start/stop lifecycle, settings → engine
├── prerender.tsx  build-only SSR entry (not part of the app bundle)
└── main.tsx       React root
public/            icons, og.png, manifest, robots.txt, sitemap.xml, CNAME
                   fonts/archivo-latin.woff2 — the one face the UI loads
                   models/ + wasm/ are vendored here, not committed
scripts/           fetch-assets.mjs · prerender.mjs
                   commit-message.mjs · next-version.mjs
.githooks/         commit-msg — the conventional-commit gate
.claude/           skills and subagents, committed rather than installed
                   per machine — see docs/AI-USAGE.md
docs/              this documentation
```
