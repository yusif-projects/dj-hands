import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { InfoIcon } from './icons'

interface Props {
  /**
   * What the button is *for*, spoken to a screen reader — "About oscillator 2",
   * not the hint itself. The hint is the bubble's own text, which is why it is
   * real markup rather than a `title`: `title` is unstyled, unreachable by
   * touch, and read out as one long string.
   */
  label: string
  children: React.ReactNode
}

/**
 * A circled `i` that keeps a paragraph of explanation next to the control it
 * explains without spending the panel's height on it. The Sound group had three
 * of them stacked, which pushed the knobs people came for below the fold.
 *
 * Shown on hover for a mouse, and on a tap or a keypress for everything else —
 * a phone has no hover at all, so a bubble that only answered `:hover` would be
 * text nobody on a phone could ever read. The two are one piece of state rather
 * than a CSS `:hover` rule beside a React one, so there is a single answer to
 * "is it open?" for the placement below to measure against.
 */
export function InfoTip({ label, children }: Props) {
  const id = useId()
  const button = useRef<HTMLButtonElement>(null)
  const bubble = useRef<HTMLSpanElement>(null)
  // Held open by a click, so it survives the pointer leaving — and so a tap has
  // something to toggle. Hover is the transient half.
  const [held, setHeld] = useState(false)
  const [hovered, setHovered] = useState(false)
  // Dropped above the icon instead of below it when the panel has no room left
  // underneath, which is where the last group's hints sit.
  const [above, setAbove] = useState(false)
  const open = held || hovered

  const close = useCallback(() => {
    setHeld(false)
    setHovered(false)
  }, [])

  useLayoutEffect(() => {
    if (!open || !button.current || !bubble.current) return
    const scroller = button.current.closest('.settings-body')
    if (!scroller) return
    const room = scroller.getBoundingClientRect().bottom - button.current.getBoundingClientRect().bottom
    // Only when it would otherwise be cut off *and* there is more room the
    // other way: flipping a bubble that is short of space in both directions
    // just moves the problem.
    const height = bubble.current.offsetHeight
    const overhead = button.current.getBoundingClientRect().top - scroller.getBoundingClientRect().top
    setAbove(room < height + 12 && overhead > room)
  }, [open, children])

  useEffect(() => {
    if (!held) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // Escape closes the whole rack. With a bubble open it means "not that",
      // so this takes the key rather than letting it reach App's listener —
      // `document` is under `window` in the bubble path, so stopping here is
      // enough. Same bargain the song strip's confirmation strikes.
      e.stopPropagation()
      close()
      // Back to the button rather than nowhere: Escape should not cost a
      // keyboard user their place in the panel.
      button.current?.focus()
    }
    // `pointerdown` rather than `click`, so the bubble is gone by the time the
    // control underneath it takes the press.
    const onDown = (e: PointerEvent) => {
      if (!button.current?.parentElement?.contains(e.target as Node)) close()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [held, close])

  return (
    <span
      className="infotip"
      // Mouse only. A touch "hover" fires on the tap that is already toggling
      // the bubble, and its `leave` may never come at all.
      onPointerEnter={(e) => e.pointerType === 'mouse' && setHovered(true)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && setHovered(false)}
    >
      <button
        ref={button}
        type="button"
        className={`infotip-button${open ? ' open' : ''}`}
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setHeld((was) => !was)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
      >
        <InfoIcon />
      </button>
      {/* Rendered either way and hidden by `hidden`, so it is out of the
          accessibility tree while closed rather than merely invisible — and so
          the placement above has something to measure the moment it opens. */}
      <span
        ref={bubble}
        id={id}
        role="note"
        className={`infotip-bubble${above ? ' above' : ''}`}
        hidden={!open}
      >
        {children}
      </span>
    </span>
  )
}
