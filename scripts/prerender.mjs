// Runs after `vite build` (as npm's `postbuild`) and makes the shipped HTML
// readable without JavaScript.
//
// Vite emits `dist/index.html` with an empty `<div id="root">`, so every word
// describing DJ Hands — the pitch, the feature list, the FAQ — used to exist
// only after the bundle executed. Google renders JS on a deferred second pass;
// Bing, DuckDuckGo and the LLM crawlers largely do not. This step renders the
// start screen to static markup and writes it into the file, so the copy is in
// the HTML itself.
//
// It is a postbuild pass rather than a Vite plugin because `transformIndexHtml`
// cannot import a .tsx module during a build without standing up a second
// module runner. Rewriting the emitted file afterwards is the same result and a
// tenth of the machinery.
//
// Any failure here exits non-zero. A silent skip would quietly ship the empty
// body again, which is exactly the bug this exists to prevent.
import { readFile, writeFile, rm } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { build } from 'vite'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const indexPath = join(root, 'dist', 'index.html')
const sitemapPath = join(root, 'dist', 'sitemap.xml')
const ROOT_DIV = '<div id="root"></div>'

// Built for Node in a throwaway directory. It has to sit under the project
// rather than in the OS temp dir: the bundle imports `react-dom/server` by bare
// specifier, which only resolves from a path that can walk up to node_modules.
// `configFile: false` is what keeps this from recursing back through
// vite.config.ts (and re-injecting the analytics tag into a bundle that has no
// HTML to put it in).
const outDir = join(root, 'node_modules', '.prerender')
try {
  await build({
    root,
    configFile: false,
    logLevel: 'warn',
    plugins: [(await import('@vitejs/plugin-react')).default()],
    build: {
      outDir,
      emptyOutDir: true,
      ssr: 'src/prerender.tsx',
      // React resolves through the bare specifier at runtime instead of being
      // inlined; this bundle is thrown away the moment it has produced a string.
      rollupOptions: { external: ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/server'] },
    },
  })

  const { render } = await import(pathToFileURL(join(outDir, 'prerender.js')).href)
  const { body, jsonLd } = render()

  let html = await readFile(indexPath, 'utf8')
  if (!html.includes(ROOT_DIV)) {
    throw new Error(`prerender: ${ROOT_DIV} not found in dist/index.html — nothing to fill`)
  }

  html = html.replace(ROOT_DIV, `<div id="root">${body}</div>`)
  html = html.replace(
    '</head>',
    `  <script type="application/ld+json">\n${jsonLd}\n    </script>\n  </head>`,
  )
  await writeFile(indexPath, html)
  console.log(`prerender: ${(body.length / 1024).toFixed(1)} kB of markup into dist/index.html`)

  // Stamped at build time so the sitemap's lastmod is the deploy date rather
  // than whenever somebody last remembered to edit the file by hand.
  const today = new Date().toISOString().slice(0, 10)
  const sitemap = await readFile(sitemapPath, 'utf8')
  await writeFile(sitemapPath, sitemap.replace(/<lastmod>.*?<\/lastmod>/, `<lastmod>${today}</lastmod>`))
  console.log(`sitemap: lastmod ${today}`)
} finally {
  await rm(outDir, { recursive: true, force: true })
}
