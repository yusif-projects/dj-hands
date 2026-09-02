import { describe, expect, it } from 'vitest'
import { ARP_PATTERNS, type ArpPattern } from '../audio/arp'
import { arpGlyphPath } from '../components/arpGlyph'

const W = 44
const H = 22
const PAD = 1.5

/** Every `x y` pair in a path, as numbers. */
function points(d: string): { x: number; y: number }[] {
  return d
    .replace(/^M /, '')
    .split(' L ')
    .map((pair) => {
      const [x, y] = pair.trim().split(/\s+/).map(Number)
      return { x, y }
    })
}

const glyph = (pattern: ArpPattern) => points(arpGlyphPath(pattern, W, H, PAD))

describe('arpGlyphPath', () => {
  it('draws every pattern inside its padding, edge to edge', () => {
    for (const pattern of ARP_PATTERNS) {
      const drawn = glyph(pattern)
      expect(drawn.length, pattern).toBeGreaterThan(3)
      for (const { x, y } of drawn) {
        expect(x, pattern).toBeGreaterThanOrEqual(PAD)
        expect(x, pattern).toBeLessThanOrEqual(W - PAD)
        expect(y, pattern).toBeGreaterThanOrEqual(PAD)
        expect(y, pattern).toBeLessThanOrEqual(H - PAD)
      }
      expect(drawn[0].x, pattern).toBeCloseTo(PAD)
      expect(drawn[drawn.length - 1].x, pattern).toBeCloseTo(W - PAD)
    }
  })

  it('is a staircase: every step is a flat run of the same width', () => {
    const drawn = glyph('up')
    expect(drawn).toHaveLength(6)
    for (let i = 0; i < drawn.length; i += 2) {
      expect(drawn[i].y).toBe(drawn[i + 1].y)
      expect(drawn[i + 1].x - drawn[i].x).toBeCloseTo((W - PAD * 2) / 3)
    }
  })

  it('climbs for up and falls for down — y is measured downward', () => {
    const up = glyph('up').map((p) => p.y)
    const down = glyph('down').map((p) => p.y)
    expect(up[0]).toBeGreaterThan(up[up.length - 1])
    expect(down[0]).toBeLessThan(down[down.length - 1])
    expect(down).toEqual([...up].reverse())
  })

  it('turns back on itself for the round trips, and reaches both ends', () => {
    for (const pattern of ['updown', 'downup'] as const) {
      const levels = glyph(pattern).map((p) => p.y)
      expect(Math.min(...levels), pattern).toBeCloseTo(PAD)
      expect(Math.max(...levels), pattern).toBeCloseTo(H - PAD)
      // Four steps rather than three: the turn adds one on the way back.
      expect(glyph(pattern), pattern).toHaveLength(8)
    }
  })

  it('draws random as something other than the order it borrows', () => {
    // `arpSequence` hands random back in up order, so a glyph derived from it
    // without a shape of its own would draw two identical picker buttons.
    expect(glyph('random')).not.toEqual(glyph('up'))
  })
})
