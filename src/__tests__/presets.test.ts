import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  EMPTY_PRESETS,
  MAX_PRESETS,
  MAX_PRESET_NAME,
  SONG_FORMAT,
  SONG_VERSION,
  addPreset,
  loadPresets,
  newPreset,
  parsePayload,
  presetLabel,
  savePresets,
  syncActive,
  toPayload,
  type Preset,
} from '../state/presets'
import { DEFAULT_SETTINGS, toSong, type Song } from '../state/settings'
import { SECTION_COUNT } from '../audio/sections'

const KEY = 'gesture-music.songs'

// Tests run in node, with no DOM: the persistence layer needs a store to talk to.
const store = new Map<string, string>()
let refuse = false
beforeEach(() => {
  store.clear()
  refuse = false
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        // Safari in private mode throws here rather than failing quietly.
        if (refuse) throw new Error('QuotaExceededError')
        store.set(k, v)
      },
      removeItem: (k: string) => void store.delete(k),
    },
  })
})

const song = (partial: Partial<Song> = {}): Song => ({ ...toSong(DEFAULT_SETTINGS), ...partial })

const preset = (partial: Partial<Preset> = {}): Preset => ({
  id: 'a',
  name: 'Thriller',
  savedAt: 1,
  version: SONG_VERSION,
  song: song(),
  ...partial,
})

describe('loadPresets', () => {
  it('returns an empty store when nothing has been saved', () => {
    expect(loadPresets()).toEqual(EMPTY_PRESETS)
  })

  it('round-trips through savePresets', () => {
    const saved = { activeId: 'a', items: [preset()] }
    savePresets(saved)
    expect(loadPresets()).toEqual(saved)
  })

  it('falls back to empty on an unreadable blob', () => {
    store.set(KEY, 'not json')
    expect(loadPresets()).toEqual(EMPTY_PRESETS)
  })

  it('falls back to empty when the items are not a list', () => {
    store.set(KEY, JSON.stringify({ activeId: null, items: 'nope' }))
    expect(loadPresets()).toEqual(EMPTY_PRESETS)
  })

  // The songs go through the settings normalizers rather than being trusted:
  // a song can arrive from somebody else's browser.
  it('validates every song rather than trusting what was stored', () => {
    store.set(
      KEY,
      JSON.stringify({
        activeId: null,
        items: [{ id: 'a', name: 'x', savedAt: 0, song: { octave: 99, cutoffMin: -5, sections: [] } }],
      }),
    )
    const [loaded] = loadPresets().items

    expect(loaded.song.octave).toBe(5)
    expect(loaded.song.cutoffMin).toBe(50)
    expect(loaded.song.sections).toHaveLength(SECTION_COUNT)
  })

  it('truncates an over-long name rather than rejecting the song', () => {
    savePresets({ activeId: null, items: [preset({ name: 'x'.repeat(80) })] })
    expect(loadPresets().items[0].name).toBe('x'.repeat(MAX_PRESET_NAME))
  })

  it('cuts a stored list longer than the cap', () => {
    const items = Array.from({ length: MAX_PRESETS + 6 }, (_, i) => preset({ id: `id-${i}` }))
    store.set(KEY, JSON.stringify({ activeId: null, items }))
    expect(loadPresets().items).toHaveLength(MAX_PRESETS)
  })

  // Two rows sharing an id would both answer the same lookup: one could never
  // be opened, and the other would quietly take its edits.
  it('replaces a missing or duplicated id so two songs can never sync as one', () => {
    store.set(
      KEY,
      JSON.stringify({ activeId: null, items: [preset({ id: 'same' }), preset({ id: 'same' }), preset({ id: undefined })] }),
    )
    const ids = loadPresets().items.map((item) => item.id)

    expect(new Set(ids).size).toBe(3)
    expect(ids.every((id) => typeof id === 'string' && id.length > 0)).toBe(true)
  })

  it('drops an activeId that names nothing, so an edit cannot sync into thin air', () => {
    store.set(KEY, JSON.stringify({ activeId: 'ghost', items: [preset({ id: 'a' })] }))
    expect(loadPresets().activeId).toBeNull()
  })

  it('keeps an activeId that names a song', () => {
    store.set(KEY, JSON.stringify({ activeId: 'a', items: [preset({ id: 'a' })] }))
    expect(loadPresets().activeId).toBe('a')
  })
})

