/**
 * Which camera the player picked. Like the panel group this is device chrome
 * rather than sound configuration, so it lives outside `Settings` and under its
 * own key — "Reset to defaults" spreads `DEFAULT_SETTINGS` wholesale, and the
 * camera stored in there would be swapped out from under a running session.
 *
 * The id is per-browser and per-origin, and it survives a replug only sometimes,
 * so a stored id is a preference to try rather than a guarantee; `useCamera`
 * asks for it with `ideal` and takes whatever actually opens.
 */

const STORAGE_KEY = 'gesture-music.camera-id'

export function loadCameraId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function saveCameraId(id: string | null): void {
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage can be unavailable (private mode); the choice just won't persist.
  }
}
