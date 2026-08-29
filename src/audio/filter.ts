/** The filter the right hand's rotation sweeps, picked once in the panel. */

export type FilterType = 'lowpass' | 'highpass' | 'bandpass'

export const FILTER_TYPES: FilterType[] = ['lowpass', 'highpass', 'bandpass']

export const DEFAULT_FILTER_TYPE: FilterType = 'lowpass'

export function isFilterType(value: unknown): value is FilterType {
  return typeof value === 'string' && (FILTER_TYPES as string[]).includes(value)
}
