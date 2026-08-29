import {
  DEFAULT_ACCIDENTAL,
  DEFAULT_CHORD_SLOTS,
  MAX_OCTAVE_OFFSET,
  ROOTS,
  isAccidental,
  isChordName,
  maxInversion,
  parseChord,
  type Accidental,
  type ChordSlot,
  type Root,
} from '../audio/chords'
import {
  DEFAULT_SECTIONS,
  MAX_SECTION_NAME,
  SECTION_COUNT,
  firstEnabled,
  type SongSection,
} from '../audio/sections'
import { DEFAULT_FILTER_TYPE, isFilterType, type FilterType } from '../audio/filter'
import {
  DEFAULT_SEND_AMOUNT,
  DEFAULT_SEND_TARGET,
  SEND_AMOUNT_RANGE,
  isSendTarget,
  type SendTarget,
} from '../audio/effects'
import { ADSR_RANGES, DEFAULT_VOICE, isWaveformName, type Voice } from '../audio/voice'

/** Bounds for the filter sweep, disjoint so `cutoffMin < cutoffMax` always holds. */
export const CUTOFF_MIN_RANGE = { min: 50, max: 1000, step: 10 }
export const CUTOFF_MAX_RANGE = { min: 1000, max: 12000, step: 100 }

export interface Settings {
  /** Five named banks of chord slots; the right hand picks which one is live. */
  sections: SongSection[]
  /** Index into `sections` of the bank the left hand is currently playing. */
  activeSection: number
  /** The one synth voice; the right hand no longer switches between several. */
  voice: Voice
  /** Global octave every chord slot is offset from. */
  octave: number
  /** Whether black keys are named with sharps or flats; display only. */
  accidental: Accidental
  /** Frame of the video where volume reads as 1.0 (near the top). */
  volumeTop: number
  /** Frame position where volume reads as 0.0 (near the bottom). */
  volumeBottom: number
  /** Which side of the cutoff the rotation sweep keeps. */
  filterType: FilterType
  /** Cutoff in Hz at full anticlockwise rotation. */
  cutoffMin: number
  /** Cutoff in Hz at full clockwise rotation. */
  cutoffMax: number
  /** Which effect(s) the send feeds; the rest stay fully dry. */
  sendTarget: SendTarget
  /** Wet mix the assigned effect sits at. */
  sendAmount: number
  /** Consecutive frames a gesture must hold before it commits. */
  debounceFrames: number
  /** Flips MediaPipe's handedness labels when they come out inverted. */
  swapHands: boolean
  showOverlay: boolean
  /** Whether the drawn skeleton reacts to the sound, or stays flat. */
  reactiveOverlay: boolean
}

// Each bump orphans the older blob rather than upgrading it: v2 dropped the
// five-preset array for a single `voice`, and v3 folded the parallel `chords`
// and `chordOctaves` arrays into `chordSlots`. Neither is merge-compatible, and
// the dead keys would be re-saved forever.
//
// v4 is the exception: it wraps `chordSlots` in a section, which is a pure
// reshape with nothing to lose, so `migrateV3` carries the old chords over.
//
// Purely additive keys do not need a bump: `loadSettings` spreads the defaults
// under the stored blob, so an older payload simply picks up the new default.
const STORAGE_KEY = 'gesture-music.settings.v4'
const LEGACY_KEY_V3 = 'gesture-music.settings.v3'

export const DEFAULT_SETTINGS: Settings = {
  sections: DEFAULT_SECTIONS.map((section) => ({
    ...section,
    slots: section.slots.map((slot) => ({ ...slot })),
  })),
  activeSection: 0,
  voice: { ...DEFAULT_VOICE },
  octave: 3,
  accidental: DEFAULT_ACCIDENTAL,
  volumeTop: 0.15,
  volumeBottom: 0.85,
  filterType: DEFAULT_FILTER_TYPE,
  cutoffMin: 200,
  cutoffMax: 8000,
  sendTarget: DEFAULT_SEND_TARGET,
  sendAmount: DEFAULT_SEND_AMOUNT,
  debounceFrames: 4,
  swapHands: false,
  showOverlay: true,
  reactiveOverlay: true,
}

