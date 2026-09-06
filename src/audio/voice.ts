/** The synth voice: up to three oscillators sharing one ADSR envelope. */

import type { ControlRange } from './range'

export type WaveformName = 'sine' | 'triangle' | 'square' | 'sawtooth'

export const WAVEFORMS: WaveformName[] = ['sine', 'triangle', 'square', 'sawtooth']

/**
 * How many oscillators a voice has: A, plus the B and C below. Written once
 * here rather than in each of the three places that count them out to a reader,
 * so a fourth layer updates the landing page and the start card with the model
 * instead of leaving them quietly claiming three.
 */
export const OSCILLATOR_COUNT = 3

export interface Voice {
  /** The first oscillator's shape. Unsuffixed: it was the only one there was. */
  waveform: WaveformName
  /** ADSR; attack/decay/release in seconds, sustain 0-1. Shared by every oscillator. */
  attack: number
  decay: number
  sustain: number
  release: number
  /**
   * The first oscillator's weight in the blend. A balance rather than a volume:
   * levels are normalized across whichever layers are live, so the one below
   * only means something once a second shape is stacked. See `layerGainsDb`.
   */
  levelA: number
  /** Whether the second oscillator sounds at all. Off is the voice as it always was. */
  oscB: boolean
  waveformB: WaveformName
  levelB: number
  /** Cents. A few of them beat against A, which is the reason to stack shapes. */
  detuneB: number
  /** Whole octaves, folded into the same detune as `detuneB` rather than transposing. */
  octaveB: number
  /** The third oscillator, in every way the second's equal — and independent of
      it, so A+C with B off is a patch like any other. */
  oscC: boolean
  waveformC: WaveformName
  levelC: number
  detuneC: number
  octaveC: number
}

export const DEFAULT_VOICE: Voice = {
  waveform: 'sawtooth',
  attack: 0.15,
  decay: 0.3,
  sustain: 0.8,
  release: 0.8,
  levelA: 1,
  oscB: false,
  // B and C's defaults are only ever reached by switching them on, so they are
  // set to sound like something rather than to be neutral: a square against the
  // saw above, an even blend, and enough detune to hear the pair beat.
  waveformB: 'square',
  levelB: 1,
  detuneB: 7,
  octaveB: 0,
  oscC: false,
  // A sine an octave down, detuned the other way from B: weight underneath the
  // pair rather than a third shape competing with them for the same register.
  waveformC: 'sine',
  levelC: 1,
  detuneC: -5,
  octaveC: -1,
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

/** Knob bounds shared by every stacked oscillator; the clamps stored voices are
    normalized to. One record rather than one per layer: the three are the same
    controls, and a bound that moved for only one of them would be a bug. */
export const OSC_LAYER_RANGES: Record<'level' | 'detune' | 'octave', ControlRange> = {
  level: { min: 0, max: 1, step: 0.01 },
  // Past about fifty cents the pair stops reading as one thick note and starts
  // reading as two notes out of tune with each other.
  detune: { min: -50, max: 50, step: 1 },
  octave: { min: -2, max: 2, step: 1 },
}

export function isWaveformName(value: unknown): value is WaveformName {
  return typeof value === 'string' && (WAVEFORMS as string[]).includes(value)
}

/**
 * Each layer's level in dB for the given weights, equal-power rather than
 * linear: uncorrelated shapes at half amplitude each sum to a patch noticeably
 * quieter than either alone, so the levels are normalized by power — the squares
 * sum to one — and the patch holds its loudness however the balance is set.
 *
 * Pass 0 for a layer that is switched off. That falls out as -Infinity and, more
 * to the point, leaves the layers that are on to share the whole of the power
 * between them: one live oscillator comes back at unity whatever its level
 * reads, so stacking a shape adds it rather than pulling the patch down by the
 * 3dB an even pair would cost it. A level is a balance, not a volume.
 *
 * With every weight at zero there is no balance to strike and nothing sounds.
 */
export function layerGainsDb(levels: number[]): number[] {
  const weights = levels.map((level) => Math.min(1, Math.max(0, level)))
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  if (total <= 0) return weights.map(() => -Infinity)
  return weights.map((weight) => gainToDb(Math.sqrt(weight / total)))
}

/**
 * A stacked oscillator's pitch offset in cents. Octaves ride the same signal as
 * the fine detune — 1200 cents each — so every trigger path can hand all three
 * oscillators the identical note name and let the detune do the transposing.
 */
export function layerDetune(octave: number, detune: number): number {
  return octave * 1200 + detune
}

/**
 * The levels a pre-v2 song's single `mixB` stood for. It was a quarter-turn
 * crossfade — `cos` into A, `sin` into B — and `layerGainsDb` normalizes by
 * power, so weights proportional to the squares of those reproduce the old pair
 * of gains exactly rather than approximately. Scaled so the louder side reads a
 * full 1: the ratio is the whole of the meaning, and a song that arrives with
 * both levels at a third would look, wrongly, like somebody had turned it down.
 *
 * Not snapped to the knob's own step, deliberately. The mapping is quadratic, so
 * near the ends a whole percent of level is a fifth of the quiet side's weight —
 * enough to be a conversion that lands close to the old sound rather than on it.
 * Rounded only far enough out to keep float noise off the value.
 *
 * The only piece of the old shape left anywhere; both migration paths call it.
 */
export function levelsFromMix(mix: number): { levelA: number; levelB: number } {
  const angle = (Math.min(1, Math.max(0, mix)) * Math.PI) / 2
  const a = Math.cos(angle) ** 2
  const b = Math.sin(angle) ** 2
  const louder = Math.max(a, b)
  const scale = (weight: number) => Math.round((weight / louder) * 1e4) / 1e4
  return { levelA: scale(a), levelB: scale(b) }
}

/**
 * Anything at or below this is silence. A weight of zero is exact, but a level
 * dragged to the bottom of its travel need not be, so without a floor a layer
 * turned all the way down would come back at some enormous negative dB instead
 * of off — inaudible either way, but only one of the two is a level a ramp can
 * actually arrive at.
 */
const SILENT_GAIN = 1e-9

/** Kept local rather than taken from Tone, so the pure helpers above stay Tone-free. */
function gainToDb(gain: number): number {
  return gain <= SILENT_GAIN ? -Infinity : 20 * Math.log10(gain)
}
