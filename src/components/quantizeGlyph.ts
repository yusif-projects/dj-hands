/**
 * SVG outlines of the four quantization grids. Pure, so the tests can stay
 * DOM-free — and derived from `QUANTIZE_BEATS` rather than drawn four times by
 * hand, so a grid whose length changes changes its own picture.
 */

import { BEATS_PER_BAR, QUANTIZE_BEATS, type QuantizeMode } from '../audio/clock'
import { glyphPath } from './effectGlyph'

/** How tall a grid mark stands off the bar; the downbeat's takes the full box. */
const MARK_HEIGHT = 0.6

/**
 * One grid across a `w` × `h` box, inset by `pad`: a bar line with a mark at
 * every point a chord change can land on, one bar's worth.
 *
 * The first mark is drawn full height and the rest short, the same way the meter
 * bridge lights the downbeat green and the other beats white — so the picture
 * and the lamps say the same thing about where a bar begins. `off` has no marks
 * at all, which is what free play is: the bar with nothing to land on.
 */
export function quantizeGlyphPath(mode: QuantizeMode, w: number, h: number, pad = 0): string {
  const bar = glyphPath(
    [
      { x: 0, level: 0 },
      { x: 1, level: 0 },
    ],
    w,
    h,
    pad,
  )
  return [bar, ...marks(mode).map((mark) => glyphPath(mark, w, h, pad))].join(' ')
}

/** Where the marks fall across the bar, as a sub-path each. */
function marks(mode: QuantizeMode) {
  const beats = QUANTIZE_BEATS[mode]
  if (beats <= 0) return []
  const drawn = []
  for (let beat = 0; beat < BEATS_PER_BAR; beat += beats) {
    const x = beat / BEATS_PER_BAR
    drawn.push([
      { x, level: 0 },
      { x, level: beat === 0 ? 1 : MARK_HEIGHT },
    ])
  }
  return drawn
}