export function loadSettings(): Settings {
  try {
    const parsed = readStored()
    if (!parsed) return DEFAULT_SETTINGS
    // Normalized first: the active index is only valid against the real sections.
    const sections = normalizeSections(parsed.sections)
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      // Guard against a stored array of the wrong length from an older build.
      sections,
      activeSection: normalizeActiveSection(parsed.activeSection, sections),
      voice: normalizeVoice(parsed.voice),
      accidental: isAccidental(parsed.accidental) ? parsed.accidental : DEFAULT_ACCIDENTAL,
      filterType: isFilterType(parsed.filterType) ? parsed.filterType : DEFAULT_FILTER_TYPE,
      cutoffMin: clampRange(parsed.cutoffMin, CUTOFF_MIN_RANGE, DEFAULT_SETTINGS.cutoffMin),
      cutoffMax: clampRange(parsed.cutoffMax, CUTOFF_MAX_RANGE, DEFAULT_SETTINGS.cutoffMax),
      sendTarget: isSendTarget(parsed.sendTarget) ? parsed.sendTarget : DEFAULT_SEND_TARGET,
      sendAmount: clampRange(parsed.sendAmount, SEND_AMOUNT_RANGE, DEFAULT_SEND_AMOUNT),
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: Settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Storage can be unavailable (private mode); settings just won't persist.
  }
}

function readStored(): Partial<Settings> | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw) return JSON.parse(raw) as Partial<Settings>
  return migrateV3()
}

/**
 * v4 replaced the flat `chordSlots` array with five named sections. Every other
 * v3 key survives unchanged, so the old payload is reshaped rather than dropped:
 * the chords the player had built become section 1, and the rest spreads across
 * as it always did. The v3 key is consumed either way — a blob that cannot be
 * read would otherwise be retried on every load forever.
 */
function migrateV3(): Partial<Settings> | null {
  const raw = localStorage.getItem(LEGACY_KEY_V3)
  if (!raw) return null
  localStorage.removeItem(LEGACY_KEY_V3)
  const { chordSlots, ...rest } = JSON.parse(raw) as Record<string, unknown>
  return {
    ...(rest as Partial<Settings>),
    // Left unvalidated on purpose; `normalizeSections` is the only validator.
    sections: DEFAULT_SECTIONS.map((section, i) =>
      i === 0 ? { ...section, slots: chordSlots as ChordSlot[] } : section,
    ),
  }
}

function normalizeSections(sections: unknown): SongSection[] {
  const stored = Array.isArray(sections) ? sections : []
  // Mapping over the defaults pins the length to the section count, whatever
  // was stored — the same guard `normalizeChordSlots` applies to slots.
  return DEFAULT_SECTIONS.map((fallback, i) => {
    const section = (stored[i] ?? {}) as Partial<SongSection>
    return {
      name:
        typeof section.name === 'string'
          ? section.name.slice(0, MAX_SECTION_NAME)
          : fallback.name,
      // Section 1 is where the left hand falls back to, so it can never be off.
      enabled: i === 0 || section.enabled === true,
      slots: normalizeChordSlots(section.slots),
    }
  })
}

/** A stored index can point past the array, or at a section since turned off. */
function normalizeActiveSection(value: unknown, sections: SongSection[]): number {
  const index = clampInteger(value, 0, SECTION_COUNT - 1, 0)
  return sections[index].enabled ? index : firstEnabled(sections)
}

function normalizeChordSlots(slots: unknown): ChordSlot[] {
  const stored = Array.isArray(slots) ? slots : []
  // Mapping over the defaults pins the length to the slot count, whatever was stored.
  return DEFAULT_CHORD_SLOTS.map((fallback, i) => {
    const slot = (stored[i] ?? {}) as Partial<ChordSlot>
    const chord = isChordName(slot.chord) ? slot.chord : fallback.chord
    return {
      chord,
      // The chord is resolved by now, so the inversion clamps to that quality's
      // note count rather than to a generic ceiling.
      inversion: clampInteger(slot.inversion, 0, maxInversion(parseChord(chord)!.quality), 0),
      bass: ROOTS.includes(slot.bass as Root) ? (slot.bass as Root) : null,
      octave: clampInteger(slot.octave, -MAX_OCTAVE_OFFSET, MAX_OCTAVE_OFFSET, fallback.octave),
    }
  })
}

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, Math.round(parsed)))
}

function normalizeVoice(voice: unknown): Voice {
  if (!voice || typeof voice !== 'object') return { ...DEFAULT_VOICE }
  const stored = voice as Partial<Voice>
  return {
    waveform: isWaveformName(stored.waveform) ? stored.waveform : DEFAULT_VOICE.waveform,
    attack: clampRange(stored.attack, ADSR_RANGES.attack, DEFAULT_VOICE.attack),
    decay: clampRange(stored.decay, ADSR_RANGES.decay, DEFAULT_VOICE.decay),
    sustain: clampRange(stored.sustain, ADSR_RANGES.sustain, DEFAULT_VOICE.sustain),
    release: clampRange(stored.release, ADSR_RANGES.release, DEFAULT_VOICE.release),
  }
}

function clampRange(value: unknown, range: { min: number; max: number }, fallback: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(range.max, Math.max(range.min, parsed))
}
