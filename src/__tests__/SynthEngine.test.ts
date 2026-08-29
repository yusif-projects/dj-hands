import { beforeEach, describe, expect, it, vi } from 'vitest'

/** Notes Tone has been told to attack and not yet release. */
const sounding: string[] = []
/** Sorted, since voices kept across a chord change stay in their old position. */
const ringing = () => [...sounding].sort()
const attacks: string[][] = []
/** The wet Params of the two effects, captured as the engine builds its graph. */
const wets: { reverb?: { value: number }; delay?: { value: number } } = {}
/** The filter node the engine builds, so its `type` can be read back. */
const filter: { node?: { type: string } } = {}
/** The meter the engine taps its output with; `db` is what `getValue` reports. */
const meter = { db: -Infinity, disposed: false }

vi.mock('tone', () => {
  class Node {
    connect() { return this }
    toDestination() { return this }
    dispose() {}
  }
  class Param {
    value = 0
    rampTo(v: number) { this.value = v }
  }
  return {
    Volume: class extends Node { volume = new Param() },
    Reverb: class extends Node {
      wet = new Param()
      constructor() {
        super()
        wets.reverb = this.wet
      }
    },
    FeedbackDelay: class extends Node {
      wet = new Param()
      delayTime = new Param()
      feedback = new Param()
      constructor() {
        super()
        wets.delay = this.wet
      }
    },
    Filter: class extends Node {
      frequency = new Param()
      type: string
      constructor(options: { type: string }) {
        super()
        this.type = options.type
        filter.node = this
      }
    },
    Meter: class extends Node {
      getValue() { return meter.db }
      dispose() { meter.disposed = true }
    },
    PolySynth: class extends Node {
      maxPolyphony = 0
      set() {}
      releaseAll() { sounding.length = 0 }
      triggerAttack(notes: string[]) {
        attacks.push([...notes])
        sounding.push(...notes)
      }
      triggerRelease(notes: string[]) {
        for (const note of notes) {
          const i = sounding.indexOf(note)
          if (i >= 0) sounding.splice(i, 1)
        }
      }
    },
    Synth: class {},
  }
})

const { SynthEngine, cutoffHz, levelFromDb } = await import('../audio/SynthEngine')
const { DEFAULT_SEND_AMOUNT } = await import('../audio/effects')
const { DEFAULT_FILTER_TYPE } = await import('../audio/filter')
const { DEFAULT_VOICE } = await import('../audio/voice')

/** Five default-voiced slots from bare chord names, the common case in tests. */
function slots(chords: string[], overrides: Record<number, object> = {}) {
  return chords.map((chord, i) => ({
    chord, inversion: 0, bass: null, octave: 0, ...overrides[i],
  })) as never
}

function makeEngine(chords: string[]) {
  const engine = new SynthEngine()
  engine.setChordSlots(slots(chords))
  engine.setOctave(3)
  return engine
}

