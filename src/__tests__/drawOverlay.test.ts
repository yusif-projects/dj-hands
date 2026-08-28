import { describe, expect, it } from 'vitest'
import {
  LEFT_COLOR,
  LEFT_HUE,
  RIGHT_COLOR,
  RIGHT_HUE,
  bloomProgress,
  followLevel,
  handColor,
  neutralStyle,
} from '../vision/drawOverlay'

describe('handColor', () => {
  it('returns the plain hand colour at rest', () => {
    // This is the whole basis of the toggle: with no signal and the filter open,
    // the reactive path must paint exactly what the flat path painted.
    expect(handColor(LEFT_HUE, 1, 0)).toBe(LEFT_COLOR)
    expect(handColor(RIGHT_HUE, 1, 0)).toBe(RIGHT_COLOR)

    const neutral = neutralStyle(LEFT_HUE)
    expect(handColor(neutral.hue, neutral.cutoff, neutral.level)).toBe(LEFT_COLOR)
  })

  it('darkens and desaturates as the filter closes', () => {
    const open = parse(handColor(LEFT_HUE, 1, 0))
    const half = parse(handColor(LEFT_HUE, 0.5, 0))
    const closed = parse(handColor(LEFT_HUE, 0, 0))

    expect(half.lightness).toBeLessThan(open.lightness)
    expect(closed.lightness).toBeLessThan(half.lightness)
    expect(half.saturation).toBeLessThan(open.saturation)
    expect(closed.saturation).toBeLessThan(half.saturation)
  })

  it('brightens with level without touching the hue', () => {
    const quiet = parse(handColor(LEFT_HUE, 1, 0))
    const loud = parse(handColor(LEFT_HUE, 1, 1))

    expect(loud.lightness).toBeGreaterThan(quiet.lightness)
    expect(loud.hue).toBe(quiet.hue)
  })

  it('clamps out-of-range inputs instead of producing nonsense', () => {
    expect(handColor(LEFT_HUE, 2, -1)).toBe(handColor(LEFT_HUE, 1, 0))
  })

  it('carries alpha only when it is not opaque', () => {
    expect(handColor(LEFT_HUE, 1, 0, 1)).not.toContain('/')
    expect(handColor(LEFT_HUE, 1, 0, 0.5)).toContain('/ 0.5')
  })
})

describe('followLevel', () => {
  it('rises faster than it falls', () => {
    const up = followLevel(0, 1, 0.55, 0.08)
    const down = followLevel(1, 0, 0.55, 0.08)
    // An attack should cover more ground in one frame than a release does.
    expect(up).toBeGreaterThan(1 - down)
  })

  it('converges on the target from either direction', () => {
    let rising = 0
    let falling = 1
    for (let i = 0; i < 200; i++) {
      rising = followLevel(rising, 1, 0.55, 0.08)
      falling = followLevel(falling, 0, 0.55, 0.08)
    }
    expect(rising).toBeCloseTo(1, 4)
    expect(falling).toBeCloseTo(0, 4)
  })

  it('never overshoots, even with a rate outside 0-1', () => {
    expect(followLevel(0, 1, 4, 0.08)).toBe(1)
    expect(followLevel(1, 0, 0.55, -2)).toBe(1)
  })
})

describe('bloomProgress', () => {
  it('runs 0 to 1 across the duration', () => {
    expect(bloomProgress(1000, 1000, 500)).toBeCloseTo(0, 6)
    expect(bloomProgress(1250, 1000, 500)).toBeCloseTo(0.5, 6)
  })

  it('expires rather than clamping, so a finished bloom is not redrawn', () => {
    expect(bloomProgress(1500, 1000, 500)).toBeNull()
    expect(bloomProgress(9000, 1000, 500)).toBeNull()
  })

  it('reports nothing before a bloom has ever fired', () => {
    // `bloomAt` starts at 0 in the loop and must not paint a bloom at startup.
    expect(bloomProgress(1000, 0, 500)).toBeNull()
    expect(bloomProgress(900, 1000, 500)).toBeNull()
  })
})

/** Pulls the numbers back out of an `hsl(h s% l%)` string for comparison. */
function parse(color: string) {
  const [hue, saturation, lightness] = color.match(/[\d.]+/g)!.map(Number)
  return { hue, saturation, lightness }
}
