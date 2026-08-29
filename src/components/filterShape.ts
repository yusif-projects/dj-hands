/** Filter response curves, for the type glyphs and the sweep figure. Pure, so the tests stay DOM-free. */

import type { FilterType } from '../audio/filter'
import { CUTOFF_MAX_RANGE, CUTOFF_MIN_RANGE } from '../state/settings'

/**
 * The axis both cutoff curves are drawn on. It spans the union of the two knobs'
 * travel rather than each knob's own range, so the closed and open curves can be
 * read against each other instead of against two different rulers.
 */
export const SPECTRUM_MIN = CUTOFF_MIN_RANGE.min
export const SPECTRUM_MAX = CUTOFF_MAX_RANGE.max

/** How many decades wide that axis is; the response is shaped in ratios, not Hz. */
const DECADES = Math.log10(SPECTRUM_MAX / SPECTRUM_MIN)

/** Enough points that the knee has no visible corners at button size. */
const SAMPLES = 48

/** Narrow enough to read as a band rather than a bump, wide enough not to spike. */
const BANDPASS_Q = 1.4

/** Where `hz` sits on the log axis, 0→1. Anything outside the axis clamps to its end. */
export function spectrumX(hz: number): number {
  const span = Math.log(SPECTRUM_MAX / SPECTRUM_MIN)
  const at = Math.log(clamp(hz, SPECTRUM_MIN, SPECTRUM_MAX) / SPECTRUM_MIN)
  return clamp01(at / span)
}

/**
 * Magnitude 0→1 of `type` at log position `x`, with its knee at `cutoff01`.
 * Soft one-pole-ish knees rather than brick walls: at 44px a vertical cliff
 * reads as a rectangle, and the point of the drawing is which side survives.
 */
export function response(type: FilterType, cutoff01: number, x: number): number {
  // How far past the cutoff we are, as a frequency ratio.
  const ratio = 10 ** ((x - cutoff01) * DECADES)
  if (type === 'lowpass') return 1 / Math.sqrt(1 + ratio ** 4)
  if (type === 'highpass') return 1 / Math.sqrt(1 + ratio ** -4)
  // Symmetric in the ratio, so the band is even on a log axis.
  return 1 / Math.sqrt(1 + (BANDPASS_Q * (ratio - 1 / ratio)) ** 2)
}

/**
 * The response drawn across a `w` × `h` box, inset by `pad` so a thick stroke
 * does not clip where the curve runs along an edge.
 */
export function responsePath(
  type: FilterType,
  cutoff01: number,
  w: number,
  h: number,
  pad = 0,
): string {
  const width = w - pad * 2
  const height = h - pad * 2
  const points: string[] = []

  for (let i = 0; i <= SAMPLES; i++) {
    const x = i / SAMPLES
    const magnitude = clamp01(response(type, cutoff01, x))
    points.push(`${round(pad + x * width)} ${round(pad + (1 - magnitude) * height)}`)
  }

  return `M ${points.join(' L ')}`
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function clamp01(value: number): number {
  return clamp(value, 0, 1)
}

function round(value: number): number {
  return Number(value.toFixed(4))
}
