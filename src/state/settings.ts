import {
  DEFAULT_CHORDS,
  DEFAULT_CHORD_OCTAVES,
  MAX_OCTAVE_OFFSET,
  isChordName,
  type ChordName,
} from '../audio/chords'
import { ADSR_RANGES, DEFAULT_VOICE, isWaveformName, type Voice } from '../audio/voice'

/** Bounds for the filter sweep, disjoint so `cutoffMin < cutoffMax` always holds. */
export const CUTOFF_MIN_RANGE = { min: 50, max: 1000, step: 10 }
export const CUTOFF_MAX_RANGE = { min: 1000, max: 12000, step: 100 }

export interface Settings {
  /** Chord for left-hand gestures 1-5, index 0 = one finger. */
  chords: ChordName[]
  /** Per-slot octave shift applied on top of `octave`, same indexing as `chords`. */
  chordOctaves: number[]
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
  /** Consecutive frames a gesture must hold before it commits. */
  debounceFrames: number
  /** Flips MediaPipe's handedness labels when they come out inverted. */
  swapHands: boolean
  showOverlay: boolean
}

// v2 dropped the five-preset array for a single `voice`; a v1 blob is not
// merge-compatible, and its dead `presets` key would be re-saved forever.
const STORAGE_KEY = 'gesture-music.settings.v2'

export const DEFAULT_SETTINGS: Settings = {
  chords: [...DEFAULT_CHORDS],
  chordOctaves: [...DEFAULT_CHORD_OCTAVES],
  voice: { ...DEFAULT_VOICE },
  octave: 3,
  volumeTop: 0.15,
  volumeBottom: 0.85,
  cutoffMin: 200,
  cutoffMax: 8000,
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
      chords: normalizeChords(parsed.chords),
      chordOctaves: normalizeChordOctaves(parsed.chordOctaves),
      voice: normalizeVoice(parsed.voice),
      cutoffMin: clampRange(parsed.cutoffMin, CUTOFF_MIN_RANGE, DEFAULT_SETTINGS.cutoffMin),
      cutoffMax: clampRange(parsed.cutoffMax, CUTOFF_MAX_RANGE, DEFAULT_SETTINGS.cutoffMax),
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

function normalizeChords(chords: unknown): ChordName[] {
  if (!Array.isArray(chords)) return [...DEFAULT_CHORDS]
  return DEFAULT_CHORDS.map((fallback, i) => (isChordName(chords[i]) ? chords[i] : fallback))
}

function normalizeChordOctaves(offsets: unknown): number[] {
  if (!Array.isArray(offsets)) return [...DEFAULT_CHORD_OCTAVES]
  return DEFAULT_CHORD_OCTAVES.map((fallback, i) => {
    const value = Number(offsets[i])
    if (!Number.isFinite(value)) return fallback
    return Math.min(MAX_OCTAVE_OFFSET, Math.max(-MAX_OCTAVE_OFFSET, Math.round(value)))
  })
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
