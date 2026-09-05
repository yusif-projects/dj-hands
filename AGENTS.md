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
| Running, building, testing, scripts, project layout | [docs/GETTING-STARTED.md](docs/GETTING-STARTED.md) |
| Module map, data flow, the render loop, start/stop lifecycle, design decisions | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Chords, chord qualities, song sections, the voice and its ADSR, the Tone graph, the filter, the effects rack, the arpeggiator, sustain | [docs/AUDIO.md](docs/AUDIO.md) |
| Hand landmarks, finger counting, the thumb, palm rotation, debouncing, handedness, overlay drawing, WebGL/GPU fallback | [docs/VISION.md](docs/VISION.md) |
| Settings schema, defaults, `localStorage` persistence, env vars, Vite/TS/lint config | [docs/CONFIGURATION.md](docs/CONFIGURATION.md) |
| GitHub Pages pipeline, custom domain, analytics, SEO assets, rollback | [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) |
| A user-reported bug — camera, no sound, reversed hands, flicker, miscounts, frame rate | [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) |
| Test strategy, code conventions, how to add a chord quality / waveform / setting | [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) |
| Gestures, HUD, the sound, chord slots, song sections, settings panel from the player's side | [docs/USER-GUIDE.md](docs/USER-GUIDE.md) |
| Claude Code setup, the skills under `.claude/`, vendoring or updating a skill | [docs/AI-USAGE.md](docs/AI-USAGE.md) |
| An overview before picking any of the above | [docs/README.md](docs/README.md) |

## Source map

```
src/
├── audio/         chords.ts · voice.ts · adsrShape.ts · effects.ts
│                  filter.ts · sections.ts · arp.ts
│                  SynthEngine.ts                              → docs/AUDIO.md
│                  SynthEngine and landmarker load on Start only
├── vision/        landmarker.ts · useCamera.ts · useHandTracking.ts
│                  fingerCount.ts · handRotation.ts
│                  drawOverlay.ts                              → docs/VISION.md
├── components/    StartScreen.tsx · Landing.tsx · faq.ts
│                  Coach.tsx · Hud.tsx · hudMeter.ts
│                  SettingsPanel.tsx · PanelRail.tsx · icons.tsx
│                  AdsrGraph.tsx · Knob.tsx · knobMath.ts
│                  WaveformPicker.tsx · waveformPath.ts
│                  effectGlyph.ts · arpGlyph.ts
├── state/         settings.ts · panel.ts · firstRun.ts
│                  coachSteps.ts                               → docs/CONFIGURATION.md
├── __tests__/     pure-logic tests only                       → docs/CONTRIBUTING.md
├── App.tsx        wiring: lifecycle, settings → engine        → docs/ARCHITECTURE.md
├── prerender.tsx  build-only SSR entry; never imported by the app
│                  → docs/DEPLOYMENT.md#prerendering
├── analytics.ts   no-op-safe wrapper over the GA tag          → docs/DEPLOYMENT.md
├── sessionStats.ts per-session counters, summarized on Stop   → docs/DEPLOYMENT.md
├── support.ts     click tracking for the coffee widget        → docs/DEPLOYMENT.md
└── styles.css     the entire stylesheet, dark-only
```

`public/models/` and `public/wasm/` are vendored by `scripts/fetch-assets.mjs`
and are **not** committed — do not treat them as missing.

`scripts/prerender.mjs` runs as `postbuild` and writes the start screen into
`dist/index.html` as static markup, so the site has something to index.

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

**The dev server lives on port 5173 — always that one.** The URL is bookmarked,
so a run that lands on 5174, 5176, 4173 or anything else is a bug, not a
detail. Vite falls forward silently when 5173 is taken, and a busy 5173 almost
always means an old dev server of this repo is still running: stop that one and
reuse the port instead of accepting whatever Vite picked. Never pass `--port`,
never set `server.port` to anything else in `vite.config.ts`, and never write
another port into docs, scripts, tests or a screenshot run. `npm run preview`
stays on its own default (4173) and is not a substitute for `npm run dev`.

## Invariants worth knowing before you edit

