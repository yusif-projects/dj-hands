/**
 * SVG outlines of the five arpeggiator patterns. Pure, so the tests can stay
 * DOM-free — and drawn from `arpSequence` itself rather than from five hand-drawn
 * shapes, so a pattern whose order changes changes its own picture.
 */

import { arpSequence, type ArpPattern } from '../audio/arp'
import { glyphPath, type GlyphPoint } from './effectGlyph'

/**
 * The chord the glyphs walk. Three notes is the smallest set that tells the
 * patterns apart — two would draw `updown` and `up` identically — and the names
 * are only ever used to index back into the up order, never sounded.
 */
const GLYPH_CHORD = ['C1', 'E1', 'G1']

/**
 * `random` has no order to draw, so it gets one: a scatter that visits every
 * level without ever climbing twice, which is what the pattern sounds like.
 * Illustrative rather than sampled — a real draw would give a different picture
 * on every render.
 */
const RANDOM_LEVELS = [0.5, 1, 0, 0.5]

/**
 * One pattern across a `w` × `h` box, inset by `pad`, as a staircase: each step
 * is a flat run at its note's height, and the jump between two of them falls out
 * of the x they share. Steps rather than a line because that is what is heard —
 * distinct notes, not a glide between them.
 */
export function arpGlyphPath(pattern: ArpPattern, w: number, h: number, pad = 0): string {
  return glyphPath(staircase(levels(pattern)), w, h, pad)
}

/** Each step's height, 0 at the chord's lowest note and 1 at its highest. */
function levels(pattern: ArpPattern): number[] {
  if (pattern === 'random') return RANDOM_LEVELS
  const top = GLYPH_CHORD.length - 1
  return arpSequence(GLYPH_CHORD, pattern).map((note) => GLYPH_CHORD.indexOf(note) / top)
}

function staircase(steps: number[]): GlyphPoint[] {
  const points: GlyphPoint[] = []
  steps.forEach((level, step) => {
    points.push({ x: step / steps.length, level }, { x: (step + 1) / steps.length, level })
  })
  return points
}
