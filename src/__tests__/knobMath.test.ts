import { describe, expect, it } from 'vitest'
import {
  KNOB_DRAG_PX,
  KNOB_MAX_ANGLE,
  KNOB_MIN_ANGLE,
  arcPath,
  fraction,
  knobAngle,
  knobDragValue,
  knobStep,
  polarPoint,
  quantize,
} from '../components/knobMath'
import { ADSR_RANGES } from '../audio/voice'

const attack = ADSR_RANGES.attack
const sustain = ADSR_RANGES.sustain

describe('knobAngle', () => {
  it('spans the full sweep between the bounds', () => {
    expect(knobAngle(attack.min, attack)).toBe(KNOB_MIN_ANGLE)
    expect(knobAngle(attack.max, attack)).toBe(KNOB_MAX_ANGLE)
  })

  it('points straight up at the midpoint', () => {
    expect(knobAngle(0.5, sustain)).toBeCloseTo(0, 10)
  })

  it('clamps rather than winding past either end', () => {
    expect(knobAngle(-5, sustain)).toBe(KNOB_MIN_ANGLE)
    expect(knobAngle(5, sustain)).toBe(KNOB_MAX_ANGLE)
  })
})

describe('fraction', () => {
  it('is zero at the floor and one at the ceiling', () => {
    expect(fraction(attack.min, attack)).toBe(0)
    expect(fraction(attack.max, attack)).toBe(1)
  })
})

describe('knobDragValue', () => {
  it('raises on an upward drag and lowers on a downward one', () => {
    expect(knobDragValue(0.5, 20, sustain)).toBeGreaterThan(0.5)
    expect(knobDragValue(0.5, -20, sustain)).toBeLessThan(0.5)
  })

  it('crosses the whole range over the full drag distance', () => {
    expect(knobDragValue(sustain.min, KNOB_DRAG_PX, sustain)).toBe(sustain.max)
  })

  it('clamps at both ends instead of wrapping', () => {
    expect(knobDragValue(0.5, 10 * KNOB_DRAG_PX, sustain)).toBe(sustain.max)
    expect(knobDragValue(0.5, -10 * KNOB_DRAG_PX, sustain)).toBe(sustain.min)
  })

  it('does not move for a drag shorter than one step', () => {
    expect(knobDragValue(0.5, 0, sustain)).toBe(0.5)
  })
})

describe('knobStep', () => {
  it('moves by whole steps in either direction', () => {
    expect(knobStep(0.5, 1, sustain)).toBe(0.51)
    expect(knobStep(0.5, -1, sustain)).toBe(0.49)
    expect(knobStep(0.5, 10, sustain)).toBe(0.6)
  })

  it('is a no-op at the bound it is pushed against', () => {
    expect(knobStep(attack.max, 1, attack)).toBe(attack.max)
    expect(knobStep(attack.min, -1, attack)).toBe(attack.min)
  })
})

describe('quantize', () => {
  it('snaps to the step without leaving float drift behind', () => {
    // The naive round(v / step) * step gives 0.15000000000000002 here, which
    // the readout hides but localStorage would carry.
    expect(quantize(0.1499, attack)).toBe(0.15)
    expect(String(quantize(0.1499, attack))).toBe('0.15')
    expect(quantize(0.117, ADSR_RANGES.release)).toBe(0.12)
  })

  it('respects a floor that is not a multiple of the step', () => {
    // Release runs 0.02…4 in steps of 0.02, so the grid is offset from zero.
    expect(quantize(0, ADSR_RANGES.release)).toBe(0.02)
  })
})

describe('polarPoint', () => {
  it('measures degrees from twelve o clock, clockwise', () => {
    expect(polarPoint(24, 24, 10, 0)).toEqual({ x: 24, y: 14 })
    expect(polarPoint(24, 24, 10, 90)).toEqual({ x: 34, y: 24 })
    expect(polarPoint(24, 24, 10, 180)).toEqual({ x: 24, y: 34 })
  })
})

describe('arcPath', () => {
  it('flags the long way round only past a half turn', () => {
    expect(arcPath(24, 24, 18, KNOB_MIN_ANGLE, KNOB_MAX_ANGLE)).toContain(' 1 1 ')
    expect(arcPath(24, 24, 18, KNOB_MIN_ANGLE, 0)).toContain(' 0 1 ')
  })

  it('collapses to a point when there is nothing to fill', () => {
    const path = arcPath(24, 24, 18, KNOB_MIN_ANGLE, KNOB_MIN_ANGLE)
    const start = polarPoint(24, 24, 18, KNOB_MIN_ANGLE)
    expect(path.startsWith(`M ${start.x} ${start.y}`)).toBe(true)
    expect(path.endsWith(`${start.x} ${start.y}`)).toBe(true)
  })
})
