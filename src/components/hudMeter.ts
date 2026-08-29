/** Readout maths and wording for the HUD bar. Pure, so the tests stay DOM-free. */

import type { FilterType } from '../audio/filter'

// Segments in the volume fader. Coarse enough that each one is a visible step
// rather than a smooth bar — the point is that it reads as hardware.
export const HUD_SEGMENTS = 14

// Below this a cutoff reads in Hz; at or above it, in kHz.
const KHZ = 1000

/** How many fader segments a 0-1 volume lights. */
export function litSegments(volume: number): number {
  return Math.round(clamp01(volume) * HUD_SEGMENTS)
}

/** How a cutoff reads in the bar — `480 Hz`, `2.4 kHz`. */
export function formatCutoff(hz: number): string {
  const rounded = Math.round(hz)
  return rounded >= KHZ ? `${(rounded / KHZ).toFixed(1)} kHz` : `${rounded} Hz`
}

/** The filter named short enough to sit beside the cutoff. */
export const FILTER_ABBREV: Record<FilterType, string> = {
  lowpass: 'LP',
  highpass: 'HP',
  bandpass: 'BP',
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}
