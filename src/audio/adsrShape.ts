/** The ADSR envelope as a drawable outline. Pure geometry, no rendering. */

import type { Voice } from './voice'

export type AdsrStage = 'attack' | 'decay' | 'sustain' | 'release'

export const ADSR_STAGES: AdsrStage[] = ['attack', 'decay', 'sustain', 'release']

/** A point in the unit box: x runs 0→1 left to right, y runs 0→1 **upward**. */
export interface ShapePoint {
  x: number
  y: number
}

export interface ShapeSegment {
  stage: AdsrStage
  from: ShapePoint
  to: ShapePoint
}

export interface EnvelopeShape {
  /** The five vertices, in time order. */
  points: ShapePoint[]
  /** The four segments between them, one per stage. */
  segments: ShapeSegment[]
}

// Sustain has no duration — it lasts as long as the chord is held — so a fixed
// plateau stands in for "held" and the three timed stages share what is left.
const SUSTAIN_HOLD = 0.28
const TIME_WIDTH = 1 - SUSTAIN_HOLD

// Every timed stage keeps at least this share of the time width, so a 5 ms
// attack beside a 4 s release still reads as an edge rather than a bare
// vertical line. Three stages, so it has to stay under a third.
const MIN_STAGE = 0.12

/**
 * Lays the envelope out across the unit box. The timed stages are proportional
 * to their seconds — a longer attack is always a wider ramp — but blended
 * against `MIN_STAGE` so none of them collapses to nothing.
 */
export function envelopeShape(voice: Voice): EnvelopeShape {
  const times = [voice.attack, voice.decay, voice.release]
  const total = times[0] + times[1] + times[2]
  const share = (t: number) =>
    total > 0
      ? TIME_WIDTH * (MIN_STAGE + (1 - 3 * MIN_STAGE) * (t / total))
      : TIME_WIDTH / 3

  const attackWidth = share(times[0])
  const decayWidth = share(times[1])
  const releaseWidth = share(times[2])
  const sustain = clamp01(voice.sustain)

  const peakX = attackWidth
  const sustainX = attackWidth + decayWidth
  const releaseX = sustainX + SUSTAIN_HOLD

  const points: ShapePoint[] = [
    { x: 0, y: 0 },
    { x: peakX, y: 1 },
    { x: sustainX, y: sustain },
    { x: releaseX, y: sustain },
    { x: releaseX + releaseWidth, y: 0 },
  ]

  const segments = ADSR_STAGES.map((stage, i) => ({
    stage,
    from: points[i],
    to: points[i + 1],
  }))

  return { points, segments }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}
