import { track } from '../analytics'
import { COFFEE_URL } from '../links'

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
        <p className="start-tagline">Play chords in the air, in front of your webcam.</p>
        <p className="start-lede">
          DJ Hands turns your camera into an instrument. It watches your hands and plays a synth:
          hold up fingers on your <strong>left hand</strong> to play a chord, and move your{' '}
          <strong>right hand</strong> to shape how it sounds. No keyboard, no MIDI gear, nothing to
          install — and if you can count to five, you can play it.
        </p>

        <h2 className="start-heading">How to play</h2>
        <ul className="start-list">
          <li>
            <span className="key">1–5</span>
            <span>
              <strong>Left hand, fingers up.</strong> Each count plays a different chord, and it
              keeps ringing for as long as you hold the shape.
            </span>
          </li>
          <li>
            <span className="key">✊</span>
            <span>
              <strong>Left hand, fist.</strong> Lets the chord go — silence.
            </span>
          </li>
          <li>
            <span className="key">↕</span>
            <span>
              <strong>Right hand, higher or lower.</strong> Volume. Raise it to swell, drop it to
              fade away.
            </span>
          </li>
          <li>
            <span className="key">↻</span>
            <span>
              <strong>Right hand, rotate.</strong> Sweeps a filter: turn clockwise for a bright,
              open sound, anticlockwise for a muffled one.
            </span>
          </li>
        </ul>

        <p className="start-try">
          <strong>Try this first:</strong> two fingers on your left hand, then three, then a fist.
          That is a chord, a chord change, and a stop — everything else is shaping the sound.
        </p>

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

        <a
          className="coffee"
          href={COFFEE_URL}
          target="_blank"
          rel="noreferrer"
          onClick={() => track('support_click', { placement: 'start_screen' })}
        >
          <span aria-hidden="true">☕</span> Buy me a coffee
        </a>
      </div>
    </div>
  )
}
