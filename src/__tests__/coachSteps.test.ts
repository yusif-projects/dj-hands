import { describe, expect, it } from 'vitest'
import { COACH_STEPS } from '../state/coachSteps'
import type { LiveState } from '../vision/useHandTracking'

function live(partial: Partial<LiveState> = {}): LiveState {
  return {
    leftGesture: 0,
    rightGesture: 0,
    leftSeen: false,
    rightSeen: false,
    volume: 0,
    cutoff: 1,
    level: 0,
    fps: 60,
    ...partial,
  }
}

const step = (id: string) => {
  const found = COACH_STEPS.find((s) => s.id === id)
  if (!found) throw new Error(`no step ${id}`)
  return found
}

describe('COACH_STEPS', () => {
  // Volume first: the engine sits at MIN_DB until the right hand is in frame, so
  // a chord asked for before it would be all but inaudible.
  it('walks volume, chord, chord change, release', () => {
    expect(COACH_STEPS.map((s) => s.id)).toEqual(['volume', 'chord', 'change', 'release'])
  })

  it('gives every step a prompt and a hand', () => {
    for (const s of COACH_STEPS) {
      expect(s.emphasis).toBeTruthy()
      expect(s.prompt).toBeTruthy()
      expect(['left', 'right']).toContain(s.hand)
    }
  })
})

describe('the chord step', () => {
  it('takes two fingers on the left hand', () => {
    expect(step('chord').satisfied(live({ leftSeen: true, leftGesture: 2 }))).toBe(true)
  })

  it('does not take a neighbouring count', () => {
    expect(step('chord').satisfied(live({ leftSeen: true, leftGesture: 1 }))).toBe(false)
    expect(step('chord').satisfied(live({ leftSeen: true, leftGesture: 3 }))).toBe(false)
  })

  // The gesture holds for a grace period after the hand leaves the frame, so the
  // count alone is not evidence that anyone is doing anything.
  it('does not take a stale count from a hand that is gone', () => {
    expect(step('chord').satisfied(live({ leftSeen: false, leftGesture: 2 }))).toBe(false)
  })

  it('ignores the right hand', () => {
    expect(step('chord').satisfied(live({ rightSeen: true, rightGesture: 2 }))).toBe(false)
  })
})

describe('the chord-change step', () => {
  it('takes three fingers on the left hand', () => {
    expect(step('change').satisfied(live({ leftSeen: true, leftGesture: 3 }))).toBe(true)
  })

  it('does not take the two fingers the previous step asked for', () => {
    expect(step('change').satisfied(live({ leftSeen: true, leftGesture: 2 }))).toBe(false)
  })

  it('does not take a stale count from a hand that is gone', () => {
    expect(step('change').satisfied(live({ leftSeen: false, leftGesture: 3 }))).toBe(false)
  })
})

describe('the release step', () => {
  it('takes a fist on the left hand', () => {
    expect(step('release').satisfied(live({ leftSeen: true, leftGesture: 0 }))).toBe(true)
  })

  it('does not take any raised finger', () => {
    for (const count of [1, 2, 3, 4, 5]) {
      expect(step('release').satisfied(live({ leftSeen: true, leftGesture: count }))).toBe(false)
    }
  })

  // Zero is also what a hand out of frame reads as, which would complete the
  // step for someone who simply lowered their hand.
  it('does not take a hand that has left the frame', () => {
    expect(step('release').satisfied(live({ leftSeen: false, leftGesture: 0 }))).toBe(false)
  })
})

describe('the volume step', () => {
  it('takes a raised right hand', () => {
    expect(step('volume').satisfied(live({ rightSeen: true, volume: 0.9 }))).toBe(true)
  })

  it('does not take a low one', () => {
    expect(step('volume').satisfied(live({ rightSeen: true, volume: 0.5 }))).toBe(false)
  })

  // Volume holds where it was when the hand left, so it can already be high.
  it('does not take a held volume with no hand in frame', () => {
    expect(step('volume').satisfied(live({ rightSeen: false, volume: 1 }))).toBe(false)
  })

  it('ignores the left hand', () => {
    expect(step('volume').satisfied(live({ leftSeen: true, leftGesture: 5, volume: 1 }))).toBe(false)
  })
})
