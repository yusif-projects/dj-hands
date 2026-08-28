import { describe, expect, it } from 'vitest'
import { WAVEFORMS } from '../audio/voice'
import { SINE_SAMPLES, WAVE_CYCLES, nextWaveform, waveformPath } from '../components/waveformPath'

const W = 40
const H = 24

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

describe('waveformPath', () => {
  it('draws every waveform as a polyline of real numbers', () => {
    for (const name of WAVEFORMS) {
      const d = waveformPath(name, W, H)
      expect(d.startsWith('M ')).toBe(true)
      expect(d).not.toContain('NaN')
      expect(points(d).length).toBeGreaterThan(2)
    }
  })

  it('keeps every point inside the box, and inside the padding when asked', () => {
    for (const name of WAVEFORMS) {
      for (const point of points(waveformPath(name, W, H))) {
        expect(point.x).toBeGreaterThanOrEqual(0)
        expect(point.x).toBeLessThanOrEqual(W)
        expect(point.y).toBeGreaterThanOrEqual(0)
        expect(point.y).toBeLessThanOrEqual(H)
      }
      for (const point of points(waveformPath(name, W, H, 3))) {
        expect(point.y).toBeGreaterThanOrEqual(3)
        expect(point.y).toBeLessThanOrEqual(H - 3)
      }
    }
  })

  it('fills the box edge to edge, top to bottom', () => {
    for (const name of WAVEFORMS) {
      const pts = points(waveformPath(name, W, H))
      expect(Math.min(...pts.map((p) => p.x))).toBe(0)
      expect(Math.max(...pts.map((p) => p.x))).toBe(W)
      expect(Math.min(...pts.map((p) => p.y))).toBeCloseTo(0, 6)
      expect(Math.max(...pts.map((p) => p.y))).toBeCloseTo(H, 6)
    }
  })

  it('joins the cycles without repeating the point they meet on', () => {
    for (const name of WAVEFORMS) {
      const pts = points(waveformPath(name, W, H))
      // A cycle that both ended and restarted at the seam would leave a
      // zero-length segment there.
      const doubled = pts.filter((p, i) => i > 0 && p.x === pts[i - 1].x && p.y === pts[i - 1].y)
      expect(doubled).toHaveLength(0)
    }
  })

  it('samples the sine smoothly, with no repeated x to make a corner', () => {
    const xs = points(waveformPath('sine', W, H)).map((p) => p.x)
    expect(xs).toHaveLength(SINE_SAMPLES * WAVE_CYCLES + 1)
    for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1])
  })

  it('gives square and sawtooth a vertical edge, and triangle none', () => {
    const verticals = (name: (typeof WAVEFORMS)[number]) => {
      const pts = points(waveformPath(name, W, H))
      return pts.filter((p, i) => i > 0 && p.x === pts[i - 1].x).length
    }
    // Square jumps once per cycle plus the reset between them; sawtooth once
    // per cycle, on the drop at its end.
    expect(verticals('square')).toBeGreaterThanOrEqual(WAVE_CYCLES)
    expect(verticals('sawtooth')).toBe(WAVE_CYCLES)
    expect(verticals('triangle')).toBe(0)
  })
})

describe('nextWaveform', () => {
  it('steps forward and back through the list', () => {
    expect(nextWaveform('sine', 1)).toBe('triangle')
    expect(nextWaveform('square', -1)).toBe('triangle')
  })

  it('wraps around at both ends', () => {
    expect(nextWaveform(WAVEFORMS[WAVEFORMS.length - 1], 1)).toBe(WAVEFORMS[0])
    expect(nextWaveform(WAVEFORMS[0], -1)).toBe(WAVEFORMS[WAVEFORMS.length - 1])
  })
})
