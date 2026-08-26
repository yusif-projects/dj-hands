import {
  DEFAULT_CHORDS,
  DEFAULT_CHORD_OCTAVES,
  MAX_OCTAVE_OFFSET,
  isChordName,
  type ChordName,
} from '../audio/chords'
import { PRESETS, type Preset } from '../audio/presets'

export interface Settings {
  /** Chord for left-hand gestures 1-5, index 0 = one finger. */
  chords: ChordName[]
  /** Per-slot octave shift applied on top of `octave`, same indexing as `chords`. */
  chordOctaves: number[]
  presets: Preset[]
  /** Global octave every chord slot is offset from. */
  octave: number
  /** Frame of the video where volume reads as 1.0 (near the top). */
  volumeTop: number
  /** Frame position where volume reads as 0.0 (near the bottom). */
  volumeBottom: number
  /** Consecutive frames a gesture must hold before it commits. */
  debounceFrames: number
  /** Flips MediaPipe's handedness labels when they come out inverted. */
  swapHands: boolean
  showOverlay: boolean
}

const STORAGE_KEY = 'gesture-music.settings.v1'

export const DEFAULT_SETTINGS: Settings = {
  chords: [...DEFAULT_CHORDS],
  chordOctaves: [...DEFAULT_CHORD_OCTAVES],
  presets: PRESETS.map((p) => ({ ...p })),
  octave: 3,
  volumeTop: 0.15,
  volumeBottom: 0.85,
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
      presets: normalizePresets(parsed.presets),
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

function normalizePresets(presets: unknown): Preset[] {
  if (!Array.isArray(presets)) return PRESETS.map((p) => ({ ...p }))
  return PRESETS.map((fallback, i) => ({ ...fallback, ...(presets[i] as Preset | undefined) }))
}
