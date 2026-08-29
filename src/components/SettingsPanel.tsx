import {
  ACCIDENTALS,
  INVERSION_LABELS,
  MAX_OCTAVE_OFFSET,
  QUALITIES,
  ROOTS,
  formatRoot,
  maxInversion,
  parseChord,
  resolveOctave,
  toChordName,
  type Accidental,
  type ChordSlot,
  type QualityId,
  type Root,
} from '../audio/chords'
import {
  MAX_SECTION_NAME,
  firstEnabled,
  sectionLabel,
  type SongSection,
} from '../audio/sections'
import { SEND_AMOUNT_RANGE, SEND_TARGETS, type SendTarget } from '../audio/effects'
import { ADSR_RANGES, DEFAULT_VOICE, type Voice } from '../audio/voice'
import type { PanelGroup } from '../state/panel'
import type { Settings } from '../state/settings'
import { CUTOFF_MAX_RANGE, CUTOFF_MIN_RANGE, DEFAULT_SETTINGS } from '../state/settings'
import { AdsrGraph } from './AdsrGraph'
import { Knob } from './Knob'
import { WaveformPicker } from './WaveformPicker'

const ACCIDENTAL_LABELS: Record<Accidental, string> = {
  sharp: 'Sharps (C♯)',
  flat: 'Flats (D♭)',
}

const seconds = (value: number) => `${value.toFixed(2)}s`
const level = (value: number) => value.toFixed(2)

const SEND_TARGET_LABELS: Record<SendTarget, string> = {
  reverb: 'Reverb',
  delay: 'Delay',
  both: 'Delay + reverb',
}

interface Props {
  settings: Settings
  onChange: (next: Settings) => void
  /** Which group the rail has open, or `null` while the panel is closed. */
  group: PanelGroup | null
  /** Puts the first-run walkthrough back on screen; App clears the flag. */
  onReplayCoach: () => void
}

