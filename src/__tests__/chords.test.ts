import { describe, expect, it } from 'vitest'
import {
  CHORDS,
  QUALITIES,
  ROOTS,
  chordToNotes,
  formatChord,
  formatChordSlot,
  formatRoot,
  isAccidental,
  isChordName,
  maxInversion,
  parseChord,
  resolveOctave,
  slotToNotes,
  toChordName,
} from '../audio/chords'

describe('chordToNotes', () => {
  it('builds major triads', () => {
    expect(chordToNotes('C', 3)).toEqual(['C3', 'E3', 'G3'])
    expect(chordToNotes('F', 3)).toEqual(['F3', 'A3', 'C4'])
  })

  it('builds minor triads', () => {
    expect(chordToNotes('Am', 3)).toEqual(['A3', 'C4', 'E4'])
    expect(chordToNotes('Em', 3)).toEqual(['E3', 'G3', 'B3'])
  })

  it('rolls the octave over at B -> C', () => {
    expect(chordToNotes('B', 3)).toEqual(['B3', 'D#4', 'F#4'])
    expect(chordToNotes('A#m', 3)).toEqual(['A#3', 'C#4', 'F4'])
  })

  it('respects the octave argument', () => {
    expect(chordToNotes('C', 4)).toEqual(['C4', 'E4', 'G4'])
  })

  it('builds sevenths, sixths and ninths', () => {
    expect(chordToNotes('G7', 3)).toEqual(['G3', 'B3', 'D4', 'F4'])
    expect(chordToNotes('Cm7', 3)).toEqual(['C3', 'D#3', 'G3', 'A#3'])
    expect(chordToNotes('Cmaj7', 3)).toEqual(['C3', 'E3', 'G3', 'B3'])
    expect(chordToNotes('Caug', 3)).toEqual(['C3', 'E3', 'G#3'])
    expect(chordToNotes('C13', 3)).toEqual(['C3', 'E3', 'G3', 'A#3', 'D4', 'A4'])
    expect(chordToNotes('C6', 3)).toEqual(['C3', 'E3', 'G3', 'A3'])
    expect(chordToNotes('Am6', 3)).toEqual(['A3', 'C4', 'E4', 'F#4'])
  })

  it('voices ninths an octave above the root', () => {
    expect(chordToNotes('C9', 3)).toEqual(['C3', 'E3', 'G3', 'A#3', 'D4'])
    expect(chordToNotes('Cmaj9', 3)).toEqual(['C3', 'E3', 'G3', 'B3', 'D4'])
    expect(chordToNotes('Cadd9', 3)).toEqual(['C3', 'E3', 'G3', 'D4'])
  })

  it('builds suspended and diminished chords', () => {
    expect(chordToNotes('Csus2', 3)).toEqual(['C3', 'D3', 'G3'])
    expect(chordToNotes('Csus4', 3)).toEqual(['C3', 'F3', 'G3'])
    expect(chordToNotes('Cdim', 3)).toEqual(['C3', 'D#3', 'F#3'])
    expect(chordToNotes('Cdim7', 3)).toEqual(['C3', 'D#3', 'F#3', 'A3'])
    expect(chordToNotes('Cm7b5', 3)).toEqual(['C3', 'D#3', 'F#3', 'A#3'])
  })

  it('produces valid notes for every root and quality', () => {
    expect(CHORDS).toHaveLength(ROOTS.length * QUALITIES.length)
    for (const chord of CHORDS) {
      const notes = chordToNotes(chord)
      expect(notes.length).toBeGreaterThanOrEqual(3)
      for (const note of notes) expect(note).toMatch(/^[A-G]#?\d$/)
    }
  })

  it('rejects names that are not chords', () => {
    expect(() => chordToNotes('H' as never)).toThrow()
    expect(() => chordToNotes('Cwat' as never)).toThrow()
  })
})

describe('chordToNotes voicing', () => {
  it('rotates the lowest tones up an octave', () => {
    expect(chordToNotes('C', 3, { inversion: 1 })).toEqual(['E3', 'G3', 'C4'])
    expect(chordToNotes('C', 3, { inversion: 2 })).toEqual(['G3', 'C4', 'E4'])
    expect(chordToNotes('G7', 3, { inversion: 3 })).toEqual(['F4', 'G4', 'B4', 'D5'])
  })

  it('keeps an inverted voicing sorted when an extension is already an octave up', () => {
    // Cadd9 is [0,4,7,14]; rotating the root to 12 puts it between the 7 and the 14.
    expect(chordToNotes('Cadd9', 3, { inversion: 1 })).toEqual(['E3', 'G3', 'C4', 'D4'])
  })

  it('clamps an inversion past the chord note count', () => {
    // A triad has three notes, so 2 is as far as it rotates.
    expect(chordToNotes('C', 3, { inversion: 9 })).toEqual(chordToNotes('C', 3, { inversion: 2 }))
    expect(chordToNotes('C', 3, { inversion: -3 })).toEqual(chordToNotes('C', 3))
  })

  it('voices a slash bass below the chord', () => {
    expect(chordToNotes('C', 3, { bass: 'E' })).toEqual(['E2', 'C3', 'E3', 'G3'])
    expect(chordToNotes('G', 3, { bass: 'B' })).toEqual(['B2', 'G3', 'B3', 'D4'])
    // A bass a semitone under the root stays in the octave below it.
    expect(chordToNotes('C', 3, { bass: 'B' })).toEqual(['B2', 'C3', 'E3', 'G3'])
  })

  it('treats a bass on the chord own root as no slash at all', () => {
    expect(chordToNotes('C', 3, { bass: 'C' })).toEqual(chordToNotes('C', 3))
    expect(chordToNotes('F#m', 3, { bass: 'F#' })).toEqual(chordToNotes('F#m', 3))
  })

  it('keeps the bass lowest when the chord is also inverted', () => {
    expect(chordToNotes('C', 3, { inversion: 2, bass: 'E' })).toEqual(['E2', 'G3', 'C4', 'E4'])
  })

  it('folds a bass back up rather than going below the playable range', () => {
    const notes = chordToNotes('C', resolveOctave(1, -2), { bass: 'E' })
    for (const note of notes) expect(note).toMatch(/^[A-G]#?\d$/)
    expect(notes[0]).toBe('E0')
  })

  it('produces valid notes for every chord at every inversion', () => {
    for (const chord of CHORDS) {
      const { quality } = parseChord(chord)!
      for (let inversion = 0; inversion <= maxInversion(quality); inversion++) {
        for (const bass of ROOTS) {
          for (const note of chordToNotes(chord, 3, { inversion, bass })) {
            expect(note).toMatch(/^[A-G]#?\d$/)
          }
        }
      }
    }
  })
})

describe('maxInversion', () => {
  it('is one less than the note count', () => {
    expect(maxInversion(QUALITIES.find((q) => q.id === '')!)).toBe(2)
    expect(maxInversion(QUALITIES.find((q) => q.id === '7')!)).toBe(3)
    expect(maxInversion(QUALITIES.find((q) => q.id === '9')!)).toBe(4)
    expect(maxInversion(QUALITIES.find((q) => q.id === '13')!)).toBe(5)
  })
})

describe('slotToNotes', () => {
  it('applies the slot own octave shift on top of the base', () => {
    const slot = { chord: 'C', inversion: 0, bass: null, octave: -1 } as const
    expect(slotToNotes(slot, 3)).toEqual(['C2', 'E2', 'G2'])
    expect(slotToNotes({ ...slot, octave: 0, bass: 'E' }, 3)).toEqual(['E2', 'C3', 'E3', 'G3'])
  })
})

describe('formatChordSlot', () => {
  it('spells a slash bass, and nothing else', () => {
    const slot = { chord: 'C', inversion: 0, bass: null, octave: 0 } as const
    expect(formatChordSlot(slot)).toBe('C')
    expect(formatChordSlot({ ...slot, bass: 'E' })).toBe('C/E')
    // Inversion does not change what the chord is called.
    expect(formatChordSlot({ ...slot, inversion: 2 })).toBe('C')
    expect(formatChordSlot({ ...slot, bass: 'C' })).toBe('C')
  })

  it('respells the root and the bass together', () => {
    const slot = { chord: 'F#m7', inversion: 0, bass: 'A#', octave: 0 } as const
    expect(formatChordSlot(slot, 'sharp')).toBe('F#m7/A#')
    expect(formatChordSlot(slot, 'flat')).toBe('Gbm7/Bb')
  })
})

describe('accidental naming', () => {
  it('leaves naturals alone in either spelling', () => {
    for (const root of ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const) {
      expect(formatRoot(root, 'flat')).toBe(root)
      expect(formatRoot(root, 'sharp')).toBe(root)
    }
  })

  it('names every black key as a flat', () => {
    expect(formatRoot('C#', 'flat')).toBe('Db')
    expect(formatRoot('D#', 'flat')).toBe('Eb')
    expect(formatRoot('F#', 'flat')).toBe('Gb')
    expect(formatRoot('G#', 'flat')).toBe('Ab')
    expect(formatRoot('A#', 'flat')).toBe('Bb')
  })

  it('defaults to sharps', () => {
    expect(formatRoot('C#')).toBe('C#')
    expect(formatChord('C#m7')).toBe('C#m7')
  })

  it('respells the root without touching the quality suffix', () => {
    expect(formatChord('D#m7b5', 'flat')).toBe('Ebm7b5')
    expect(formatChord('Am7b5', 'flat')).toBe('Am7b5')
  })

  it('shows no sharp anywhere once flats are on', () => {
    for (const chord of CHORDS) {
      expect(formatChord(chord, 'flat')).not.toContain('#')
    }
  })

  it('is naming only — the stored name still parses and plays the same', () => {
    for (const chord of CHORDS) {
      expect(parseChord(chord)).not.toBeNull()
    }
    expect(chordToNotes('D#', 3)).toEqual(['D#3', 'G3', 'A#3'])
  })

  it('validates stored spellings', () => {
    expect(isAccidental('sharp')).toBe(true)
    expect(isAccidental('flat')).toBe(true)
    expect(isAccidental('natural')).toBe(false)
    expect(isAccidental(undefined)).toBe(false)
  })
})

describe('resolveOctave', () => {
  it('adds a slot offset to the base octave', () => {
    expect(resolveOctave(3, 0)).toBe(3)
    expect(resolveOctave(3, -2)).toBe(1)
    expect(resolveOctave(3, 2)).toBe(5)
  })

  it('treats a missing offset as no shift', () => {
    expect(resolveOctave(4)).toBe(4)
    expect(resolveOctave(4, undefined)).toBe(4)
  })

  it('clamps to a playable octave range', () => {
    expect(resolveOctave(1, -2)).toBe(0)
    expect(resolveOctave(1, -5)).toBe(0)
    expect(resolveOctave(5, 9)).toBe(7)
  })

  it('produces valid notes at the extremes', () => {
    expect(chordToNotes('B', resolveOctave(1, -2))).toEqual(['B0', 'D#1', 'F#1'])
    expect(chordToNotes('C', resolveOctave(5, 2))).toEqual(['C7', 'E7', 'G7'])
  })
})

describe('parseChord', () => {
  it('splits sharp roots from their quality', () => {
    expect(parseChord('F#m7')).toMatchObject({ root: 'F#', quality: { id: 'm7' } })
    expect(parseChord('C')).toMatchObject({ root: 'C', quality: { id: '' } })
  })

  it('prefers the longest matching quality suffix', () => {
    expect(parseChord('Am7b5')).toMatchObject({ root: 'A', quality: { id: 'm7b5' } })
    expect(parseChord('Am7')).toMatchObject({ root: 'A', quality: { id: 'm7' } })
    expect(parseChord('Am')).toMatchObject({ root: 'A', quality: { id: 'm' } })
  })

  it('round-trips through toChordName for every combination', () => {
    for (const root of ROOTS) {
      for (const quality of QUALITIES) {
        const name = toChordName(root, quality.id)
        expect(parseChord(name)).toMatchObject({ root, quality: { id: quality.id } })
      }
    }
  })

  it('rejects unknown roots and qualities', () => {
    expect(parseChord('H')).toBeNull()
    expect(parseChord('Cmaj8')).toBeNull()
    expect(isChordName('Cm7b5')).toBe(true)
    expect(isChordName('Cm7b9')).toBe(false)
    expect(isChordName(42)).toBe(false)
  })
})
