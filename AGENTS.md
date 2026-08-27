# AGENTS.md

DJ Hands — a client-only React app that turns a webcam into an instrument.
MediaPipe tracks hands, `fingerCount` turns landmarks into a number, Tone.js
makes the sound. No backend, no uploads, no server code anywhere in this repo.

The documentation in [docs/](docs/) is complete and current. **Read the doc
before grepping the source** — the routing table below says which one, and each
doc links to the exact files it describes.

## Where things are documented

| If the task touches… | Read |
| --- | --- |
| Running, building, testing, scripts, project layout | [docs/getting-started.md](docs/getting-started.md) |
| Module map, data flow, the render loop, start/stop lifecycle, design decisions | [docs/architecture.md](docs/architecture.md) |
| Chords, chord qualities, the voice and its ADSR, the Tone graph, the filter, the reverb/delay send, sustain | [docs/audio.md](docs/audio.md) |
| Hand landmarks, finger counting, the thumb, palm rotation, debouncing, handedness, overlay drawing, WebGL/GPU fallback | [docs/vision.md](docs/vision.md) |
| Settings schema, defaults, `localStorage` persistence, env vars, Vite/TS/lint config | [docs/configuration.md](docs/configuration.md) |
| GitHub Pages pipeline, custom domain, analytics, SEO assets, rollback | [docs/deployment.md](docs/deployment.md) |
| A user-reported bug — camera, no sound, reversed hands, flicker, miscounts, frame rate | [docs/troubleshooting.md](docs/troubleshooting.md) |
| Test strategy, code conventions, how to add a chord quality / waveform / setting | [docs/contributing.md](docs/contributing.md) |
| Gestures, HUD, the sound, chord slots, settings panel from the player's side | [docs/user-guide.md](docs/user-guide.md) |
| An overview before picking any of the above | [docs/README.md](docs/README.md) |

## Source map

```
src/
├── audio/         chords.ts · voice.ts · effects.ts
│                  SynthEngine.ts                              → docs/audio.md
├── vision/        landmarker.ts · useCamera.ts · useHandTracking.ts
│                  fingerCount.ts · handRotation.ts
│                  drawOverlay.ts                              → docs/vision.md
├── components/    StartScreen.tsx · Hud.tsx · SettingsPanel.tsx
├── state/         settings.ts                                 → docs/configuration.md
├── __tests__/     pure-logic tests only                       → docs/contributing.md
├── App.tsx        wiring: lifecycle, settings → engine        → docs/architecture.md
├── analytics.ts   no-op-safe wrapper over the GA tag          → docs/deployment.md
├── links.ts       outbound URLs shared by components
└── styles.css     the entire stylesheet, dark-only
```

`public/models/` and `public/wasm/` are vendored by `scripts/fetch-assets.mjs`
and are **not** committed — do not treat them as missing.

## Commands

```bash
npm test        # vitest, single run — the fast check, no browser needed
npm run lint    # oxlint
npm run typecheck
npm run build   # tsc -b + vite build
npm run dev     # http://localhost:5173
```

Before pushing: `npm test && npm run lint && npm run build`. Anything touching
the render loop, audio timing, or the camera also needs a manual run — the tests
cover pure logic only, by design.

## Invariants worth knowing before you edit

These are the ones that break silently. Full reasoning in
[docs/contributing.md](docs/contributing.md#conventions) and
[docs/architecture.md](docs/architecture.md#design-decisions-worth-knowing).

- **The render loop must not depend on `settings`.** `useHandTracking` reads
  through `settingsRef` on purpose; adding `settings` to the dependency array
  restarts the loop on every slider drag and drops held notes.
- **No `setState` per frame.** The HUD publishes from a ref every 100 ms.
- **`audio/` and `vision/` do not import each other**, and `chords.ts`,
  `voice.ts`, `effects.ts`, `fingerCount.ts`, `handRotation.ts` and
  `drawOverlay.ts` stay pure and React-free. That purity is
  what keeps the test suite meaningful.
- **TypeScript is strict in ways that fail the build**, not the lint:
  `verbatimModuleSyntax` (use `import type`), `erasableSyntaxOnly` (no enums, no
  constructor parameter properties), `noUnusedLocals`, `noUnusedParameters`.
- **Tuning constants live named at the top of their module** — `HAND_GRACE_MS`,
  `VOLUME_SMOOTHING`, `EXTENDED_RATIO`, `MIN_DB`. Edit the constant, not an
  inline number.
- **Comments explain why, not what.** Match the existing density: they document
  non-obvious constraints (mirrored handedness, Tone's voice recycling, strictly
  increasing timestamps, Chrome's WebGL blocklist).

## Repo conventions

**Never push to a remote without asking first.** Commit locally when asked, then
stop and ask — pushing is outward-facing and `main` publishes. The one exception
is the `ship` skill: invoking `/ship` *is* the permission to stage, commit, and
push. Permission for one push does not carry to the next.

`main` deploys to production on push — branch for anything not ready to publish.
Commit messages are short, imperative, and describe the user-visible change
("Fall back to CPU inference when the GPU delegate fails").

Keep the docs in step with the code: a change that makes any statement in
[docs/](docs/) wrong should update that doc in the same commit.
