import type { CSSProperties } from 'react'
import {
  formatChordSlot,
  formatSlotNotes,
  resolveOctave,
  type Accidental,
  type ChordSlot,
} from '../audio/chords'
import type { FilterType } from '../audio/filter'
import { cutoffHz } from '../audio/SynthEngine'
import type { LiveState } from '../vision/useHandTracking'
import { FILTER_ABBREV, HUD_SEGMENTS, formatCutoff, litSegments } from './hudMeter'
import { KNOB_MAX_ANGLE, KNOB_MIN_ANGLE, KNOB_SWEEP, arcPath } from './knobMath'

// The arc borrows the panel knobs' 270° sweep and bottom dead zone, so the two
// read as the same control in two places rather than as two different dials.
const ARC_BOX = 40
const ARC_CENTRE = ARC_BOX / 2
const ARC_RADIUS = 15

const ARC_TRACK = arcPath(ARC_CENTRE, ARC_CENTRE, ARC_RADIUS, KNOB_MIN_ANGLE, KNOB_MAX_ANGLE)

const SEGMENTS = Array.from({ length: HUD_SEGMENTS }, (_, i) => i)

interface Props {
  live: LiveState
  chordSlots: ChordSlot[]
  /** The live song section, already resolved through `sectionLabel`. */
  sectionName: string
  octave: number
  /** How black keys are named in the chord readout. */
  accidental: Accidental
  /** Named beside the cutoff, which does not say by itself what it is doing. */
  filterType: FilterType
  cutoffMin: number
  cutoffMax: number
}

export function Hud({
  live,
  chordSlots,
  sectionName,
  octave,
  accidental,
  filterType,
  cutoffMin,
  cutoffMax,
}: Props) {
  const slot = live.leftGesture > 0 ? chordSlots[live.leftGesture - 1] : undefined
  const hz = cutoffHz(live.cutoff, cutoffMin, cutoffMax)
  const lit = litSegments(live.volume)

  return (
    <div className="hud">
      <div className="hud-frame">
        <div className="hud-fps">{Math.round(live.fps)} fps</div>

        <div className="hud-bar">
          {/* A pad lighting up is the finger count — the row is in gesture
              order, so there is nothing left to spell out in words. */}
          <div className={`hud-zone pads ${live.leftSeen ? '' : 'idle'}`}>
            <div className="pad-row">
              {chordSlots.map((each, i) => (
                <div key={i} className={`pad ${live.leftGesture === i + 1 ? 'on' : ''}`}>
                  <span className="pad-n">{i + 1}</span>
                  <span className="pad-chord">{formatChordSlot(each, accidental)}</span>
                </div>
              ))}
            </div>
            <div className="pad-foot">
              {/* The line keeps its height empty-handed, so opening and closing
                  the left hand never resizes the bar. */}
              <span className="pad-notes">
                {slot ? formatSlotNotes(slot, octave, accidental).join(' · ') : ''}
              </span>
              <span className="pad-oct">oct {resolveOctave(octave, slot?.octave)}</span>
            </div>
          </div>

          <div className="hud-section">{sectionName}</div>

          <div className={`hud-zone shape ${live.rightSeen ? '' : 'idle'}`}>
            <svg className="hud-arc" viewBox={`0 0 ${ARC_BOX} ${ARC_BOX}`} aria-hidden="true">
              <path className="arc-track" d={ARC_TRACK} />
              <path
                className="arc-fill"
                d={arcPath(
                  ARC_CENTRE,
                  ARC_CENTRE,
                  ARC_RADIUS,
                  KNOB_MIN_ANGLE,
                  KNOB_MIN_ANGLE + live.cutoff * KNOB_SWEEP,
                )}
              />
            </svg>

            <div className="shape-read">
              <span className="hud-filter">
                <span className="filter-kind">{FILTER_ABBREV[filterType]}</span>
                <span className="filter-hz">{formatCutoff(hz)}</span>
              </span>
              {/* Segments follow the gesture; the glow follows the measured
                  audio, so it keeps ringing through the release and the tail
                  after the chord is dropped. */}
              <div className="fader" style={{ '--level': live.level } as CSSProperties}>
                {SEGMENTS.map((i) => (
                  <span key={i} className={`seg ${i < lit ? 'on' : ''}`} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
