import { describe, expect, it } from 'vitest'
import {
  BPM_RANGE,
  DEFAULT_BPM,
  DEFAULT_EFFECTS,
  DEFAULT_TIMING,
  DELAY_MAX_SECONDS,
  DIVISIONS,
  EFFECT_IDS,
  EFFECT_MS_RANGES,
  TIMED_EFFECT_IDS,
  cloneEffects,
  defaultAmount,
  divisionMs,
  effectMs,
  isDivisionId,
  isEffectId,
  isTimed,
  moveEffect,
  normalizeEffects,
} from '../audio/effects'

const ids = (effects: { id: string }[]) => effects.map((effect) => effect.id)
/** Canonical order minus the ids a test has already placed by hand. */
const rest = (...placed: string[]) => EFFECT_IDS.filter((id) => !placed.includes(id))
const LAST = DEFAULT_EFFECTS.length - 1
/** A complete stored rack — nothing for the normalizer to repair. */
const fullRack = () =>
  [...EFFECT_IDS].reverse().map((id, i) => ({
    id,
    amount: (i + 1) / 10,
    ...(isTimed(id) ? { timing: { ...DEFAULT_TIMING[id]! } } : {}),
  }))

describe('isEffectId', () => {
  it('accepts every effect', () => {
    for (const id of EFFECT_IDS) expect(isEffectId(id)).toBe(true)
  })

  it('rejects anything else a stored blob might hold', () => {
    for (const junk of ['both', 'flanger', '', null, undefined, 0, {}, ['reverb']]) {
      expect(isEffectId(junk)).toBe(false)
    }
  })
})

describe('moveEffect', () => {
  it('moves an entry up the chain', () => {
    expect(ids(moveEffect(DEFAULT_EFFECTS, LAST, 0))).toEqual(['reverb', ...rest('reverb')])
  })

  it('moves an entry down the chain', () => {
    const [first, second] = EFFECT_IDS
    expect(ids(moveEffect(DEFAULT_EFFECTS, 0, 1))).toEqual([second, first, ...rest(first, second)])
  })

  it('carries the amounts with the entry rather than the position', () => {
    // Reverb is the only one with a non-zero default, so a move that read the
    // amount off the new position rather than the entry would show up here.
    const moved = moveEffect(DEFAULT_EFFECTS, LAST, 0)
    expect(moved[0]).toEqual({ id: 'reverb', amount: defaultAmount('reverb') })
  })

  it('leaves the chain alone when the move runs off either end', () => {
    // The reorder buttons hand over `i - 1` at the top without checking first.
    expect(moveEffect(DEFAULT_EFFECTS, 0, -1)).toBe(DEFAULT_EFFECTS)
    expect(moveEffect(DEFAULT_EFFECTS, LAST, LAST + 1)).toBe(DEFAULT_EFFECTS)
  })

  it('never mutates the array it was handed', () => {
    const before = ids(DEFAULT_EFFECTS)
    moveEffect(DEFAULT_EFFECTS, LAST, 0)
    expect(ids(DEFAULT_EFFECTS)).toEqual(before)
  })
})

describe('normalizeEffects', () => {
  it('defaults when nothing is stored', () => {
    expect(normalizeEffects(undefined)).toEqual(DEFAULT_EFFECTS)
    expect(normalizeEffects('not an array')).toEqual(DEFAULT_EFFECTS)
  })

  it('keeps a stored order', () => {
    // A full rack, reversed and each with its own amount: nothing here needs
    // repairing, so it has to come back exactly as it went in.
    const stored = fullRack()
    expect(normalizeEffects(stored)).toEqual(stored)
  })

  // The engine walks this array to build its chain, so a missing id would strand
  // that node outside the signal path and a duplicate would wire one in twice.
  it('appends whatever the blob was missing, in canonical order', () => {
    expect(ids(normalizeEffects([{ id: 'reverb', amount: 0.5 }]))).toEqual([
      'reverb',
      ...rest('reverb'),
    ])
  })

  it('drops duplicates, keeping the first', () => {
    const normalized = normalizeEffects([
      { id: 'delay', amount: 0.4 },
      { id: 'delay', amount: 0.9 },
    ])
    expect(ids(normalized)).toEqual(['delay', ...rest('delay')])
    expect(normalized[0].amount).toBe(0.4)
  })

  it('drops entries it cannot read', () => {
    expect(ids(normalizeEffects([null, 'delay', { amount: 1 }, { id: 'flanger', amount: 1 }])))
      .toEqual(EFFECT_IDS)
  })

  it('always returns every effect exactly once', () => {
    for (const stored of [[], [{ id: 'chorus' }], [{ id: 'delay', amount: 1 }, { id: 'delay' }]]) {
      expect(ids(normalizeEffects(stored)).sort()).toEqual([...EFFECT_IDS].sort())
    }
  })

  it('clamps an amount to the knob range', () => {
    const normalized = normalizeEffects([
      { id: 'chorus', amount: 2 },
      { id: 'delay', amount: -1 },
    ])
    expect(normalized[0].amount).toBe(1)
    expect(normalized[1].amount).toBe(0)
  })

  it('falls back to the default amount on one it cannot read', () => {
    const normalized = normalizeEffects([{ id: 'reverb', amount: 'loud' }])
    expect(normalized[0].amount).toBe(defaultAmount('reverb'))
  })
})