describe('savePresets', () => {
  it('reports the write that lands and the one the browser refuses', () => {
    expect(savePresets(EMPTY_PRESETS)).toBe(true)
    refuse = true
    expect(savePresets(EMPTY_PRESETS)).toBe(false)
  })
})

describe('syncActive', () => {
  it('folds what is being played into the open song and stamps it', () => {
    const open = { activeId: 'a', items: [preset({ id: 'a' }), preset({ id: 'b' })] }
    const next = syncActive(open, song({ bpm: 145 }), 4242)

    expect(next.items[0].song.bpm).toBe(145)
    expect(next.items[0].savedAt).toBe(4242)
  })

  it('leaves every other song alone, by identity', () => {
    const open = { activeId: 'a', items: [preset({ id: 'a' }), preset({ id: 'b' })] }
    const next = syncActive(open, song({ bpm: 145 }), 1)

    expect(next.items[1]).toBe(open.items[1])
  })

  // Songs are opt-in, so this is the common case: an edit must cost a null check.
  it('returns the very same store when nothing is open', () => {
    const closed = { activeId: null, items: [preset()] }
    expect(syncActive(closed, song({ bpm: 145 }))).toBe(closed)
  })

  it('returns the very same store when the open id names nothing', () => {
    const dangling = { activeId: 'ghost', items: [preset({ id: 'a' })] }
    expect(syncActive(dangling, song({ bpm: 145 }))).toBe(dangling)
  })
})

describe('addPreset', () => {
  it('adds a song and opens it in one step', () => {
    const added = addPreset(EMPTY_PRESETS, preset({ id: 'new' }))

    expect(added.items).toHaveLength(1)
    expect(added.activeId).toBe('new')
  })

  it('holds the cap even when the button that disables at it does not', () => {
    const full = {
      activeId: null,
      items: Array.from({ length: MAX_PRESETS }, (_, i) => preset({ id: `id-${i}` })),
    }
    expect(addPreset(full, preset({ id: 'one-too-many' }))).toBe(full)
  })
})

describe('presetLabel', () => {
  it('numbers a song that was never named, and trims', () => {
    expect(presetLabel(preset({ name: '' }), 2)).toBe('Song 3')
    expect(presetLabel(preset({ name: '   ' }), 0)).toBe('Song 1')
    expect(presetLabel(preset({ name: 'Thriller' }), 0)).toBe('Thriller')
  })
})

describe('the clipboard payload', () => {
  it('round-trips a song', () => {
    const mine = newPreset('Let It Happen', song({ bpm: 116, octave: 4 }))
    const parsed = parsePayload(toPayload(mine))!

    expect(parsed.name).toBe('Let It Happen')
    expect(parsed.song.bpm).toBe(116)
    expect(parsed.song.octave).toBe(4)
  })

  // An id from another browser means nothing here, and "when I saved it" is not
  // a fact about the song — so your own copy comes back as a second song.
  it('carries no id and no savedAt', () => {
    const payload = JSON.parse(toPayload(preset()))

    expect(payload).not.toHaveProperty('id')
    expect(payload).not.toHaveProperty('savedAt')
  })

  it('refuses anything that is not one of ours', () => {
    expect(parsePayload('not json')).toBeNull()
    expect(parsePayload(JSON.stringify({ name: 'x', song: song() }))).toBeNull()
    expect(parsePayload(JSON.stringify({ format: 'something.else', song: song() }))).toBeNull()
  })

  it('normalizes a hand-edited song rather than trusting it', () => {
    const parsed = parsePayload(
      JSON.stringify({
        format: SONG_FORMAT,
        version: SONG_VERSION,
        name: 'y'.repeat(80),
        song: { cutoffMax: 1e9, effects: [{ id: 'delay', amount: 5 }], arp: { pattern: 'sideways' } },
      }),
    )!

    expect(parsed.name).toBe('y'.repeat(MAX_PRESET_NAME))
    expect(parsed.song.cutoffMax).toBe(12000)
    // The rack is repaired to every effect exactly once, whatever arrived.
    expect(parsed.song.effects).toHaveLength(DEFAULT_SETTINGS.effects.length)
    expect(parsed.song.arp.pattern).toBe(DEFAULT_SETTINGS.arp.pattern)
  })

  it('drops the tracking settings a payload tries to smuggle in', () => {
    const parsed = parsePayload(
      JSON.stringify({
        format: SONG_FORMAT,
        version: SONG_VERSION,
        name: 'Sneaky',
        song: { ...song(), debounceFrames: 12, swapHands: true, activeSection: 4, showOverlay: false },
      }),
    )!

    expect(parsed.song).not.toHaveProperty('debounceFrames')
    expect(parsed.song).not.toHaveProperty('swapHands')
    expect(parsed.song).not.toHaveProperty('activeSection')
    expect(parsed.song).not.toHaveProperty('showOverlay')
  })
})