describe('SynthEngine chord slots', () => {
  beforeEach(() => {
    sounding.length = 0
    attacks.length = 0
  })

  it('plays the quality chosen for each slot', () => {
    const engine = makeEngine(['Cmaj7', 'Gm7b5', 'Aadd9', 'Fsus4', 'Edim7'])

    engine.setChordSlot(0)
    expect(ringing()).toEqual(['B3', 'C3', 'E3', 'G3'])
    engine.setChordSlot(1)
    expect(ringing()).toEqual(['A#3', 'C#4', 'F4', 'G3'])
    engine.setChordSlot(4)
    expect(ringing()).toEqual(['A#3', 'C#4', 'E3', 'G3'])
    engine.setChordSlot(null)
    expect(ringing()).toEqual([])
  })

  it('changes the sounding chord when a held slot switches quality', () => {
    const engine = makeEngine(['C', 'G', 'Am', 'F', 'Em'])
    engine.setChordSlot(0)
    expect(ringing()).toEqual(['C3', 'E3', 'G3'])

    // The settings panel switching slot 1 from maj to 9, mid-hold.
    engine.setChordSlots(slots(['C9', 'G', 'Am', 'F', 'Em']))
    expect(ringing()).toEqual(['A#3', 'C3', 'D4', 'E3', 'G3'])

    engine.setChordSlots(slots(['Cm', 'G', 'Am', 'F', 'Em']))
    expect(ringing()).toEqual(['C3', 'D#3', 'G3'])
  })

  it('leaves shared notes ringing instead of re-attacking them', () => {
    const engine = makeEngine(['C', 'G', 'Am', 'F', 'Em'])
    engine.setChordSlot(0)
    attacks.length = 0

    // C -> Cmaj7 adds one note; C3/E3/G3 must not be attacked a second time.
    engine.setChordSlots(slots(['Cmaj7', 'G', 'Am', 'F', 'Em']))
    expect(attacks).toEqual([['B3']])
  })

  it('re-voices a held chord when its octave offset changes', () => {
    const engine = makeEngine(['C7', 'C7', 'C7', 'C7', 'C7'])
    engine.setChordSlot(0)
    expect(ringing()).toEqual(['A#3', 'C3', 'E3', 'G3'])

    engine.setChordSlots(slots(['C7', 'C7', 'C7', 'C7', 'C7'], { 0: { octave: -2 } }))
    expect(ringing()).toEqual(['A#1', 'C1', 'E1', 'G1'])
    engine.setOctave(5)
    expect(ringing()).toEqual(['A#3', 'C3', 'E3', 'G3'])
  })

  it('re-voices a held chord when its inversion changes', () => {
    const engine = makeEngine(['C', 'G', 'Am', 'F', 'Em'])
    engine.setChordSlot(0)
    expect(ringing()).toEqual(['C3', 'E3', 'G3'])

    engine.setChordSlots(slots(['C', 'G', 'Am', 'F', 'Em'], { 0: { inversion: 1 } }))
    expect(ringing()).toEqual(['C4', 'E3', 'G3'])
  })

  it('adds a slash bass under a held chord without disturbing it', () => {
    const engine = makeEngine(['C', 'G', 'Am', 'F', 'Em'])
    engine.setChordSlot(0)
    attacks.length = 0

    engine.setChordSlots(slots(['C', 'G', 'Am', 'F', 'Em'], { 0: { bass: 'E' } }))
    expect(attacks).toEqual([['E2']])
    expect(ringing()).toEqual(['C3', 'E2', 'E3', 'G3'])
  })

  it('silences only the offending slot when a chord name is unusable', () => {
    const engine = makeEngine(['C', 'nonsense', 'Am', 'F', 'Em'])
    engine.setChordSlot(1)
    expect(ringing()).toEqual([])
    engine.setChordSlot(2)
    expect(ringing()).toEqual(['A3', 'C4', 'E4'])
  })
})

describe('cutoffHz', () => {
  it('lands on the range ends', () => {
    expect(cutoffHz(0, 200, 8000)).toBeCloseTo(200, 6)
    expect(cutoffHz(1, 200, 8000)).toBeCloseTo(8000, 6)
  })

  it('sweeps in ratios, not in Hz', () => {
    // Halfway is the geometric mean, so each half of the travel is the same
    // number of octaves.
    expect(cutoffHz(0.5, 200, 8000)).toBeCloseTo(Math.sqrt(200 * 8000), 6)
  })

  it('clamps an out-of-range amount', () => {
    expect(cutoffHz(-1, 200, 8000)).toBeCloseTo(200, 6)
    expect(cutoffHz(2, 200, 8000)).toBeCloseTo(8000, 6)
  })

  it('survives a degenerate range', () => {
    expect(cutoffHz(0.5, 0, 0)).toBeGreaterThan(0)
    expect(cutoffHz(0.5, 5000, 1000)).toBeCloseTo(5000, 6)
  })
})

describe('levelFromDb', () => {
  it('lands on the ends of the -48..0 dB window', () => {
    expect(levelFromDb(0)).toBeCloseTo(1, 6)
    expect(levelFromDb(-48)).toBeCloseTo(0, 6)
    expect(levelFromDb(-24)).toBeCloseTo(0.5, 6)
  })

  it('reads silence as zero', () => {
    // A meter with nothing going through it reports -Infinity, not a number.
    expect(levelFromDb(-Infinity)).toBe(0)
    expect(levelFromDb(NaN)).toBe(0)
  })

  it('clamps outside the window', () => {
    expect(levelFromDb(-90)).toBe(0)
    expect(levelFromDb(6)).toBe(1)
  })

  it('honours a custom floor', () => {
    expect(levelFromDb(-30, -60)).toBeCloseTo(0.5, 6)
  })
})

