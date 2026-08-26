/** Pure chord theory: chord name -> note names. No audio, no side effects. */

const ROOT_SEMITONES = {
  C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5,
  'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11,
} as const

export type Root = keyof typeof ROOT_SEMITONES

/** Selectable roots, naturals first then sharps. */
export const ROOTS: Root[] = [
  'C', 'D', 'E', 'F', 'G', 'A', 'B', 'C#', 'D#', 'F#', 'G#', 'A#',
]

const PITCH_NAMES: Root[] = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export interface Quality {
  /** Suffix appended to the root to form a chord name; major is the bare root. */
  id: string
  /** How the quality reads in the picker. */
  label: string
  /** Semitones above the root; values past 11 voice the extension an octave up. */
  intervals: number[]
}

/** The selectable chord qualities, ordered from plain triads to extensions. */
export const QUALITIES: Quality[] = [
  { id: '',     label: 'maj',   intervals: [0, 4, 7] },
  { id: 'm',    label: 'min',   intervals: [0, 3, 7] },
  { id: '7',    label: '7',     intervals: [0, 4, 7, 10] },
  { id: 'm7',   label: 'min7',  intervals: [0, 3, 7, 10] },
  { id: 'maj7', label: 'M7',    intervals: [0, 4, 7, 11] },
  { id: '6',    label: '6',     intervals: [0, 4, 7, 9] },
  { id: 'm6',   label: 'm6',    intervals: [0, 3, 7, 9] },
  { id: '9',    label: '9',     intervals: [0, 4, 7, 10, 14] },
  { id: 'maj9', label: 'maj9',  intervals: [0, 4, 7, 11, 14] },
  { id: 'add9', label: 'add9',  intervals: [0, 4, 7, 14] },
  { id: 'sus2', label: 'sus2',  intervals: [0, 2, 7] },
  { id: 'sus4', label: 'sus4',  intervals: [0, 5, 7] },
  { id: 'dim',  label: 'dim',   intervals: [0, 3, 6] },
  { id: 'dim7', label: 'dim7',  intervals: [0, 3, 6, 9] },
  { id: 'm7b5', label: 'm7b5',  intervals: [0, 3, 6, 10] },
]

export type QualityId = (typeof QUALITIES)[number]['id']

/** A chord name is a root with a quality suffix, e.g. `C`, `Am`, `F#maj7`. */
export type ChordName = `${Root}${string}`

/** Every root/quality combination, for validation and tests. */
export const CHORDS: ChordName[] = ROOTS.flatMap((root) =>
  QUALITIES.map((q) => `${root}${q.id}` as ChordName),
)

export const DEFAULT_CHORDS: ChordName[] = ['C', 'G', 'Am', 'F', 'Em']

/** How far a single slot may be shifted from the global octave, in octaves. */
export const MAX_OCTAVE_OFFSET = 2

/** Per-slot octave shifts, one per chord slot. */
export const DEFAULT_CHORD_OCTAVES: number[] = DEFAULT_CHORDS.map(() => 0)

const MIN_OCTAVE = 0
const MAX_OCTAVE = 7

/** Combines the global octave with a slot's offset, clamped to a playable range. */
export function resolveOctave(base: number, offset = 0): number {
  return Math.min(MAX_OCTAVE, Math.max(MIN_OCTAVE, Math.round(base + offset)))
}

// Longest suffix first, so `m7b5` wins over `m7` and `m` on the same name.
const QUALITIES_BY_LENGTH = [...QUALITIES].sort((a, b) => b.id.length - a.id.length)

/** Splits a chord name into its root and quality, or `null` if it is not one. */
export function parseChord(chord: string): { root: Root; quality: Quality } | null {
  // Sharps are two characters, so try the longer root before the natural.
  for (const length of [2, 1]) {
    const root = chord.slice(0, length) as Root
    if (ROOT_SEMITONES[root] === undefined) continue
    const suffix = chord.slice(length)
    const quality = QUALITIES_BY_LENGTH.find((q) => q.id === suffix)
    if (quality) return { root, quality }
  }
  return null
}

export function isChordName(chord: unknown): chord is ChordName {
  return typeof chord === 'string' && parseChord(chord) !== null
}

/** Rebuilds a chord name from its parts, e.g. `('F#', 'm7') -> 'F#m7'`. */
export function toChordName(root: Root, qualityId: QualityId): ChordName {
  return `${root}${qualityId}` as ChordName
}

/**
 * Expands a chord name into Tone.js note names, e.g. `Am` at octave 3 ->
 * ['A3','C4','E4']. Octave rolls over correctly when an interval crosses B->C.
 */
export function chordToNotes(chord: ChordName, octave = 3): string[] {
  const parsed = parseChord(chord)
  if (!parsed) throw new Error(`Unknown chord: ${chord}`)
  const rootSemitone = ROOT_SEMITONES[parsed.root]

  return parsed.quality.intervals.map((interval) => {
    const absolute = rootSemitone + interval
    return `${PITCH_NAMES[absolute % 12]}${octave + Math.floor(absolute / 12)}`
  })
}
