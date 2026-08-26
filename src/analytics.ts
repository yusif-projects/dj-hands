/**
 * Thin wrapper over the Google Analytics tag injected by the `google-analytics`
 * Vite plugin. `gtag` is absent in dev and in builds made without a measurement
 * id, so every call here is a no-op unless the tag actually loaded.
 */
declare global {
  interface Window {
    gtag?: (command: string, ...args: unknown[]) => void
  }
}

export function track(event: string, params?: Record<string, unknown>): void {
  window.gtag?.('event', event, params)
}
