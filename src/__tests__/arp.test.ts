import { describe, expect, it } from 'vitest'
import {
  ARP_GATE_RANGE,
  ARP_MS_RANGE,
  ARP_OCTAVES_RANGE,
  ARP_PATTERNS,
  DEFAULT_ARP,
  arpSequence,
  cloneArp,
  isArpPattern,
  normalizeArp,
  randomStep,
} from '../audio/arp'
import { chordToNotes } from '../audio/chords'

const TRIAD = ['C3', 'E3', 'G3']

describe('arpSequence', () => {
  it('walks a chord up in the order it is voiced', () => {
    expect(arpSequence(TRIAD, 'up')).toEqual(['C3', 'E3', 'G3'])
  })

  it('walks it down from the top', () => {
    expect(arpSequence(TRIAD, 'down')).toEqual(['G3', 'E3', 'C3'])
  })

  it('turns at both ends without repeating them', () => {
    expect(arpSequence(TRIAD, 'updown')).toEqual(['C3', 'E3', 'G3', 'E3'])
    expect(arpSequence(TRIAD, 'downup')).toEqual(['G3', 'E3', 'C3', 'E3'])
  })

  it('reduces a round trip on two notes to the plain direction', () => {
    expect(arpSequence(['C3', 'G3'], 'updown')).toEqual(['C3', 'G3'])
    expect(arpSequence(['C3'], 'updown')).toEqual(['C3'])
  })

  it('gives random the same notes as up, for the engine to draw into', () => {
    expect(arpSequence(TRIAD, 'random')).toEqual(arpSequence(TRIAD, 'up'))
  })

  it('stacks the chord an octave at a time, still low to high', () => {
    expect(arpSequence(TRIAD, 'up', 2)).toEqual(['C3', 'E3', 'G3', 'C4', 'E4', 'G4'])
    expect(arpSequence(TRIAD, 'down', 2)).toEqual(['G4', 'E4', 'C4', 'G3', 'E3', 'C3'])
  })

  it('turns at the top of the whole stack rather than of each octave', () => {
    expect(arpSequence(['C3', 'G3'], 'updown', 2)).toEqual(['C3', 'G3', 'C4', 'G4', 'C4', 'G3'])
  })

  it('walks a real chord, extensions and slash bass included', () => {
    const notes = chordToNotes('Am7', 3, { bass: 'F' })
    expect(arpSequence(notes, 'up')).toEqual(notes)
    expect(arpSequence(notes, 'up', 2)).toHaveLength(notes.length * 2)
  })

  it('has nothing to walk on an empty chord', () => {
    for (const pattern of ARP_PATTERNS) expect(arpSequence([], pattern, 3)).toEqual([])
  })
})

describe('randomStep', () => {
  /** Draws are deterministic here; a real one would make the test a coin toss. */
  const fixed = (value: number) => () => value

  it('never plays the same note twice in a row', () => {
    for (let previous = 0; previous < 4; previous++) {
      for (const draw of [0, 0.25, 0.5, 0.75, 0.999]) {
        expect(randomStep(4, previous, fixed(draw))).not.toBe(previous)
      }
    }
  })

  it('can still reach every other note', () => {
    const reached = new Set([0, 0.34, 0.67, 0.999].map((d) => randomStep(4, 2, fixed(d))))
    expect([...reached].sort()).toEqual([0, 1, 3])
  })

  it('stays inside the sequence at the top of the draw', () => {
    expect(randomStep(3, 1, fixed(0.999))).toBeLessThan(3)
    expect(randomStep(3, -1, fixed(0.999))).toBeLessThan(3)
  })

  it('draws from the whole sequence when the last step is not in it', () => {
    // A chord change can leave an index behind that the new, shorter chord has
    // no note at; that must not exclude a note from the draw.
    expect(randomStep(3, -1, fixed(0))).toBe(0)
    expect(randomStep(3, 9, fixed(0))).toBe(0)
  })

  it('has nowhere else to go on a one-note chord', () => {
    expect(randomStep(1, 0, fixed(0.9))).toBe(0)
    expect(randomStep(0, -1, fixed(0.9))).toBe(0)
  })
})

describe('normalizeArp', () => {
  it('round-trips a good value', () => {
    const arp = { ...DEFAULT_ARP, enabled: true, pattern: 'downup' as const, octaves: 3, gate: 0.25 }
    expect(normalizeArp(arp)).toEqual(arp)
  })

  it('falls back to the defaults on junk', () => {
    expect(normalizeArp(null)).toEqual(DEFAULT_ARP)
    expect(normalizeArp('up')).toEqual(DEFAULT_ARP)
    expect(normalizeArp({})).toEqual(DEFAULT_ARP)
  })

  it('only ever starts arpeggiating on a real true', () => {
    expect(normalizeArp({ enabled: 'yes' }).enabled).toBe(false)
    expect(normalizeArp({ enabled: 1 }).enabled).toBe(false)
    expect(normalizeArp({ enabled: true }).enabled).toBe(true)
  })

  it('clamps the numbers to their knobs', () => {
    const wide = normalizeArp({ octaves: 99, gate: 40, timing: { ms: 999999 } })
    expect(wide.octaves).toBe(ARP_OCTAVES_RANGE.max)
    expect(wide.gate).toBe(ARP_GATE_RANGE.max)
    expect(wide.timing.ms).toBe(ARP_MS_RANGE.max)

    const narrow = normalizeArp({ octaves: -4, gate: -1, timing: { ms: 0 } })
    expect(narrow.octaves).toBe(ARP_OCTAVES_RANGE.min)
    expect(narrow.gate).toBe(ARP_GATE_RANGE.min)
    expect(narrow.timing.ms).toBe(ARP_MS_RANGE.min)
  })

  it('rounds an octave span to whole octaves', () => {
    expect(normalizeArp({ octaves: 2.4 }).octaves).toBe(2)
  })

  it('rejects a pattern and a division it does not know', () => {
    expect(normalizeArp({ pattern: 'sideways' }).pattern).toBe(DEFAULT_ARP.pattern)
    expect(normalizeArp({ timing: { division: 'ninth' } }).timing.division).toBe(
      DEFAULT_ARP.timing.division,
    )
  })

  it('keeps a half-built timing whole', () => {
    const timing = normalizeArp({ timing: { lock: false } }).timing
    expect(timing).toEqual({ lock: false, division: DEFAULT_ARP.timing.division, ms: DEFAULT_ARP.timing.ms })
  })
})

describe('isArpPattern', () => {
  it('accepts every pattern and nothing else', () => {
    for (const pattern of ARP_PATTERNS) expect(isArpPattern(pattern)).toBe(true)
    expect(isArpPattern('sideways')).toBe(false)
    expect(isArpPattern(undefined)).toBe(false)
  })
})

describe('cloneArp', () => {
  it('copies the nested timing rather than sharing it', () => {
    const copy = cloneArp(DEFAULT_ARP)
    copy.timing.ms = 999
    expect(DEFAULT_ARP.timing.ms).not.toBe(999)
  })
})
