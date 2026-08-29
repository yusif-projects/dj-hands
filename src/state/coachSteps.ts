/**
 * The first-run walkthrough, as data. Each step names a gesture and says how to
 * recognise it in the live tracking state, so `Coach` only has to time the hold
 * and render — the recognition itself stays pure and testable here.
 *
 * Four steps, deliberately: chord, chord change, release, volume. Rotation and
 * the section switch are named in the closing card and documented in the "How to
 * play" panel, because a walkthrough long enough to skip is the very problem
 * this replaces.
 */

import type { LiveState } from '../vision/useHandTracking'

/** How loud the right hand has to get before the volume step counts. */
const RAISED_VOLUME = 0.75

export interface CoachStep {
  id: string
  /** The instruction, with the gesture itself in `emphasis`. */
  prompt: string
  emphasis: string
  /** Which hand the step watches, for the card's accent colour. */
  hand: 'left' | 'right'
  satisfied(live: LiveState): boolean
}

export const COACH_STEPS: CoachStep[] = [
  // Volume leads, and not for narrative reasons: the engine starts at MIN_DB and
  // only leaves it once the right hand is in frame, so a chord played before
  // this step would be all but inaudible — and an instrument that makes no sound
  // on the first try is exactly what this walkthrough exists to prevent.
  {
    id: 'volume',
    prompt: 'towards the top of the frame. Its height is the volume, so start high.',
    emphasis: 'Raise your right hand',
    hand: 'right',
    // The volume holds where it was when the hand left, so the hand has to be in
    // frame for this to mean the person actually did it.
    satisfied: (live) => live.rightSeen && live.volume > RAISED_VOLUME,
  },
  {
    id: 'chord',
    prompt: 'on your left hand. That is a chord, and it rings while you hold it.',
    emphasis: 'Now hold up two fingers',
    hand: 'left',
    satisfied: (live) => live.leftSeen && live.leftGesture === 2,
  },
  {
    id: 'change',
    prompt: '— every count is a different chord.',
    emphasis: 'Three fingers',
    hand: 'left',
    satisfied: (live) => live.leftSeen && live.leftGesture === 3,
  },
  {
    id: 'release',
    prompt: 'to let the chord go.',
    emphasis: 'Make a fist',
    hand: 'left',
    satisfied: (live) => live.leftSeen && live.leftGesture === 0,
  },
]
