/**
 * A numeric control's bounds and granularity. Shared by the ADSR, cutoff and
 * effect-amount knobs, so one range type reaches both the audio config that
 * declares the bounds and the knob maths that walks them.
 */
export interface ControlRange {
  min: number
  max: number
  step: number
}
