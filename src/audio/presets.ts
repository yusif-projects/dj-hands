/** The five synth voices selected by right-hand gestures 1-5. */

export type OscillatorName = 'sine' | 'triangle' | 'square' | 'sawtooth' | 'fatsine' | 'fatsawtooth'

export interface Preset {
  name: string
  oscillator: OscillatorName
  /** ADSR; attack/decay/release in seconds, sustain 0-1. */
  attack: number
  decay: number
  sustain: number
  release: number
  /** Low-pass cutoff in Hz. */
  cutoff: number
  /** Reverb send, 0-1. */
  reverb: number
}

export const PRESETS: Preset[] = [
  { name: 'Warm Pad',    oscillator: 'sawtooth',   attack: 0.6,  decay: 0.4, sustain: 0.8,  release: 1.6, cutoff: 1800, reverb: 0.55 },
  { name: 'Square Lead', oscillator: 'square',     attack: 0.01, decay: 0.2, sustain: 0.7,  release: 0.3, cutoff: 3500, reverb: 0.05 },
  { name: 'Soft Sine',   oscillator: 'sine',       attack: 0.15, decay: 0.3, sustain: 0.85, release: 0.8, cutoff: 5000, reverb: 0.25 },
  { name: 'Pluck',       oscillator: 'triangle',   attack: 0.005, decay: 0.5, sustain: 0.15, release: 0.4, cutoff: 4000, reverb: 0.2 },
  { name: 'Organ',       oscillator: 'fatsine',    attack: 0.02, decay: 0.05, sustain: 1.0, release: 0.1, cutoff: 6000, reverb: 0.15 },
]

export const OSCILLATOR_OPTIONS: OscillatorName[] = [
  'sine', 'triangle', 'square', 'sawtooth', 'fatsine', 'fatsawtooth',
]
