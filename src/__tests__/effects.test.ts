import { describe, expect, it } from 'vitest'
import {
  DEFAULT_EFFECTS,
  EFFECT_IDS,
  defaultAmount,
  isEffectId,
  moveEffect,
  normalizeEffects,
} from '../audio/effects'

const ids = (effects: { id: string }[]) => effects.map((effect) => effect.id)

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
    expect(ids(moveEffect(DEFAULT_EFFECTS, 2, 0))).toEqual(['reverb', 'chorus', 'delay'])
  })

  it('moves an entry down the chain', () => {
    expect(ids(moveEffect(DEFAULT_EFFECTS, 0, 1))).toEqual(['delay', 'chorus', 'reverb'])
  })

  it('carries the amounts with the entry rather than the position', () => {
    const moved = moveEffect(DEFAULT_EFFECTS, 2, 0)
    expect(moved[0]).toEqual({ id: 'reverb', amount: defaultAmount('reverb') })
  })

  it('leaves the chain alone when the move runs off either end', () => {
    // The reorder buttons hand over `i - 1` at the top without checking first.
    expect(moveEffect(DEFAULT_EFFECTS, 0, -1)).toBe(DEFAULT_EFFECTS)
    expect(moveEffect(DEFAULT_EFFECTS, 2, 3)).toBe(DEFAULT_EFFECTS)
  })

  it('never mutates the array it was handed', () => {
    const before = ids(DEFAULT_EFFECTS)
    moveEffect(DEFAULT_EFFECTS, 2, 0)
    expect(ids(DEFAULT_EFFECTS)).toEqual(before)
  })
})

describe('normalizeEffects', () => {
  it('defaults when nothing is stored', () => {
    expect(normalizeEffects(undefined)).toEqual(DEFAULT_EFFECTS)
    expect(normalizeEffects('not an array')).toEqual(DEFAULT_EFFECTS)
  })

  it('keeps a stored order', () => {
    const stored = [
      { id: 'reverb', amount: 0.5 },
      { id: 'chorus', amount: 0.1 },
      { id: 'delay', amount: 0.2 },
    ]
    expect(normalizeEffects(stored)).toEqual(stored)
  })

  // The engine walks this array to build its chain, so a missing id would strand
  // that node outside the signal path and a duplicate would wire one in twice.
  it('appends whatever the blob was missing, in canonical order', () => {
    expect(ids(normalizeEffects([{ id: 'reverb', amount: 0.5 }]))).toEqual([
      'reverb',
      'chorus',
      'delay',
    ])
  })

  it('drops duplicates, keeping the first', () => {
    const normalized = normalizeEffects([
      { id: 'delay', amount: 0.4 },
      { id: 'delay', amount: 0.9 },
    ])
    expect(ids(normalized)).toEqual(['delay', 'chorus', 'reverb'])
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
