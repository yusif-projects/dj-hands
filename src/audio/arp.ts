/**
 * The arpeggiator: the held chord played one note at a time on a clock. Pure —
 * the order the notes are walked in and the settings that describe it, with no
 * audio and no clock of its own. `SynthEngine` owns the Tone loop that steps it.
 *
 * The rate is an `EffectTiming` borrowed whole from the rack, so "free in
 * milliseconds or locked to the tempo" behaves identically in both places and
 * there is one tempo in the app rather than two.
 */

import { shiftOctave } from './chords'
import { clampToRange, isDivisionId, type EffectTiming } from './effects'
import type { ControlRange } from './range'

export type ArpPattern = 'up' | 'down' | 'updown' | 'downup' | 'random'

/** Picker order: the two directions, their two round trips, then the wild card. */
export const ARP_PATTERNS: ArpPattern[] = ['up', 'down', 'updown', 'downup', 'random']

export interface ArpSettings {
  enabled: boolean
  pattern: ArpPattern
  /** Rate, held both ways so the lock can be toggled freely — as in the rack. */
  timing: EffectTiming
  /** How many octaves the pattern climbs before it repeats. */
  octaves: number
  /** Share of the step the note rings for; the rest is silence. */
  gate: number
}

/**
 * 40 ms is 25 steps a second, past which nothing reads as notes; a second is
 * about as slow as a pattern can go before it stops being one.
 */
export const ARP_MS_RANGE: ControlRange = { min: 40, max: 1000, step: 10 }
export const ARP_OCTAVES_RANGE: ControlRange = { min: 1, max: 3, step: 1 }
/** A floor above zero: a gate of nothing is an arpeggiator that plays silence. */
export const ARP_GATE_RANGE: ControlRange = { min: 0.05, max: 1, step: 0.05 }

/**
 * Off by default, so an update changes nothing a returning player hears. Locked
 * to the tempo rather than free-running, unlike the rack's effects — those
 * default unlocked to preserve rates that predate the lock, where an arpeggio
 * has nothing to preserve and wants the grid.
 */
export const DEFAULT_ARP: ArpSettings = {
  enabled: false,
  pattern: 'up',
  timing: { lock: true, division: 'eighth', ms: 250 },
  octaves: 1,
  gate: 0.6,
}

export function isArpPattern(value: unknown): value is ArpPattern {
  return typeof value === 'string' && (ARP_PATTERNS as string[]).includes(value)
}

/** A stored arp made trustworthy; junk and half-built objects resolve to defaults. */
export function normalizeArp(stored: unknown): ArpSettings {
  if (!stored || typeof stored !== 'object') return cloneArp(DEFAULT_ARP)
  const arp = stored as Partial<ArpSettings>
  const ms = Number(arp.timing?.ms)
  return {
    // Anything but a real `true` reads as off: an update must never start
    // arpeggiating under someone because a hand-edited blob held a truthy string.
    enabled: arp.enabled === true,
    pattern: isArpPattern(arp.pattern) ? arp.pattern : DEFAULT_ARP.pattern,
    timing: {
      lock: arp.timing?.lock !== false,
      division: isDivisionId(arp.timing?.division)
        ? arp.timing.division
        : DEFAULT_ARP.timing.division,
      ms: Number.isFinite(ms) ? clampToRange(ms, ARP_MS_RANGE) : DEFAULT_ARP.timing.ms,
    },
    octaves: clampInteger(arp.octaves, ARP_OCTAVES_RANGE, DEFAULT_ARP.octaves),
    gate: clampNumber(arp.gate, ARP_GATE_RANGE, DEFAULT_ARP.gate),
  }
}

/** A deep copy, so the nested `timing` is not shared with the arp copied from. */
export function cloneArp(arp: ArpSettings): ArpSettings {
  return { ...arp, timing: { ...arp.timing } }
}

/**
 * The order one cycle walks, from a chord's notes as `chordToNotes` voices them
 * — low to high, so `up` is the array itself once it is stacked.
 *
 * The round trips do not repeat their endpoints: `C E G` up-down is `C E G E`,
 * not `C E G G E`, which is the turn every arpeggiator on a synth makes. Two
 * notes or one therefore reduce to the plain direction, which is what they are.
 *
 * `random` has no fixed order, so it returns the `up` order for the engine to
 * draw into with `randomStep` — the notes are the same set either way, and this
 * keeps the shuffling out of a function that is otherwise pure order.
 */
export function arpSequence(notes: string[], pattern: ArpPattern, octaves = 1): string[] {
  if (notes.length === 0) return []
  const up = stack(notes, octaves)
  if (pattern === 'up' || pattern === 'random') return up
  const down = [...up].reverse()
  if (pattern === 'down') return down
  // Trimming both ends of the return leg is what drops the doubled turn.
  const forward = pattern === 'updown' ? up : down
  return [...forward, ...forward.slice(1, -1).reverse()]
}

/** The chord repeated up `octaves` octaves, still low to high. */
function stack(notes: string[], octaves: number): string[] {
  const span = Math.max(1, Math.round(octaves))
  const stacked: string[] = []
  for (let octave = 0; octave < span; octave++) {
    for (const note of notes) stacked.push(shiftOctave(note, octave))
  }
  return stacked
}

/**
 * The next index for `random`: uniform over every index *except* the one just
 * played, because a random walk that repeats reads as a dropped note rather than
 * as a choice. `rand` is injectable so the draw can be tested.
 *
 * A `previous` outside the sequence — the first step of a chord, or one left
 * over from a longer one — draws from the whole thing instead.
 */
export function randomStep(length: number, previous: number, rand: () => number = Math.random): number {
  if (length <= 1) return 0
  if (previous < 0 || previous >= length) return Math.min(length - 1, Math.floor(rand() * length))
  const pick = Math.min(length - 2, Math.floor(rand() * (length - 1)))
  // Skipping over `previous` maps the short draw back onto every other index.
  return pick >= previous ? pick + 1 : pick
}

function clampNumber(value: unknown, range: ControlRange, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? clampToRange(parsed, range) : fallback
}

function clampInteger(value: unknown, range: ControlRange, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? clampToRange(Math.round(parsed), range) : fallback
}
