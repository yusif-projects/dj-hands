import { describe, expect, it } from 'vitest'
import {
  CHORDS,
  QUALITIES,
  ROOTS,
  chordToNotes,
  isChordName,
  parseChord,
  resolveOctave,
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
