/** Pure chord theory: chord name -> note names. No audio, no side effects. */

const ROOT_SEMITONES = {
  C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5,
  'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11,
} as const

export type Root = keyof typeof ROOT_SEMITONES

const PITCH_NAMES: Root[] = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

const MAJOR = [0, 4, 7]
const MINOR = [0, 3, 7]

/** The 24 selectable chords, ordered naturals-first then sharps. */
export const CHORDS = [
  'C', 'Cm', 'D', 'Dm', 'E', 'Em', 'F', 'Fm', 'G', 'Gm', 'A', 'Am', 'B', 'Bm',
  'C#', 'C#m', 'D#', 'D#m', 'F#', 'F#m', 'G#', 'G#m', 'A#', 'A#m',
] as const

export type ChordName = (typeof CHORDS)[number]

export const DEFAULT_CHORDS: ChordName[] = ['C', 'G', 'Am', 'F', 'Em']

/**
 * Expands a chord name into Tone.js note names, e.g. `Am` at octave 3 ->
 * ['A3','C4','E4']. Octave rolls over correctly when an interval crosses B->C.
 */
export function chordToNotes(chord: ChordName, octave = 3): string[] {
  const isMinor = chord.endsWith('m')
  const root = (isMinor ? chord.slice(0, -1) : chord) as Root
  const rootSemitone = ROOT_SEMITONES[root]
  if (rootSemitone === undefined) throw new Error(`Unknown chord root: ${chord}`)

  return (isMinor ? MINOR : MAJOR).map((interval) => {
    const absolute = rootSemitone + interval
    return `${PITCH_NAMES[absolute % 12]}${octave + Math.floor(absolute / 12)}`
  })
}
