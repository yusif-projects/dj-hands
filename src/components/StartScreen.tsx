interface Props {
  onStart: () => void
  loading: boolean
  error: string | null
}

export function StartScreen({ onStart, loading, error }: Props) {
  return (
    <div className="start-screen">
      <div className="start-card">
        <h1>Gesture Chord Synth</h1>
        <p className="start-lede">
          Play chords with your hands. Your <strong>left hand</strong> picks the chord (hold up 1–5
          fingers), your <strong>right hand</strong> picks the sound — and its height sets the volume.
        </p>
        <ul className="start-list">
          <li><span className="key">1–5</span> left hand — chord slots, sustained while held</li>
          <li><span className="key">1–5</span> right hand — synth preset</li>
          <li><span className="key">↕</span> right hand height — volume up / down</li>
          <li><span className="key">✊</span> fist — silence</li>
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
