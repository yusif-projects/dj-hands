import type { ChordName } from '../audio/chords'
import type { Preset } from '../audio/presets'
import type { LiveState } from '../vision/useHandTracking'

interface Props {
  live: LiveState
  chords: ChordName[]
  presets: Preset[]
}

export function Hud({ live, chords, presets }: Props) {
  const chord = live.leftGesture > 0 ? chords[live.leftGesture - 1] : null
  const preset = live.rightGesture > 0 ? presets[live.rightGesture - 1] : null

  return (
    <div className="hud">
      <div className={`hud-card left ${live.leftSeen ? 'seen' : ''}`}>
        <div className="hud-label">Left hand · chord</div>
        <div className="hud-value">{chord ?? '—'}</div>
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
        <div className="hud-label">Right hand · sound</div>
        <div className="hud-value">{preset?.name ?? '—'}</div>
        <div className="hud-sub">
          {live.rightSeen ? `${live.rightGesture} finger${live.rightGesture === 1 ? '' : 's'}` : 'not detected'}
        </div>
      </div>

      <div className="hud-fps">{Math.round(live.fps)} fps</div>
    </div>
  )
}
