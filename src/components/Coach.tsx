/**
 * The first-run walkthrough. Instructions on the start screen ask someone to
 * read about a physical skill before they have heard a note; these ask for the
 * gesture instead, and watch the tracking state until it arrives. Every step
 * completes itself by being performed, so the only way past it is to play.
 */

import { useEffect, useRef, useState } from 'react'
import { track } from '../analytics'
import { COACH_STEPS } from '../state/coachSteps'
import type { LiveState } from '../vision/useHandTracking'

/**
 * How long a gesture has to hold before it counts. `live` publishes every 100 ms,
 * so this is four samples — enough that a shape passed through on the way to
 * another one does not tick the step off.
 */
const COACH_HOLD_MS = 400

/**
 * How long a step may stall before offering the swap-hands hint. Only the
 * seeing-one-hand-but-the-wrong-one case gets it, which is exactly the symptom
 * of a camera that mirrors in hardware and hands us an already-flipped frame.
 */
const COACH_STUCK_MS = 12000

interface Props {
  live: LiveState
  /** Called when the walkthrough is finished or skipped; App stores the flag. */
  onDone: () => void
}

export function Coach({ live, onDone }: Props) {
  // Equal to COACH_STEPS.length once every step is done: the closing card.
  const [index, setIndex] = useState(0)
  const [stuck, setStuck] = useState(false)
  const heldSince = useRef(0)
  // Stamped from inside the effect: the clock is not readable during render. The
  // index it was stamped for is what tells the effect a new step has begun.
  const stepAt = useRef({ index: -1, at: 0 })

  const step = COACH_STEPS[index]
  const holding = step ? step.satisfied(live) : false

  useEffect(() => {
    const current = COACH_STEPS[index]
    if (!current) return
    const now = performance.now()
    if (stepAt.current.index !== index) {
      stepAt.current = { index, at: now }
      setStuck(false)
    }

    // One hand in frame, and it is the other one: the hardware-mirrored camera.
    // Latched for the rest of the step, since the moment itself passes.
    const wanted = current.hand === 'left' ? live.leftSeen : live.rightSeen
    const other = current.hand === 'left' ? live.rightSeen : live.leftSeen
    if (!wanted && other && now - stepAt.current.at > COACH_STUCK_MS) setStuck(true)

    if (!current.satisfied(live)) {
      heldSince.current = 0
      return
    }
    if (!heldSince.current) {
      heldSince.current = now
      return
    }
    if (now - heldSince.current < COACH_HOLD_MS) return

    heldSince.current = 0
    track('coach_step_done', { step: current.id })
    if (index + 1 === COACH_STEPS.length) track('coach_completed')
    setIndex(index + 1)
  }, [live, index])

  const skip = () => {
    track('coach_skipped', { step: step?.id ?? 'done' })
    onDone()
  }

  if (!step) {
    return (
      <div className="coach done" role="status">
        <p className="coach-prompt">
          <strong>That is the whole instrument.</strong> Two more to find on your own: turn your
          right palm to sweep the filter, and hold up fingers on your right hand to switch song
          section.
        </p>
        <div className="coach-foot">
          <span className="coach-note">How to play lives in the rail, any time.</span>
          <button type="button" className="coach-go" onClick={onDone}>
            Start playing
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`coach hand-${step.hand}`}>
      <div className="coach-dots" aria-hidden="true">
        {COACH_STEPS.map((s, i) => (
          <span key={s.id} className={`coach-dot ${i < index ? 'done' : ''} ${i === index ? 'now' : ''}`} />
        ))}
      </div>

      <p className="coach-prompt" role="status" aria-live="polite">
        <strong>{step.emphasis}</strong> {step.prompt}
      </p>

      {stuck && (
        <p className="coach-stuck">
          Your other hand is the one being tracked. Some cameras mirror in hardware — turn on{' '}
          <strong>Swap hands</strong> under Tracking.
        </p>
      )}

      <div className="coach-foot">
        <span className={`coach-state ${holding ? 'holding' : ''}`}>
          {holding ? 'Got it — hold…' : `Step ${index + 1} of ${COACH_STEPS.length}`}
        </span>
        <button type="button" className="coach-skip" onClick={skip}>
          Skip
        </button>
      </div>
    </div>
  )
}