describe('SynthEngine output level', () => {
  it('reports the meter, floored at silence', () => {
    const engine = new SynthEngine()

    meter.db = -Infinity
    expect(engine.getLevel()).toBe(0)
    meter.db = -24
    expect(engine.getLevel()).toBeCloseTo(0.5, 6)
    meter.db = 0
    expect(engine.getLevel()).toBeCloseTo(1, 6)
  })

  it('disposes the meter with the rest of the graph', () => {
    meter.disposed = false
    new SynthEngine().dispose()
    expect(meter.disposed).toBe(true)
  })
})

describe('SynthEngine voice edits', () => {
  beforeEach(() => {
    sounding.length = 0
    attacks.length = 0
  })

  it('retriggers a held chord when the waveform changes', () => {
    const engine = makeEngine(['C', 'G', 'Am', 'F', 'Em'])
    engine.setChordSlot(0)
    attacks.length = 0

    engine.setVoice({ ...DEFAULT_VOICE, waveform: 'square' })
    expect(attacks).toEqual([['C3', 'E3', 'G3']])
    expect(ringing()).toEqual(['C3', 'E3', 'G3'])
  })

  it('leaves a held chord alone when only the envelope changes', () => {
    const engine = makeEngine(['C', 'G', 'Am', 'F', 'Em'])
    engine.setChordSlot(0)
    attacks.length = 0

    // A slider drag fires this on every input event; re-striking would stutter.
    engine.setVoice({ ...DEFAULT_VOICE, attack: 0.4 })
    engine.setVoice({ ...DEFAULT_VOICE, attack: 0.5 })
    expect(attacks).toEqual([])
    expect(ringing()).toEqual(['C3', 'E3', 'G3'])
  })
})

describe('SynthEngine filter type', () => {
  it('starts on the default type', () => {
    new SynthEngine()
    expect(filter.node?.type).toBe(DEFAULT_FILTER_TYPE)
  })

  it('switches the filter over without touching the sweep', () => {
    const engine = new SynthEngine()
    engine.setCutoffRange(200, 8000)
    engine.setCutoff(0.5)
    const swept = (filter.node as unknown as { frequency: { value: number } }).frequency.value

    engine.setFilterType('highpass')
    expect(filter.node?.type).toBe('highpass')
    engine.setFilterType('bandpass')
    expect(filter.node?.type).toBe('bandpass')
    expect((filter.node as unknown as { frequency: { value: number } }).frequency.value).toBe(swept)
  })
})

describe('SynthEngine effect send', () => {
  it('opens the default send on the default target, and nothing else', () => {
    new SynthEngine()
    expect(wets.reverb?.value).toBeCloseTo(DEFAULT_SEND_AMOUNT, 6)
    expect(wets.delay?.value).toBe(0)
  })

  it('feeds only the assigned effect, silencing the one it moved off', () => {
    const engine = new SynthEngine()
    engine.setSendAmount(0.6)

    engine.setSendTarget('reverb')
    expect(wets.reverb?.value).toBeCloseTo(0.6, 6)
    expect(wets.delay?.value).toBe(0)

    engine.setSendTarget('delay')
    expect(wets.reverb?.value).toBe(0)
    expect(wets.delay?.value).toBeCloseTo(0.6, 6)

    engine.setSendTarget('both')
    expect(wets.reverb?.value).toBeCloseTo(0.6, 6)
    expect(wets.delay?.value).toBeCloseTo(0.6, 6)
  })

  it('re-applies the send when the amount moves under it', () => {
    const engine = new SynthEngine()
    engine.setSendTarget('both')

    // A slider drag must be heard on a chord that is already sounding.
    engine.setSendAmount(0.2)
    expect(wets.reverb?.value).toBeCloseTo(0.2, 6)
    expect(wets.delay?.value).toBeCloseTo(0.2, 6)
    engine.setSendAmount(0)
    expect(wets.reverb?.value).toBe(0)
    expect(wets.delay?.value).toBe(0)
  })
})
