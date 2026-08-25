import { describe, expect, it } from 'vitest'
import { GestureDebouncer, countExtendedFingers, type Point } from '../vision/fingerCount'

/**
 * Builds a synthetic upright right hand. `extended` is [thumb, index, middle,
 * ring, pinky]; an extended digit reaches far from the wrist, a curled one stops
 * short of its own PIP joint.
 */
function makeHand(extended: boolean[]): Point[] {
  const lm: Point[] = Array.from({ length: 21 }, () => ({ x: 0, y: 0 }))
  lm[0] = { x: 0.5, y: 1.0 } // wrist
  lm[9] = { x: 0.5, y: 0.7 } // middle MCP -> palm size 0.3
  lm[17] = { x: 0.62, y: 0.75 } // pinky MCP, on the far side from the thumb

  // Thumb sits on the opposite side of the palm from the pinky MCP.
  lm[1] = { x: 0.42, y: 0.9 }
  lm[2] = { x: 0.38, y: 0.85 }
  lm[3] = { x: 0.35, y: 0.8 } // IP
  lm[4] = extended[0] ? { x: 0.24, y: 0.74 } : { x: 0.44, y: 0.78 } // TIP

  // index, middle, ring, pinky: [MCP, PIP, DIP, TIP]
  const columns = [0.42, 0.5, 0.57, 0.63]
  const bases = [5, 9, 13, 17]
  for (let f = 0; f < 4; f++) {
    const x = columns[f]
    const base = bases[f]
    lm[base] = { x, y: 0.72 }
    lm[base + 1] = { x, y: 0.6 } // PIP
    lm[base + 2] = extended[f + 1] ? { x, y: 0.48 } : { x, y: 0.62 }
    lm[base + 3] = extended[f + 1] ? { x, y: 0.38 } : { x, y: 0.68 } // TIP
  }
  // makeHand overwrote 9 and 17 as finger MCPs, which is correct — they are the
  // same landmarks used for palm size and thumb reference.
  lm[9] = { x: 0.5, y: 0.72 }
  lm[17] = { x: 0.63, y: 0.72 }
  return lm
}

const NONE = [false, false, false, false, false]
const set = (...idx: number[]) => NONE.map((_, i) => idx.includes(i))

/** Rotates every landmark about the frame centre. */
function rotate(lm: Point[], radians: number): Point[] {
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return lm.map(({ x, y }) => {
    const dx = x - 0.5
    const dy = y - 0.5
    return { x: 0.5 + dx * cos - dy * sin, y: 0.5 + dx * sin + dy * cos }
  })
}

describe('countExtendedFingers', () => {
  it('counts a fist as zero', () => {
    expect(countExtendedFingers(makeHand(NONE))).toBe(0)
  })

  it('counts one through five', () => {
    expect(countExtendedFingers(makeHand(set(1)))).toBe(1)
    expect(countExtendedFingers(makeHand(set(1, 2)))).toBe(2)
    expect(countExtendedFingers(makeHand(set(1, 2, 3)))).toBe(3)
    expect(countExtendedFingers(makeHand(set(1, 2, 3, 4)))).toBe(4)
    expect(countExtendedFingers(makeHand(set(0, 1, 2, 3, 4)))).toBe(5)
  })

  it('counts an extended thumb', () => {
    expect(countExtendedFingers(makeHand(set(0)))).toBe(1)
  })

  it('is rotation invariant', () => {
    const hand = makeHand(set(1, 2, 3))
    for (const deg of [-90, -45, 30, 90, 180]) {
      expect(countExtendedFingers(rotate(hand, (deg * Math.PI) / 180))).toBe(3)
    }
  })

  it('returns zero for malformed input', () => {
    expect(countExtendedFingers([])).toBe(0)
    expect(countExtendedFingers([{ x: 0, y: 0 }])).toBe(0)
  })
})

describe('GestureDebouncer', () => {
  it('commits only after the required streak', () => {
    const d = new GestureDebouncer(3)
    expect(d.push(3)).toBe(0)
    expect(d.push(3)).toBe(0)
    expect(d.push(3)).toBe(3)
  })

  it('ignores a single stray frame', () => {
    const d = new GestureDebouncer(3)
    d.push(2); d.push(2); d.push(2)
    expect(d.push(5)).toBe(2)
    expect(d.push(2)).toBe(2)
  })

  it('resets back to zero', () => {
    const d = new GestureDebouncer(1)
    expect(d.push(4)).toBe(4)
    d.reset()
    expect(d.value).toBe(0)
  })
})
