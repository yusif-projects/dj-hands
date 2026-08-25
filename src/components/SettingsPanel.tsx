import { CHORDS, type ChordName } from '../audio/chords'
import { OSCILLATOR_OPTIONS, type OscillatorName } from '../audio/presets'
import type { Settings } from '../state/settings'
import { DEFAULT_SETTINGS } from '../state/settings'

interface Props {
  settings: Settings
  onChange: (next: Settings) => void
  open: boolean
  onToggle: () => void
}

export function SettingsPanel({ settings, onChange, open, onToggle }: Props) {
  const patch = (partial: Partial<Settings>) => onChange({ ...settings, ...partial })

  const setChord = (slot: number, chord: ChordName) => {
    const chords = [...settings.chords]
    chords[slot] = chord
    patch({ chords })
  }

  const setOscillator = (index: number, oscillator: OscillatorName) => {
    const presets = settings.presets.map((p, i) => (i === index ? { ...p, oscillator } : p))
    patch({ presets })
  }

  return (
    <aside className={`settings ${open ? 'open' : ''}`}>
      <button className="settings-toggle" onClick={onToggle}>
        {open ? '›' : '‹'} <span>Settings</span>
      </button>

      <div className="settings-body">
        <section>
          <h2>Left hand — chords</h2>
          <p className="hint">Each finger count triggers its chord for as long as you hold it.</p>
          {settings.chords.map((chord, i) => (
            <label key={i} className="row">
              <span className="slot">{i + 1}</span>
              <select value={chord} onChange={(e) => setChord(i, e.target.value as ChordName)}>
                {CHORDS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
          ))}
          <label className="row">
            <span className="row-label">Octave</span>
            <input
              type="range" min={1} max={5} step={1}
              value={settings.octave}
              onChange={(e) => patch({ octave: Number(e.target.value) })}
            />
            <span className="row-value">{settings.octave}</span>
          </label>
        </section>

        <section>
          <h2>Right hand — sounds</h2>
          <p className="hint">Finger count selects the voice; hand height sets the volume.</p>
          {settings.presets.map((preset, i) => (
            <label key={i} className="row">
              <span className="slot">{i + 1}</span>
              <span className="preset-name">{preset.name}</span>
              <select
                value={preset.oscillator}
                onChange={(e) => setOscillator(i, e.target.value as OscillatorName)}
              >
                {OSCILLATOR_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </label>
          ))}
        </section>

        <section>
          <h2>Volume range</h2>
          <p className="hint">Where in the frame your hand reads as loudest and quietest.</p>
          <label className="row">
            <span className="row-label">Top (100%)</span>
            <input
              type="range" min={0} max={0.5} step={0.01}
              value={settings.volumeTop}
              onChange={(e) => patch({ volumeTop: Number(e.target.value) })}
            />
            <span className="row-value">{settings.volumeTop.toFixed(2)}</span>
          </label>
          <label className="row">
            <span className="row-label">Bottom (0%)</span>
            <input
              type="range" min={0.5} max={1} step={0.01}
              value={settings.volumeBottom}
              onChange={(e) => patch({ volumeBottom: Number(e.target.value) })}
            />
            <span className="row-value">{settings.volumeBottom.toFixed(2)}</span>
          </label>
        </section>

        <section>
          <h2>Tracking</h2>
          <label className="row">
            <span className="row-label">Steadiness</span>
            <input
              type="range" min={1} max={12} step={1}
              value={settings.debounceFrames}
              onChange={(e) => patch({ debounceFrames: Number(e.target.value) })}
            />
            <span className="row-value">{settings.debounceFrames}f</span>
          </label>
          <label className="row checkbox">
            <input
              type="checkbox"
              checked={settings.swapHands}
              onChange={(e) => patch({ swapHands: e.target.checked })}
            />
            <span>Swap hands <em>(if left/right are reversed)</em></span>
          </label>
          <label className="row checkbox">
            <input
              type="checkbox"
              checked={settings.showOverlay}
              onChange={(e) => patch({ showOverlay: e.target.checked })}
            />
            <span>Show hand skeleton</span>
          </label>
        </section>

        <button className="reset" onClick={() => onChange({ ...DEFAULT_SETTINGS })}>
          Reset to defaults
        </button>
      </div>
    </aside>
  )
}
