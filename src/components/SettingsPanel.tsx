import {
  INVERSION_LABELS,
  MAX_OCTAVE_OFFSET,
  QUALITIES,
  ROOTS,
  maxInversion,
  parseChord,
  resolveOctave,
  toChordName,
  type ChordSlot,
  type QualityId,
  type Root,
} from '../audio/chords'
import { SEND_AMOUNT_RANGE, SEND_TARGETS, type SendTarget } from '../audio/effects'
import { ADSR_RANGES, WAVEFORMS, type Voice, type WaveformName } from '../audio/voice'
import type { Settings } from '../state/settings'
import { CUTOFF_MAX_RANGE, CUTOFF_MIN_RANGE, DEFAULT_SETTINGS } from '../state/settings'

const SEND_TARGET_LABELS: Record<SendTarget, string> = {
  reverb: 'Reverb',
  delay: 'Delay',
  both: 'Delay + reverb',
}

interface Props {
  settings: Settings
  onChange: (next: Settings) => void
  open: boolean
  onToggle: () => void
}

export function SettingsPanel({ settings, onChange, open, onToggle }: Props) {
  const patch = (partial: Partial<Settings>) => onChange({ ...settings, ...partial })

  const setSlot = (slot: number, partial: Partial<ChordSlot>) => {
    patch({
      chordSlots: settings.chordSlots.map((s, i) => (i === slot ? { ...s, ...partial } : s)),
    })
  }

  const setVoice = (partial: Partial<Voice>) => patch({ voice: { ...settings.voice, ...partial } })

  return (
    <aside className={`settings ${open ? 'open' : ''}`}>
      <button className="settings-toggle" onClick={onToggle}>
        {open ? '›' : '‹'} <span>Settings</span>
      </button>

      <div className="settings-body">
        <section>
          <h2>Left hand — chords</h2>
          <p className="hint">
            Each finger count triggers its chord for as long as you hold it. Pick a root and a
            quality per slot; the ± buttons shift that one chord up or down whole octaves.
            Inversion rotates the chord's lowest notes up, and the bass picker puts any note
            underneath it — leave it on the root for a plain chord.
          </p>
          {settings.chordSlots.map((slot, i) => {
            const parsed = parseChord(slot.chord)
            const root = parsed?.root ?? 'C'
            const quality = parsed?.quality
            const qualityId = quality?.id ?? ''
            const inversions = INVERSION_LABELS.slice(0, (quality ? maxInversion(quality) : 2) + 1)
            return (
              <div key={i} className="chord-slot">
                <div className="row">
                  <span className="slot">{i + 1}</span>
                  <select
                    className="root-select"
                    value={root}
                    aria-label={`Chord ${i + 1} root`}
                    onChange={(e) => setSlot(i, { chord: toChordName(e.target.value as Root, qualityId) })}
                  >
                    {ROOTS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  <select
                    value={qualityId}
                    aria-label={`Chord ${i + 1} quality`}
                    onChange={(e) => {
                      const next = QUALITIES.find((q) => q.id === e.target.value)
                      // A narrower quality has fewer notes to rotate, so an inversion
                      // carried over from a wider one has to come down with it.
                      setSlot(i, {
                        chord: toChordName(root, e.target.value as QualityId),
                        inversion: next ? Math.min(slot.inversion, maxInversion(next)) : 0,
                      })
                    }}
                  >
                    {QUALITIES.map((q) => (
                      <option key={q.id} value={q.id}>{q.label}</option>
                    ))}
                  </select>
                  <div className="octave-step">
                    <button
                      type="button"
                      aria-label={`Lower chord ${i + 1} an octave`}
                      disabled={slot.octave <= -MAX_OCTAVE_OFFSET}
                      onClick={() => setSlot(i, { octave: slot.octave - 1 })}
                    >
                      −
                    </button>
                    <span
                      className="octave-value"
                      title={`Plays at octave ${resolveOctave(settings.octave, slot.octave)}`}
                    >
                      {slot.octave > 0 ? `+${slot.octave}` : slot.octave}
                    </span>
                    <button
                      type="button"
                      aria-label={`Raise chord ${i + 1} an octave`}
                      disabled={slot.octave >= MAX_OCTAVE_OFFSET}
                      onClick={() => setSlot(i, { octave: slot.octave + 1 })}
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="row voicing">
                  <span className="voicing-label">inv</span>
                  <select
                    value={slot.inversion}
                    aria-label={`Chord ${i + 1} inversion`}
                    onChange={(e) => setSlot(i, { inversion: Number(e.target.value) })}
                  >
                    {inversions.map((label, n) => (
                      <option key={label} value={n}>{label}</option>
                    ))}
                  </select>
                  <span className="voicing-label">bass</span>
                  <select
                    className="bass-select"
                    value={slot.bass ?? root}
                    aria-label={`Chord ${i + 1} bass`}
                    // Picking the chord's own root is what "no slash bass" means.
                    onChange={(e) =>
                      setSlot(i, { bass: e.target.value === root ? null : (e.target.value as Root) })
                    }
                  >
                    {ROOTS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>
            )
          })}
          <label className="row">
            <span className="row-label">Base octave</span>
            <input
              type="range" min={1} max={5} step={1}
              value={settings.octave}
              onChange={(e) => patch({ octave: Number(e.target.value) })}
            />
            <span className="row-value">{settings.octave}</span>
          </label>
        </section>

        <section>
          <h2>Sound</h2>
          <p className="hint">
            One voice for everything the left hand plays. Attack and release are the fade in
            and out; sustain is the level a held chord settles at.
          </p>
          <label className="row">
            <span className="row-label">Waveform</span>
            <select
              value={settings.voice.waveform}
              onChange={(e) => setVoice({ waveform: e.target.value as WaveformName })}
            >
              {WAVEFORMS.map((w) => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </label>
          <label className="row">
            <span className="row-label">Attack</span>
            <input
              type="range" {...ADSR_RANGES.attack}
              value={settings.voice.attack}
              onChange={(e) => setVoice({ attack: Number(e.target.value) })}
            />
            <span className="row-value">{settings.voice.attack.toFixed(2)}s</span>
          </label>
          <label className="row">
            <span className="row-label">Decay</span>
            <input
              type="range" {...ADSR_RANGES.decay}
              value={settings.voice.decay}
              onChange={(e) => setVoice({ decay: Number(e.target.value) })}
            />
            <span className="row-value">{settings.voice.decay.toFixed(2)}s</span>
          </label>
          <label className="row">
            <span className="row-label">Sustain</span>
            <input
              type="range" {...ADSR_RANGES.sustain}
              value={settings.voice.sustain}
              onChange={(e) => setVoice({ sustain: Number(e.target.value) })}
            />
            <span className="row-value">{settings.voice.sustain.toFixed(2)}</span>
          </label>
          <label className="row">
            <span className="row-label">Release</span>
            <input
              type="range" {...ADSR_RANGES.release}
              value={settings.voice.release}
              onChange={(e) => setVoice({ release: Number(e.target.value) })}
            />
            <span className="row-value">{settings.voice.release.toFixed(2)}s</span>
          </label>
        </section>

        <section>
          <h2>Filter</h2>
          <p className="hint">
            Rotating your right hand sweeps the lowpass between these two cutoffs — upright
            sits halfway, clockwise opens it up.
          </p>
          <label className="row">
            <span className="row-label">Closed</span>
            <input
              type="range" {...CUTOFF_MIN_RANGE}
              value={settings.cutoffMin}
              onChange={(e) => patch({ cutoffMin: Number(e.target.value) })}
            />
            <span className="row-value">{settings.cutoffMin} Hz</span>
          </label>
          <label className="row">
            <span className="row-label">Open</span>
            <input
              type="range" {...CUTOFF_MAX_RANGE}
              value={settings.cutoffMax}
              onChange={(e) => patch({ cutoffMax: Number(e.target.value) })}
            />
            <span className="row-value">{(settings.cutoffMax / 1000).toFixed(1)} kHz</span>
          </label>
        </section>

        <section>
          <h2>Effects</h2>
          <p className="hint">
            A fixed send, the same for everything you play. Whatever is not picked stays
            fully bypassed.
          </p>
          <label className="row">
            <span className="row-label">Effect</span>
            <select
              value={settings.sendTarget}
              onChange={(e) => patch({ sendTarget: e.target.value as SendTarget })}
            >
              {SEND_TARGETS.map((t) => (
                <option key={t} value={t}>{SEND_TARGET_LABELS[t]}</option>
              ))}
            </select>
          </label>
          <label className="row">
            <span className="row-label">Amount</span>
            <input
              type="range" {...SEND_AMOUNT_RANGE}
              value={settings.sendAmount}
              onChange={(e) => patch({ sendAmount: Number(e.target.value) })}
            />
            <span className="row-value">{Math.round(settings.sendAmount * 100)}%</span>
          </label>
        </section>

        <section>
          <h2>Volume range</h2>
          <p className="hint">Where in the frame your right hand reads as loudest and quietest.</p>
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