export function SettingsPanel({ settings, onChange, group, onReplayCoach }: Props) {
  const patch = (partial: Partial<Settings>) => onChange({ ...settings, ...partial })

  const active = settings.activeSection
  const section = settings.sections[active]
  const enabledCount = settings.sections.filter((s) => s.enabled).length

  const setSection = (index: number, partial: Partial<SongSection>) =>
    settings.sections.map((s, i) => (i === index ? { ...s, ...partial } : s))

  const setSlot = (slot: number, partial: Partial<ChordSlot>) => {
    patch({
      sections: setSection(active, {
        slots: section.slots.map((s, i) => (i === slot ? { ...s, ...partial } : s)),
      }),
    })
  }

  // A new section starts from what you were just playing rather than from the
  // stock progression — most songs move a couple of chords between sections.
  const enableSection = (index: number) => {
    const sections = settings.sections[index].enabled
      ? settings.sections
      : setSection(index, { enabled: true, slots: section.slots.map((s) => ({ ...s })) })
    onChange({ ...settings, sections, activeSection: index })
  }

  const disableSection = (index: number) => {
    const sections = setSection(index, { enabled: false })
    onChange({
      ...settings,
      sections,
      // Turning off the section you are on has to leave you somewhere.
      activeSection: index === active ? firstEnabled(sections) : active,
    })
  }

  const setVoice = (partial: Partial<Voice>) => patch({ voice: { ...settings.voice, ...partial } })

  return (
    <aside className={`settings ${group ? 'open' : ''}`}>
      {/* Hidden panel keeps its DOM (so nothing re-mounts) but leaves the tab order. */}
      <div className="settings-body" id="settings-panel" inert={!group}>
        <section className="panel-group" hidden={group !== 'chords'}>
          <h2>Chords</h2>
          <p className="hint">
            Each section holds its own five chords, and your right hand's finger count
            switches between them as you play. Tap a dimmed tab to add one — it starts as
            a copy of the section you are on.
          </p>
          <div className="section-tabs" role="tablist" aria-label="Song sections">
            {settings.sections.map((s, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === active}
                className={`${i === active ? 'active' : ''} ${s.enabled ? '' : 'off'}`}
                // The visible text is just "3 +" on a section that is off, which
                // says nothing on its own; both states get a spoken name.
                aria-label={
                  s.enabled ? `${sectionLabel(s, i)} — ${i + 1} fingers` : `Add section ${i + 1}`
                }
                title={s.enabled ? `${sectionLabel(s, i)} — ${i + 1} fingers` : `Add section ${i + 1}`}
                onClick={() => enableSection(i)}
              >
                <span className="tab-number">{i + 1}</span>
                <span className="tab-name">{s.enabled ? sectionLabel(s, i) : '+'}</span>
              </button>
            ))}
          </div>
          <div className="row section-name">
            <span className="slot">{active + 1}</span>
            <input
              type="text"
              value={section.name}
              maxLength={MAX_SECTION_NAME}
              placeholder={`Section ${active + 1}`}
              aria-label={`Name of section ${active + 1}`}
              onChange={(e) => patch({ sections: setSection(active, { name: e.target.value }) })}
            />
            {/* There has to be somewhere to fall back to, so the last one stays. */}
            <button
              type="button"
              className="section-remove"
              disabled={enabledCount < 2}
              aria-label={`Remove section ${active + 1}`}
              title={enabledCount < 2 ? 'The last section stays' : 'Remove this section'}
              onClick={() => disableSection(active)}
            >
              ×
            </button>
          </div>
          <p className="hint">
            Each finger count on your left hand triggers its chord for as long as you hold it.
            Pick a root and a quality per slot; the ± buttons shift that one chord up or down
            whole octaves. Inversion rotates the chord's lowest notes up, and the bass picker
            puts any note underneath it — leave it on the root for a plain chord.
          </p>
          {section.slots.map((slot, i) => {
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
                      <option key={r} value={r}>{formatRoot(r, settings.accidental)}</option>
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
                      <option key={r} value={r}>{formatRoot(r, settings.accidental)}</option>
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
          {/* Naming only — the chord itself is stored under its sharp name. */}
          <label className="row">
            <span className="row-label">Note names</span>
            <select
              value={settings.accidental}
              onChange={(e) => patch({ accidental: e.target.value as Accidental })}
            >
              {ACCIDENTALS.map((a) => (
                <option key={a} value={a}>{ACCIDENTAL_LABELS[a]}</option>
              ))}
            </select>
          </label>
        </section>

        <section className="panel-group" hidden={group !== 'sound'}>
          <h2>Sound</h2>
          <p className="hint">
            One voice for everything the left hand plays. Pick its wave shape from the four
            buttons — they are drawn as they sound, thin and clean at the left, buzzy at the
            right. The curve below is a single chord's life: it fades in, falls to the level it
            holds at, then fades out when you drop the hand.
          </p>
          <WaveformPicker
            value={settings.voice.waveform}
            onChange={(waveform) => setVoice({ waveform })}
          />
          <AdsrGraph voice={settings.voice} />
          <div className="knob-row">
            <Knob
              label="Attack"
              stage="attack"
              range={ADSR_RANGES.attack}
              reset={DEFAULT_VOICE.attack}
              value={settings.voice.attack}
              format={seconds}
              onChange={(attack) => setVoice({ attack })}
            />
            <Knob
              label="Decay"
              stage="decay"
              range={ADSR_RANGES.decay}
              reset={DEFAULT_VOICE.decay}
              value={settings.voice.decay}
              format={seconds}
              onChange={(decay) => setVoice({ decay })}
            />
            <Knob
              label="Sustain"
              stage="sustain"
              range={ADSR_RANGES.sustain}
              reset={DEFAULT_VOICE.sustain}
              value={settings.voice.sustain}
              format={level}
              onChange={(sustain) => setVoice({ sustain })}
            />
            <Knob
              label="Release"
              stage="release"
              range={ADSR_RANGES.release}
              reset={DEFAULT_VOICE.release}
              value={settings.voice.release}
              format={seconds}
              onChange={(release) => setVoice({ release })}
            />
          </div>
        </section>

        <section className="panel-group" hidden={group !== 'filter'}>
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

        <section className="panel-group" hidden={group !== 'effects'}>
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

        <section className="panel-group" hidden={group !== 'volume'}>
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

        <section className="panel-group" hidden={group !== 'tracking'}>
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
          {/* Nothing is drawn at all with the skeleton hidden, so this would
              otherwise be a switch that does nothing. */}
          <label className="row checkbox">
            <input
              type="checkbox"
              checked={settings.reactiveOverlay}
              disabled={!settings.showOverlay}
              onChange={(e) => patch({ reactiveOverlay: e.target.checked })}
            />
            <span>Sound-reactive hands <em>(glow follows what you hear)</em></span>
          </label>
        </section>

        {/* The reference the start screen used to carry. It sits here rather
            than in front of the camera because this is where you come back to
            it — including for the section switch, which nothing else explains. */}
        <section className="panel-group" hidden={group !== 'help'}>
          <h2>How to play</h2>
          <p className="hint">
            Your left hand picks the chord, your right hand shapes it. Everything is held rather
            than triggered: the sound follows the shape you are making right now.
          </p>
          <ul className="gesture-list">
            <li>
              <span className="key left">1–5</span>
              <span>
                <strong>Left hand, fingers up.</strong> Each count plays a different chord, and it
                keeps ringing for as long as you hold the shape.
              </span>
            </li>
            <li>
              <span className="key left">✊</span>
              <span>
                <strong>Left hand, fist.</strong> Lets the chord go — silence.
              </span>
            </li>
            <li>
              <span className="key right">↕</span>
              <span>
                <strong>Right hand, higher or lower.</strong> Volume. Raise it to swell, drop it to
                fade away.
              </span>
            </li>
            <li>
              <span className="key right">↻</span>
              <span>
                <strong>Right hand, rotate.</strong> Sweeps a filter: turn clockwise for a bright,
                open sound, anticlockwise for a muffled one.
              </span>
            </li>
            <li>
              <span className="key right">1–5</span>
              <span>
                <strong>Right hand, fingers up.</strong> Switches to song section 1–5, each with
                its own five chords. A fist on this hand does nothing.
              </span>
            </li>
          </ul>
          <p className="hint">
            Drop a hand out of frame and its chord releases; the volume, the filter and the section
            all stay where you left them.
          </p>
          <button className="reset" onClick={onReplayCoach}>
            Replay walkthrough
          </button>
        </section>

        <button className="reset" onClick={() => onChange({ ...DEFAULT_SETTINGS })}>
          Reset to defaults
        </button>
      </div>
    </aside>
  )
}
