import { beforeEach, describe, expect, it } from 'vitest'
import { loadCoachDone, setCoachDone } from '../state/firstRun'

const COACH_KEY = 'gesture-music.coach-done'

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

describe('loadCoachDone', () => {
  it('reads false on an empty store', () => {
    expect(loadCoachDone()).toBe(false)
  })

  it('round-trips both ways, so "Replay walkthrough" can clear it', () => {
    setCoachDone(true)
    expect(loadCoachDone()).toBe(true)
    setCoachDone(false)
    expect(loadCoachDone()).toBe(false)
  })

  // Failing open would skip the very thing the flag gates, so anything that is
  // not our own marker has to read as "not yet".
  it('treats a value we did not write as not yet done', () => {
    store.set(COACH_KEY, 'true')
    expect(loadCoachDone()).toBe(false)
  })
})

describe('storage failures', () => {
  it('read as not-yet-done rather than throwing', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('denied')
      },
    })
    expect(loadCoachDone()).toBe(false)
    expect(() => setCoachDone(true)).not.toThrow()
  })
})
