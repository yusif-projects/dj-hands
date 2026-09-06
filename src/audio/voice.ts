/** The synth voice: two oscillators sharing one ADSR envelope. */

import type { ControlRange } from './range'

export type WaveformName = 'sine' | 'triangle' | 'square' | 'sawtooth'

export const WAVEFORMS: WaveformName[] = ['sine', 'triangle', 'square', 'sawtooth']

export interface Voice {
  /** The first oscillator's shape. Unsuffixed: it was the only one there was. */
  waveform: WaveformName
  /** ADSR; attack/decay/release in seconds, sustain 0-1. Shared by both oscillators. */
  attack: number
  decay: number
  sustain: number
  release: number
  /** Whether the second oscillator sounds at all. Off is the voice as it always was. */
  oscB: boolean
  waveformB: WaveformName
  /** Equal-power blend: 0 is all A, 1 is all B, 0.5 an even pair. */
  mixB: number
  /** Cents. A few of them beat against A, which is the reason to stack two shapes. */
  detuneB: number
  /** Whole octaves, folded into the same detune as `detuneB` rather than transposing. */
  octaveB: number
}

export const DEFAULT_VOICE: Voice = {
  waveform: 'sawtooth',
  attack: 0.15,
  decay: 0.3,
  sustain: 0.8,
  release: 0.8,
  oscB: false,
  // B's defaults are only ever reached by switching it on, so they are set to
  // sound like something rather than to be neutral: a square against the saw
  // above, an even blend, and enough detune to hear the two beat.
  waveformB: 'square',
  mixB: 0.5,
  detuneB: 7,
  octaveB: 0,
}

/** Kept as a name of its own: the ADSR editor reads better than a bare range. */
export type AdsrRange = ControlRange

/** Slider bounds for the ADSR editor; also the clamps stored settings are normalized to. */
export const ADSR_RANGES: Record<'attack' | 'decay' | 'sustain' | 'release', AdsrRange> = {
  // A floor above zero on attack and release: an instant edge clicks on a chord this thick.
  attack: { min: 0.005, max: 2, step: 0.005 },
  decay: { min: 0.005, max: 2, step: 0.005 },
  sustain: { min: 0, max: 1, step: 0.01 },
  release: { min: 0.02, max: 4, step: 0.02 },
}

/** Knob bounds for the second oscillator; the clamps stored voices are normalized to. */
export const OSC_B_RANGES: Record<'mix' | 'detune' | 'octave', ControlRange> = {
  mix: { min: 0, max: 1, step: 0.01 },
  // Past about fifty cents the pair stops reading as one thick note and starts
  // reading as two notes out of tune with each other.
  detune: { min: -50, max: 50, step: 1 },
  octave: { min: -2, max: 2, step: 1 },
}

export function isWaveformName(value: unknown): value is WaveformName {
  return typeof value === 'string' && (WAVEFORMS as string[]).includes(value)
}

/**
 * The two oscillators' levels in dB for a blend of `mix`, equal-power rather
 * than linear: two uncorrelated shapes at half amplitude each sum to a patch
 * noticeably quieter than either alone, and a linear crossfade puts that dip in
 * the middle of the knob's travel — exactly where the blend is meant to live.
 *
 * The ends return -Infinity so a fully-crossfaded oscillator is silent rather
 * than merely quiet, which is what lets the mix knob act as a fade-out too.
 */
export function mixGainDb(mix: number): [a: number, b: number] {
  const clamped = Math.min(1, Math.max(0, mix))
  const angle = (clamped * Math.PI) / 2
  return [gainToDb(Math.cos(angle)), gainToDb(Math.sin(angle))]
}

/**
 * The second oscillator's pitch offset in cents. Octaves ride the same signal as
 * the fine detune — 1200 cents each — so every trigger path can hand both
 * oscillators the identical note name and let the detune do the transposing.
 */
export function oscBDetune(voice: Voice): number {
  return voice.octaveB * 1200 + voice.detuneB
}

/**
 * Anything at or below this is silence. `cos(pi/2)` lands a hair above zero
 * rather than on it, so without a floor the fully-crossfaded oscillator would
 * come back at some enormous negative dB instead of off — inaudible either way,
 * but only one of the two is a level a ramp can actually arrive at.
 */
const SILENT_GAIN = 1e-9

/** Kept local rather than taken from Tone, so the pure helpers above stay Tone-free. */
function gainToDb(gain: number): number {
  return gain <= SILENT_GAIN ? -Infinity : 20 * Math.log10(gain)
}
