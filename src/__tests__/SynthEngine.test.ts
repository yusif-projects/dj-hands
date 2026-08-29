import { beforeEach, describe, expect, it, vi } from 'vitest'

/** Notes Tone has been told to attack and not yet release. */
const sounding: string[] = []
/** Sorted, since voices kept across a chord change stay in their old position. */
const ringing = () => [...sounding].sort()
const attacks: string[][] = []
/** The wet Params of the rack's nodes, captured as the engine builds its graph. */
const wets: Partial<Record<'chorus' | 'delay' | 'reverb', { value: number }>> = {}
/** Every live connection, so the chain can be read back after a reorder. */
const links: Array<{ from: string; to: string }> = []
/** The filter node the engine builds, so its `type` can be read back. */
const filter: { node?: { type: string } } = {}
/** The chorus node, so the test can check its LFO was actually started. */
const chorus: { node?: { started: boolean } } = {}
/** The meter the engine taps its output with; `db` is what `getValue` reports. */
const meter = { db: -Infinity, disposed: false }

vi.mock('tone', () => {
  class Node {
    name = 'node'
    connect(target: { name: string }) {
      links.push({ from: this.name, to: target.name })
      return this
    }
    // Tone's no-argument disconnect drops every outgoing connection.
    disconnect() {
      for (let i = links.length - 1; i >= 0; i--) {
        if (links[i].from === this.name) links.splice(i, 1)
      }
      return this
    }
    toDestination() { return this }
    dispose() {}
  }
  class Param {
    value = 0
    rampTo(v: number) { this.value = v }
  }
  return {
    Volume: class extends Node {
      name = 'volume'
      volume = new Param()
    },
    Reverb: class extends Node {
      name = 'reverb'
      wet = new Param()
      constructor() {
        super()
        wets.reverb = this.wet
      }
    },
    FeedbackDelay: class extends Node {
      name = 'delay'
      wet = new Param()
      delayTime = new Param()
      feedback = new Param()
      constructor() {
        super()
        wets.delay = this.wet
      }
    },
    Chorus: class extends Node {
      name = 'chorus'
      wet = new Param()
      started = false
      constructor() {
        super()
        wets.chorus = this.wet
      }
      // Tone hands the chorus back from `start`, so the engine can chain onto it.
      start() {
        this.started = true
        chorus.node = this
        return this
      }
    },
    Filter: class extends Node {
      name = 'filter'
      frequency = new Param()
      type: string
      constructor(options: { type: string }) {
        super()
        this.type = options.type
        filter.node = this
      }
    },
    Meter: class extends Node {
      name = 'meter'
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
const { DEFAULT_EFFECTS, moveEffect } = await import('../audio/effects')
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

describe('SynthEngine effects rack', () => {
  beforeEach(() => {
    links.length = 0
  })

  /** The chain from the filter to the volume, as the engine currently has it wired. */
  const chain = (): string[] => {
    const path: string[] = []
    let node = 'filter'
    while (node !== 'volume') {
      const next = links.find((link) => link.from === node)
      if (!next) return [...path, '(dead end)']
      path.push(next.to)
      node = next.to
    }
    return path
  }

  it('wires the default chain and opens the default amounts', () => {
    new SynthEngine()

    expect(chain()).toEqual(['chorus', 'delay', 'reverb', 'volume'])
    for (const { id, amount } of DEFAULT_EFFECTS) {
      expect(wets[id]?.value).toBeCloseTo(amount, 6)
    }
  })

  it('starts the chorus LFO, without which it is silent at any wet', () => {
    new SynthEngine()
    expect(chorus.node?.started).toBe(true)
  })

  it('gives every effect its own amount', () => {
    const engine = new SynthEngine()

    engine.setEffects([
      { id: 'chorus', amount: 0.1 },
      { id: 'delay', amount: 0.4 },
      { id: 'reverb', amount: 0.9 },
    ])
    expect(wets.chorus?.value).toBeCloseTo(0.1, 6)
    expect(wets.delay?.value).toBeCloseTo(0.4, 6)
    expect(wets.reverb?.value).toBeCloseTo(0.9, 6)
  })

  it('re-applies an amount that moves under a sounding chord', () => {
    const engine = new SynthEngine()

    // A knob drag must be heard on a chord that is already ringing.
    engine.setEffects(DEFAULT_EFFECTS.map((effect) => ({ ...effect, amount: 0.2 })))
    expect(wets.reverb?.value).toBeCloseTo(0.2, 6)
    engine.setEffects(DEFAULT_EFFECTS.map((effect) => ({ ...effect, amount: 0 })))
    expect(wets.reverb?.value).toBe(0)
  })

  it('rewires the graph when the order changes', () => {
    const engine = new SynthEngine()

    engine.setEffects(moveEffect(DEFAULT_EFFECTS, 2, 0))
    expect(chain()).toEqual(['reverb', 'chorus', 'delay', 'volume'])
  })

  it('tears the old order down rather than layering the new one under it', () => {
    const engine = new SynthEngine()

    engine.setEffects(moveEffect(DEFAULT_EFFECTS, 2, 0))
    engine.setEffects(moveEffect(DEFAULT_EFFECTS, 0, 2))

    // A node left with two outputs would still be feeding the chain it was
    // moved out of, so the same signal would arrive twice.
    const outgoing = links.filter((link) => link.from !== 'volume')
    expect(outgoing).toHaveLength(new Set(outgoing.map((link) => link.from)).size)
  })

  it('leaves the chain alone when only the amounts move', () => {
    const engine = new SynthEngine()
    const wired = chain()

    engine.setEffects(DEFAULT_EFFECTS.map((effect) => ({ ...effect, amount: 0.5 })))
    expect(chain()).toEqual(wired)
  })

  it('never asks Tone for a wet mix outside 0-1', () => {
    const engine = new SynthEngine()

    engine.setEffects([
      { id: 'chorus', amount: 2 },
      { id: 'delay', amount: -1 },
      { id: 'reverb', amount: 0.5 },
    ])
    expect(wets.chorus?.value).toBe(1)
    expect(wets.delay?.value).toBe(0)
  })
})
