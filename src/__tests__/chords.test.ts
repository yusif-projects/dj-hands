import { describe, expect, it } from 'vitest'
import {
  ACCIDENTALS,
  CHORDS,
  INVERSION_LABELS,
  QUALITIES,
  QUALITY_GROUPS,
  ROOTS,
  chordToNotes,
  formatChord,
  formatChordSlot,
  formatQuality,
  formatRoot,
  formatSlotNotes,
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

  it('builds the fourth-and-fifth qualities', () => {
    expect(chordToNotes('C5', 3)).toEqual(['C3', 'G3'])
    expect(chordToNotes('C7sus4', 3)).toEqual(['C3', 'F3', 'G3', 'A#3'])
    expect(chordToNotes('C9sus4', 3)).toEqual(['C3', 'F3', 'G3', 'A#3', 'D4'])
  })

  it('builds the augmented and minor-major sevenths', () => {
    expect(chordToNotes('Caug7', 3)).toEqual(['C3', 'E3', 'G#3', 'A#3'])
    expect(chordToNotes('Caugmaj7', 3)).toEqual(['C3', 'E3', 'G#3', 'B3'])
    expect(chordToNotes('Cmmaj7', 3)).toEqual(['C3', 'D#3', 'G3', 'B3'])
  })

  it('builds the minor adds alongside the major ones', () => {
    expect(chordToNotes('Cmadd9', 3)).toEqual(['C3', 'D#3', 'G3', 'D4'])
    expect(chordToNotes('Cmadd13', 3)).toEqual(['C3', 'D#3', 'G3', 'A4'])
    expect(chordToNotes('C6/9', 3)).toEqual(['C3', 'E3', 'G3', 'A3', 'D4'])
  })

  it('builds the added elevenths clear of the third', () => {
    expect(chordToNotes('Cadd11', 3)).toEqual(['C3', 'E3', 'G3', 'F4'])
    expect(chordToNotes('Cmadd11', 3)).toEqual(['C3', 'D#3', 'G3', 'F4'])
  })

  it('builds the flat adds an octave above the root', () => {
    // Sharps are the only stored spelling, so the b9 sounds as C#4 and the b13
    // as G#4 — the name carries the flat, the note names do not.
    expect(chordToNotes('Caddb9', 3)).toEqual(['C3', 'E3', 'G3', 'C#4'])
    expect(chordToNotes('Cmaddb9', 3)).toEqual(['C3', 'D#3', 'G3', 'C#4'])
    expect(chordToNotes('Caddb13', 3)).toEqual(['C3', 'E3', 'G3', 'G#4'])
    expect(chordToNotes('Cmaddb13', 3)).toEqual(['C3', 'D#3', 'G3', 'G#4'])
  })

  it('voices elevenths an octave above the third', () => {
    expect(chordToNotes('C11', 3)).toEqual(['C3', 'E3', 'G3', 'A#3', 'D4', 'F4'])
    expect(chordToNotes('Cm11', 3)).toEqual(['C3', 'D#3', 'G3', 'A#3', 'D4', 'F4'])
    expect(chordToNotes('Cmaj11', 3)).toEqual(['C3', 'E3', 'G3', 'B3', 'D4', 'F4'])
    // The #11 is a semitone above the plain one, and lands the same octave up.
    expect(chordToNotes('Cmaj7#11', 3)).toEqual(['C3', 'E3', 'G3', 'B3', 'F#4'])
  })

  it('produces valid notes for every root and quality', () => {
    expect(CHORDS).toHaveLength(ROOTS.length * QUALITIES.length)
    for (const chord of CHORDS) {
      const notes = chordToNotes(chord)
      // The bare fifth is the only two-note quality; the rest are triads or wider.
      expect(notes.length).toBeGreaterThanOrEqual(2)
      for (const note of notes) expect(note).toMatch(/^[A-G]#?\d$/)
    }
  })

  it('names an inversion for the widest quality', () => {
    for (const quality of QUALITIES) {
      expect(INVERSION_LABELS[maxInversion(quality)]).toBeDefined()
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
    expect(formatChordSlot(slot, 'sharp')).toBe('F♯m7/A♯')
    expect(formatChordSlot(slot, 'flat')).toBe('G♭m7/B♭')
  })
})

describe('formatSlotNotes', () => {
  const slot = { chord: 'C', inversion: 0, bass: null, octave: 0 } as const

  it('names the notes without their octaves', () => {
    expect(formatSlotNotes(slot, 3)).toEqual(['C', 'E', 'G'])
    expect(formatSlotNotes({ ...slot, chord: 'Cmaj7' }, 3)).toEqual(['C', 'E', 'G', 'B'])
  })

  it('follows the voicing rather than the textbook spelling', () => {
    expect(formatSlotNotes({ ...slot, inversion: 1 }, 3)).toEqual(['E', 'G', 'C'])
    // A slash bass leads, and doubling a chord tone is not collapsed — it sounds
    // twice, an octave apart.
    expect(formatSlotNotes({ ...slot, bass: 'E' }, 3)).toEqual(['E', 'C', 'E', 'G'])
  })

  it('respells black keys with the chosen accidental', () => {
    const black = { ...slot, chord: 'D#' } as const
    expect(formatSlotNotes(black, 3, 'sharp')).toEqual(['D♯', 'G', 'A♯'])
    expect(formatSlotNotes(black, 3, 'flat')).toEqual(['E♭', 'G', 'B♭'])
  })

  // The widest quality, and the case the HUD's note line has to fit on one row.
  it('names every note of a thirteenth', () => {
    expect(formatSlotNotes({ ...slot, chord: 'Cmaj13' }, 3)).toEqual([
      'C', 'E', 'G', 'B', 'D', 'A',
    ])
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
    expect(formatRoot('C#', 'flat')).toBe('D♭')
    expect(formatRoot('D#', 'flat')).toBe('E♭')
    expect(formatRoot('F#', 'flat')).toBe('G♭')
    expect(formatRoot('G#', 'flat')).toBe('A♭')
    expect(formatRoot('A#', 'flat')).toBe('B♭')
  })

  it('defaults to sharps', () => {
    expect(formatRoot('C#')).toBe('C♯')
    expect(formatChord('C#m7')).toBe('C♯m7')
  })

  it('engraves the accidental rather than typing it', () => {
    // The signs are display only — an ASCII `#` or `b` never reaches the UI,
    // and never leaves it either: the name on disk is still `C#m7`.
    for (const spelling of ACCIDENTALS) {
      for (const chord of CHORDS) {
        expect(formatChord(chord, spelling)).not.toMatch(/[#b]/)
      }
    }
  })

  it('respells the root without touching the quality suffix', () => {
    expect(formatChord('D#m7b5', 'flat')).toBe('E♭m7♭5')
    expect(formatChord('Am7b5', 'flat')).toBe('Am7♭5')
    // The sharp eleventh is the quality's own degree, so flats leave it sharp.
    expect(formatChord('D#maj7#11', 'flat')).toBe('E♭maj7♯11')
  })

  it('shows no sharp root once flats are on', () => {
    for (const chord of CHORDS) {
      const { quality } = parseChord(chord)!
      const named = formatChord(chord, 'flat')
      // Only the root is up for respelling — `maj7#11` keeps the sharp in its
      // own name, so the suffix is trimmed off before the check.
      const suffix = formatQuality(quality.id)
      expect(named.slice(0, named.length - suffix.length)).not.toContain('♯')
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

describe('QUALITY_GROUPS', () => {
  it('is what QUALITIES is flattened from', () => {
    expect(QUALITY_GROUPS.flatMap((group) => group.qualities)).toEqual(QUALITIES)
  })

  it('puts every quality under exactly one non-empty family', () => {
    const families = QUALITY_GROUPS.map((group) => group.family)
    expect(new Set(families).size).toBe(families.length)
    for (const group of QUALITY_GROUPS) expect(group.qualities.length).toBeGreaterThan(0)
    const ids = QUALITIES.map((q) => q.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('labels a quality with its own suffix, so the picker reads as the HUD writes', () => {
    for (const quality of QUALITIES) {
      // Major is the bare root, so it is the one label that has to be a name.
      expect(quality.label).toBe(quality.id === '' ? 'maj' : quality.id)
    }
  })
})

describe('formatQuality', () => {
  it('engraves the accidental on a degree', () => {
    expect(formatQuality('m7b5')).toBe('m7♭5')
    expect(formatQuality('addb9')).toBe('add♭9')
    expect(formatQuality('maddb13')).toBe('madd♭13')
    expect(formatQuality('maj7#11')).toBe('maj7♯11')
  })

  it('leaves a suffix with no accidental alone', () => {
    expect(formatQuality('')).toBe('')
    expect(formatQuality('sus4')).toBe('sus4')
    expect(formatQuality('6/9')).toBe('6/9')
    expect(formatQuality('maj13')).toBe('maj13')
  })

  it('covers every quality the picker offers', () => {
    for (const quality of QUALITIES) expect(formatQuality(quality.id)).not.toMatch(/[#b]/)
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
    // Suffixes that contain a shorter one: the longer id has to win outright.
    expect(parseChord('Ammaj7')).toMatchObject({ root: 'A', quality: { id: 'mmaj7' } })
    expect(parseChord('Amadd9')).toMatchObject({ root: 'A', quality: { id: 'madd9' } })
    expect(parseChord('Amaj7#11')).toMatchObject({ root: 'A', quality: { id: 'maj7#11' } })
    expect(parseChord('Am11')).toMatchObject({ root: 'A', quality: { id: 'm11' } })
    expect(parseChord('A7sus4')).toMatchObject({ root: 'A', quality: { id: '7sus4' } })
    expect(parseChord('A6/9')).toMatchObject({ root: 'A', quality: { id: '6/9' } })
    expect(parseChord('Amaddb13')).toMatchObject({ root: 'A', quality: { id: 'maddb13' } })
    expect(parseChord('Aaddb13')).toMatchObject({ root: 'A', quality: { id: 'addb13' } })
    // A sharp root in front of a numeric suffix still splits at the root.
    expect(parseChord('C#11')).toMatchObject({ root: 'C#', quality: { id: '11' } })
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
