import { useRef } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import {
  KNOB_MAX_ANGLE,
  KNOB_MIN_ANGLE,
  arcPath,
  knobAngle,
  knobStep,
  knobDragValue,
  polarPoint,
} from './knobMath'
import type { AdsrStage } from '../audio/adsrShape'
import type { EffectId } from '../audio/effects'
import type { ControlRange } from '../audio/range'

/**
 * What the dial is coloured for. The tone is the only thing tying a knob to what
 * it edits — everything else is the same dial — and it resolves to nothing but a
 * `knob-<tone>` class, so the palette stays in one place in the stylesheet.
 */
export type KnobTone = AdsrStage | 'cutoff-min' | 'cutoff-max' | EffectId

const CX = 24
const CY = 24
const RING_R = 18
const POINTER_INNER = 6
const POINTER_OUTER = 13

// Arrow keys move one step, page keys ten — the same contract as the range
// inputs these replaced.
const KEY_STEPS: Record<string, number> = {
  ArrowUp: 1,
  ArrowRight: 1,
  ArrowDown: -1,
  ArrowLeft: -1,
  PageUp: 10,
  PageDown: -10,
}

const TRACK = arcPath(CX, CY, RING_R, KNOB_MIN_ANGLE, KNOB_MAX_ANGLE)

interface Props {
  label: string
  value: number
  range: ControlRange
  /** Where a double-click puts it back to. */
  reset: number
  format: (value: number) => string
  tone: KnobTone
  /** Off where the label is already on screen beside the dial; it stays spoken. */
  showLabel?: boolean
  onChange: (value: number) => void
}

export function Knob({
  label,
  value,
  range,
  reset,
  format,
  tone,
  showLabel = true,
  onChange,
}: Props) {
  const drag = useRef<{ y: number; value: number } | null>(null)
  const angle = knobAngle(value, range)
  const pointerFrom = polarPoint(CX, CY, POINTER_INNER, angle)
  const pointerTo = polarPoint(CX, CY, POINTER_OUTER, angle)

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    // Suppresses the text selection a drag would otherwise start; focus has to
    // be moved by hand once the default is gone.
    e.preventDefault()
    drag.current = { y: e.clientY, value }
    e.currentTarget.setPointerCapture(e.pointerId)
    e.currentTarget.focus()
  }

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const start = drag.current
    if (!start) return
    onChange(knobDragValue(start.value, start.y - e.clientY, range))
  }

  const handlePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    drag.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const steps = KEY_STEPS[e.key]
    if (steps !== undefined) {
      e.preventDefault()
      onChange(knobStep(value, steps, range))
    } else if (e.key === 'Home') {
      e.preventDefault()
      onChange(range.min)
    } else if (e.key === 'End') {
      e.preventDefault()
      onChange(range.max)
    }
  }

  return (
    <div className={`knob knob-${tone}`}>
      <div
        className="knob-dial"
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-orientation="vertical"
        aria-valuemin={range.min}
        aria-valuemax={range.max}
        aria-valuenow={value}
        aria-valuetext={format(value)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={() => onChange(reset)}
        onKeyDown={handleKeyDown}
      >
        <svg viewBox="0 0 48 48" aria-hidden="true">
          <circle className="knob-body" cx={CX} cy={CY} r={RING_R - 4} />
          <path className="knob-track" d={TRACK} />
          <path className="knob-fill" d={arcPath(CX, CY, RING_R, KNOB_MIN_ANGLE, angle)} />
          <line
            className="knob-pointer"
            x1={pointerFrom.x}
            y1={pointerFrom.y}
            x2={pointerTo.x}
            y2={pointerTo.y}
          />
        </svg>
      </div>
      {showLabel && <div className="knob-label">{label}</div>}
      <div className="knob-value">{format(value)}</div>
    </div>
  )
}
