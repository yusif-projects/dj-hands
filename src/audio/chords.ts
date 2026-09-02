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

/** One optgroup in the quality picker: a family and the qualities under it. */
export interface QualityGroup {
  /** Names the group in the picker. */
  family: string
  qualities: Quality[]
}

export interface Quality {
  /** Suffix appended to the root to form a chord name; major is the bare root. */
  id: string
  /** How the quality reads in the picker. */
  label: string
  /** Semitones above the root; values past 11 voice the extension an octave up. */
  intervals: number[]
}

/**
 * The picker's groups, and the source of order for every chord in the app. A
 * quality lives in exactly one family, so the optgroups cannot drift out of
 * step with the list — `QUALITIES` is flattened from this rather than kept
 * beside it.
 *
 * Families run roughly by depth, and a quality sits with the family it is heard
 * as rather than the one its note count would put it in: `dim7` and `m7b5` are
 * sevenths, `6/9` is a sixth.
 *
 * Labels are the suffix itself — the picker reads the way the HUD will write it
 * back — so major, which has no suffix, is the only one that needs a name.
 */
export const QUALITY_GROUPS: QualityGroup[] = [
  {
    family: 'Fifth',
    qualities: [
      { id: '5', label: '5', intervals: [0, 7] },
    ],
  },
  {
    family: 'Triads',
    qualities: [
      { id: '',     label: 'maj',  intervals: [0, 4, 7] },
      { id: 'm',    label: 'm',    intervals: [0, 3, 7] },
      { id: 'sus2', label: 'sus2', intervals: [0, 2, 7] },
      { id: 'sus4', label: 'sus4', intervals: [0, 5, 7] },
      { id: 'aug',  label: 'aug',  intervals: [0, 4, 8] },
      { id: 'dim',  label: 'dim',  intervals: [0, 3, 6] },
    ],
  },
  {
    family: 'Sevenths',
    qualities: [
      { id: '7',       label: '7',       intervals: [0, 4, 7, 10] },
      { id: 'm7',      label: 'm7',      intervals: [0, 3, 7, 10] },
      { id: 'maj7',    label: 'maj7',    intervals: [0, 4, 7, 11] },
      { id: 'mmaj7',   label: 'mmaj7',   intervals: [0, 3, 7, 11] },
      { id: '7sus4',   label: '7sus4',   intervals: [0, 5, 7, 10] },
      { id: 'aug7',    label: 'aug7',    intervals: [0, 4, 8, 10] },
      { id: 'augmaj7', label: 'augmaj7', intervals: [0, 4, 8, 11] },
      { id: 'dim7',    label: 'dim7',    intervals: [0, 3, 6, 9] },
      { id: 'm7b5',    label: 'm7b5',    intervals: [0, 3, 6, 10] },
    ],
  },
  {
    family: 'Sixths',
    qualities: [
      { id: '6',   label: '6',   intervals: [0, 4, 7, 9] },
      { id: 'm6',  label: 'm6',  intervals: [0, 3, 7, 9] },
      { id: '6/9', label: '6/9', intervals: [0, 4, 7, 9, 14] },
    ],
  },
  {
    // By degree, each one major then minor. There is no `addb11` — a flat
    // eleventh is 16 semitones, which is the major third an octave up, so the
    // name could only ever mean a doubled third.
    family: 'Adds',
    qualities: [
      { id: 'addb9',   label: 'addb9',   intervals: [0, 4, 7, 13] },
      { id: 'maddb9',  label: 'maddb9',  intervals: [0, 3, 7, 13] },
      { id: 'add9',    label: 'add9',    intervals: [0, 4, 7, 14] },
      { id: 'madd9',   label: 'madd9',   intervals: [0, 3, 7, 14] },
      { id: 'add11',   label: 'add11',   intervals: [0, 4, 7, 17] },
      { id: 'madd11',  label: 'madd11',  intervals: [0, 3, 7, 17] },
      { id: 'addb13',  label: 'addb13',  intervals: [0, 4, 7, 20] },
      { id: 'maddb13', label: 'maddb13', intervals: [0, 3, 7, 20] },
      { id: 'add13',   label: 'add13',   intervals: [0, 4, 7, 21] },
      { id: 'madd13',  label: 'madd13',  intervals: [0, 3, 7, 21] },
    ],
  },
  {
    family: 'Ninths',
    qualities: [
      { id: '9',     label: '9',     intervals: [0, 4, 7, 10, 14] },
      { id: 'maj9',  label: 'maj9',  intervals: [0, 4, 7, 11, 14] },
      { id: 'm9',    label: 'm9',    intervals: [0, 3, 7, 10, 14] },
      { id: '9sus4', label: '9sus4', intervals: [0, 5, 7, 10, 14] },
    ],
  },
  {
    // These keep their third, with the eleventh an octave above it rather than a
    // semitone away; `7sus4`/`9sus4` are the no-third reading of the same stack.
    family: 'Elevenths',
    qualities: [
      { id: '11',      label: '11',      intervals: [0, 4, 7, 10, 14, 17] },
      { id: 'm11',     label: 'm11',     intervals: [0, 3, 7, 10, 14, 17] },
      { id: 'maj11',   label: 'maj11',   intervals: [0, 4, 7, 11, 14, 17] },
      { id: 'maj7#11', label: 'maj7#11', intervals: [0, 4, 7, 11, 18] },
    ],
  },
  {
    family: 'Thirteenths',
    qualities: [
      { id: '13',    label: '13',    intervals: [0, 4, 7, 10, 14, 21] },
      { id: 'maj13', label: 'maj13', intervals: [0, 4, 7, 11, 14, 21] },
      { id: 'm13',   label: 'm13',   intervals: [0, 3, 7, 10, 14, 21] },
    ],
  },
]

