import { beforeEach, describe, expect, it, vi } from 'vitest'

/** Notes Tone has been told to attack and not yet release. */
const sounding: string[] = []
/** Sorted, since voices kept across a chord change stay in their old position. */
const ringing = () => [...sounding].sort()
const attacks: string[][] = []
/** The wet Params of the two effects, captured as the engine builds its graph. */
const wets: { reverb?: { value: number }; delay?: { value: number } } = {}

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
    Filter: class extends Node { frequency = new Param() },
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

const { SynthEngine, cutoffHz } = await import('../audio/SynthEngine')
const { DEFAULT_SEND_AMOUNT } = await import('../audio/effects')
const { DEFAULT_VOICE } = await import('../audio/voice')

function makeEngine(chords: string[]) {
  const engine = new SynthEngine()
  engine.setChords(chords as never)
  engine.setOctave(3)
  engine.setChordOctaves([0, 0, 0, 0, 0])
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
    engine.setChords(['C9', 'G', 'Am', 'F', 'Em'] as never)
    expect(ringing()).toEqual(['A#3', 'C3', 'D4', 'E3', 'G3'])

    engine.setChords(['Cm', 'G', 'Am', 'F', 'Em'] as never)
    expect(ringing()).toEqual(['C3', 'D#3', 'G3'])
  })

  it('leaves shared notes ringing instead of re-attacking them', () => {
    const engine = makeEngine(['C', 'G', 'Am', 'F', 'Em'])
    engine.setChordSlot(0)
    attacks.length = 0

    // C -> Cmaj7 adds one note; C3/E3/G3 must not be attacked a second time.
    engine.setChords(['Cmaj7', 'G', 'Am', 'F', 'Em'] as never)
    expect(attacks).toEqual([['B3']])
  })

  it('re-voices a held chord when its octave offset changes', () => {
    const engine = makeEngine(['C7', 'C7', 'C7', 'C7', 'C7'])
    engine.setChordSlot(0)
    expect(ringing()).toEqual(['A#3', 'C3', 'E3', 'G3'])

    engine.setChordOctaves([-2, 0, 0, 0, 0])
    expect(ringing()).toEqual(['A#1', 'C1', 'E1', 'G1'])
    engine.setOctave(5)
    expect(ringing()).toEqual(['A#3', 'C3', 'E3', 'G3'])
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
