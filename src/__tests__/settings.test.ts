import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '../state/settings'
import { SECTION_COUNT } from '../audio/sections'

const KEY = 'gesture-music.settings.v4'
const LEGACY = 'gesture-music.settings.v3'

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

describe('loadSettings', () => {
  it('returns the defaults when nothing is stored', () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('round-trips through saveSettings', () => {
    const settings = { ...DEFAULT_SETTINGS, octave: 4, activeSection: 0 }
    saveSettings(settings)
    expect(loadSettings()).toEqual(settings)
  })

  it('falls back to the defaults on an unreadable blob', () => {
    store.set(KEY, 'not json')
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })
})

describe('section normalization', () => {
  it('pins the section count whatever length was stored', () => {
    for (const sections of [[], [{ name: 'a', enabled: true, slots: [] }], new Array(9).fill({}), 'nope']) {
      store.set(KEY, JSON.stringify({ sections }))
      expect(loadSettings().sections).toHaveLength(SECTION_COUNT)
    }
  })

  it('keeps the first section on however it was stored', () => {
    store.set(KEY, JSON.stringify({ sections: [{ name: 'x', enabled: false, slots: [] }] }))
    expect(loadSettings().sections[0].enabled).toBe(true)
  })

  it('validates each section its own slots', () => {
    store.set(
      KEY,
      JSON.stringify({
        sections: [
          { name: 'Verse', enabled: true, slots: [{ chord: 'Dm7', inversion: 1, bass: 'A', octave: 1 }] },
          { name: 'Chorus', enabled: true, slots: [{ chord: 'nonsense', inversion: 99, bass: 'H', octave: 42 }] },
        ],
      }),
    )
    const [verse, chorus] = loadSettings().sections
    expect(verse.slots[0]).toEqual({ chord: 'Dm7', inversion: 1, bass: 'A', octave: 1 })
    // An unknown name falls back to the slot's default; the numbers clamp, and
    // an unknown bass reads as no slash bass at all.
    expect(chorus.slots[0]).toEqual({ chord: 'C', inversion: 2, bass: null, octave: 2 })
    expect(chorus.slots).toHaveLength(DEFAULT_SETTINGS.sections[0].slots.length)
  })

  it('truncates an over-long name rather than rejecting it', () => {
    store.set(KEY, JSON.stringify({ sections: [{ name: 'x'.repeat(80), enabled: true, slots: [] }] }))
    expect(loadSettings().sections[0].name).toBe('x'.repeat(18))
  })
})

describe('activeSection normalization', () => {
  const sections = (enabled: boolean[]) => enabled.map((e) => ({ name: '', enabled: e, slots: [] }))

  it('keeps an index that points at a section that is on', () => {
    store.set(KEY, JSON.stringify({ sections: sections([true, true, true]), activeSection: 2 }))
    expect(loadSettings().activeSection).toBe(2)
  })

  it('falls back when the stored index points at a section that is off', () => {
    store.set(KEY, JSON.stringify({ sections: sections([false, true, false]), activeSection: 4 }))
    // Index 0 is forced back on, so that is where it lands.
    expect(loadSettings().activeSection).toBe(0)

    store.set(KEY, JSON.stringify({ sections: sections([true, true]), activeSection: 3 }))
    expect(loadSettings().activeSection).toBe(0)
  })

  it('clamps an out-of-range or nonsense index', () => {
    for (const activeSection of [-3, 99, 'two', null]) {
      store.set(KEY, JSON.stringify({ sections: sections([true, true]), activeSection }))
      const { activeSection: index } = loadSettings()
      expect(index).toBeGreaterThanOrEqual(0)
      expect(index).toBeLessThan(SECTION_COUNT)
    }
  })
})

describe('the v3 migration', () => {
  const v3 = {
    chordSlots: [{ chord: 'Dm', inversion: 0, bass: null, octave: -1 }],
    octave: 5,
    swapHands: true,
  }

  it('lands the old chords in the first section and keeps the other keys', () => {
    store.set(LEGACY, JSON.stringify(v3))
    const settings = loadSettings()

    expect(settings.sections[0].slots[0]).toEqual(v3.chordSlots[0])
    expect(settings.sections[0].enabled).toBe(true)
    expect(settings.sections.slice(1).every((s) => !s.enabled)).toBe(true)
    expect(settings.octave).toBe(5)
    expect(settings.swapHands).toBe(true)
  })

  it('consumes the old key so it is never migrated twice', () => {
    store.set(LEGACY, JSON.stringify(v3))
    loadSettings()
    expect(store.has(LEGACY)).toBe(false)
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('is skipped once a v4 blob exists', () => {
    store.set(LEGACY, JSON.stringify(v3))
    store.set(KEY, JSON.stringify({ octave: 2 }))
    expect(loadSettings().octave).toBe(2)
    expect(store.has(LEGACY)).toBe(true)
  })
})
