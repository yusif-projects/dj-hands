import { describe, expect, it } from 'vitest'
import { DEFAULT_VOICE, mixGainDb, oscBDetune } from '../audio/voice'

describe('mixGainDb', () => {
  it('silences the oscillator that is fully crossfaded out', () => {
    // -Infinity rather than a very small number: at the ends of its travel the
    // knob is a fade-out, and an oscillator left barely audible is a bug you
    // only find by soloing the other one.
    expect(mixGainDb(0)).toEqual([0, -Infinity])
    expect(mixGainDb(1)).toEqual([-Infinity, 0])
  })

  it('holds the pair at equal power through the middle of the travel', () => {
    const [a, b] = mixGainDb(0.5)
    expect(a).toBeCloseTo(-3.01, 2)
    expect(b).toBeCloseTo(-3.01, 2)
  })

  it('keeps the summed power flat across the sweep', () => {
    // The reason for equal power at all: a linear blend puts a level dip
    // exactly where the knob is meant to sit.
    for (const mix of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
      const power = mixGainDb(mix).reduce((sum, db) => sum + 10 ** (db / 10), 0)
      expect(power).toBeCloseTo(1, 6)
    }
  })

  it('moves the two levels in opposite directions', () => {
    const [quietA, loudB] = mixGainDb(0.75)
    const [loudA, quietB] = mixGainDb(0.25)
    expect(loudA).toBeGreaterThan(quietA)
    expect(loudB).toBeGreaterThan(quietB)
  })

  it('clamps a mix from outside the knob\'s range', () => {
    expect(mixGainDb(-1)).toEqual(mixGainDb(0))
    expect(mixGainDb(2)).toEqual(mixGainDb(1))
  })
})

describe('oscBDetune', () => {
  it('carries the fine detune straight through', () => {
    expect(oscBDetune({ ...DEFAULT_VOICE, octaveB: 0, detuneB: 7 })).toBe(7)
    expect(oscBDetune({ ...DEFAULT_VOICE, octaveB: 0, detuneB: -12 })).toBe(-12)
  })

  it('folds whole octaves into the same cents', () => {
    // One signal for both, so every trigger path can hand the two oscillators
    // the identical note name and let B do its own transposing.
    expect(oscBDetune({ ...DEFAULT_VOICE, octaveB: 1, detuneB: 0 })).toBe(1200)
    expect(oscBDetune({ ...DEFAULT_VOICE, octaveB: -2, detuneB: 0 })).toBe(-2400)
    expect(oscBDetune({ ...DEFAULT_VOICE, octaveB: -1, detuneB: 5 })).toBe(-1195)
  })
})

describe('the default voice', () => {
  it('ships the layer off, so an older song sounds the way it was saved', () => {
    expect(DEFAULT_VOICE.oscB).toBe(false)
  })

  it('has the layer ready to sound like something the moment it is switched on', () => {
    // B's defaults are only ever reached by turning it on, so a detune of zero
    // against a shape identical to A's would make the toggle do nothing audible.
    expect(DEFAULT_VOICE.waveformB).not.toBe(DEFAULT_VOICE.waveform)
    expect(DEFAULT_VOICE.detuneB).not.toBe(0)
  })
})
