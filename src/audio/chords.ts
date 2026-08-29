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

/** The selectable chord qualities, ordered by note count: triads first, then
 *  sevenths and sixths, then the ninths and thirteenths. */
export const QUALITIES: Quality[] = [
  { id: '',      label: 'maj',   intervals: [0, 4, 7] },
  { id: 'm',     label: 'min',   intervals: [0, 3, 7] },
  { id: 'sus2',  label: 'sus2',  intervals: [0, 2, 7] },
  { id: 'sus4',  label: 'sus4',  intervals: [0, 5, 7] },
  { id: 'aug',   label: 'aug',   intervals: [0, 4, 8] },
  { id: 'dim',   label: 'dim',   intervals: [0, 3, 6] },
  { id: '7',     label: '7',     intervals: [0, 4, 7, 10] },
  { id: 'm7',    label: 'min7',  intervals: [0, 3, 7, 10] },
  { id: 'maj7',  label: 'maj7',  intervals: [0, 4, 7, 11] },
  { id: '6',     label: '6',     intervals: [0, 4, 7, 9] },
  { id: 'm6',    label: 'm6',    intervals: [0, 3, 7, 9] },
  { id: 'add9',  label: 'add9',  intervals: [0, 4, 7, 14] },
  { id: 'add13', label: 'add13', intervals: [0, 4, 7, 21] },
  { id: 'dim7',  label: 'dim7',  intervals: [0, 3, 6, 9] },
  { id: 'm7b5',  label: 'm7b5',  intervals: [0, 3, 6, 10] },
  { id: '9',     label: '9',     intervals: [0, 4, 7, 10, 14] },
  { id: 'maj9',  label: 'maj9',  intervals: [0, 4, 7, 11, 14] },
  { id: 'm9',    label: 'm9',    intervals: [0, 3, 7, 10, 14] },
  { id: '13',    label: '13',    intervals: [0, 4, 7, 10, 14, 21] },
  { id: 'maj13', label: 'maj13', intervals: [0, 4, 7, 11, 14, 21] },
  { id: 'm13',   label: 'm13',   intervals: [0, 3, 7, 10, 14, 21] },
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

/** Everything one left-hand gesture plays: a chord plus how it is voiced. */
export interface ChordSlot {
  /** Root + quality, as a chord name — e.g. `C`, `Am`, `F#maj7`. */
  chord: ChordName
  /** Chord tones rotated up an octave from the bottom; 0 is root position. */
  inversion: number
  /** Slash bass, voiced below the chord; `null` means the chord's own root. */
  bass: Root | null
  /** Octave shift on top of the global octave, −2…+2. */
  octave: number
}

/** One slot per left-hand gesture; the array length is the slot count. */
export const DEFAULT_CHORD_SLOTS: ChordSlot[] = DEFAULT_CHORDS.map((chord) => ({
  chord,
  inversion: 0,
  bass: null,
  octave: 0,
}))

/** Highest inversion a quality supports: one less than its note count. */
export function maxInversion(quality: Quality): number {
  return quality.intervals.length - 1
}

/** Inversion names by index; index 0 is root position. */
export const INVERSION_LABELS = ['root', '1st', '2nd', '3rd', '4th', '5th']

/**
 * Which spelling black keys read as. Naming only: a chord is always stored and
 * parsed under its sharp name, so switching this renames nothing on disk.
 */
export type Accidental = 'sharp' | 'flat'

export const ACCIDENTALS: Accidental[] = ['sharp', 'flat']

export const DEFAULT_ACCIDENTAL: Accidental = 'sharp'

export function isAccidental(value: unknown): value is Accidental {
  return value === 'sharp' || value === 'flat'
}

/** The flat spelling of each sharp root; naturals name themselves either way. */
const FLAT_NAMES: Partial<Record<Root, string>> = {
  'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb',
}

/** How a root reads in the UI — only the five black keys change. */
export function formatRoot(root: Root, accidental: Accidental = DEFAULT_ACCIDENTAL): string {
  return accidental === 'flat' ? FLAT_NAMES[root] ?? root : root
}

/**
 * How a chord name reads in the UI. Only the root is respelled; a quality
 * suffix that already carries a flat (`m7b5`) is its own name and stays put.
 */
export function formatChord(
  chord: ChordName,
  accidental: Accidental = DEFAULT_ACCIDENTAL,
): string {
  const parsed = parseChord(chord)
  if (!parsed) return chord
  return `${formatRoot(parsed.root, accidental)}${parsed.quality.id}`
}

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

export interface Voicing {
  /** Rotations of the lowest chord tones up an octave; clamped to the note count. */
  inversion?: number
  /** Slash bass voiced below the chord; `null` adds no note. */
  bass?: Root | null
}

/**
 * Names one semitone offset from the root. The offset can be negative — a slash
 * bass sits below the root — and JS `%` keeps the sign, so the pitch index needs
 * a floored modulo rather than a bare one.
 */
function noteName(absolute: number, octave: number): string {
  const name = PITCH_NAMES[((absolute % 12) + 12) % 12]
  // A bass note under an already-low chord can fall below the playable range;
  // fold it back up rather than emitting a subsonic octave.
  const at = Math.max(MIN_OCTAVE, octave + Math.floor(absolute / 12))
  return `${name}${at}`
}

/**
 * Expands a chord name into Tone.js note names, e.g. `Am` at octave 3 ->
 * ['A3','C4','E4']. Octave rolls over correctly when an interval crosses B->C.
 *
 * `inversion` rotates the lowest tones up an octave; `bass` adds a slash bass
 * 1-11 semitones under the root, which leaves it below every chord tone whether
 * the chord is inverted or not.
 */
export function chordToNotes(chord: ChordName, octave = 3, voicing: Voicing = {}): string[] {
  const parsed = parseChord(chord)
  if (!parsed) throw new Error(`Unknown chord: ${chord}`)
  const rootSemitone = ROOT_SEMITONES[parsed.root]

  const { intervals } = parsed.quality
  const turns = Math.min(maxInversion(parsed.quality), Math.max(0, Math.round(voicing.inversion ?? 0)))
  // Sorted so the voicing reads low to high: an extension already an octave up
  // can outrank a tone that was just rotated past it.
  const voiced = [
    ...intervals.slice(turns),
    ...intervals.slice(0, turns).map((interval) => interval + 12),
  ].sort((a, b) => a - b)

  const { bass } = voicing
  if (bass && bass !== parsed.root) {
    voiced.unshift((((ROOT_SEMITONES[bass] - rootSemitone) % 12) + 12) % 12 - 12)
  }

  return voiced.map((interval) => noteName(rootSemitone + interval, octave))
}

/** A slot's notes at a base octave; the slot's own shift is applied on top. */
export function slotToNotes(slot: ChordSlot, baseOctave: number): string[] {
  return chordToNotes(slot.chord, resolveOctave(baseOctave, slot.octave), slot)
}

/** How a slot reads in the HUD — `Am`, `C/E`, `G/B`. */
export function formatChordSlot(
  slot: ChordSlot,
  accidental: Accidental = DEFAULT_ACCIDENTAL,
): string {
  const name = formatChord(slot.chord, accidental)
  return slot.bass && slot.bass !== parseChord(slot.chord)?.root
    ? `${name}/${formatRoot(slot.bass, accidental)}`
    : name
}

// Every name `slotToNotes` emits is a pitch from `PITCH_NAMES` with an octave
// digit glued on, so the split is exact rather than a best effort.
const NOTE_WITH_OCTAVE = /^([A-G]#?)(\d+)$/

/**
 * How a slot's notes read under the HUD's chord pads — `['E', 'G', 'C']`.
 *
 * Voiced order, so an inversion rotates the line and a slash bass leads it, and
 * without octave digits: the line names what is sounding, and the pad row
 * already carries the octave. Doubled notes are kept — a slash bass under its
 * own chord tone genuinely sounds twice.
 */
export function formatSlotNotes(
  slot: ChordSlot,
  baseOctave: number,
  accidental: Accidental = DEFAULT_ACCIDENTAL,
): string[] {
  return slotToNotes(slot, baseOctave).map((note) => {
    const root = NOTE_WITH_OCTAVE.exec(note)?.[1] as Root | undefined
    return root ? formatRoot(root, accidental) : note
  })
}
