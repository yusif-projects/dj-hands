import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

/**
 * Injects the Google Analytics (GA4) tag into index.html.
 *
 * The measurement id comes from `VITE_GA_ID` — set in `.env.production` so the
 * tag ships with deployed builds only, and `npm run dev` never reports traffic.
 * A missing or malformed id is simply skipped, which keeps local builds and
 * forks free of a broken (or somebody else's) tag.
 */
function googleAnalytics(mode: string): Plugin {
  const id = loadEnv(mode, process.cwd(), 'VITE_').VITE_GA_ID?.trim()
  const enabled = !!id && /^G-[A-Z0-9]+$/.test(id)

  return {
    name: 'google-analytics',
    transformIndexHtml() {
      if (!enabled) return []
      return [
        {
          tag: 'link',
          attrs: { rel: 'preconnect', href: 'https://www.googletagmanager.com' },
          injectTo: 'head',
        },
        {
          tag: 'script',
          attrs: { async: true, src: `https://www.googletagmanager.com/gtag/js?id=${id}` },
          injectTo: 'head',
        },
        {
          tag: 'script',
          children: [
            'window.dataLayer = window.dataLayer || [];',
            'function gtag(){dataLayer.push(arguments);}',
            "gtag('js', new Date());",
            `gtag('config', '${id}');`,
          ].join('\n'),
          injectTo: 'head',
        },
      ]
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), googleAnalytics(mode)],
  // Relative asset paths so the built `dist/` can be opened by any plain static
  // server (VS Code Live Server, `python -m http.server`, GitHub Pages subpaths)
  // without being mounted at the domain root.
  base: './',
}))
