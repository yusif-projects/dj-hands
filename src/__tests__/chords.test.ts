import { describe, expect, it } from 'vitest'
import { CHORDS, chordToNotes } from '../audio/chords'

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

  it('produces three valid notes for all 24 chords', () => {
    expect(CHORDS).toHaveLength(24)
    for (const chord of CHORDS) {
      const notes = chordToNotes(chord)
      expect(notes).toHaveLength(3)
      for (const note of notes) expect(note).toMatch(/^[A-G]#?\d$/)
    }
  })
})
