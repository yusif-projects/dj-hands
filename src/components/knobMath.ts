/** Rotary-knob geometry and interaction maths. Pure, so the tests can stay DOM-free. */

import type { AdsrRange } from '../audio/voice'

// A 270° sweep with the dead zone at the bottom — the hardware convention, and
// the one that leaves the pointer unambiguous at both ends.
export const KNOB_SWEEP = 270
export const KNOB_MIN_ANGLE = -KNOB_SWEEP / 2
export const KNOB_MAX_ANGLE = KNOB_SWEEP / 2

// Vertical pixels of drag that cross the whole range. Long enough that the
// coarsest range (release, 0.02→4 s) still lands on a value you meant.
export const KNOB_DRAG_PX = 160

/** Degrees from 12 o'clock, positive clockwise. */
export function knobAngle(value: number, range: AdsrRange): number {
  return KNOB_MIN_ANGLE + fraction(value, range) * KNOB_SWEEP
}

/** Where `value` sits in its range, 0→1. */
export function fraction(value: number, range: AdsrRange): number {
  const span = range.max - range.min
  if (span <= 0) return 0
  return clamp((value - range.min) / span, 0, 1)
}

/**
 * The value after dragging `dy` pixels *upward* from `startValue`. Screen y
 * grows downward, so callers pass `startY - clientY`.
 */
export function knobDragValue(startValue: number, dy: number, range: AdsrRange): number {
  const span = range.max - range.min
  return quantize(startValue + (dy / KNOB_DRAG_PX) * span, range)
}

/** Nudge by whole steps, for the arrow and page keys. */
export function knobStep(value: number, steps: number, range: AdsrRange): number {
  return quantize(value + steps * range.step, range)
}

/** Snap to the range's step and clamp to its bounds. */
export function quantize(value: number, range: AdsrRange): number {
  const stepped = Math.round((value - range.min) / range.step) * range.step + range.min
  // The multiplication leaves drift like 0.15000000000000002, which the readout
  // hides but localStorage would carry forever.
  return round(clamp(stepped, range.min, range.max))
}

/** A point on a circle, measured in degrees from 12 o'clock, clockwise. */
export function polarPoint(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180
  return { x: round(cx + r * Math.cos(rad)), y: round(cy + r * Math.sin(rad)) }
}

/** An SVG arc path between two angles on the same circle. */
export function arcPath(cx: number, cy: number, r: number, fromDeg: number, toDeg: number): string {
  const from = polarPoint(cx, cy, r, fromDeg)
  const to = polarPoint(cx, cy, r, toDeg)
  const largeArc = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0
  const sweep = toDeg >= fromDeg ? 1 : 0
  return `M ${from.x} ${from.y} A ${r} ${r} 0 ${largeArc} ${sweep} ${to.x} ${to.y}`
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function round(value: number): number {
  return Number(value.toFixed(6))
}
