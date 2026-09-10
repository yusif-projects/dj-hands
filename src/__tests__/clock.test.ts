import { describe, expect, it } from 'vitest'
import {
  BEATS_PER_BAR,
  DEFAULT_CLOCK,
  QUANTIZE_BEATS,
  QUANTIZE_LABELS,
  QUANTIZE_MODES,
  beatSeconds,
  beatsSinceGrid,
  cloneClock,
  isGridBeat,
  isQuantizeMode,
  normalizeClock,
} from '../audio/clock'

describe('the grid', () => {
  /**
   * The worked examples the feature was asked for, in the counting a player
   * uses: beat 1 is index 0. A change is played on the first grid mark strictly
   * after the beat it was made during — which is what `isGridBeat` decides, one
   * beat at a time, as the clock reaches it.
   */
  const nextMark = (during: number, mode: 'quarter' | 'half' | 'bar') => {
    let beat = during + 1
    while (!isGridBeat(beat, mode)) beat++
    return beat
  }

  it('holds a whole-bar change for the next downbeat, wherever in the bar it was made', () => {
    // Changed on the two, three or four — all of them land on the next one.
    expect(nextMark(1, 'bar')).toBe(4)
    expect(nextMark(2, 'bar')).toBe(4)
    expect(nextMark(3, 'bar')).toBe(4)
  })

  it('lands a half-bar change on the next one or three', () => {
    // Changed on the two lands on the three; changed on the three has missed
    // that mark and waits for the next bar's one.
    expect(nextMark(1, 'half')).toBe(2)
    expect(nextMark(2, 'half')).toBe(4)
    expect(nextMark(3, 'half')).toBe(4)
  })

  it('lands a quarter-bar change on the next beat, whichever it is', () => {
    for (let during = 0; during < BEATS_PER_BAR; during++) {
      expect(nextMark(during, 'quarter')).toBe(during + 1)
    }
  })

  it('has no marks at all while it is off — that is what free play is', () => {
    for (let beat = 0; beat < 16; beat++) {
      expect(isGridBeat(beat, 'off')).toBe(false)
    }
  })

  it('starts every mode on the first beat of the first bar', () => {
    for (const mode of QUANTIZE_MODES) {
      expect(isGridBeat(0, mode)).toBe(mode !== 'off')
    }
  })

  it('divides the bar rather than running past it', () => {
    for (const mode of QUANTIZE_MODES) {
      if (mode === 'off') continue
      expect(BEATS_PER_BAR % QUANTIZE_BEATS[mode]).toBe(0)
    }
  })
})

describe('beatsSinceGrid', () => {
  it('counts up to the next mark and starts again at it', () => {
    expect([0, 1, 2, 3, 4].map((beat) => beatsSinceGrid(beat, 'bar'))).toEqual([0, 1, 2, 3, 0])
    expect([0, 1, 2, 3, 4].map((beat) => beatsSinceGrid(beat, 'half'))).toEqual([0, 1, 0, 1, 0])
    expect([0, 1, 2, 3, 4].map((beat) => beatsSinceGrid(beat, 'quarter'))).toEqual([0, 0, 0, 0, 0])
  })

  /**
   * The engine asks about `beat - 1` to find where the last mark fell, so it
   * asks about -1 before the first beat has been counted. A JS remainder keeps
   * the sign of its left side, and a negative answer there would put the last
   * mark in the future and let every change through the capture window.
   */
  it('reads forward from a beat before the clock started', () => {
    for (const mode of QUANTIZE_MODES) {
      expect(beatsSinceGrid(-1, mode)).toBeGreaterThanOrEqual(0)
    }
    expect(beatsSinceGrid(-1, 'bar')).toBe(3)
  })

  it('is zero while there is no grid to be off', () => {
    expect(beatsSinceGrid(7, 'off')).toBe(0)
  })
})

describe('beatSeconds', () => {
  it('is a second at 60, and halves as the tempo doubles', () => {
    expect(beatSeconds(60)).toBeCloseTo(1, 6)
    expect(beatSeconds(120)).toBeCloseTo(0.5, 6)
    expect(beatSeconds(240)).toBeCloseTo(0.25, 6)
  })
})

describe('DEFAULT_CLOCK', () => {
  /**
   * The key was added without a storage version bump, on the promise that a blob
   * from before it picks up a default that changes nothing anyone hears — the
   * same promise the arpeggiator shipped on.
   */
  it('is silent and out of the way', () => {
    expect(DEFAULT_CLOCK.quantize).toBe('off')
    expect(DEFAULT_CLOCK.click).toBe(false)
  })
})

describe('QUANTIZE_LABELS', () => {
  it('names every mode', () => {
    for (const mode of QUANTIZE_MODES) {
      expect(QUANTIZE_LABELS[mode]).toBeTruthy()
    }
  })
})

describe('normalizeClock', () => {
  it('takes a clock it recognises unchanged', () => {
    const stored = { quantize: 'half' as const, click: true, blink: false }
    expect(normalizeClock(stored)).toEqual(stored)
  })

  it('falls back to defaults on junk and on nothing at all', () => {
    for (const junk of [null, undefined, 'bar', 7, []]) {
      expect(normalizeClock(junk)).toEqual(DEFAULT_CLOCK)
    }
  })

  it('fills in a half-built object', () => {
    expect(normalizeClock({ quantize: 'bar' })).toEqual({
      ...DEFAULT_CLOCK,
      quantize: 'bar',
    })
  })

  it('falls back on a grid it does not know', () => {
    expect(normalizeClock({ quantize: 'triplet' }).quantize).toBe(DEFAULT_CLOCK.quantize)
  })

  /**
   * A truthy string from a hand-edited blob must not start the metronome under
   * someone, and an absent key must not switch the lamps off — the two defaults
   * fall opposite ways, so they cannot share one test.
   */
  it('reads only a real true as a click, but an absent blink as the default', () => {
    expect(normalizeClock({ click: 'yes' }).click).toBe(false)
    expect(normalizeClock({}).blink).toBe(DEFAULT_CLOCK.blink)
    expect(normalizeClock({ blink: false }).blink).toBe(false)
  })
})

describe('cloneClock', () => {
  it('is a copy, never the object it came from', () => {
    const clone = cloneClock(DEFAULT_CLOCK)
    expect(clone).toEqual(DEFAULT_CLOCK)
    expect(clone).not.toBe(DEFAULT_CLOCK)
  })
})

describe('isQuantizeMode', () => {
  it('accepts every mode and nothing else', () => {
    for (const mode of QUANTIZE_MODES) expect(isQuantizeMode(mode)).toBe(true)
    for (const other of ['', 'Bar', 'eighth', 4, null, {}]) {
      expect(isQuantizeMode(other)).toBe(false)
    }
  })
})
