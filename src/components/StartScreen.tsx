import { CHORDS, DEFAULT_CHORD_SLOTS } from '../audio/chords'
import { SECTION_COUNT } from '../audio/sections'
import { WAVEFORMS } from '../audio/voice'

/**
 * Rounded down to the ten below and marked `+`: the honest figure is a headline
 * only by accident, and "252" invites arithmetic where "250+" reads as plenty.
 * Still derived, so a new quality raises it instead of dating the claim.
 */
const CHORD_HEADLINE = `${Math.floor(CHORDS.length / 10) * 10}+`

/**
 * Counted from the source rather than written out, so adding a chord quality or
 * a waveform updates the pitch instead of quietly making it wrong.
 *
 * Not every tile is a number. A count is a boast when it is large and an
 * apology when it is small — four waveforms reads as a limit, so that tile
 * leads with what the synth *is* and keeps the count as supporting detail.
 */
const STATS: { value: string; text?: boolean; label: string; sub: string }[] = [
  {
    value: CHORD_HEADLINE,
    label: 'chords',
    sub: '12 roots, 21 qualities, every inversion',
  },
  {
    value: String(SECTION_COUNT * DEFAULT_CHORD_SLOTS.length),
    label: 'on tap',
    sub: `${SECTION_COUNT} sections × ${DEFAULT_CHORD_SLOTS.length} fingers, switched mid-song`,
  },
  {
    value: 'ADSR',
    text: true,
    label: 'real synth',
    sub: `${WAVEFORMS.length} waveforms, lowpass, reverb + delay`,
  },
  {
    value: '0',
    label: 'to install',
    sub: 'no signup, no MIDI gear, no upload',
  },
]

interface Props {
  onStart: () => void
  loading: boolean
  error: string | null
}

export function StartScreen({ onStart, loading, error }: Props) {
  return (
    <div className="start-screen">
      <div className="start-card">
        <h1>DJ Hands</h1>
        <p className="start-tagline">
          Play chords in the air, in front of your webcam. Your left hand picks the chord, your
          right hand shapes it.
        </p>

        {/* Split by hand and coloured with the same two tokens the overlay draws
            hands in, so the colour code is already learned by the time the
            camera is on. A glance, not a list — the walkthrough does the
            teaching, and the section switch waits in "How to play". */}
        <div className="start-hands">
          <div className="hand-group left">
            <span className="hand-name">Left hand</span>
            <ul>
              <li>
                <span className="key left">1–5</span> chord
              </li>
              <li>
                <span className="key left">✊</span> silence
              </li>
            </ul>
          </div>
          <div className="hand-group right">
            <span className="hand-name">Right hand</span>
            <ul>
              <li>
                <span className="key right">↕</span> volume
              </li>
              <li>
                <span className="key right">↻</span> filter
              </li>
            </ul>
          </div>
        </div>

        <ul className="start-stats">
          {STATS.map((stat) => (
            <li key={stat.label}>
              <span className={`stat-value ${stat.text ? 'text' : ''}`}>{stat.value}</span>
              <span className="stat-label">{stat.label}</span>
              <span className="stat-sub">{stat.sub}</span>
            </li>
          ))}
        </ul>

        <p className="start-pitch">Not a toy — a synth you actually build:</p>
        <ul className="start-points">
          <li>
            <strong>Shape the voice.</strong> Four waveforms, and an ADSR envelope you draw by hand.
          </li>
          <li>
            <strong>Play the filter.</strong> Turning your palm sweeps the lowpass, live.
          </li>
          <li>
            <strong>Drench it.</strong> Reverb, delay, or both — at whatever depth you like.
          </li>
          <li>
            <strong>Rewrite every chord.</strong> Inversions, slash bass, an octave shift per
            finger.
          </li>
          <li>
            <strong>Keep it.</strong> Everything saves as you go, so the instrument you built is the
            one waiting next time.
          </li>
        </ul>

        <button className="primary" onClick={onStart} disabled={loading}>
          {loading ? 'Starting…' : 'Start camera & audio'}
        </button>
        {error && <p className="error">{error}</p>}
        <p className="fine-print">
          Needs webcam permission. Video is processed entirely on your device — nothing is uploaded.
        </p>
        <p className="fine-print credit">
          Inspired by{' '}
          <a href="https://gesture-synth-weld.vercel.app" target="_blank" rel="noreferrer">
            gesture-synth
          </a>{' '}
          — respect to the original.
        </p>
        <p className="fine-print credit">
          Built by{' '}
          <a href="https://www.linkedin.com/in/yusif-programmer/" target="_blank" rel="noreferrer">
            Yusif Aliyev
          </a>{' '}
          · Music as{' '}
          <a href="https://www.joeinthestudio.com" target="_blank" rel="noreferrer">
            Joe in the Studio
          </a>
        </p>
      </div>
    </div>
  )
}
