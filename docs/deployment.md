# Deployment

The site is a static bundle served from GitHub Pages at
**[www.dj-hands.com](https://www.dj-hands.com)**.

## Pipeline

[.github/workflows/deploy.yml](../.github/workflows/deploy.yml) runs on every
push to `main`, and on manual dispatch:

```
checkout → setup-node 22 (npm cache) → npm ci → npm run build → upload dist/ → deploy-pages
```

`npm run build` triggers `prebuild`, which runs `scripts/fetch-assets.mjs` —
downloading the MediaPipe model and copying the WASM runtime into `public/`
before Vite builds. Neither is committed to the repo, so this step is what makes
the deployed bundle self-contained.

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

## Rollback

Deployments are per-commit. To roll back, revert the offending commit on `main`
and let the workflow redeploy, or re-run an earlier successful workflow run from
the Actions tab.
