import type { CSSProperties, KeyboardEvent } from 'react'
import { wrapIndex } from './pickerMath'

/** The box every glyph is drawn into, so the pickers stay the same size. */
export const PICKER_VIEW_W = 44
export const PICKER_VIEW_H = 22
/** Half the stroke width, so the peaks sit on the edge rather than over it. */
export const PICKER_PAD = 1.5

const KEY_STEPS: Record<string, number> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
}

export interface PickerOption<T extends string> {
  value: T
  /** Not on screen, so it has to be spoken and hoverable. */
  label: string
  /** The glyph's `d`, drawn into the box above. */
  path: string
}

interface Props<T extends string> {
  /** Names the group to a screen reader. */
  label: string
  value: T
  options: PickerOption<T>[]
  /** Which hand's accent marks the active button. */
  tone: 'left' | 'right'
  onChange: (value: T) => void
}

/**
 * A row of drawings you pick one of. The drawing is the whole button — a shape
 * says what it sounds like faster than its name does — so the name lives in the
 * tooltip and the accessible label.
 */
export function IconPicker<T extends string>({ label, value, options, tone, onChange }: Props<T>) {
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const steps = KEY_STEPS[e.key]
    if (steps === undefined) return
    e.preventDefault()
    const index = wrapIndex(
      options.findIndex((option) => option.value === value),
      steps,
      options.length,
    )
    const next = options[index]
    if (!next) return
    onChange(next.value)
    // Selection follows focus here, so the one tab stop has to travel with it.
    e.currentTarget.querySelectorAll<HTMLButtonElement>('button')[index]?.focus()
  }

  return (
    <div
      className={`icon-picker tone-${tone}`}
      // Drives the grid, so two pickers of different lengths share one rule.
      style={{ '--picker-cols': options.length } as CSSProperties}
      role="radiogroup"
      aria-label={label}
      onKeyDown={handleKeyDown}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          aria-label={option.label}
          title={option.label}
          className={option.value === value ? 'active' : ''}
          // One tab stop for the group; the arrow keys move within it.
          tabIndex={option.value === value ? 0 : -1}
          onClick={() => onChange(option.value)}
        >
          <svg viewBox={`0 0 ${PICKER_VIEW_W} ${PICKER_VIEW_H}`} aria-hidden="true">
            <path className="picker-glyph" d={option.path} />
          </svg>
        </button>
      ))}
    </div>
  )
}
