import {
  DEFAULT_CHORD_SLOTS,
  MAX_OCTAVE_OFFSET,
  ROOTS,
  isChordName,
  maxInversion,
  parseChord,
  type ChordSlot,
  type Root,
} from '../audio/chords'
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
  /** Chord and voicing for left-hand gestures 1-5, index 0 = one finger. */
  chordSlots: ChordSlot[]
  /** The one synth voice; the right hand no longer switches between several. */
  voice: Voice
  /** Global octave every chord slot is offset from. */
  octave: number
  /** Frame of the video where volume reads as 1.0 (near the top). */
  volumeTop: number
  /** Frame position where volume reads as 0.0 (near the bottom). */
  volumeBottom: number
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
}

// Each bump orphans the older blob rather than upgrading it: v2 dropped the
// five-preset array for a single `voice`, and v3 folded the parallel `chords`
// and `chordOctaves` arrays into `chordSlots`. Neither is merge-compatible, and
// the dead keys would be re-saved forever.
const STORAGE_KEY = 'gesture-music.settings.v3'

export const DEFAULT_SETTINGS: Settings = {
  chordSlots: DEFAULT_CHORD_SLOTS.map((slot) => ({ ...slot })),
  voice: { ...DEFAULT_VOICE },
  octave: 3,
  volumeTop: 0.15,
  volumeBottom: 0.85,
  cutoffMin: 200,
  cutoffMax: 8000,
  sendTarget: DEFAULT_SEND_TARGET,
  sendAmount: DEFAULT_SEND_AMOUNT,
  debounceFrames: 4,
  swapHands: false,
  showOverlay: true,
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<Settings>
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      // Guard against a stored array of the wrong length from an older build.
      chordSlots: normalizeChordSlots(parsed.chordSlots),
      voice: normalizeVoice(parsed.voice),
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