/**
 * The promise is that a song saved today still plays after any future feature.
 * That promise has no visible symptom when it breaks — the song just quietly
 * comes back with somebody else's chords — so it is pinned here.
 */
describe('staying compatible', () => {
  const fixtures = join(dirname(fileURLToPath(import.meta.url)), 'fixtures')

  // Real payloads, frozen the day they were written and never edited again. Add
  // one whenever SONG_VERSION moves; never change or delete an old one.
  for (const file of readdirSync(fixtures).filter((name) => name.endsWith('.json'))) {
    it(`still plays ${file} exactly as it was saved`, () => {
      const raw = readFileSync(join(fixtures, file), 'utf8')
      const original = JSON.parse(raw)
      const parsed = parsePayload(raw)

      expect(parsed).not.toBeNull()
      // Nothing quietly landing on a default: the chords are the chords, and
      // the sound around them is the sound that was saved.
      expect(parsed!.song.sections).toEqual(original.song.sections)
      expect(parsed!.song.voice).toEqual(original.song.voice)
      expect(parsed!.song.effects).toEqual(original.song.effects)
      expect(parsed!.song.arp).toEqual(original.song.arp)
      expect(parsed!.song.bpm).toBe(original.song.bpm)
      expect(parsed!.song.octave).toBe(original.song.octave)
      expect(parsed!.name).toBe(original.name)
    })
  }

  it('reads a song written before the version field existed as version 1', () => {
    const parsed = parsePayload(JSON.stringify({ format: SONG_FORMAT, name: 'Old', song: song() }))!
    expect(parsed.version).toBe(1)
  })

  // Refusing a song from a newer build is worse than playing what we understand.
  it('accepts a song from a version this build has never heard of', () => {
    const parsed = parsePayload(
      JSON.stringify({ format: SONG_FORMAT, version: 99, name: 'Future', song: song({ bpm: 133 }) }),
    )!

    expect(parsed.song.bpm).toBe(133)
    expect(parsed.version).toBe(99)
  })

  // So an older build asked to re-save a newer song does not strip it.
  it('carries through the fields it has no name for', () => {
    const parsed = parsePayload(
      JSON.stringify({
        format: SONG_FORMAT,
        version: 99,
        name: 'Future',
        song: { ...song(), glideTime: 0.4 },
      }),
    )!

    expect((parsed.song as Record<string, unknown>).glideTime).toBe(0.4)
  })

  // The additive case, which is the one that will come up: a field added after
  // a song was saved arrives at its default rather than breaking the song.
  it('gives a song saved before a field existed the new default', () => {
    const { arp: _arp, ...beforeTheArpeggiator } = song({ bpm: 128 })
    const parsed = parsePayload(
      JSON.stringify({ format: SONG_FORMAT, version: 1, name: 'Old', song: beforeTheArpeggiator }),
    )!

    // It arrives switched off, so a returning player picks it up without
    // hearing anything change — and the rest of the song is untouched.
    expect(parsed.song.arp).toEqual(DEFAULT_SETTINGS.arp)
    expect(parsed.song.bpm).toBe(128)
    expect(parsed.song.sections).toEqual(song().sections)
  })
})
