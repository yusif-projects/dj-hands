/**
 * Build-time entry, never imported by the app.
 *
 * The whole pitch for DJ Hands lives in `StartScreen` and `Landing`, which
 * means that before this existed the served HTML was an empty `<div id="root">`
 * and the only thing a crawler could read about the site was its title tag.
 * `scripts/prerender.mjs` builds this module for Node, calls `render()`, and
 * writes the result into `dist/index.html`.
 *
 * On the client `main.tsx` still calls `createRoot`, not `hydrateRoot`:
 * `createRoot().render()` clears whatever is in the container first, so the
 * prerendered markup is simply replaced. Hydration would be wrong here — this
 * renders only the not-yet-started branch of `App`, so the two trees diverge
 * the moment a session begins.
 *
 * Everything reachable from here has to run in Node. That rules out any module
 * touching `window`, `document` or `tone` at import time, which is why
 * `audio/` keeps its data modules free of the Tone import.
 */
import { renderToStaticMarkup } from 'react-dom/server'
import { StartScreen } from './components/StartScreen'
import { faqJsonLd } from './components/faq'

export interface Prerendered {
  /** Markup for `<div id="root">`. */
  body: string
  /** A `FAQPage` block for `<head>`, built from the same array `Landing` renders. */
  jsonLd: string
}

export function render(): Prerendered {
  // The shell `App` renders before Start is pressed. Reproduced rather than
  // imported: App runs camera and audio effects on mount, none of which exist
  // in Node. `loading` and `error` are App's real initial state, so the markup
  // matches the first client paint.
  const body = renderToStaticMarkup(
    <div className="app">
      <div className="stage">
        <video className="camera" playsInline muted autoPlay />
        <canvas className="overlay" />
      </div>
      <StartScreen onStart={() => {}} loading={false} error={null} />
    </div>,
  )

  return { body, jsonLd: faqJsonLd() }
}
