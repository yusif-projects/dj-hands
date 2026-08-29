/** The single synth voice: a waveform plus its ADSR envelope. */

import type { ControlRange } from './range'

export type WaveformName = 'sine' | 'triangle' | 'square' | 'sawtooth'

export const WAVEFORMS: WaveformName[] = ['sine', 'triangle', 'square', 'sawtooth']

export interface Voice {
  waveform: WaveformName
  /** ADSR; attack/decay/release in seconds, sustain 0-1. */
  attack: number
  decay: number
  sustain: number
  release: number
}

export const DEFAULT_VOICE: Voice = {
  waveform: 'sawtooth',
  attack: 0.15,
  decay: 0.3,
  sustain: 0.8,
  release: 0.8,
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

export function isWaveformName(value: unknown): value is WaveformName {
  return typeof value === 'string' && (WAVEFORMS as string[]).includes(value)
}
