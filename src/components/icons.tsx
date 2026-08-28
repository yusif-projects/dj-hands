/**
 * One line-art glyph per settings group, drawn in-repo the way the rest of the
 * app's SVG is (`waveformPath`, `AdsrGraph`, `Knob`) rather than pulled from an
 * icon package. Every glyph strokes in `currentColor`, so the rail button's
 * hover and active colours reach the icon without a rule of their own.
 */

import type { SVGProps } from 'react'
import { waveformPath } from './waveformPath'

const SIZE = 20

function Glyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      width={SIZE}
      height={SIZE}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    />
  )
}

/** Three white keys with two black ones sitting between them. */
export function ChordsIcon() {
  return (
    <Glyph>
      <rect x={2.5} y={5} width={15} height={10} rx={1.5} />
      <path d="M7.5 5v10M12.5 5v10" />
      <path d="M6.4 5h2.2v5.5H6.4zM11.4 5h2.2v5.5h-2.2z" fill="currentColor" stroke="none" />
    </Glyph>
  )
}

/**
 * The same two-cycle sine the waveform buttons inside this group draw, so the
 * icon and the controls it opens are literally the same curve. Drawn into a
 * short box and dropped to the middle: `waveformPath` pads both axes equally,
 * and a full-height sine reads as a zigzag at this size.
 */
export function SoundIcon() {
  return (
    <Glyph>
      <g transform="translate(0 4)">
        <path d={waveformPath('sine', SIZE, 12, 1)} />
      </g>
    </Glyph>
  )
}

/** A lowpass response: flat, then a knee falling away to the right. */
export function FilterIcon() {
  return (
    <Glyph>
      <path d="M2.5 6.5H10c3 0 3.5 2.5 4 4.5s1.5 3 3.5 3" />
    </Glyph>
  )
}

/** A source with three arcs coming off it — a send going out to a tail. */
export function EffectsIcon() {
  return (
    <Glyph>
      <circle cx={4.5} cy={10} r={1.25} fill="currentColor" stroke="none" />
      <path d="M8.5 6a5 5 0 010 8M11.75 3.75a8.5 8.5 0 010 12.5M15 1.75a12 12 0 010 16.5" />
    </Glyph>
  )
}

/** A speaker with two arcs — the loud end of the range. */
export function VolumeIcon() {
  return (
    <Glyph>
      <path d="M3 7.75h2.5L9 4.5v11L5.5 12.25H3z" />
      <path d="M12 7.5a3.5 3.5 0 010 5M14.5 5a7 7 0 010 10" />
    </Glyph>
  )
}

/** An open hand — what the camera is looking for. */
export function TrackingIcon() {
  return (
    <Glyph>
      <path d="M7.2 9.5V4.4a1.15 1.15 0 012.3 0V9" />
      <path d="M9.5 9V3.6a1.15 1.15 0 012.3 0V9" />
      <path d="M11.8 9V4.6a1.15 1.15 0 012.3 0V11" />
      <path d="M7.2 9.5V7.4a1.15 1.15 0 00-2.3 0v5.1a5.2 5.2 0 005.2 5.2h1.7a3.3 3.3 0 003.3-3.3V11" />
    </Glyph>
  )
}
