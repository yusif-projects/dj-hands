import { describe, expect, it } from 'vitest'
import { FILTER_ABBREV, HUD_SEGMENTS, formatCutoff, litSegments } from '../components/hudMeter'
import { FILTER_TYPES } from '../audio/filter'

describe('litSegments', () => {
  it('spans the whole fader', () => {
    expect(litSegments(0)).toBe(0)
    expect(litSegments(1)).toBe(HUD_SEGMENTS)
  })

  it('lights half the segments at half volume', () => {
    expect(litSegments(0.5)).toBe(HUD_SEGMENTS / 2)
  })

  it('clamps a volume outside 0-1', () => {
    expect(litSegments(-0.4)).toBe(0)
    expect(litSegments(2)).toBe(HUD_SEGMENTS)
  })
})

describe('formatCutoff', () => {
  it('reads in Hz below a kilohertz', () => {
    expect(formatCutoff(480)).toBe('480 Hz')
    expect(formatCutoff(999.4)).toBe('999 Hz')
  })

  it('switches to kHz at a kilohertz', () => {
    expect(formatCutoff(1000)).toBe('1.0 kHz')
    expect(formatCutoff(2437)).toBe('2.4 kHz')
  })

  // 999.6 rounds up to 1000, which is the kHz side of the boundary — the check
  // has to run on the rounded value, or it prints "1000 Hz".
  it('rounds before choosing the unit', () => {
    expect(formatCutoff(999.6)).toBe('1.0 kHz')
  })
})

describe('FILTER_ABBREV', () => {
  it('names every filter type', () => {
    for (const type of FILTER_TYPES) {
      expect(FILTER_ABBREV[type]).toMatch(/^[A-Z]{2}$/)
    }
  })
})
