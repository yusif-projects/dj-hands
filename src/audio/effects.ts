/**
 * The effects rack: six effects, each with its own wet mix. Three of them —
 * tremolo, phaser and delay — also carry a rate, chosen either freely in
 * milliseconds or snapped to a note division against the rack's tempo. The
 * other three have a fixed character and nothing but the amount to set.
 */

import type { ControlRange } from './range'

export type EffectId = 'bitcrusher' | 'chorus' | 'tremolo' | 'phaser' | 'delay' | 'reverb'

/**
 * Canonical order — waveshaping, then modulation, then time, then space. Also
 * the default chain. The crusher leads because it is the only one that rewrites
 * the waveform itself: behind the modulation it would be quantizing a signal
 * already smeared by three LFOs, and its steps would read as noise rather than
 * as grit on the chord.
 */
export const EFFECT_IDS: EffectId[] = [
  'bitcrusher',
  'chorus',
  'tremolo',
  'phaser',
  'delay',
  'reverb',
]

/** The effects with a rate of their own; the rest are fixed-character. */
export const TIMED_EFFECT_IDS: EffectId[] = ['tremolo', 'phaser', 'delay']

/** Note values the rate snaps to while locked: straight, dotted and triplet. */
export type DivisionId =
  | 'thirty-second'
  | 'sixteenth-triplet'
  | 'sixteenth'
  | 'eighth-triplet'
  | 'dotted-sixteenth'
  | 'eighth'
  | 'quarter-triplet'
  | 'dotted-eighth'
  | 'quarter'
  | 'half-triplet'
  | 'dotted-quarter'
  | 'half'
  | 'whole'

/**
 * Ordered by duration rather than by family, so the knob's detents run short to
 * long clockwise the way every other knob in the panel does. That interleaves
 * the three families, which is the point: what a player reaches for next is the
 * neighbouring *length*, not the neighbouring notation.
 */
export const DIVISIONS: DivisionId[] = [
  'thirty-second',
  'sixteenth-triplet',
  'sixteenth',
  'eighth-triplet',
  'dotted-sixteenth',
  'eighth',
  'quarter-triplet',
  'dotted-eighth',
  'quarter',
  'half-triplet',
  'dotted-quarter',
  'half',
  'whole',
]

/**
 * Beats — quarter notes — each division spans. A dot adds half the note again;
 * a triplet fits three into the space of two, so one is a third of the note it
 * is named against rather than of the note itself.
 */
const DIVISION_BEATS: Record<DivisionId, number> = {
  'thirty-second': 0.125,
  'sixteenth-triplet': 1 / 6,
  sixteenth: 0.25,
  'eighth-triplet': 1 / 3,
  'dotted-sixteenth': 0.375,
  eighth: 0.5,
  'quarter-triplet': 2 / 3,
  'dotted-eighth': 0.75,
  quarter: 1,
  'half-triplet': 4 / 3,
  'dotted-quarter': 1.5,
  half: 2,
  whole: 4,
}

/** One timed effect's rate, held both ways so the lock can be toggled freely. */
export interface EffectTiming {
  /** Snap the rate to the grid rather than choosing it in milliseconds. */
  lock: boolean
  /** The note value used while locked. */
  division: DivisionId
  /** The period in milliseconds used while unlocked. */
  ms: number
}

/** One effect's settings. The order of an `EffectSetting[]` *is* the chain order. */
export interface EffectSetting {
  id: EffectId
  amount: number
  /** Present on exactly the timed effects, absent on the others. */
  timing?: EffectTiming
}

/** Knob bounds for an amount; also the clamp stored settings are normalized to. */
export const EFFECT_AMOUNT_RANGE: ControlRange = { min: 0, max: 1, step: 0.05 }

/** The rack's tempo, which only the locked effects read. */
export const DEFAULT_BPM = 120
export const BPM_RANGE: ControlRange = { min: 40, max: 240, step: 1 }

/**
 * The locked knob drives an *index* into `DIVISIONS` rather than a duration, so
 * the knob maths already in the panel does the snapping and there is no second
 * quantizer anywhere in the rack.
 */
export const DIVISION_RANGE: ControlRange = { min: 0, max: DIVISIONS.length - 1, step: 1 }

/**
 * Knob bounds for each timed effect's free-running period. Musical rather than
 * uniform: a phaser sweep is measured in seconds and a delay in fractions of one,
 * so one shared range would spend most of its travel somewhere useless.
 */
export const EFFECT_MS_RANGES: Partial<Record<EffectId, ControlRange>> = {
  // 20 Hz down to 0.5 Hz.
  tremolo: { min: 50, max: 2000, step: 10 },
  // 4 Hz down to 0.1 Hz.
  phaser: { min: 250, max: 10000, step: 50 },
  delay: { min: 20, max: 1000, step: 10 },
}

/**
 * What each timed effect starts at. Every one begins unlocked at the rate it was
 * fixed to before the rate was a knob, so nothing changes under a returning
 * player until they turn a lock on.
 */
export const DEFAULT_TIMING: Partial<Record<EffectId, EffectTiming>> = {
  tremolo: { lock: false, division: 'eighth', ms: 200 },
  phaser: { lock: false, division: 'eighth', ms: 2500 },
  delay: { lock: false, division: 'eighth', ms: 250 },
}

export const DEFAULT_EFFECTS: EffectSetting[] = [
  { id: 'bitcrusher', amount: 0 },
  { id: 'chorus', amount: 0 },
  { id: 'tremolo', amount: 0, timing: { ...DEFAULT_TIMING.tremolo! } },
  { id: 'phaser', amount: 0, timing: { ...DEFAULT_TIMING.phaser! } },
  { id: 'delay', amount: 0, timing: { ...DEFAULT_TIMING.delay! } },
  // Where the old single send sat, so nobody's sound changes under them.
  { id: 'reverb', amount: 0.25 },
]