describe('divisionMs', () => {
  it('measures each division against the beat', () => {
    // A quarter note is the beat itself; 120 BPM puts it at half a second.
    expect(divisionMs('quarter', 120)).toBe(500)
    expect(divisionMs('eighth', 120)).toBe(250)
    expect(divisionMs('dotted-eighth', 120)).toBe(375)
  })

  it('adds half the note again for a dot', () => {
    for (const [plain, dotted] of [
      ['sixteenth', 'dotted-sixteenth'],
      ['eighth', 'dotted-eighth'],
      ['quarter', 'dotted-quarter'],
    ] as const) {
      expect(divisionMs(dotted, 120)).toBeCloseTo(divisionMs(plain, 120) * 1.5, 9)
    }
  })

  // Three triplets fill the space of two plain notes, so one is two thirds of
  // the note it is named against — not a third of it.
  it('fits three triplets into two plain notes', () => {
    for (const [plain, triplet] of [
      ['sixteenth', 'sixteenth-triplet'],
      ['eighth', 'eighth-triplet'],
      ['quarter', 'quarter-triplet'],
      ['half', 'half-triplet'],
    ] as const) {
      expect(divisionMs(triplet, 120) * 3).toBeCloseTo(divisionMs(plain, 120) * 2, 9)
    }
  })

  it('doubles from each straight division to the next', () => {
    const straight = ['thirty-second', 'sixteenth', 'eighth', 'quarter', 'half', 'whole'] as const
    for (let i = 1; i < straight.length; i++) {
      expect(divisionMs(straight[i], 120)).toBeCloseTo(divisionMs(straight[i - 1], 120) * 2, 9)
    }
  })

  it('scales inversely with tempo', () => {
    expect(divisionMs('quarter', 60)).toBe(1000)
    expect(divisionMs('quarter', 40)).toBe(1500)
    // The slowest tempo against the longest division: the number the delay line
    // has to be allocated against.
    expect(divisionMs('whole', 40)).toBe(6000)
  })

  it('runs short to long in the order the knob steps through them', () => {
    const lengths = DIVISIONS.map((division) => divisionMs(division, DEFAULT_BPM))
    for (let i = 1; i < lengths.length; i++) expect(lengths[i]).toBeGreaterThan(lengths[i - 1])
  })
})

describe('effectMs', () => {
  const timing = { lock: false, division: 'quarter' as const, ms: 250 }

  it('reads the milliseconds while unlocked, whatever the tempo', () => {
    expect(effectMs(timing, 120)).toBe(250)
    expect(effectMs(timing, 40)).toBe(250)
  })

  it('reads the division while locked', () => {
    expect(effectMs({ ...timing, lock: true }, 120)).toBe(500)
  })

  // Storing both is what lets the lock be toggled without losing either side.
  it('leaves the other side untouched, so a lock can be toggled back', () => {
    const locked = { ...timing, lock: true }
    expect(effectMs(locked, 120)).toBe(500)
    expect(effectMs({ ...locked, lock: false }, 120)).toBe(250)
  })
})

describe('isTimed', () => {
  it('is true for exactly the effects with a rate', () => {
    for (const id of EFFECT_IDS) expect(isTimed(id)).toBe(TIMED_EFFECT_IDS.includes(id))
  })

  it('gives every timed effect a default and a knob range', () => {
    for (const id of TIMED_EFFECT_IDS) {
      expect(DEFAULT_TIMING[id]).toBeDefined()
      expect(EFFECT_MS_RANGES[id]).toBeDefined()
    }
  })
})

