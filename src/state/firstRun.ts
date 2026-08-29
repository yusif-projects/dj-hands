/**
 * Whether this browser has already been walked through the gestures. Like the
 * open panel group in `panel.ts`, it is UI chrome rather than sound
 * configuration, so it lives outside `Settings` and under its own key: "Reset to
 * defaults" spreads `DEFAULT_SETTINGS` wholesale, and a flag stored in there
 * would make resetting the sound replay the walkthrough as a side effect.
 */

const COACH_KEY = 'gesture-music.coach-done'

export function loadCoachDone(): boolean {
  try {
    // Anything that is not our own marker reads as "not yet", so a garbage value
    // costs a repeat rather than skipping the thing the flag gates.
    return localStorage.getItem(COACH_KEY) === '1'
  } catch {
    return false
  }
}

/** Settable both ways — "Replay walkthrough" clears it. */
export function setCoachDone(done: boolean): void {
  try {
    if (done) localStorage.setItem(COACH_KEY, '1')
    else localStorage.removeItem(COACH_KEY)
  } catch {
    // Storage can be unavailable (private mode); the flag just won't persist.
  }
}
