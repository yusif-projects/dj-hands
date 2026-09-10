import { describe, expect, it } from 'vitest'
import { BEATS_PER_BAR, QUANTIZE_BEATS, QUANTIZE_MODES, type QuantizeMode } from '../audio/clock'
import { quantizeGlyphPath } from '../components/quantizeGlyph'

const W = 44
const H = 22
const PAD = 1.5

/** The glyph's sub-paths, each as its own `x y` pairs. */
function subpaths(d: string): { x: number; y: number }[][] {
  return d
    .trim()
    .split('M ')
    .filter(Boolean)
    .map((run) =>
      run
        .trim()
        .split(' L ')
        .map((pair) => {
          const [x, y] = pair.trim().split(/\s+/).map(Number)
          return { x, y }
        }),
    )
}

const glyph = (mode: QuantizeMode) => subpaths(quantizeGlyphPath(mode, W, H, PAD))

describe('quantizeGlyphPath', () => {
  it('draws every grid inside its padding', () => {
    for (const mode of QUANTIZE_MODES) {
      for (const run of glyph(mode)) {
        for (const { x, y } of run) {
          expect(x, mode).toBeGreaterThanOrEqual(PAD)
          expect(x, mode).toBeLessThanOrEqual(W - PAD)
          expect(y, mode).toBeGreaterThanOrEqual(PAD)
          expect(y, mode).toBeLessThanOrEqual(H - PAD)
        }
      }
    }
  })

  it('lays a bar line edge to edge under every grid', () => {
    for (const mode of QUANTIZE_MODES) {
      const [bar] = glyph(mode)
      expect(bar, mode).toHaveLength(2)
      expect(bar[0].x, mode).toBeCloseTo(PAD)
      expect(bar[1].x, mode).toBeCloseTo(W - PAD)
      expect(bar[0].y, mode).toBe(bar[1].y)
    }
  })

  it('marks one bar off into as many pieces as the grid divides it into', () => {
    for (const mode of QUANTIZE_MODES) {
      const marks = glyph(mode).length - 1
      const beats = QUANTIZE_BEATS[mode]
      expect(marks, mode).toBe(beats > 0 ? BEATS_PER_BAR / beats : 0)
    }
  })

  it('draws free play as the bar with nothing to land on', () => {
    expect(glyph('off')).toHaveLength(1)
  })

  it('spaces the marks evenly from the left edge', () => {
    const marks = glyph('quarter').slice(1)
    const span = (W - PAD * 2) / BEATS_PER_BAR
    marks.forEach((mark, i) => {
      expect(mark[0].x).toBeCloseTo(PAD + i * span)
      // Each mark is one vertical stroke off the bar line.
      expect(mark).toHaveLength(2)
      expect(mark[0].x).toBe(mark[1].x)
    })
  })

  it('stands the downbeat taller than the marks after it', () => {
    // The same thing the meter bridge says by lighting the one green: a picture
    // that did not show where the bar begins would not be a picture of a bar.
    const [, downbeat, ...rest] = glyph('quarter')
    // y is measured downward, so the taller mark reaches the smaller number.
    expect(downbeat[1].y).toBeCloseTo(PAD)
    for (const mark of rest) {
      expect(mark[1].y).toBeGreaterThan(downbeat[1].y)
    }
  })

  it('draws each grid differently, so no two buttons repeat', () => {
    const drawn = QUANTIZE_MODES.map((mode) => quantizeGlyphPath(mode, W, H, PAD))
    expect(new Set(drawn).size).toBe(QUANTIZE_MODES.length)
  })
})
