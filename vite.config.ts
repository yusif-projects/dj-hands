import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative asset paths so the built `dist/` can be opened by any plain static
  // server (VS Code Live Server, `python -m http.server`, GitHub Pages subpaths)
  // without being mounted at the domain root.
  base: './',
})
