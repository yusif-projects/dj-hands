# Deployment

The site is a static bundle served from GitHub Pages at
**[www.dj-hands.com](https://www.dj-hands.com)**.

## Pipeline

[.github/workflows/deploy.yml](../.github/workflows/deploy.yml) runs on every
push to `main`, and on manual dispatch — where an optional `ref` input picks
which tag, branch, or commit to build (see [rollback](#rollback)):

```
checkout → setup-node 22 (npm cache) → npm ci → lint → test → npm run build → upload dist/ → deploy-pages
```

`npm run build` triggers `prebuild`, which runs `scripts/fetch-assets.mjs` —
downloading the MediaPipe model and copying the WASM runtime into `public/`
before Vite builds. Neither is committed to the repo, so this step is what makes
the deployed bundle self-contained.

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

`dist/` contains the hashed JS/CSS bundle, `index.html` with the analytics tag
injected, everything from `public/`, and the vendored `models/` and `wasm/`
directories. The model alone is the bulk of the transfer — it is fetched once
and then cached by the browser.

Because `base: './'` is set, `dist/` can also be served from a subdirectory or
opened by any plain static server. See
[troubleshooting](troubleshooting.md#vs-code-live-server) for the Live Server
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

`src/analytics.ts` is a one-function wrapper:

```ts
export function track(event: string, params?: Record<string, unknown>): void {
  window.gtag?.('event', event, params)
}
```

`gtag` is absent whenever the tag was not injected, so every call is a no-op in
dev. Beyond the automatic page view, the app sends two events:

| Event | When | Params |
| --- | --- | --- |
| `session_started` | Camera, audio, and tracker all came up | — |
| `session_start_failed` | Any part of startup threw | `reason` — the first line of the error |

`session_start_failed` reasons are worth watching: they surface WebGL-disabled
browsers, denied camera permissions, and missing cameras as a distribution
rather than one-off reports.

**Forking this repo:** clear `VITE_GA_ID` in `.env.production`, or replace it
with your own measurement id. Leaving it as-is sends your traffic to the
original property.

## SEO and social

[index.html](../index.html) carries a full metadata set — canonical URL, Open
Graph, Twitter card, theme color, and a `WebApplication` JSON-LD block naming
the author and stating it is free. `public/og.png` is the 1200×630 preview
image; `robots.txt` allows everything and points at `sitemap.xml`, which lists
the single URL.

If the domain changes, these absolute URLs need updating together:
`index.html` (canonical, `og:url`, `og:image`, `twitter:image`, JSON-LD `url`),
`public/robots.txt`, `public/sitemap.xml`, and `public/CNAME`.

## Releases

Every deploy is per-commit, which makes "what is live right now?" hard to answer
after a few pushes. Tags fix that: a tag names a build you are willing to go
back to.

```bash
npm version patch    # or minor / major — bumps package.json, commits, tags v1.0.1
git push --follow-tags
```

Pushing a `v*` tag triggers
[.github/workflows/release.yml](../.github/workflows/release.yml), which lints,
tests, and builds from that exact tag, then publishes a GitHub Release with
auto-generated notes (every PR and commit since the previous tag) and attaches
`dj-hands-vX.Y.Z.zip` — the built `dist/` for that version.

The release job is independent of the deploy job. `main` still deploys on every
push; tagging just marks a point in that history as a known-good version, and
the attached zip is the byte-for-byte bundle that was live.

## Rollback

Three options, cheapest first.

**Redeploy an older version.** Actions → *Deploy to GitHub Pages* → *Run
workflow*, and put a tag, branch, or commit SHA in the `ref` box. The workflow
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
