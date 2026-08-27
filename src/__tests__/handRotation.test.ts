import { describe, expect, it } from 'vitest'
import type { Point } from '../vision/fingerCount'
import { ROTATION_RANGE, palmTilt, rotationAmount } from '../vision/handRotation'

/**
 * Only the wrist and the middle MCP matter, but the guard needs 21 landmarks.
 * `radians` is the turn as the *player* sees it, positive clockwise; landmarks
 * come from the unmirrored frame, so the fixture rotates the other way.
 */
function makePalm(radians = 0): Point[] {
  const turn = -radians
  const lm: Point[] = Array.from({ length: 21 }, () => ({ x: 0, y: 0 }))
  lm[0] = { x: 0.5, y: 0.8 }
  // Upright: the middle knuckle sits directly above the wrist.
  const dx = 0
  const dy = -0.3
  lm[9] = {
    x: lm[0].x + dx * Math.cos(turn) - dy * Math.sin(turn),
    y: lm[0].y + dx * Math.sin(turn) + dy * Math.cos(turn),
  }
  return lm
}

const deg = (d: number) => (d * Math.PI) / 180

describe('palmTilt', () => {
  it('reads an upright palm as no tilt', () => {
    expect(palmTilt(makePalm(0))).toBeCloseTo(0, 6)
  })

  it('signs a clockwise turn positive and an anticlockwise turn negative', () => {
    expect(palmTilt(makePalm(deg(45)))).toBeCloseTo(deg(45), 6)
    expect(palmTilt(makePalm(deg(-45)))).toBeCloseTo(deg(-45), 6)
  })

  it('does not jump a full turn when the hand goes upside down', () => {
    // Just past straight down from either side must stay near ±180°, not wrap to 0.
    expect(palmTilt(makePalm(deg(179)))).toBeCloseTo(deg(179), 6)
    expect(palmTilt(makePalm(deg(-179)))).toBeCloseTo(deg(-179), 6)
  })

  it('rejects landmarks it cannot measure', () => {
    expect(palmTilt([])).toBeNull()
    expect(palmTilt(Array.from({ length: 12 }, () => ({ x: 0.5, y: 0.5 })))).toBeNull()

    const collapsed = makePalm(0)
    collapsed[9] = { ...collapsed[0] }
    expect(palmTilt(collapsed)).toBeNull()
  })
})

describe('rotationAmount', () => {
  it('puts upright in the middle of the sweep', () => {
    expect(rotationAmount(makePalm(0))).toBeCloseTo(0.5, 6)
  })

  it('reaches the extremes at the edges of the range', () => {
    expect(rotationAmount(makePalm(ROTATION_RANGE))).toBeCloseTo(1, 6)
    expect(rotationAmount(makePalm(-ROTATION_RANGE))).toBeCloseTo(0, 6)
  })

  it('clamps past the range instead of sweeping back', () => {
    expect(rotationAmount(makePalm(deg(120)))).toBe(1)
    expect(rotationAmount(makePalm(deg(-120)))).toBe(0)
  })

  it('rises monotonically through the range', () => {
    const readings = [-60, -30, 0, 30, 60].map((d) => rotationAmount(makePalm(deg(d)))!)
    for (let i = 1; i < readings.length; i++) {
      expect(readings[i]).toBeGreaterThan(readings[i - 1])
    }
  })

  it('passes through a hand it cannot measure', () => {
    expect(rotationAmount([])).toBeNull()
  })
})
