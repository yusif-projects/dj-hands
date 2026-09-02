# Deployment

The site is a static bundle served from GitHub Pages at
**[www.dj-hands.com](https://www.dj-hands.com)**.

## Pipeline

[.github/workflows/deploy.yml](../.github/workflows/deploy.yml) runs on every
push to `main`, and on manual dispatch — where an optional `ref` input picks
which tag, branch, or commit to build (see [rollback](#rollback)):

```
checkout → setup-node 22 (npm cache) → npm ci → lint → test → npm run build
  → postbuild prerender → upload dist/ → deploy-pages
```

`npm run build` triggers `prebuild`, which runs `scripts/fetch-assets.mjs` —
downloading the MediaPipe model and copying the WASM runtime into `public/`
before Vite builds. Neither is committed to the repo, so this step is what makes
the deployed bundle self-contained. It then triggers `postbuild`, which runs
[scripts/prerender.mjs](../scripts/prerender.mjs) over the emitted `dist/` — see
[prerendering](#prerendering) below.

Lint and tests gate the deploy: a failing test stops the run before `dist/` is
ever built, so a red test is a blocked deploy rather than a live bug. This
applies to rollback deploys too — an old `ref` has to still pass today's lint and
tests to reach the site.

The workflow uses OIDC (`id-token: write`) with `actions/deploy-pages`, so there
is no deploy token to manage. Concurrency is grouped on `pages` with
`cancel-in-progress`, so a rapid series of pushes only deploys the last one.

### Repository settings required

- **Settings → Pages → Source: GitHub Actions** (not "Deploy from a branch").
- **Settings → Pages → Custom domain: `www.dj-hands.com`**, with *Enforce HTTPS*
  on. The `public/CNAME` file carries the same value into every build, which is
  what keeps the custom domain from being reset on deploy.

### DNS

`www.dj-hands.com` is a `CNAME` to the GitHub Pages host. The apex domain should
redirect to `www` (or carry the four Pages `A` records) so both spellings work.

## Build output

```bash
npm run build      # → dist/
npm run preview    # serve it locally
```

`dist/` contains the hashed CSS and four hashed JS chunks — the entry, plus
Tone, MediaPipe and the synth engine, which the app fetches behind the start
screen rather than before it — `index.html` with the analytics tag
injected, everything from `public/`, and the vendored `models/` and `wasm/`
directories. The model alone is the bulk of the transfer — it is fetched once
and then cached by the browser.

Because `base: './'` is set, `dist/` can also be served from a subdirectory or
opened by any plain static server. See
[troubleshooting](TROUBLESHOOTING.md#vs-code-live-server) for the Live Server
case specifically.

## Analytics

Google Analytics is injected into `index.html` **at build time** by the
`googleAnalytics` Vite plugin in [vite.config.ts](../vite.config.ts), from the
`VITE_GA_ID` measurement id in [.env.production](../.env.production):

```bash
VITE_GA_ID=G-XXXXXXXXXX
```

The plugin injects three head tags: a `preconnect` to
`googletagmanager.com`, the async gtag loader, and the inline `gtag('config', …)`
bootstrap. The id is validated against `/^G-[A-Z0-9]+$/` first — an empty or
malformed value emits nothing at all, so `npm run dev` and forked builds never
report traffic, and never report it to somebody else's property.

`src/analytics.ts` is a thin wrapper over the tag:

```ts
export function track(event: string, params?: Record<string, unknown>): void {
  window.gtag?.('event', event, params)
}
```

`gtag` is absent whenever the tag was not injected, so every call is a no-op in
dev. Alongside it, `trackSettled(key, event, params)` debounces: a knob emits a
value on every pointer move and a slider on every step crossed, and only the
value a control comes to rest on is worth an event. `flushSettled()` empties
those pending timers as a session ends, since the page may not live long enough
to run them.

Beyond the automatic page view, the app sends these events:

| Event | When | Params |
| --- | --- | --- |
| `session_started` | Camera, audio, and tracker all came up | — |
| `session_start_failed` | Any part of startup threw | `reason` — the first line of the error |
| `session_ended` | Stop was pressed, or the tab closed | see below |
| `panel_group_opened` | A settings-rail group was opened | `group` — the group id |
| `setting_changed` | Any settings-panel control was committed | `setting`, `value` |
| `outbound_click` | A credit link was followed | `link`, `from` — `start` or `about` |
| `support_click` | The Buy Me a Coffee widget button was clicked | `placement` — `widget` |
| `coach_step_done` | A walkthrough step was performed | `step` — `chord`, `change`, `release` or `volume` |
| `coach_completed` | All four steps were performed | — |
| `coach_skipped` | The walkthrough was dismissed early | `step` — the one it was abandoned on, or `done` |
| `coach_replayed` | "Replay walkthrough" was pressed | — |

### `setting_changed`

The panel has around thirty controls, and giving each its own event name would
mean thirty event names and thirty custom dimensions to register. They all
report through one event instead, named by `setting`, so the question "which
parts of the synth do people actually touch?" is a single breakdown.

Values for `setting`: `filter_type`, `waveform`, `attack`, `decay`, `sustain`,
`release`, `effect_amount`, `effect_order`, `effect_lock`, `effect_rate`, `bpm`,
`chord_root`, `chord_quality`, `chord_octave`, `inversion`, `slash_bass`,
`base_octave`, `accidental`, `cutoff_min`, `cutoff_max`, `volume_top`,
`volume_bottom`, `camera`, `steadiness`, `swap_hands`, `show_overlay`,
`reactive_overlay`, `section_added`, `section_switched`, `section_removed`,
`section_renamed`, `reset`.

`effect_amount` and `effect_rate` carry the effect's id as their value rather
than the number that moved, since which of the six a player reaches for is the
question worth asking. `effect_order` pairs the id with the direction — `id:up`
or `id:down` — and `effect_lock` pairs it with the new state, `id:true` or
`id:false`, so turning the grid on can be told from turning it off.

`value` carries the detail — the waveform picked, the filter type chosen, the
effect that moved and which way (`reverb:up`). The camera reports its position
in the list rather than its device id, which is unique per browser and means
nothing across users.

### `session_ended`

The render loop runs at display rate, so it never calls `track()` — a chord
change is worth an event, sixty a second is not. `useHandTracking` accumulates
into a plain ref (`src/sessionStats.ts`) and App sends one summary when the
session ends:

| Param | Meaning |
| --- | --- |
| `seconds` | Session length |
| `chords_played` | Chord strikes — left-hand transitions onto a chord |
| `distinct_chords` | 0–5, how many of the five slots were reached |
| `section_switches` | Section changes that actually took |
| `sections_used` | Distinct sections reached, counting the one started on |
| `filter_swept` | 0–1, the span of cutoff explored |
| `volume_used` | 0–1, the span of volume explored |
| `hands_pct` | % of frames with a hand in them |
| `avg_fps` | Rounded, for performance triage |
| `coach_done` | Whether the walkthrough had been finished |

It is sent from both Stop and `pagehide`, guarded so doing both does not count
the session twice — `pagehide` rather than `unload` because it still fires when
the page goes into the back/forward cache. Most sessions end by closing the tab,
so that path carries most of the data.

`session_start_failed` reasons are worth watching: they surface WebGL-disabled
browsers, denied camera permissions, and missing cameras as a distribution
rather than one-off reports.

The `coach_*` events answer the question the walkthrough exists to fix: how many
people who start a session actually get a note out of it. `coach_step_done` with
`step=chord` against `session_started` is the one that matters — a gap there is
people whose hands are not being read, not people who are bored.

`hands_pct` and `avg_fps` are the counterpart for everything else. A feature can
look unused because nobody wants it, or because hand tracking never worked on
that machine; without those two the numbers cannot tell the difference.

### Custom dimensions

GA4 collects these parameters but will not show them in reports until each is
registered. Under **Admin → Custom definitions**, add `setting`, `value`,
`group`, `link` and `from` as event-scoped **custom dimensions**, and the
`session_ended` numbers as **custom metrics**. Registration is not retroactive,
so anything collected beforehand stays unqueryable.

**Forking this repo:** clear `VITE_GA_ID` in `.env.production`, or replace it
with your own measurement id. Leaving it as-is sends your traffic to the
original property.

## SEO and social

[index.html](../index.html) carries a full metadata set — canonical URL, Open
Graph, Twitter card, theme color, and a `WebApplication` JSON-LD block naming the
author, listing the feature set, and stating it is free. `public/og.png` is the
1200×630 preview image; `robots.txt` allows everything and points at
`sitemap.xml`, which lists the single URL.

If the domain changes, these absolute URLs need updating together:
`index.html` (canonical, `og:url`, `og:image`, `twitter:image`, JSON-LD `url`
and `screenshot`), `public/robots.txt`, `public/sitemap.xml`, and `public/CNAME`.

The JSON-LD `featureList` is the one claim about the instrument written out by
hand rather than counted from the audio modules, so
[metadata.test.ts](../src/__tests__/metadata.test.ts) asserts the numbers in it
still match `CHORDS`, `QUALITIES`, `WAVEFORMS`, `FILTER_TYPES` and the rest.
Add a chord quality and the test fails until the structured data says so too.

### Prerendering

Vite emits `dist/index.html` with an empty `<div id="root"></div>`. Every word
describing DJ Hands lives in `StartScreen` and `Landing`, so before this step
the only thing a crawler could read about the site was the title tag and meta
description — which is why it ranked for its own name and nothing else. Google
renders JavaScript on a deferred second pass; Bing, DuckDuckGo and the LLM
crawlers largely do not.

`postbuild` runs [scripts/prerender.mjs](../scripts/prerender.mjs), which:

1. Builds [src/prerender.tsx](../src/prerender.tsx) for Node into
   `node_modules/.prerender` — a throwaway SSR bundle, built with
   `configFile: false` so it does not recurse through `vite.config.ts`. The
   directory has to sit under the project rather than in the OS temp dir, or the
   bare `react-dom/server` import cannot resolve.
2. Calls its `render()`, which returns the start screen as static markup plus a
   `FAQPage` JSON-LD block.
3. Writes the markup into `<div id="root">` and the block before `</head>`.
4. Stamps today's date into `dist/sitemap.xml` as `<lastmod>`.
5. Deletes the bundle.

The result is ~1,200 indexable words where there were none. Any failure exits
non-zero — a silent skip would ship the empty body again without anyone
noticing, which is the exact bug this exists to prevent.

**The one font face is preloaded.** [index.html](../index.html) carries a
`<link rel="preload">` for `/fonts/archivo-latin.woff2`. Prerendering means the
start card paints before any JavaScript runs, so without the preload it paints
in the fallback stack and reflows when the face arrives — at the one moment a
visitor is deciding whether this is a real instrument. The file is copied
verbatim out of `public/`, so it is unhashed and the preload URL is stable.

**The client still calls `createRoot`, not `hydrateRoot`.** `createRoot().render()`
clears the container before mounting, so the prerendered markup is simply
replaced. Hydration would be wrong: `prerender.tsx` renders only the
not-yet-started branch of `App`, and the two trees diverge the moment a session
begins. `renderToStaticMarkup` emits no `data-reactroot`, so React logs no
warning either.

Everything reachable from `prerender.tsx` has to run in Node — no `window`,
`document` or `tone` at import time. That is why `audio/`'s data modules keep
the Tone import confined to `SynthEngine.ts`. Break it and the build fails
loudly, by design.

The FAQ is a single array in [faq.ts](../src/components/faq.ts) that feeds both
the rendered `<dl>` and the JSON-LD, because Google treats structured data that
does not match the visible text as an invalid rich result.

`npm run dev` is unaffected — prerendering is a production concern, and the dev
server serves the untouched `index.html`.

## Releases

**Every successful deploy tags itself.** The `tag` job in
[deploy.yml](../.github/workflows/deploy.yml) runs after `deploy`, reads the
highest existing `v*` tag, bumps it, and publishes a GitHub Release at that
commit with auto-generated notes. Push to `main`, and a minute later there is a
`v1.0.7` you can go back to. There is nothing to remember to do.

**The commits pick the number.** [scripts/next-version.mjs](../scripts/next-version.mjs)
reads every commit since that tag and takes the largest bump any of them asks
for:

| In the log since the last tag | `v1.2.3` becomes |
| --- | --- |
| A `!` before the colon, or a `BREAKING CHANGE:` footer | `v2.0.0` |
| A `feat` commit | `v1.3.0` |
| Anything else — `fix`, `docs`, `chore`, a merge | `v1.2.4` |

Which is why the [commit format](CONTRIBUTING.md#commit-messages) is enforced by
a hook and by CI: the type is not bookkeeping, it is the version. A capability
committed as a `chore` ships under a patch bump and no one is told about it.
Messages git writes itself — merges, reverts, `fixup!` — carry no type and move
nothing.

Two guards keep the tags honest:

- `needs: deploy` — a run that failed lint, tests, the build, or the deployment
  itself never reaches the tag job, so a tag always means "this was live".
- `if: github.event_name == 'push'` — manual dispatches are skipped, so a
  rollback re-deploying `v1.0.4` does not mint a `v1.0.8` pointing at old code.

### Cutting a deliberate version

The automatic tags now move whichever number the commits earned, so a minor or
major release usually arrives on its own. To name one anyway — a milestone, or a
version you want the `dist/` zip attached to:

```bash
npm version minor      # or major
git push --follow-tags
```

That tag triggers [release.yml](../.github/workflows/release.yml), which builds
from the tag and attaches `dj-hands-vX.Y.Z.zip` — the built `dist/`, useful as a
bundle that needs no rebuild. Automatic per-deploy releases carry notes only; at
one deploy per push, attaching a 16 MB bundle to each would add up fast.

After a manual `v1.1.0`, the automatic tags continue from it — `v1.1.1` for a
fix, `v1.2.0` for the next `feat`.

### Why package.json drifts

The tag job does not commit a version bump back to `main` — that push would
trigger another deploy, which would tag again, forever. So `package.json` stays
where you last set it by hand while the tags climb past it. The tags are the
source of truth for what shipped; `package.json` marks your last deliberate
version.

## Rollback

Three options, cheapest first.

**Redeploy an older version.** Pick the last good version off the
[releases page](https://github.com/yusif-projects/dj-hands/releases), then
Actions → *Deploy to GitHub Pages* → *Run workflow*, and put that tag in the
`ref` box (a branch or commit SHA works too). The workflow
definition comes from `main` but the code is built from whatever you named, so
`v1.0.0` puts `v1.0.0` back on the live site in a couple of minutes. `main` is
untouched — the next push to it deploys again, so this is a stopgap, not a fix.

**Re-run an earlier deploy.** Actions → pick the last good run of *Deploy to
GitHub Pages* → *Re-run all jobs*. Same effect, no typing, but only reaches runs
still in the retention window.

**Revert on `main`.** `git revert <sha>` and push — the permanent fix, and the
only one of the three that stops the next push from bringing the breakage back.

The zip on each release is the fallback if a rebuild itself is what broke: it
needs no `npm ci`, no model fetch, and no network — unzip it and serve it
anywhere.