describe('isDivisionId', () => {
  it('accepts every division', () => {
    for (const division of DIVISIONS) expect(isDivisionId(division)).toBe(true)
  })

  it('rejects anything else a stored blob might hold', () => {
    for (const junk of ['1/8', 'sixty-fourth', 'dotted', '', null, undefined, 0, {}]) {
      expect(isDivisionId(junk)).toBe(false)
    }
  })
})

describe('normalizeEffects timing', () => {
  const timingOf = (effects: ReturnType<typeof normalizeEffects>, id: string) =>
    effects.find((effect) => effect.id === id)!.timing

  it('gives a rate to the timed effects and none to the others', () => {
    const normalized = normalizeEffects([])
    for (const effect of normalized) {
      expect(effect.timing === undefined).toBe(!isTimed(effect.id))
    }
  })

  it('defaults each timed effect to the rate it ran at before it was a knob', () => {
    const normalized = normalizeEffects([])
    for (const id of TIMED_EFFECT_IDS) expect(timingOf(normalized, id)).toEqual(DEFAULT_TIMING[id])
  })

  it('keeps a stored timing', () => {
    const timing = { lock: true, division: 'quarter' as const, ms: 600 }
    expect(timingOf(normalizeEffects([{ id: 'delay', amount: 0.5, timing }]), 'delay')).toEqual(
      timing,
    )
  })

  it('clamps the milliseconds to that effect\'s own range', () => {
    const stored = (id: string, ms: number) => [{ id, amount: 0, timing: { ms } }]
    // The phaser's ceiling is four times the delay's, so one shared clamp would
    // show up as the wrong bound on one of them.
    expect(timingOf(normalizeEffects(stored('delay', 99999)), 'delay')!.ms).toBe(
      EFFECT_MS_RANGES.delay!.max,
    )
    expect(timingOf(normalizeEffects(stored('phaser', 99999)), 'phaser')!.ms).toBe(
      EFFECT_MS_RANGES.phaser!.max,
    )
    expect(timingOf(normalizeEffects(stored('tremolo', -1)), 'tremolo')!.ms).toBe(
      EFFECT_MS_RANGES.tremolo!.min,
    )
  })

  it('repairs a timing it cannot read', () => {
    const junk = [{ id: 'delay', amount: 0, timing: { division: 'sixty-fourth', ms: 'fast' } }]
    expect(timingOf(normalizeEffects(junk), 'delay')).toEqual(DEFAULT_TIMING.delay)
  })

  // A truthy string in a hand-edited blob must not silently put an effect on the
  // grid, where it would then ignore the milliseconds shown beside it.
  it('locks on a real `true` and nothing else', () => {
    const lockedWith = (lock: unknown) =>
      timingOf(normalizeEffects([{ id: 'delay', amount: 0, timing: { lock } }]), 'delay')!.lock
    expect(lockedWith(true)).toBe(true)
    for (const junk of ['yes', 1, {}, null, undefined]) expect(lockedWith(junk)).toBe(false)
  })
})

describe('cloneEffects', () => {
  it('copies the nested timing rather than sharing it', () => {
    const copy = cloneEffects(DEFAULT_EFFECTS)
    const original = DEFAULT_EFFECTS.find((effect) => effect.id === 'delay')!
    copy.find((effect) => effect.id === 'delay')!.timing!.ms = 999
    expect(original.timing!.ms).toBe(DEFAULT_TIMING.delay!.ms)
  })
})

describe('DELAY_MAX_SECONDS', () => {
  /**
   * The regression this guards fails *silently* — a delay line too short does
   * not error, the repeats just stop spreading — so it is asserted against the
   * data rather than against the number itself.
   */
  it('covers the longest division at the slowest tempo', () => {
    const longest = Math.max(...DIVISIONS.map((division) => divisionMs(division, BPM_RANGE.min)))
    expect(DELAY_MAX_SECONDS).toBeGreaterThanOrEqual(longest / 1000)
  })

  it('covers the manual knob reaching its own ceiling', () => {
    expect(DELAY_MAX_SECONDS).toBeGreaterThanOrEqual(EFFECT_MS_RANGES.delay!.max / 1000)
  })

  it('is not wastefully larger than what it has to hold', () => {
    const longest = Math.max(
      EFFECT_MS_RANGES.delay!.max,
      ...DIVISIONS.map((division) => divisionMs(division, BPM_RANGE.min)),
    )
    expect(DELAY_MAX_SECONDS - longest / 1000).toBeLessThanOrEqual(2)
  })
})
