/** The filter the right hand's rotation sweeps, picked once in the panel. */

export type FilterType = 'lowpass' | 'highpass' | 'bandpass'

export const FILTER_TYPES: FilterType[] = ['lowpass', 'highpass', 'bandpass']

export const DEFAULT_FILTER_TYPE: FilterType = 'lowpass'

export function isFilterType(value: unknown): value is FilterType {
  return typeof value === 'string' && (FILTER_TYPES as string[]).includes(value)
}

/**
 * Maps a 0-1 rotation amount onto a cutoff in Hz. Exponential, because pitch and
 * brightness are heard in ratios: a linear sweep spends most of its travel in a
 * range that sounds identically open.
 *
 * Lives here rather than beside the Tone graph that consumes it. It is pure
 * maths, and the HUD needs it to label the sweep — importing it from
 * `SynthEngine` pulled all of Tone into the entry chunk for one function.
 */
export function cutoffHz(amount: number, min: number, max: number): number {
  const lo = Math.max(1, min)
  const hi = Math.max(lo, max)
  return lo * (hi / lo) ** clamp01(amount)
}

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v))
}
