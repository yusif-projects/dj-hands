import { beforeEach, describe, expect, it } from 'vitest'
import { loadCameraId, saveCameraId } from '../state/camera'

const KEY = 'gesture-music.camera-id'

// Tests run in node, with no DOM: the persistence layer needs a store to talk to.
const store = new Map<string, string>()
beforeEach(() => {
  store.clear()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  })
})

describe('camera id storage', () => {
  it('remembers nothing before a camera has been picked', () => {
    expect(loadCameraId()).toBeNull()
  })

  it('round-trips a device id', () => {
    saveCameraId('abc123')
    expect(loadCameraId()).toBe('abc123')
  })

  // Clearing has to remove the key rather than store an empty string, or the
  // next start would ask for a camera whose id is "".
  it('clears the stored id on null', () => {
    saveCameraId('abc123')
    saveCameraId(null)
    expect(store.has(KEY)).toBe(false)
    expect(loadCameraId()).toBeNull()
  })

  it('survives storage being unavailable', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('denied')
      },
    })
    expect(() => saveCameraId('abc123')).not.toThrow()
    expect(loadCameraId()).toBeNull()
  })
})
