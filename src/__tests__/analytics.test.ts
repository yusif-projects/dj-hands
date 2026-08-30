import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushSettled, track, trackSettled } from '../analytics'

type Hit = { event: string; params?: Record<string, unknown> }

let hits: Hit[]

beforeEach(() => {
  vi.useFakeTimers()
  hits = []
  // Tests run in node, with no DOM: stand in for the tag the Vite plugin injects.
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      gtag: (_command: string, event: string, params?: Record<string, unknown>) => {
        hits.push({ event, params })
      },
    },
  })
})

afterEach(() => {
  // Anything still pending would fire into the next test's array.
  flushSettled()
  vi.useRealTimers()
})

describe('track', () => {
  it('sends the event and its params straight through', () => {
    track('session_started')
    track('setting_changed', { setting: 'waveform', value: 'square' })
    expect(hits).toEqual([
      { event: 'session_started', params: undefined },
      { event: 'setting_changed', params: { setting: 'waveform', value: 'square' } },
    ])
  })

  // Dev builds and forks ship no tag at all, and must not throw for it.
  it('does nothing when the tag never loaded', () => {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: {} })
    expect(() => track('session_started')).not.toThrow()
  })
})

describe('trackSettled', () => {
  it('waits for the control to stop moving', () => {
    trackSettled('attack', 'setting_changed', { setting: 'attack', value: 0.1 })
    vi.advanceTimersByTime(400)
    expect(hits).toHaveLength(0)
    vi.advanceTimersByTime(400)
    expect(hits).toHaveLength(1)
  })

  // The point of the debounce: a drag passes through dozens of values and only
  // the one it lands on was chosen.
  it('reports the value it settled on, once', () => {
    for (const value of [0.1, 0.2, 0.3, 0.4]) {
      trackSettled('attack', 'setting_changed', { setting: 'attack', value })
      vi.advanceTimersByTime(100)
    }
    vi.advanceTimersByTime(1000)
    expect(hits).toEqual([{ event: 'setting_changed', params: { setting: 'attack', value: 0.4 } }])
  })

  it('keeps two controls moved together apart', () => {
    trackSettled('attack', 'setting_changed', { setting: 'attack', value: 0.1 })
    trackSettled('decay', 'setting_changed', { setting: 'decay', value: 0.5 })
    vi.advanceTimersByTime(1000)
    expect(hits.map((h) => h.params?.setting).sort()).toEqual(['attack', 'decay'])
  })

  it('starts the wait again on every move', () => {
    trackSettled('attack', 'setting_changed', { setting: 'attack', value: 0.1 })
    vi.advanceTimersByTime(600)
    trackSettled('attack', 'setting_changed', { setting: 'attack', value: 0.2 })
    vi.advanceTimersByTime(600)
    expect(hits).toHaveLength(0)
    vi.advanceTimersByTime(200)
    expect(hits).toHaveLength(1)
  })
})

describe('flushSettled', () => {
  it('sends what is still waiting, so a session ending does not lose it', () => {
    trackSettled('attack', 'setting_changed', { setting: 'attack', value: 0.3 })
    trackSettled('decay', 'setting_changed', { setting: 'decay', value: 0.6 })
    flushSettled()
    expect(hits).toHaveLength(2)
  })

  it('does not let a flushed event fire again on its timer', () => {
    trackSettled('attack', 'setting_changed', { setting: 'attack', value: 0.3 })
    flushSettled()
    vi.advanceTimersByTime(2000)
    expect(hits).toHaveLength(1)
  })

  it('is a no-op with nothing pending', () => {
    flushSettled()
    expect(hits).toHaveLength(0)
  })
})
