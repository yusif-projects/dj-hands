import { beforeEach, describe, expect, it, vi } from 'vitest'

/** Notes Tone has been told to attack and not yet release. */
const sounding: string[] = []
/** Sorted, since voices kept across a chord change stay in their old position. */
const ringing = () => [...sounding].sort()
const attacks: string[][] = []
/** The wet Params of the rack's nodes, captured as the engine builds its graph. */
const wets: Partial<Record<string, { value: number }>> = {}
/** The rate Params of the timed effects: Hz on the two LFOs, seconds on the delay. */
const rates: Partial<Record<string, { value: number }>> = {}
/** Seconds of delay line the engine asked Tone to allocate. */
const delayBuffer = { maxDelay: 0 }
/** Every live connection, so the chain can be read back after a reorder. */
const links: Array<{ from: string; to: string }> = []
/** The filter node the engine builds, so its `type` can be read back. */
const filter: { node?: { type: string } } = {}
/** Names of the LFO effects `start` was called on, without which they are silent. */
const started = new Set<string>()
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
      constructor(options: { maxDelay: number }) {
        super()
        wets.delay = this.wet
        rates.delay = this.delayTime
        delayBuffer.maxDelay = options.maxDelay
      }
    },
    Chorus: class extends Node {
      name = 'chorus'
      wet = new Param()
      constructor() {
        super()
        wets.chorus = this.wet
      }
      // Tone hands the node back from `start`, so the engine can chain onto it.
      start() {
        started.add(this.name)
        return this
      }
    },
    Tremolo: class extends Node {
      name = 'tremolo'
      wet = new Param()
      frequency = new Param()
      constructor() {
        super()
        wets.tremolo = this.wet
        rates.tremolo = this.frequency
      }
      start() {
        started.add(this.name)
        return this
      }
    },
    Phaser: class extends Node {
      name = 'phaser'
      wet = new Param()
      frequency = new Param()
      constructor() {
        super()
        wets.phaser = this.wet
        rates.phaser = this.frequency
      }
    },
    BitCrusher: class extends Node {
      name = 'bitcrusher'
      wet = new Param()
      bits = new Param()
      constructor(bits: number) {
        super()
        this.bits.value = bits
        wets.bitcrusher = this.wet
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
const { DEFAULT_BPM, DEFAULT_EFFECTS, DELAY_MAX_SECONDS, cloneEffects, moveEffect } =
  await import('../audio/effects')
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

    expect(chain()).toEqual([...DEFAULT_EFFECTS.map((effect) => effect.id), 'volume'])
    for (const { id, amount } of DEFAULT_EFFECTS) {
      expect(wets[id]?.value).toBeCloseTo(amount, 6)
    }
  })

  it('starts the LFO effects, without which they are silent at any wet', () => {
    started.clear()
    new SynthEngine()
    expect([...started].sort()).toEqual(['chorus', 'tremolo'])
  })

  it('gives every effect its own amount', () => {
    const engine = new SynthEngine()

    // A distinct amount each, so one node's param standing in for another's
    // would show up rather than being masked by a shared value.
    const spread = DEFAULT_EFFECTS.map((effect, i) => ({ ...effect, amount: (i + 1) / 10 }))
    engine.setEffects(spread)
    for (const { id, amount } of spread) {
      expect(wets[id]?.value).toBeCloseTo(amount, 6)
    }
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
    const last = DEFAULT_EFFECTS.length - 1
    const reordered = moveEffect(DEFAULT_EFFECTS, last, 0)

    engine.setEffects(reordered)
    expect(chain()).toEqual([...reordered.map((effect) => effect.id), 'volume'])
  })

  it('tears the old order down rather than layering the new one under it', () => {
    const engine = new SynthEngine()

    const last = DEFAULT_EFFECTS.length - 1
    engine.setEffects(moveEffect(DEFAULT_EFFECTS, last, 0))
    engine.setEffects(moveEffect(DEFAULT_EFFECTS, 0, last))

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

  /** The rack with one effect's timing overridden, the rest at their defaults. */
  const withTiming = (id: string, timing: object) =>
    cloneEffects(DEFAULT_EFFECTS).map((effect) =>
      effect.id === id ? { ...effect, timing: { ...effect.timing!, ...timing } } : effect,
    )

  it('allocates a delay line long enough for the longest division', () => {
    new SynthEngine()
    // A whole note at 40 BPM is 6s; Tone's own default of 1s would throw on it.
    // `effects.ts` owns the sizing, so this only checks the engine uses it.
    expect(delayBuffer.maxDelay).toBe(DELAY_MAX_SECONDS)
    expect(delayBuffer.maxDelay).toBeGreaterThanOrEqual(6)
  })

  it('starts each timed effect at its default rate', () => {
    new SynthEngine()
    // Seconds on the delay, Hz on the two LFOs — the rack stores one unit and
    // this is where it fans back out.
    expect(rates.delay?.value).toBeCloseTo(0.25, 6)
    expect(rates.tremolo?.value).toBeCloseTo(5, 6)
    expect(rates.phaser?.value).toBeCloseTo(0.4, 6)
  })

  it('takes the milliseconds while unlocked, whatever the tempo', () => {
    const engine = new SynthEngine()

    engine.setEffects(withTiming('delay', { lock: false, ms: 400 }), 40)
    expect(rates.delay?.value).toBeCloseTo(0.4, 6)
  })

  it('takes the division against the tempo while locked', () => {
    const engine = new SynthEngine()

    // A quarter note at 60 BPM is one second, and 5 Hz down to 1 Hz.
    engine.setEffects(withTiming('delay', { lock: true, division: 'quarter' }), 60)
    expect(rates.delay?.value).toBeCloseTo(1, 6)
    engine.setEffects(withTiming('tremolo', { lock: true, division: 'quarter' }), 60)
    expect(rates.tremolo?.value).toBeCloseTo(1, 6)
  })

  it('moves a locked effect when only the tempo changes, and leaves the rest', () => {
    const engine = new SynthEngine()
    const rack = withTiming('delay', { lock: true, division: 'quarter' })

    engine.setEffects(rack, 60)
    expect(rates.delay?.value).toBeCloseTo(1, 6)
    // Same rack, twice the tempo: the locked delay halves and the unlocked
    // tremolo beside it does not budge.
    engine.setEffects(rack, 120)
    expect(rates.delay?.value).toBeCloseTo(0.5, 6)
    expect(rates.tremolo?.value).toBeCloseTo(5, 6)
  })

  it('holds the last tempo when only the rack is handed over', () => {
    const engine = new SynthEngine()
    const rack = withTiming('delay', { lock: true, division: 'quarter' })

    engine.setEffects(rack, 60)
    // An amount edit calls through without a tempo; the delay must not jump back
    // to the default BPM because of it.
    engine.setEffects(rack.map((effect) => ({ ...effect, amount: 0.5 })))
    expect(rates.delay?.value).toBeCloseTo(1, 6)
    expect(DEFAULT_BPM).not.toBe(60)
  })

  it('never asks Tone for a wet mix outside 0-1', () => {
    const engine = new SynthEngine()

    engine.setEffects(
      DEFAULT_EFFECTS.map((effect, i) => ({ ...effect, amount: i % 2 === 0 ? 2 : -1 })),
    )
    for (const [i, { id }] of DEFAULT_EFFECTS.entries()) {
      expect(wets[id]?.value).toBe(i % 2 === 0 ? 1 : 0)
    }
  })
})
