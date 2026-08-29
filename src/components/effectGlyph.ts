/** SVG outlines of the three effects. Pure, so the tests can stay DOM-free. */

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

/** A point with x 0→1 left to right and `level` 0→1 **upward**. */
interface GlyphPoint {
  x: number
  level: number
}

/**
 * The effect drawn across a `w` × `h` box, inset by `pad`. Several sub-paths
 * rather than one: chorus is two voices and delay is a row of separate repeats,
 * and a single path would have to jump between them.
 */
export function effectGlyphPaths(id: EffectId, w: number, h: number, pad = 0): string[] {
  const draw = (points: GlyphPoint[]) => toPath(points, w, h, pad)

  if (id === 'chorus') {
    return [draw(chorusVoice(0)), draw(chorusVoice(CHORUS_SPREAD))]
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

function reverbTail(): GlyphPoint[] {
  const points: GlyphPoint[] = []
  for (let i = 0; i <= TAIL_SAMPLES; i++) {
    const x = i / TAIL_SAMPLES
    points.push({ x, level: 10 ** (-TAIL_DECADES * x) })
  }
  return points
}

function toPath(points: GlyphPoint[], w: number, h: number, pad: number): string {
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