These are the ones that break silently. Full reasoning in
[docs/CONTRIBUTING.md](docs/CONTRIBUTING.md#conventions) and
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#design-decisions-worth-knowing).

- **The render loop must not depend on `settings`.** `useHandTracking` reads
  through `settingsRef` on purpose; adding `settings` to the dependency array
  restarts the loop on every slider drag and drops held notes.
- **No `setState` per frame.** The HUD publishes from a ref every 100 ms.
- **`audio/` and `vision/` do not import each other**, and `chords.ts`,
  `sections.ts`, `voice.ts`, `adsrShape.ts`, `effects.ts`, `filter.ts`,
  `fingerCount.ts`,
  `handRotation.ts`, `drawOverlay.ts`, `knobMath.ts`, `hudMeter.ts`,
  `arp.ts`, `arpGlyph.ts` and
  `waveformPath.ts` stay pure and React-free. That purity is what keeps the test suite meaningful.
- **TypeScript is strict in ways that fail the build**, not the lint:
  `verbatimModuleSyntax` (use `import type`), `erasableSyntaxOnly` (no enums, no
  constructor parameter properties), `noUnusedLocals`, `noUnusedParameters`.
- **Tuning constants live named at the top of their module** — `HAND_GRACE_MS`,
  `VOLUME_SMOOTHING`, `EXTENDED_RATIO`, `MIN_DB`. Edit the constant, not an
  inline number.
- **The start-screen tree must stay Node-renderable.** `scripts/prerender.mjs`
  runs `StartScreen`, `Landing` and everything they import through
  `renderToStaticMarkup` in Node. A browser-only import anywhere under them —
  `window`, `document`, or `tone` touched at module scope — fails the build.
  `main.tsx` stays on `createRoot`, never `hydrateRoot`; see
  [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md#prerendering).
- **Comments explain why, not what.** Match the existing density: they document
  non-obvious constraints (mirrored handedness, Tone's voice recycling, strictly
  increasing timestamps, Chrome's WebGL blocklist).

## Hand edits are not drafts

Code an agent wrote stops belonging to the agent the moment it is on disk. The
working tree is the source of truth, not the version an earlier turn produced.

- **Re-read a file immediately before editing it**, even one written earlier in
  the same session. What is on disk now is what ships.
- **If a file differs from what the agent last wrote, that difference is
  deliberate.** Treat a hand edit as a decision — keep it, build on top of it,
  and match its style in the surrounding code. Do not "fix" it back toward the
  generated version.
- **Never rewrite a whole file to change part of it.** Edit the part. A
  full-file rewrite silently reverts every hand edit it does not happen to
  reproduce.
- If a hand edit genuinely conflicts with the task — it breaks an invariant
  above, or the request cannot be satisfied while keeping it — **stop and ask**.
  Say what changed and why it collides. Do not overwrite it and mention it
  afterwards.

## Repo conventions

**Never push to a remote without asking first.** Commit locally when asked, then
stop and ask — pushing is outward-facing and `main` publishes. The one exception
is the `ship` skill: invoking `/ship` *is* the permission to stage, commit, and
push. Permission for one push does not carry to the next.

`main` deploys to production on push — branch for anything not ready to publish.

**Commit messages follow [Conventional Commits](https://www.conventionalcommits.org).**
The `commit-msg` hook rejects anything else, and so does CI on a pull request.

```
type(optional scope)!: description

feat(audio): add a phaser to the effects rack
fix(vision): fall back to CPU inference when the GPU delegate fails
docs: split the README into a docs/ set
```

- **Types:** `feat` `fix` `perf` `refactor` `docs` `test` `build` `ci` `style`
  `chore` `revert`. Scope is optional and lowercase — usually a source directory
  (`audio`, `vision`, `state`, `components`) or `deps`, `deploy`, `skills`.
- The description stays imperative, lowercase, under 72 characters with the
  prefix, no trailing period, and describes the **user-visible change**.
- `feat` bumps the minor version on the next deploy, a `!` or a
  `BREAKING CHANGE:` footer bumps the major, everything else the patch — see
  [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md#releases). Type honestly; the version
  is derived from it.
- **No tool attribution, ever.** No `Co-Authored-By: Claude`, no
  `Claude-Session:`, no "Generated with Claude Code". Commits here are authored
  by a person; GitHub renders a co-author trailer as a contributor on every
  commit page. `.claude/settings.json` turns the trailer off at the source and
  the `commit-msg` hook rejects one that arrives anyway.

**Skills belong to this repo, never to the machine.** Installing, vendoring or
writing a skill means creating it under `.claude/skills/<name>/` in this project
and committing it. Never write to `~/.claude/skills/`, `~/.claude/agents/`, or
any other path in the home directory — a global skill is invisible to everyone
who clones this repo, survives no `git clean`, and silently follows you into
unrelated projects. The same goes for agents (`.claude/agents/`), commands and
`settings.json`: project-local, tracked in git.

- Vendoring an upstream skill: clone it, strip its `.git`, copy it into
  `.claude/skills/`, and record the source and commit in
  [skills-lock.json](skills-lock.json) — the full procedure is in
  [docs/AI-USAGE.md](docs/AI-USAGE.md#vendoring-a-skill).
- If a tool offers to install a skill globally, decline and place it by hand.
- Anything that would touch the home directory is worth a question first.

Keep the docs in step with the code: a change that makes any statement in
[docs/](docs/) wrong should update that doc in the same commit.
