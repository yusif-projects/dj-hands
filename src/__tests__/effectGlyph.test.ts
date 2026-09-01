import { describe, expect, it } from 'vitest'
import { DELAY_FEEDBACK, EFFECT_IDS } from '../audio/effects'
import { DELAY_TAPS, PHASER_NOTCHES, effectGlyphPaths } from '../components/effectGlyph'

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

  it('draws bitcrusher as flat holds snapped to a handful of levels', () => {
    const ys = effectGlyphPaths('bitcrusher', W, H).flatMap((d) => points(d).map((p) => p.y))

    // Each hold is two points at one height; the vertical between holds falls
    // out of the x they share, so the pairs are what makes it a staircase.
    for (let i = 0; i < ys.length; i += 2) expect(ys[i + 1]).toBe(ys[i])
    // Quantized rather than merely sampled: far fewer heights than holds.
    expect(new Set(ys).size).toBeLessThan(ys.length / 2)
  })

  it('draws tremolo as two envelopes pinched to nothing between swells', () => {
    const [top, bottom] = effectGlyphPaths('tremolo', W, H).map((d) =>
      points(d).map((p) => p.y),
    )
    const last = top.length - 1

    // The depth LFO reaches zero at both ends and in the middle, so the two
    // outlines meet on the centre line there — that pinch is what reads as
    // tremolo, and a single path could not draw it.
    for (const i of [0, last / 2, last]) {
      expect(top[i]).toBeCloseTo(H / 2, 6)
      expect(bottom[i]).toBeCloseTo(H / 2, 6)
    }
    // And they open to the full height inside each lobe.
    expect(Math.min(...top)).toBeCloseTo(0, 6)
    expect(Math.max(...bottom)).toBeCloseTo(H, 6)
  })

  it('draws phaser as a shelf with notches cut down out of it', () => {
    const [d] = effectGlyphPaths('phaser', W, H)
    const ys = points(d).map((p) => p.y)
    // Level is drawn upward, so the shelf is the smallest y and a notch a larger one.
    const shelf = Math.min(...ys)
    const floor = Math.max(...ys)
    const cut = ys.map((y) => y > (shelf + floor) / 2)

    expect(floor).toBeGreaterThan(shelf)
    // One count per run that leaves the shelf, so a single wide dip cannot pass.
    expect(cut.filter((deep, i) => deep && !cut[i - 1])).toHaveLength(PHASER_NOTCHES)
  })

  it('draws reverb as a hit and a tail that decays away from it', () => {
    const [hit, tail] = effectGlyphPaths('reverb', W, H)
    expect(points(hit)).toHaveLength(2)
    const ys = points(tail).map((p) => p.y)
    for (let i = 1; i < ys.length; i++) expect(ys[i]).toBeGreaterThanOrEqual(ys[i - 1])
  })
})
