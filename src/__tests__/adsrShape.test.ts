import { describe, expect, it } from 'vitest'
import { envelopeShape } from '../audio/adsrShape'
import { ADSR_RANGES, DEFAULT_VOICE } from '../audio/voice'
import type { Voice } from '../audio/voice'

const voice = (partial: Partial<Voice>): Voice => ({ ...DEFAULT_VOICE, ...partial })

/** The width of one stage, in unit-box x. */
function width(v: Voice, stage: 'attack' | 'decay' | 'sustain' | 'release') {
  const segment = envelopeShape(v).segments.find((s) => s.stage === stage)!
  return segment.to.x - segment.from.x
}

describe('envelopeShape', () => {
  it('fills the box exactly, whatever the times are', () => {
    for (const v of [DEFAULT_VOICE, voice({ attack: 2, decay: 0.005, release: 4 })]) {
      const { points } = envelopeShape(v)
      expect(points[0].x).toBe(0)
      expect(points[points.length - 1].x).toBeCloseTo(1, 10)
    }
  })

  it('rises to the peak and returns to the floor', () => {
    const { points } = envelopeShape(DEFAULT_VOICE)
    expect(points[0].y).toBe(0)
    expect(points[1].y).toBe(1)
    expect(points[4].y).toBe(0)
  })

  it('holds the sustain plateau flat at the sustain level', () => {
    const { points } = envelopeShape(voice({ sustain: 0.42 }))
    expect(points[2].y).toBe(0.42)
    expect(points[3].y).toBe(0.42)
    expect(points[3].x).toBeGreaterThan(points[2].x)
  })

  it('lands the decay on the baseline when sustain is zero', () => {
    const { points } = envelopeShape(voice({ sustain: 0 }))
    expect(points[2].y).toBe(0)
    expect(points[3].y).toBe(0)
  })

  it('widens a stage as its time grows', () => {
    const short = voice({ attack: ADSR_RANGES.attack.min })
    const long = voice({ attack: ADSR_RANGES.attack.max })
    expect(width(long, 'attack')).toBeGreaterThan(width(short, 'attack'))
  })

  it('keeps the shortest stage visible beside the longest one', () => {
    // 5 ms of attack against 4 s of release: without the floor the attack edge
    // would be a vertical line with no width at all.
    const extreme = voice({
      attack: ADSR_RANGES.attack.min,
      decay: ADSR_RANGES.decay.min,
      release: ADSR_RANGES.release.max,
    })
    expect(width(extreme, 'attack')).toBeGreaterThan(0.05)
    expect(width(extreme, 'decay')).toBeGreaterThan(0.05)
  })

  it('clamps a sustain outside 0-1 rather than drawing outside the box', () => {
    expect(envelopeShape(voice({ sustain: 3 })).points[2].y).toBe(1)
    expect(envelopeShape(voice({ sustain: -1 })).points[2].y).toBe(0)
  })

  it('names the four segments in time order and chains them end to end', () => {
    const { segments } = envelopeShape(DEFAULT_VOICE)
    expect(segments.map((s) => s.stage)).toEqual(['attack', 'decay', 'sustain', 'release'])
    for (let i = 1; i < segments.length; i++) {
      expect(segments[i].from).toEqual(segments[i - 1].to)
    }
  })
})
