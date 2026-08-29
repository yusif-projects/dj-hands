/** The effects rack: three fixed-character effects, each with its own wet mix. */

import type { ControlRange } from './range'

export type EffectId = 'chorus' | 'delay' | 'reverb'

/** Canonical order — modulation, then time, then space. Also the default chain. */
export const EFFECT_IDS: EffectId[] = ['chorus', 'delay', 'reverb']

/** One effect's wet mix. The order of an `EffectSetting[]` *is* the chain order. */
export interface EffectSetting {
  id: EffectId
  amount: number
}

/** Knob bounds for an amount; also the clamp stored settings are normalized to. */
export const EFFECT_AMOUNT_RANGE: ControlRange = { min: 0, max: 1, step: 0.05 }

export const DEFAULT_EFFECTS: EffectSetting[] = [
  { id: 'chorus', amount: 0 },
  { id: 'delay', amount: 0 },
  // Where the old single send sat, so nobody's sound changes under them.
  { id: 'reverb', amount: 0.25 },
]

/**
 * Each effect's character is fixed; only how much of it you hear is set in the
 * panel. These live here rather than inside the engine because the panel draws
 * its glyphs from the same numbers the audio graph is built from.
 */
export const DELAY_TIME = 0.25
export const DELAY_FEEDBACK = 0.35
export const REVERB_DECAY = 3
export const CHORUS_FREQUENCY = 1.5
export const CHORUS_DELAY_TIME = 3.5
export const CHORUS_DEPTH = 0.7

export function isEffectId(value: unknown): value is EffectId {
  return typeof value === 'string' && (EFFECT_IDS as string[]).includes(value)
}

/** The amount an effect resets to, and what an unreadable stored one falls back to. */
export function defaultAmount(id: EffectId): number {
  return DEFAULT_EFFECTS.find((effect) => effect.id === id)!.amount
}

/**
 * `effects` with the entry at `from` lifted out and dropped at `to`. An index
 * outside the array returns it unchanged, so the reorder buttons can hand over
 * `i - 1` at the top of the list without checking first.
 */
export function moveEffect(effects: EffectSetting[], from: number, to: number): EffectSetting[] {
  if (!inBounds(from, effects.length) || !inBounds(to, effects.length)) return effects
  const next = [...effects]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

/**
 * A stored rack made trustworthy: every id present exactly once, in whatever
 * order survived, with amounts clamped. Junk, duplicates and missing entries all
 * resolve rather than shortening the list — the engine walks this array to build
 * its chain, so a missing id would strand that node outside the signal path and
 * a duplicate would try to wire one node in twice.
 */
export function normalizeEffects(stored: unknown): EffectSetting[] {
  const list = Array.isArray(stored) ? stored : []
  const seen = new Set<EffectId>()
  const effects: EffectSetting[] = []

  for (const entry of list) {
    const id = (entry as Partial<EffectSetting> | null)?.id
    if (!isEffectId(id) || seen.has(id)) continue
    seen.add(id)
    effects.push({ id, amount: clampAmount((entry as EffectSetting).amount, id) })
  }
  // Whatever the blob was missing joins in canonical order, at its default.
  for (const id of EFFECT_IDS) {
    if (!seen.has(id)) effects.push({ id, amount: defaultAmount(id) })
  }
  return effects
}

function clampAmount(value: unknown, id: EffectId): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return defaultAmount(id)
  return Math.min(EFFECT_AMOUNT_RANGE.max, Math.max(EFFECT_AMOUNT_RANGE.min, parsed))
}

function inBounds(index: number, length: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < length
}
