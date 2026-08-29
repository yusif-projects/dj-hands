import { describe, expect, it } from 'vitest'
import { DELAY_FEEDBACK, EFFECT_IDS } from '../audio/effects'
import { DELAY_TAPS, effectGlyphPaths } from '../components/effectGlyph'

const W = 44
const H = 22

/** The numbers back out of a path string, in pairs. */
const points = (d: string): Array<{ x: number; y: number }> =>
  d
    .replace(/[ML]/g, ' ')
    .trim()
    .split(/\s+/)
    .map(Number)
    .reduce<Array<{ x: number; y: number }>>((acc, n, i) => {
      if (i % 2 === 0) acc.push({ x: n, y: 0 })
      else acc[acc.length - 1].y = n
      return acc
    }, [])

describe('effectGlyphPaths', () => {
  it('draws something for every effect', () => {
    for (const id of EFFECT_IDS) {
      const paths = effectGlyphPaths(id, W, H)
      expect(paths.length).toBeGreaterThan(0)
      for (const d of paths) expect(points(d).length).toBeGreaterThan(1)
    }
  })

  it('stays inside the padding, so a thick stroke cannot clip', () => {
    const pad = 3
    for (const id of EFFECT_IDS) {
      for (const d of effectGlyphPaths(id, W, H, pad)) {
        for (const point of points(d)) {
          expect(point.x).toBeGreaterThanOrEqual(pad)
          expect(point.x).toBeLessThanOrEqual(W - pad)
          expect(point.y).toBeGreaterThanOrEqual(pad)
          expect(point.y).toBeLessThanOrEqual(H - pad)
        }
      }
    }
  })

  it('draws chorus as two voices, offset from each other', () => {
    const [first, second] = effectGlyphPaths('chorus', W, H)
    expect(second).toBeDefined()
    expect(second).not.toBe(first)
  })

  it('draws the dry hit plus one bar per repeat worth hearing', () => {
    expect(effectGlyphPaths('delay', W, H)).toHaveLength(DELAY_TAPS + 1)
    // The repeat before the last is still well up; the tail-off is the last one.
    expect(DELAY_FEEDBACK ** (DELAY_TAPS - 1)).toBeGreaterThan(0.08)
    expect(DELAY_FEEDBACK ** DELAY_TAPS).toBeLessThanOrEqual(0.08)
  })

  it('draws the delay repeats falling away from the dry hit', () => {
    // Every bar hangs from the baseline, so a shorter one has a larger top y.
    const tops = effectGlyphPaths('delay', W, H).map((d) => Math.min(...points(d).map((p) => p.y)))
    for (let i = 1; i < tops.length; i++) expect(tops[i]).toBeGreaterThan(tops[i - 1])
  })

  it('draws reverb as a hit and a tail that decays away from it', () => {
    const [hit, tail] = effectGlyphPaths('reverb', W, H)
    expect(points(hit)).toHaveLength(2)
    const ys = points(tail).map((p) => p.y)
    for (let i = 1; i < ys.length; i++) expect(ys[i]).toBeGreaterThanOrEqual(ys[i - 1])
  })
})
