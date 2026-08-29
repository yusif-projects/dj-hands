import { describe, expect, it } from 'vitest'
import { FILTER_TYPES } from '../audio/filter'
import { SPECTRUM_MAX, SPECTRUM_MIN, response, responsePath, spectrumX } from '../components/filterShape'

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

describe('spectrumX', () => {
  it('puts the axis ends at the box ends', () => {
    expect(spectrumX(SPECTRUM_MIN)).toBe(0)
    expect(spectrumX(SPECTRUM_MAX)).toBe(1)
  })

  it('is logarithmic, so the geometric middle sits halfway', () => {
    expect(spectrumX(Math.sqrt(SPECTRUM_MIN * SPECTRUM_MAX))).toBeCloseTo(0.5, 6)
  })

  it('clamps anything off the axis to its end', () => {
    expect(spectrumX(1)).toBe(0)
    expect(spectrumX(96000)).toBe(1)
  })
})

describe('response', () => {
  it('keeps the side of the cutoff its name promises', () => {
    // Well below the cutoff, and well above it.
    expect(response('lowpass', 0.5, 0.1)).toBeGreaterThan(0.9)
    expect(response('lowpass', 0.5, 0.9)).toBeLessThan(0.1)
    expect(response('highpass', 0.5, 0.1)).toBeLessThan(0.1)
    expect(response('highpass', 0.5, 0.9)).toBeGreaterThan(0.9)
  })

  it('leaves the bandpass falling away on both sides of its band', () => {
    expect(response('bandpass', 0.5, 0.5)).toBeCloseTo(1, 6)
    expect(response('bandpass', 0.5, 0.2)).toBeLessThan(0.2)
    expect(response('bandpass', 0.5, 0.8)).toBeLessThan(0.2)
  })

  it('meets its own knee at the same height wherever the knee is', () => {
    for (const type of FILTER_TYPES) {
      const at = (cutoff: number) => response(type, cutoff, cutoff)
      expect(at(0.2)).toBeCloseTo(at(0.8), 6)
    }
  })

  it('never leaves 0-1, so a curve cannot escape its box', () => {
    for (const type of FILTER_TYPES) {
      for (let i = 0; i <= 20; i++) {
        const magnitude = response(type, 0.5, i / 20)
        expect(magnitude).toBeGreaterThanOrEqual(0)
        expect(magnitude).toBeLessThanOrEqual(1)
      }
    }
  })
})

describe('responsePath', () => {
  it('spans the box left to right', () => {
    for (const type of FILTER_TYPES) {
      const pts = points(responsePath(type, 0.5, W, H))
      expect(pts[0].x).toBe(0)
      expect(pts[pts.length - 1].x).toBe(W)
    }
  })

  it('stays inside the padding, so a thick stroke cannot clip', () => {
    const pad = 3
    for (const type of FILTER_TYPES) {
      for (const point of points(responsePath(type, 0.5, W, H, pad))) {
        expect(point.x).toBeGreaterThanOrEqual(pad)
        expect(point.x).toBeLessThanOrEqual(W - pad)
        expect(point.y).toBeGreaterThanOrEqual(pad)
        expect(point.y).toBeLessThanOrEqual(H - pad)
      }
    }
  })

  it('slides with the cutoff rather than reshaping', () => {
    const closed = points(responsePath('lowpass', 0.2, W, H))
    const open = points(responsePath('lowpass', 0.8, W, H))
    // Higher cutoff, so more of the band is still standing at any given x.
    for (let i = 0; i < closed.length; i++) expect(open[i].y).toBeLessThanOrEqual(closed[i].y)
  })
})
