import { formatChordSlot, resolveOctave, type ChordSlot } from '../audio/chords'
import { cutoffHz } from '../audio/SynthEngine'
import type { LiveState } from '../vision/useHandTracking'

interface Props {
  live: LiveState
  chordSlots: ChordSlot[]
  /** The live song section, already resolved through `sectionLabel`. */
  sectionName: string
  octave: number
  cutoffMin: number
  cutoffMax: number
}

export function Hud({ live, chordSlots, sectionName, octave, cutoffMin, cutoffMax }: Props) {
  const slot = live.leftGesture > 0 ? chordSlots[live.leftGesture - 1] : undefined
  const hz = Math.round(cutoffHz(live.cutoff, cutoffMin, cutoffMax))

  return (
    <div className="hud">
      <div className={`hud-card left ${live.leftSeen ? 'seen' : ''}`}>
        <div className="hud-label">Left hand · chord</div>
        <div className="hud-value">
          {slot ? `${formatChordSlot(slot)} · oct ${resolveOctave(octave, slot.octave)}` : '—'}
        </div>
        <div className="hud-sub">
          {live.leftSeen ? `${live.leftGesture} finger${live.leftGesture === 1 ? '' : 's'}` : 'not detected'}
        </div>
      </div>

      <div className="hud-volume">
        <div className="hud-label">Volume</div>
        <div className="meter">
          <div className="meter-fill" style={{ height: `${Math.round(live.volume * 100)}%` }} />
        </div>
        <div className="hud-sub">{Math.round(live.volume * 100)}%</div>
      </div>

      <div className={`hud-card right ${live.rightSeen ? 'seen' : ''}`}>
        <div className="hud-label">Right hand · filter</div>
        <div className="hud-value">{hz >= 1000 ? `${(hz / 1000).toFixed(1)} kHz` : `${hz} Hz`}</div>
        <div className="hud-sub">
          {/* The section holds when the hand is gone, so it is named either way. */}
          {live.rightSeen
            ? `${live.rightGesture} finger${live.rightGesture === 1 ? '' : 's'} · ${sectionName}`
            : sectionName}
        </div>
      </div>

      <div className="hud-fps">{Math.round(live.fps)} fps</div>
    </div>
  )
}
