import { beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS,
  applySong,
  loadSettings,
  saveSettings,
  toSong,
} from '../state/settings'
import { DEFAULT_ARP } from '../audio/arp'
import { BPM_RANGE, DEFAULT_TIMING, EFFECT_IDS, isTimed } from '../audio/effects'
import { SECTION_COUNT } from '../audio/sections'

const KEY = 'gesture-music.settings.v5'
const V4 = 'gesture-music.settings.v4'
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

describe('accidental', () => {
  it('defaults to sharps and keeps a stored spelling', () => {
    expect(loadSettings().accidental).toBe('sharp')
    store.set(KEY, JSON.stringify({ accidental: 'flat' }))
    expect(loadSettings().accidental).toBe('flat')
  })

  it('falls back to sharps on a value it does not know', () => {
    store.set(KEY, JSON.stringify({ accidental: 'natural' }))
    expect(loadSettings().accidental).toBe('sharp')
  })
})

describe('filter type', () => {
  it('defaults to lowpass and keeps a stored type', () => {
    expect(loadSettings().filterType).toBe('lowpass')
    store.set(KEY, JSON.stringify({ filterType: 'bandpass' }))
    expect(loadSettings().filterType).toBe('bandpass')
  })

  it('falls back to lowpass on a value it does not know', () => {
    store.set(KEY, JSON.stringify({ filterType: 'notchpass' }))
    expect(loadSettings().filterType).toBe('lowpass')
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

  it('is skipped once a current blob exists', () => {
    store.set(LEGACY, JSON.stringify(v3))
    store.set(KEY, JSON.stringify({ octave: 2 }))
    expect(loadSettings().octave).toBe(2)
    expect(store.has(LEGACY)).toBe(true)
  })

  it('picks up the effects rack the old blob never had', () => {
    store.set(LEGACY, JSON.stringify(v3))
    expect(loadSettings().effects).toEqual(DEFAULT_SETTINGS.effects)
  })
})

describe('the v5 migration', () => {
  const amounts = (settings: ReturnType<typeof loadSettings>) =>
    Object.fromEntries(settings.effects.map((effect) => [effect.id, effect.amount]))
  /** Every effect silent — the send could only ever reach delay and reverb. */
  const bypassed = Object.fromEntries(EFFECT_IDS.map((id) => [id, 0]))

  it('lands the old send on the effect it named, and keeps the other keys', () => {
    store.set(V4, JSON.stringify({ sendTarget: 'delay', sendAmount: 0.6, octave: 5 }))
    const settings = loadSettings()

    expect(amounts(settings)).toEqual({ ...bypassed, delay: 0.6 })
    expect(settings.octave).toBe(5)
  })

  it('splits a `both` send across delay and reverb', () => {
    store.set(V4, JSON.stringify({ sendTarget: 'both', sendAmount: 0.6 }))
    expect(amounts(loadSettings())).toEqual({ ...bypassed, delay: 0.6, reverb: 0.6 })
  })

  // A v4 blob with no send still played the old defaults, so it migrates to
  // them rather than to silence.
  it('falls back to the old defaults when the send was never stored', () => {
    store.set(V4, JSON.stringify({ octave: 2 }))
    expect(amounts(loadSettings())).toEqual({ ...bypassed, reverb: 0.25 })
  })

  it('falls back to the old default target on one it does not know', () => {
    store.set(V4, JSON.stringify({ sendTarget: 'chorus', sendAmount: 0.4 }))
    expect(amounts(loadSettings())).toEqual({ ...bypassed, reverb: 0.4 })
  })

  it('starts the chain in its default order', () => {
    store.set(V4, JSON.stringify({ sendTarget: 'reverb', sendAmount: 0.5 }))
    expect(loadSettings().effects.map((effect) => effect.id)).toEqual(
      DEFAULT_SETTINGS.effects.map((effect) => effect.id),
    )
  })

  it('consumes the old key so it is never migrated twice', () => {
    store.set(V4, JSON.stringify({ sendTarget: 'delay', sendAmount: 0.6 }))
    loadSettings()
    expect(store.has(V4)).toBe(false)
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('takes the v4 blob over an older v3 one, leaving v3 where it is', () => {
    store.set(LEGACY, JSON.stringify({ chordSlots: [], octave: 5 }))
    store.set(V4, JSON.stringify({ octave: 2 }))
    expect(loadSettings().octave).toBe(2)
    expect(store.has(LEGACY)).toBe(true)
  })

  it('falls back to the defaults on an unreadable v4 blob', () => {
    store.set(V4, 'not json')
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
    expect(store.has(V4)).toBe(false)
  })
})

describe('effects', () => {
  it('defaults to the stock rack', () => {
    expect(loadSettings().effects).toEqual(DEFAULT_SETTINGS.effects)
  })

  it('keeps a stored order and its amounts', () => {
    const effects = [...EFFECT_IDS].reverse().map((id, i) => ({
      id,
      amount: (i + 1) / 10,
      ...(isTimed(id) ? { timing: { ...DEFAULT_TIMING[id]! } } : {}),
    }))
    store.set(KEY, JSON.stringify({ effects }))
    expect(loadSettings().effects).toEqual(effects)
  })

  it('repairs a rack that lost an effect', () => {
    store.set(KEY, JSON.stringify({ effects: [{ id: 'delay', amount: 1 }] }))
    expect(loadSettings().effects.map((effect) => effect.id)).toEqual([
      'delay',
      ...EFFECT_IDS.filter((id) => id !== 'delay'),
    ])
  })
})

describe('the arpeggiator', () => {
  it('round-trips', () => {
    const arp = { ...DEFAULT_ARP, enabled: true, pattern: 'updown' as const, octaves: 3 }
    saveSettings({ ...DEFAULT_SETTINGS, arp })
    expect(loadSettings().arp).toEqual(arp)
  })

  /**
   * The key was added without a storage version bump, on the promise that a blob
   * from before it simply picks up the default — and that the default is silent,
   * so an update never starts arpeggiating under a returning player.
   */
  it('is picked up by a stored blob from before it existed', () => {
    const { arp, ...before } = DEFAULT_SETTINGS
    store.set(KEY, JSON.stringify({ ...before, octave: 4 }))
    const loaded = loadSettings()
    expect(loaded.arp).toEqual(DEFAULT_ARP)
    expect(loaded.arp.enabled).toBe(false)
    expect(loaded.octave).toBe(4)
    expect(arp).toEqual(DEFAULT_ARP)
  })

  it('normalizes a hand-edited one rather than trusting it', () => {
    store.set(KEY, JSON.stringify({ ...DEFAULT_SETTINGS, arp: { pattern: 'sideways', octaves: 99 } }))
    const loaded = loadSettings()
    expect(loaded.arp.pattern).toBe(DEFAULT_ARP.pattern)
    expect(loaded.arp.octaves).toBe(3)
    expect(loaded.arp.enabled).toBe(false)
  })

  /** The nested timing is the half a shallow copy would leave shared. */
  it('is a deep copy of the module default, and so is a loaded one', () => {
    expect(DEFAULT_SETTINGS.arp).not.toBe(DEFAULT_ARP)
    expect(DEFAULT_SETTINGS.arp.timing).not.toBe(DEFAULT_ARP.timing)

    saveSettings(DEFAULT_SETTINGS)
    expect(loadSettings().arp.timing).not.toBe(DEFAULT_SETTINGS.arp.timing)
  })
})

describe('bpm', () => {
  it('defaults to the stock tempo', () => {
    expect(loadSettings().bpm).toBe(DEFAULT_SETTINGS.bpm)
  })

  it('keeps a stored tempo', () => {
    store.set(KEY, JSON.stringify({ bpm: 96 }))
    expect(loadSettings().bpm).toBe(96)
  })

  it('clamps one outside the knob range', () => {
    store.set(KEY, JSON.stringify({ bpm: 5 }))
    expect(loadSettings().bpm).toBe(BPM_RANGE.min)
    store.set(KEY, JSON.stringify({ bpm: 5000 }))
    expect(loadSettings().bpm).toBe(BPM_RANGE.max)
  })

  it('falls back on one it cannot read', () => {
    store.set(KEY, JSON.stringify({ bpm: 'fast' }))
    expect(loadSettings().bpm).toBe(DEFAULT_SETTINGS.bpm)
  })

  it('survives a round trip', () => {
    saveSettings({ ...DEFAULT_SETTINGS, bpm: 144 })
    expect(loadSettings().bpm).toBe(144)
  })

  // Both the tempo and the rack's timing are purely additive, which is exactly
  // the case `STORAGE_KEY` does not need bumping for.
  it('is picked up by a blob stored before it existed, rack intact', () => {
    store.set(KEY, JSON.stringify({ octave: 4, effects: [{ id: 'delay', amount: 0.8 }] }))
    const settings = loadSettings()

    expect(settings.bpm).toBe(DEFAULT_SETTINGS.bpm)
    expect(settings.octave).toBe(4)
    const delay = settings.effects.find((effect) => effect.id === 'delay')!
    expect(delay.amount).toBe(0.8)
    expect(delay.timing).toEqual(DEFAULT_TIMING.delay)
  })
})

describe('the song slice', () => {
  it('carries every musical field and none of the ones about the room', () => {
    const song = toSong(DEFAULT_SETTINGS)

    expect(song.sections).toBe(DEFAULT_SETTINGS.sections)
    expect(song.voice).toBe(DEFAULT_SETTINGS.voice)
    expect(song.effects).toBe(DEFAULT_SETTINGS.effects)
    expect(song.arp).toBe(DEFAULT_SETTINGS.arp)
    expect(song.bpm).toBe(DEFAULT_SETTINGS.bpm)
    expect(song.octave).toBe(DEFAULT_SETTINGS.octave)

    // A song that carried these would re-tune the tracking of whoever it was
    // sent to, and would put a storage write on every gesture section switch.
    expect(song).not.toHaveProperty('activeSection')
    expect(song).not.toHaveProperty('debounceFrames')
    expect(song).not.toHaveProperty('swapHands')
    expect(song).not.toHaveProperty('showOverlay')
    expect(song).not.toHaveProperty('reactiveOverlay')
  })

  // The slice is shallow, which is only safe because every editor path in the
  // panel spreads rather than mutating. This is that guarantee, written down.
  it('is not disturbed by a later edit to the settings it came from', () => {
    const settings = { ...DEFAULT_SETTINGS, bpm: 100 }
    const song = toSong(settings)

    const edited = {
      ...settings,
      bpm: 160,
      sections: settings.sections.map((section, i) =>
        i === 0
          ? { ...section, slots: section.slots.map((slot) => ({ ...slot, chord: 'Bm' as const })) }
          : section,
      ),
    }

    expect(edited.sections[0].slots[0].chord).toBe('Bm')
    expect(song.bpm).toBe(100)
    expect(song.sections[0].slots[0].chord).toBe(DEFAULT_SETTINGS.sections[0].slots[0].chord)
  })
})

describe('applySong', () => {
  it('replaces what you hear and leaves the tracking alone', () => {
    const song = toSong({ ...DEFAULT_SETTINGS, bpm: 90, octave: 5 })
    const mine = { ...DEFAULT_SETTINGS, debounceFrames: 9, swapHands: true, showOverlay: false }

    const next = applySong(mine, song)

    expect(next.bpm).toBe(90)
    expect(next.octave).toBe(5)
    expect(next.debounceFrames).toBe(9)
    expect(next.swapHands).toBe(true)
    expect(next.showOverlay).toBe(false)
  })

  // The debouncer only reports a finger count when it changes, so a hand held
  // at three fingers would not re-select until it moved.
  it('keeps the section you are standing on when the song has it on', () => {
    const song = toSong({
      ...DEFAULT_SETTINGS,
      sections: DEFAULT_SETTINGS.sections.map((s, i) => (i === 2 ? { ...s, enabled: true } : s)),
    })

    expect(applySong({ ...DEFAULT_SETTINGS, activeSection: 2 }, song).activeSection).toBe(2)
  })

  it('falls back to the first section that is on when the song has it off', () => {
    const song = toSong(DEFAULT_SETTINGS)

    expect(applySong({ ...DEFAULT_SETTINGS, activeSection: 2 }, song).activeSection).toBe(0)
  })
})

// These four rode the spread unvalidated until a song could arrive from
// somebody else's clipboard. A pasted `volumeTop` of 1e9 mutes the instrument
// with nothing on screen to explain it.
describe('the fields a pasted song could otherwise bend', () => {
  it('clamps an octave outside what the slider offers', () => {
    store.set(KEY, JSON.stringify({ octave: 99 }))
    expect(loadSettings().octave).toBe(5)

    store.set(KEY, JSON.stringify({ octave: -4 }))
    expect(loadSettings().octave).toBe(1)
  })

  it('clamps a volume range outside the frame', () => {
    store.set(KEY, JSON.stringify({ volumeTop: 1e9, volumeBottom: -1 }))
    const settings = loadSettings()

    expect(settings.volumeTop).toBe(0.5)
    expect(settings.volumeBottom).toBe(0.5)
  })

  it('clamps steadiness and falls back on a value that is not a number', () => {
    store.set(KEY, JSON.stringify({ debounceFrames: 400 }))
    expect(loadSettings().debounceFrames).toBe(12)

    store.set(KEY, JSON.stringify({ debounceFrames: 'lots' }))
    expect(loadSettings().debounceFrames).toBe(DEFAULT_SETTINGS.debounceFrames)
  })

  it('keeps a stored false rather than reading an absent key as one', () => {
    store.set(KEY, JSON.stringify({ showOverlay: false }))
    expect(loadSettings().showOverlay).toBe(false)

    store.set(KEY, JSON.stringify({ octave: 3 }))
    expect(loadSettings().showOverlay).toBe(true)
    expect(loadSettings().reactiveOverlay).toBe(true)
  })
})