/**
 * The character each effect is fixed to, whatever its rate. These live here
 * rather than inside the engine because the panel draws its glyphs from the same
 * numbers the audio graph is built from. Listed in chain order.
 */
export const BITCRUSHER_BITS = 4
export const CHORUS_FREQUENCY = 1.5
export const CHORUS_DELAY_TIME = 3.5
export const CHORUS_DEPTH = 0.7
export const TREMOLO_DEPTH = 0.8
export const PHASER_OCTAVES = 3
export const PHASER_BASE_FREQUENCY = 350
export const DELAY_FEEDBACK = 0.35
export const REVERB_DECAY = 3

/**
 * Seconds of delay line to allocate. Tone defaults this to 1 second and the
 * underlying `DelayNode` cannot grow past whatever it was built with, so it has
 * to cover the longest time the rack can ever ask for — today a whole note at
 * the slowest tempo, 6 s.
 *
 * Derived rather than written down, because getting it wrong is not a subtle
 * mistuning but a hard failure: Tone bounds `delayTime` by whatever the buffer
 * was built with and *throws* past it — `Value must be within [0, 1], got: 6` —
 * and since `setEffects` walks the whole rack, that throw abandons every effect
 * after the delay too. A division added to the list above therefore widens the
 * buffer on its own instead of outgrowing it. The spare second absorbs float
 * drift at the boundary.
 */
export const DELAY_MAX_SECONDS =
  Math.ceil(
    Math.max(
      EFFECT_MS_RANGES.delay!.max,
      ...DIVISIONS.map((division) => divisionMs(division, BPM_RANGE.min)),
    ) / 1000,
  ) + 1

export function isEffectId(value: unknown): value is EffectId {
  return typeof value === 'string' && (EFFECT_IDS as string[]).includes(value)
}

export function isDivisionId(value: unknown): value is DivisionId {
  return typeof value === 'string' && (DIVISIONS as string[]).includes(value)
}

/** Whether this effect has a rate at all, or only an amount. */
export function isTimed(id: EffectId): boolean {
  return TIMED_EFFECT_IDS.includes(id)
}

/** The amount an effect resets to, and what an unreadable stored one falls back to. */
export function defaultAmount(id: EffectId): number {
  return DEFAULT_EFFECTS.find((effect) => effect.id === id)!.amount
}

/** How long one division lasts at `bpm`, in milliseconds. */
export function divisionMs(division: DivisionId, bpm: number): number {
  return (60000 / bpm) * DIVISION_BEATS[division]
}

/**
 * The period a timed effect actually runs at. The lock picks which of the two
 * stored values is live; the other is left untouched, so toggling the lock back
 * returns the rate that was set on that side rather than a converted one.
 */
export function effectMs(timing: EffectTiming, bpm: number): number {
  return timing.lock ? divisionMs(timing.division, bpm) : timing.ms
}

/** A deep copy, so the nested `timing` is not shared with the array copied from. */
export function cloneEffects(effects: EffectSetting[]): EffectSetting[] {
  return effects.map((effect) =>
    effect.timing ? { ...effect, timing: { ...effect.timing } } : { ...effect },
  )
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
 *
 * Timing is held to the same promise: every timed effect comes back with a
 * complete one and every other effect with none at all, so neither the panel nor
 * the engine has to defend against a half-built object from a hand-edited blob.
 */
export function normalizeEffects(stored: unknown): EffectSetting[] {
  const list = Array.isArray(stored) ? stored : []
  const seen = new Set<EffectId>()
  const effects: EffectSetting[] = []

  for (const entry of list) {
    const id = (entry as Partial<EffectSetting> | null)?.id
    if (!isEffectId(id) || seen.has(id)) continue
    seen.add(id)
    effects.push(normalizeEffect(id, entry as Partial<EffectSetting>))
  }
  // Whatever the blob was missing joins in canonical order, at its default.
  for (const id of EFFECT_IDS) {
    if (!seen.has(id)) effects.push(normalizeEffect(id, {}))
  }
  return effects
}

function normalizeEffect(id: EffectId, stored: Partial<EffectSetting>): EffectSetting {
  const effect: EffectSetting = { id, amount: clampAmount(stored.amount, id) }
  // Assigned rather than spread in, so an untimed effect carries no `timing` key
  // at all rather than an explicit `undefined` for the panel to trip over.
  if (isTimed(id)) effect.timing = normalizeTiming(id, stored.timing)
  return effect
}

function normalizeTiming(id: EffectId, stored: EffectTiming | undefined): EffectTiming {
  const fallback = DEFAULT_TIMING[id]!
  const ms = Number(stored?.ms)
  return {
    // Anything but a real `true` reads as unlocked, so a truthy string left in a
    // hand-edited blob cannot silently put an effect on the grid.
    lock: stored?.lock === true,
    division: isDivisionId(stored?.division) ? stored.division : fallback.division,
    ms: Number.isFinite(ms) ? clampToRange(ms, EFFECT_MS_RANGES[id]!) : fallback.ms,
  }
}

function clampAmount(value: unknown, id: EffectId): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return defaultAmount(id)
  return clampToRange(parsed, EFFECT_AMOUNT_RANGE)
}

/** Held to a control's own bounds. Shared with the arpeggiator, which normalizes
 *  its rate against the same `ControlRange`s this module's knobs are built from. */
export function clampToRange(value: number, range: ControlRange): number {
  return Math.min(range.max, Math.max(range.min, value))
}

function inBounds(index: number, length: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < length
}