/** Every quality, flattened into picker order. */
export const QUALITIES: Quality[] = QUALITY_GROUPS.flatMap((group) => group.qualities)

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

/**
 * The engraved accidentals, as opposed to the `#` and `b` a chord is stored
 * and parsed under. Typesetting only: nothing that reads a name back ever sees
 * these, so they stay on the formatting side of the module.
 */
const SHARP_SIGN = '♯'
const FLAT_SIGN = '♭'

/** The flat spelling of each sharp root; naturals name themselves either way. */
const FLAT_NAMES: Partial<Record<Root, string>> = {
  'C#': `D${FLAT_SIGN}`, 'D#': `E${FLAT_SIGN}`, 'F#': `G${FLAT_SIGN}`,
  'G#': `A${FLAT_SIGN}`, 'A#': `B${FLAT_SIGN}`,
}

/** How a root reads in the UI — only the five black keys carry a sign. */
export function formatRoot(root: Root, accidental: Accidental = DEFAULT_ACCIDENTAL): string {
  if (accidental === 'flat') return FLAT_NAMES[root] ?? root
  return root.replace('#', SHARP_SIGN)
}

// An accidental inside a suffix always sits on a degree number — `m7b5`,
// `maj7#11` — so anchoring on the digit after it is exact, and a `b` that means
// something else could never be mistaken for a flat.
const SUFFIX_ACCIDENTAL = /[b#](?=\d)/g

/**
 * How a quality suffix reads in the UI: `m7b5` -> `m7♭5`, `maj7#11` ->
 * `maj7♯11`. The accidental it carries is part of the quality's own name, so
 * this is engraving rather than respelling — a flat here stays flat whichever
 * spelling the roots are on.
 */
export function formatQuality(id: string): string {
  return id.replace(SUFFIX_ACCIDENTAL, (sign) => (sign === 'b' ? FLAT_SIGN : SHARP_SIGN))
}

/**
 * How a chord name reads in the UI. Both halves are engraved, but only the root
 * is respelled: a quality suffix that carries an accidental of its own (`m7b5`,
 * `maj7#11`) keeps the degree it names.
 */
export function formatChord(
  chord: ChordName,
  accidental: Accidental = DEFAULT_ACCIDENTAL,
): string {
  const parsed = parseChord(chord)
  if (!parsed) return chord
  return `${formatRoot(parsed.root, accidental)}${formatQuality(parsed.quality.id)}`
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

/**
 * The same note an octave or more up — `('C4', 1) -> 'C5'`. Note spelling stays
 * in this module, so the arpeggiator's octave span is about order rather than
 * about how a name is put back together. A name this module did not emit is
 * returned untouched rather than mangled.
 */
export function shiftOctave(note: string, by: number): string {
  const parsed = NOTE_WITH_OCTAVE.exec(note)
  if (!parsed) return note
  return `${parsed[1]}${Math.max(MIN_OCTAVE, Number(parsed[2]) + by)}`
}
