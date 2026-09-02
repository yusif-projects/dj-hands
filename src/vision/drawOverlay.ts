import type { Point } from './fingerCount'

/** Bone pairs of the 21-point hand skeleton. */
const CONNECTIONS: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
]

/** Landmarks bounding the palm; their mean is where a chord bloom is centred. */
const PALM = [0, 5, 17]

/* The two hand inks, as the overlay's own hue. These are `--left` and `--right`
   from the stylesheet: the code a player learns on the start card is the code
   drawn on their own knuckles, so the two definitions move together or the
   product has two vocabularies. */
export const LEFT_HUE = 203
export const RIGHT_HUE = 34

/** Stroke and joint size at silence; the reactive path adds on top of these. */
const BASE_LINE_WIDTH = 3
const BASE_JOINT_RADIUS = 4
const LEVEL_LINE_WIDTH = 3
const LEVEL_JOINT_RADIUS = 4
const LEVEL_GLOW = 74

/* The panel inks are painted, not neon. Stroking the skeleton at full
   saturation put a third, brighter pair of blues and ambers into a product whose
   whole colour law is that each ink means one thing; 78 is where the stroke
   still reads over a moving camera feed and still matches the panel. */
const BASE_SATURATION = 78

/** How far a closed filter pulls the colour down in saturation and lightness. */
const CUTOFF_SATURATION_DROP = 45
const CUTOFF_LIGHTNESS_DROP = 30
/** How far a loud signal lifts it back up, on top of whatever the cutoff left. */
const LEVEL_LIGHTNESS_LIFT = 18

const BLOOM_RADIUS = 0.3
const BLOOM_RING_SPACING = 0.1
const BLOOM_LINE_WIDTH = 3

/** How the skeleton is painted for one hand on one frame. */
export interface HandStyle {
  hue: number
  /** Audio level, 0-1: drives glow, stroke width and joint size. */
  level: number
  /** Filter sweep position, 0-1: drives colour temperature. */
  cutoff: number
}

/** The neutral style — what a hand looks like in silence, or with the toggle off. */
export function neutralStyle(hue: number): HandStyle {
  return { hue, level: 0, cutoff: 1 }
}

/**
 * Colour for a hand at a given brightness and loudness. A closed filter reads as
 * dark and desaturated, an open one as the full base colour; level lifts the
 * lightness on top. At `cutoff: 1, level: 0` this returns the base colour
 * exactly, which is what makes the reactive path collapse to the plain one.
 */
export function handColor(hue: number, cutoff: number, level: number, alpha = 1): string {
  const c = clamp01(cutoff)
  const l = clamp01(level)
  const saturation = BASE_SATURATION - (1 - c) * CUTOFF_SATURATION_DROP
  const lightness = 65 - (1 - c) * CUTOFF_LIGHTNESS_DROP + l * LEVEL_LIGHTNESS_LIFT
  const suffix = alpha >= 1 ? '' : ` / ${alpha}`
  return `hsl(${hue} ${round(saturation)}% ${round(lightness)}%${suffix})`
}

export const LEFT_COLOR = handColor(LEFT_HUE, 1, 0)
export const RIGHT_COLOR = handColor(RIGHT_HUE, 1, 0)

/**
 * Asymmetric one-pole follower. Rises fast and falls slow, so an attack snaps
 * and a release glides; a symmetric filter fast enough to catch the attack also
 * makes the tail flicker.
 */
export function followLevel(
  current: number,
  target: number,
  attack: number,
  release: number,
): number {
  const rate = target > current ? attack : release
  return current + (target - current) * clamp01(rate)
}

/** 0-1 through a bloom's life, or `null` once it has finished (or never started). */
export function bloomProgress(now: number, startedAt: number, duration: number): number | null {
  if (startedAt <= 0 || duration <= 0) return null
  const elapsed = now - startedAt
  if (elapsed < 0 || elapsed >= duration) return null
  return elapsed / duration
}

export function clearOverlay(ctx: CanvasRenderingContext2D) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
}

/**
 * Draws one hand's skeleton. Landmarks are normalized 0-1 in frame space.
 *
 * The skeleton is one stroke and all 21 joints are one fill, because canvas
 * applies the shadow per draw call: batching keeps the glow to two shadowed
 * calls per hand instead of twenty-two.
 */
export function drawHand(ctx: CanvasRenderingContext2D, landmarks: Point[], style: HandStyle) {
  const { width: w, height: h } = ctx.canvas
  const level = clamp01(style.level)
  const color = handColor(style.hue, style.cutoff, level)

  ctx.save()
  ctx.shadowBlur = level * LEVEL_GLOW
  ctx.shadowColor = color

  ctx.lineWidth = BASE_LINE_WIDTH + level * LEVEL_LINE_WIDTH
  ctx.strokeStyle = color
  ctx.beginPath()
  for (const [a, b] of CONNECTIONS) {
    ctx.moveTo(landmarks[a].x * w, landmarks[a].y * h)
    ctx.lineTo(landmarks[b].x * w, landmarks[b].y * h)
  }
  ctx.stroke()

  const radius = BASE_JOINT_RADIUS + level * LEVEL_JOINT_RADIUS
  ctx.fillStyle = color
  ctx.beginPath()
  for (const p of landmarks) {
    const x = p.x * w
    const y = p.y * h
    // Without this the arcs are joined by a line back to the previous one.
    ctx.moveTo(x + radius, y)
    ctx.arc(x, y, radius, 0, Math.PI * 2)
  }
  ctx.fill()

  ctx.restore()
}

/**
 * Expanding rings from the palm on a chord change, one per selected slot — so
 * the gesture that was recognised is visible without reading the HUD.
 */
export function drawChordBloom(
  ctx: CanvasRenderingContext2D,
  landmarks: Point[],
  rings: number,
  progress: number,
  hue: number,
) {
  if (rings <= 0) return
  const { width: w, height: h } = ctx.canvas
  // Rings are sized off the smaller axis so they stay circular on any aspect.
  const scale = Math.min(w, h)

  let cx = 0
  let cy = 0
  for (const i of PALM) {
    cx += landmarks[i].x * w
    cy += landmarks[i].y * h
  }
  cx /= PALM.length
  cy /= PALM.length

  const alpha = 1 - progress
  const color = handColor(hue, 1, 0, alpha)
  ctx.save()
  ctx.lineWidth = BLOOM_LINE_WIDTH
  ctx.strokeStyle = color
  ctx.shadowBlur = alpha * LEVEL_GLOW
  ctx.shadowColor = color
  for (let i = 0; i < rings; i++) {
    // Each ring trails the one before it, so the count is countable.
    const radius = scale * progress * (BLOOM_RADIUS - i * BLOOM_RING_SPACING)
    if (radius <= 0) continue
    ctx.beginPath()
    ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()
}

/** Horizontal guides showing where the volume range tops out and bottoms out. */
export function drawVolumeGuides(ctx: CanvasRenderingContext2D, top: number, bottom: number) {
  const { width: w, height: h } = ctx.canvas
  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'
  ctx.lineWidth = 1
  ctx.setLineDash([8, 8])
  for (const y of [top, bottom]) {
    ctx.beginPath()
    ctx.moveTo(0, y * h)
    ctx.lineTo(w, y * h)
    ctx.stroke()
  }
  ctx.restore()
}

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v))
}

function round(v: number) {
  return Math.round(v * 10) / 10
}
