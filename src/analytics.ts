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

/** Quiet time a continuous control must sit still before it reports. */
const SETTLE_MS = 700

export function track(event: string, params?: Record<string, unknown>): void {
  window.gtag?.('event', event, params)
}

/**
 * A knob drag emits a value on every pointer move, and a slider on every step
 * crossed — sending each one would bury the value that was actually chosen
 * under a hundred it merely passed through. Only the value a control settles on
 * is reported, keyed so two controls moved together do not cancel each other.
 */
const pending = new Map<string, { timer: ReturnType<typeof setTimeout>; send: () => void }>()

export function trackSettled(key: string, event: string, params?: Record<string, unknown>): void {
  const waiting = pending.get(key)
  if (waiting) clearTimeout(waiting.timer)
  const send = () => {
    pending.delete(key)
    track(event, params)
  }
  pending.set(key, { timer: setTimeout(send, SETTLE_MS), send })
}

/**
 * Fires every debounced event still waiting. Called as a session ends — a knob
 * nudged in the last half-second is exactly the kind of change worth keeping,
 * and the page may not be alive when its timer would have run.
 */
export function flushSettled(): void {
  for (const { timer, send } of [...pending.values()]) {
    clearTimeout(timer)
    send()
  }
}
