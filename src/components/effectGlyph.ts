/** SVG outlines of the six effects. Pure, so the tests can stay DOM-free. */

import { DELAY_FEEDBACK } from '../audio/effects'
import type { EffectId } from '../audio/effects'

/** A repeat quieter than this share of the dry hit is the last one worth drawing. */
const TAP_FLOOR = 0.08

/**
 * How many repeats the delay glyph shows, read off the feedback the engine
 * actually runs: the first one to fall under the floor, which is drawn as the
 * tail-off, and none after it. At 0.35 that is three repeats behind the hit.
 */
export const DELAY_TAPS = Math.max(2, Math.ceil(Math.log(TAP_FLOOR) / Math.log(DELAY_FEEDBACK)))

const SINE_SAMPLES = 20
const CHORUS_CYCLES = 1.5
/** Amplitude of each chorus voice, leaving room for the two to sit apart. */
const CHORUS_AMPLITUDE = 0.4
/** How far the second voice lags the first, in cycles — chorus as a detuned copy. */
const CHORUS_SPREAD = 0.14

const TAIL_SAMPLES = 24
/** Decades the reverb tail falls across the glyph's width. */
const TAIL_DECADES = 2.5

const TREMOLO_SAMPLES = 60
/** Swells the depth LFO cuts the level into across the glyph. */
const TREMOLO_LOBES = 2

const PHASER_SAMPLES = 60
/** Notches swept across the glyph, and how far each one cuts. */
export const PHASER_NOTCHES = 3
const PHASER_SHELF = 0.85
const PHASER_NOTCH_DEPTH = 0.7
/** Raising the comb to a power narrows the dips into notches rather than waves. */
const PHASER_NOTCH_SHARPNESS = 6

const CRUSH_CYCLES = 1.5
/** Sample-and-hold steps across the width, and the levels each one snaps to.
 *  Both illustrative: `2 ** BITCRUSHER_BITS` is 16 levels, which across 22px of
 *  glyph would come out smooth and show none of what the effect does. */
const CRUSH_HOLDS = 14
const CRUSH_LEVELS = 6

/** A point with x 0→1 left to right and `level` 0→1 **upward**. */
export interface GlyphPoint {
  x: number
  level: number
}

/**
 * The effect drawn across a `w` × `h` box, inset by `pad`. Several sub-paths
 * rather than one: chorus is two voices and delay is a row of separate repeats,
 * and a single path would have to jump between them.
 */
export function effectGlyphPaths(id: EffectId, w: number, h: number, pad = 0): string[] {
  const draw = (points: GlyphPoint[]) => glyphPath(points, w, h, pad)

  if (id === 'bitcrusher') {
    return [draw(crushedWave())]
  }

  if (id === 'chorus') {
    return [draw(chorusVoice(0)), draw(chorusVoice(CHORUS_SPREAD))]
  }

  if (id === 'tremolo') {
    return [draw(tremoloEnvelope(1)), draw(tremoloEnvelope(-1))]
  }

  if (id === 'phaser') {
    return [draw(phaserResponse())]
  }

  if (id === 'delay') {
    // The dry hit at full height, then the repeats falling away under feedback.
    return Array.from({ length: DELAY_TAPS + 1 }, (_, tap) => {
      const x = tap / DELAY_TAPS
      const level = tap === 0 ? 1 : DELAY_FEEDBACK ** tap
      return draw([
        { x, level: 0 },
        { x, level },
      ])
    })
  }

  // Reverb: the dry hit, then a tail smearing away from it.
  return [
    draw([
      { x: 0, level: 0 },
      { x: 0, level: 1 },
    ]),
    draw(reverbTail()),
  ]
}

function chorusVoice(phase: number): GlyphPoint[] {
  const points: GlyphPoint[] = []
  for (let i = 0; i <= SINE_SAMPLES; i++) {
    const x = i / SINE_SAMPLES
    const angle = (x * CHORUS_CYCLES + phase) * 2 * Math.PI
    points.push({ x, level: 0.5 + (Math.sin(angle) * CHORUS_AMPLITUDE) / 2 })
  }
  return points
}

/**
 * A sine put through a sample-and-hold and snapped to a handful of levels — the
 * staircase is the whole point, so each hold is drawn as a flat run and the jump
 * to the next one falls out of the shared x between them.
 */
function crushedWave(): GlyphPoint[] {
  const points: GlyphPoint[] = []
  const steps = CRUSH_LEVELS - 1
  for (let hold = 0; hold < CRUSH_HOLDS; hold++) {
    // Read at the middle of the hold, so neither end of the glyph is favoured.
    const angle = ((hold + 0.5) / CRUSH_HOLDS) * CRUSH_CYCLES * 2 * Math.PI
    const level = Math.round((0.5 + Math.sin(angle) / 2) * steps) / steps
    points.push({ x: hold / CRUSH_HOLDS, level }, { x: (hold + 1) / CRUSH_HOLDS, level })
  }
  return points
}

/**
 * One side of the level envelope, pinched to nothing and back once per lobe.
 * The envelope rather than the carrier inside it: enough oscillations to read as
 * a carrier come out a smear at 44px, and what says tremolo is the swell anyway.
 * Drawn twice, mirrored, so the two outlines meet on the centre line at a pinch.
 */
function tremoloEnvelope(sign: 1 | -1): GlyphPoint[] {
  const points: GlyphPoint[] = []
  for (let i = 0; i <= TREMOLO_SAMPLES; i++) {
    const x = i / TREMOLO_SAMPLES
    const depth = 0.5 - Math.cos(x * TREMOLO_LOBES * 2 * Math.PI) / 2
    points.push({ x, level: 0.5 + (sign * depth) / 2 })
  }
  return points
}

/** The response curve rather than a waveform: a shelf with notches cut out of it. */
function phaserResponse(): GlyphPoint[] {
  const points: GlyphPoint[] = []
  for (let i = 0; i <= PHASER_SAMPLES; i++) {
    const x = i / PHASER_SAMPLES
    // Offset so the comb's peaks land inside the glyph rather than on its edges.
    const comb = 0.5 - Math.cos(x * PHASER_NOTCHES * 2 * Math.PI) / 2
    points.push({ x, level: PHASER_SHELF - PHASER_NOTCH_DEPTH * comb ** PHASER_NOTCH_SHARPNESS })
  }
  return points
}

function reverbTail(): GlyphPoint[] {
  const points: GlyphPoint[] = []
  for (let i = 0; i <= TAIL_SAMPLES; i++) {
    const x = i / TAIL_SAMPLES
    points.push({ x, level: 10 ** (-TAIL_DECADES * x) })
  }
  return points
}

/**
 * A run of points as a polyline across a `w` × `h` box, inset by `pad`. Shared
 * with the arpeggiator's glyphs, so every drawing in the pickers is laid into
 * its box by the same three lines of arithmetic.
 */
export function glyphPath(points: GlyphPoint[], w: number, h: number, pad = 0): string {
  const width = w - pad * 2
  const height = h - pad * 2
  const drawn = points.map(
    (point) => `${round(pad + point.x * width)} ${round(pad + (1 - point.level) * height)}`,
  )
  return `M ${drawn.join(' L ')}`
}

function round(value: number): number {
  return Number(value.toFixed(4))
}
