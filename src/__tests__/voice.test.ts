import { describe, expect, it } from 'vitest'
import { DEFAULT_VOICE, layerDetune, layerGainsDb, levelsFromMix } from '../audio/voice'

describe('layerGainsDb', () => {
  it('silences a layer weighing nothing', () => {
    // -Infinity rather than a very small number: a level at the bottom of its
    // travel is a fade-out, and an oscillator left barely audible is a bug you
    // only find by soloing the others.
    expect(layerGainsDb([1, 0, 0])).toEqual([0, -Infinity, -Infinity])
    expect(layerGainsDb([0, 1, 0])).toEqual([-Infinity, 0, -Infinity])
  })

  it('leaves one live layer at unity whatever its level reads', () => {
    // The whole point of normalizing: switching a shape in adds it rather than
    // dropping the patch by the 3dB an even pair costs it.
    for (const level of [0.2, 0.5, 1]) {
      expect(layerGainsDb([level, 0, 0])[0]).toBeCloseTo(0, 6)
    }
  })

  it('holds an even pair at equal power', () => {
    const [a, b] = layerGainsDb([1, 1, 0])
    expect(a).toBeCloseTo(-3.01, 2)
    expect(b).toBeCloseTo(-3.01, 2)
  })

  it('holds an even trio at equal power', () => {
    for (const db of layerGainsDb([1, 1, 1])) expect(db).toBeCloseTo(-4.77, 2)
  })

  it('keeps the summed power flat however the balance is set', () => {
    // The reason for equal power at all: a linear blend puts a level dip
    // exactly where the knobs are meant to sit.
    const balances = [
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
      [1, 0.25, 0.5],
      [0.1, 1, 0.4],
      [0.6, 0, 0.6],
    ]
    for (const levels of balances) {
      const power = layerGainsDb(levels).reduce((sum, db) => sum + 10 ** (db / 10), 0)
      expect(power).toBeCloseTo(1, 6)
    }
  })

  it('gives the louder level the louder layer', () => {
    const [quiet, loud] = layerGainsDb([0.25, 1, 0])
    expect(loud).toBeGreaterThan(quiet)
  })

  it('falls silent when nothing weighs anything', () => {
    // No balance to strike. Reachable by hand — every level dragged to zero —
    // so it has to be silence rather than a division by zero.
    expect(layerGainsDb([0, 0, 0])).toEqual([-Infinity, -Infinity, -Infinity])
  })

  it('clamps a level from outside the knob\'s range', () => {
    expect(layerGainsDb([2, 1, 0])).toEqual(layerGainsDb([1, 1, 0]))
    expect(layerGainsDb([1, -1, 0])).toEqual(layerGainsDb([1, 0, 0]))
  })
})

describe('levelsFromMix', () => {
  it('reproduces the gains the old crossfade gave, so a v1 song sounds the same', () => {
    // The whole reason the conversion is by the squares of the old cos/sin:
    // through the normalizer they land back on exactly the pair of gains the
    // song was saved with, rather than near them.
    for (const mix of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
      const angle = (mix * Math.PI) / 2
      const { levelA, levelB } = levelsFromMix(mix)
      const [a, b] = layerGainsDb([levelA, levelB])
      expect(10 ** (a / 20)).toBeCloseTo(Math.cos(angle), 4)
      expect(10 ** (b / 20)).toBeCloseTo(Math.sin(angle), 4)
    }
  })

  it('reads the even blend as an even pair', () => {
    expect(levelsFromMix(0.5)).toEqual({ levelA: 1, levelB: 1 })
  })

  it('carries a fully crossfaded oscillator over as silence', () => {
    expect(levelsFromMix(0)).toEqual({ levelA: 1, levelB: 0 })
    expect(levelsFromMix(1)).toEqual({ levelA: 0, levelB: 1 })
  })

  it('scales the louder side to a full level rather than to what it was', () => {
    // The ratio is the whole of the meaning. Both sides at a third would look,
    // wrongly, like somebody had turned the patch down.
    for (const mix of [0.2, 0.4, 0.6, 0.8]) {
      const { levelA, levelB } = levelsFromMix(mix)
      expect(Math.max(levelA, levelB)).toBe(1)
    }
  })

  it('keeps float noise off the levels it writes', () => {
    // They are stored and re-read as a song's own numbers, so a value carrying
    // fifteen decimal places would show up in every payload it touches.
    for (const mix of [0.13, 0.37, 0.62]) {
      for (const level of Object.values(levelsFromMix(mix))) {
        expect(level).toBe(Math.round(level * 1e4) / 1e4)
      }
    }
  })

  it('clamps a mix from outside the old knob\'s range', () => {
    expect(levelsFromMix(-1)).toEqual(levelsFromMix(0))
    expect(levelsFromMix(2)).toEqual(levelsFromMix(1))
  })
})

describe('layerDetune', () => {
  it('carries the fine detune straight through', () => {
    expect(layerDetune(0, 7)).toBe(7)
    expect(layerDetune(0, -12)).toBe(-12)
  })

  it('folds whole octaves into the same cents', () => {
    // One signal for both, so every trigger path can hand the three oscillators
    // the identical note name and let each do its own transposing.
    expect(layerDetune(1, 0)).toBe(1200)
    expect(layerDetune(-2, 0)).toBe(-2400)
    expect(layerDetune(-1, 5)).toBe(-1195)
  })
})

describe('the default voice', () => {
  it('ships both stacked layers off, so an older song sounds the way it was saved', () => {
    expect(DEFAULT_VOICE.oscB).toBe(false)
    expect(DEFAULT_VOICE.oscC).toBe(false)
  })

  it('has each layer ready to sound like something the moment it is switched on', () => {
    // Their defaults are only ever reached by turning them on, so a detune of
    // zero against a shape identical to A's would make the toggle do nothing
    // audible.
    expect(DEFAULT_VOICE.waveformB).not.toBe(DEFAULT_VOICE.waveform)
    expect(DEFAULT_VOICE.detuneB).not.toBe(0)
    expect(DEFAULT_VOICE.waveformC).not.toBe(DEFAULT_VOICE.waveform)
    expect(DEFAULT_VOICE.detuneC).not.toBe(0)
  })

  it('starts every level at a full, even balance', () => {
    // A stacked shape arrives level with what is already sounding; the knob is
    // there to lean it one way, not to be found turned down.
    expect(DEFAULT_VOICE.levelA).toBe(1)
    expect(DEFAULT_VOICE.levelB).toBe(1)
    expect(DEFAULT_VOICE.levelC).toBe(1)
  })
})
