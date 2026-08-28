import type { KeyboardEvent } from 'react'
import { WAVEFORMS } from '../audio/voice'
import type { WaveformName } from '../audio/voice'
import { nextWaveform, waveformPath } from './waveformPath'

const VIEW_W = 44
const VIEW_H = 22
// Half the stroke width, so the peaks sit on the edge rather than over it.
const PAD = 1.5

// The shapes never change, so they are drawn once for the module's lifetime.
const PATHS = Object.fromEntries(
  WAVEFORMS.map((w) => [w, waveformPath(w, VIEW_W, VIEW_H, PAD)]),
) as Record<WaveformName, string>

const KEY_STEPS: Record<string, number> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
}

interface Props {
  value: WaveformName
  onChange: (waveform: WaveformName) => void
}

export function WaveformPicker({ value, onChange }: Props) {
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const steps = KEY_STEPS[e.key]
    if (steps === undefined) return
    e.preventDefault()
    const next = nextWaveform(value, steps)
    onChange(next)
    // Selection follows focus here, so the one tab stop has to travel with it.
    e.currentTarget.querySelectorAll<HTMLButtonElement>('button')[WAVEFORMS.indexOf(next)]?.focus()
  }

  return (
    <div className="waveform-picker" role="radiogroup" aria-label="Waveform" onKeyDown={handleKeyDown}>
      {WAVEFORMS.map((w) => (
        <button
          key={w}
          type="button"
          role="radio"
          aria-checked={w === value}
          // The name is not on screen, so it has to be spoken and hoverable.
          aria-label={w}
          title={w}
          className={w === value ? 'active' : ''}
          // One tab stop for the group; the arrow keys move within it.
          tabIndex={w === value ? 0 : -1}
          onClick={() => onChange(w)}
        >
          <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} aria-hidden="true">
            <path className="wave-line" d={PATHS[w]} />
          </svg>
        </button>
      ))}
    </div>
  )
}
