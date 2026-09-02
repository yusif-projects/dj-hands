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

/** A hand with a note beside it — the gestures, and what they make. */
export function HelpIcon() {
  return (
    <Glyph>
      <path d="M5.6 9.2V4.6a1.05 1.05 0 012.1 0V8.8" />
      <path d="M7.7 8.8V3.9a1.05 1.05 0 012.1 0V8.8" />
      <path d="M5.6 9.2V7.3a1.05 1.05 0 00-2.1 0v4.6a4.75 4.75 0 004.75 4.75h1.05a3 3 0 003-3V8.6a1.05 1.05 0 00-2.1 0" />
      <path d="M14.5 8.5V3l3 .9" />
      <circle cx={13.2} cy={8.6} r={1.3} />
    </Glyph>
  )
}

/** A camera — the eye the whole group is about. */
export function TrackingIcon() {
  return (
    <Glyph>
      <path d="M2.5 7.5a1.5 1.5 0 011.5-1.5h1.9l1.3-2h5.6l1.3 2H16a1.5 1.5 0 011.5 1.5v7A1.5 1.5 0 0116 16H4a1.5 1.5 0 01-1.5-1.5z" />
      <circle cx={10} cy={11} r={3} />
    </Glyph>
  )
}

/** A plain info mark — the group is credits rather than a control. */
export function AboutIcon() {
  return (
    <Glyph>
      <circle cx={10} cy={10} r={7.5} />
      <path d="M10 9v4.5" />
      <path d="M10 6.4v0.1" />
    </Glyph>
  )
}

/* ---- Key-cap glyphs ----
 * The gesture badges used to be Unicode characters — a fist emoji, an up-down
 * arrow, a rotation arrow — which meant three of the five badges were set in
 * whatever face the platform happened to have for them, at whatever weight, next
 * to two that were set in the app's own. These are the same three drawn on the
 * icon grid at cap-height scale, so a badge is the machine's silkscreen
 * throughout. `currentColor` again, so `.key.left` and `.key.right` reach them.
 */

const KEY_SIZE = 17

function KeyGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox={`0 0 ${KEY_SIZE} ${KEY_SIZE}`}
      width={KEY_SIZE}
      height={KEY_SIZE}
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

/**
 * A closed fist, seen from the back of the hand: the block of folded fingers,
 * three knuckle creases, and the thumb laid across the front. Drawn as a block
 * rather than as four articulated fingers because at 17px an articulated hand
 * is four indistinguishable bumps.
 */
export function FistIcon() {
  return (
    <KeyGlyph>
      <path d="M4 6.6a2 2 0 012-2h4.6a2.6 2.6 0 012.6 2.6v3.2a3.6 3.6 0 01-3.6 3.6H7.6A3.6 3.6 0 014 10.4z" />
      <path d="M6.7 4.7v3M9.2 4.6v3.1M11.6 5.1v2.6" />
      <path d="M4 9.4h9.2" />
    </KeyGlyph>
  )
}

/** Height: one shaft with a head at each end. */
export function RaiseIcon() {
  return (
    <KeyGlyph>
      <path d="M8 2.6v10.8" />
      <path d="M5.2 5.4L8 2.6l2.8 2.8" />
      <path d="M5.2 10.6L8 13.4l2.8-2.8" />
    </KeyGlyph>
  )
}

/** Rotation: three quarters of a circle closing on an arrowhead. */
export function RotateIcon() {
  return (
    <KeyGlyph>
      <path d="M13.1 8a5.1 5.1 0 11-1.9-3.97" />
      <path d="M13.4 2.2v2.9h-2.9" />
    </KeyGlyph>
  )
}
