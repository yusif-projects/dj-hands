import { useEffect, useRef, useState } from 'react'
import { track, trackSettled } from '../analytics'
import type { CSSProperties } from 'react'
import {
  MAX_PRESETS,
  MAX_PRESET_NAME,
  parsePayload,
  presetLabel,
  toPayload,
  type Preset,
  type PresetPayload,
  type PresetStore,
} from '../state/presets'
import {
  ARP_GATE_RANGE,
  ARP_MS_RANGE,
  ARP_OCTAVES_RANGE,
  ARP_PATTERNS,
  DEFAULT_ARP,
  type ArpPattern,
  type ArpSettings,
} from '../audio/arp'
import {
  ACCIDENTALS,
  INVERSION_LABELS,
  MAX_OCTAVE_OFFSET,
  QUALITIES,
  QUALITY_GROUPS,
  ROOTS,
  formatQuality,
  formatRoot,
  formatSlotNotes,
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
import {
  BPM_RANGE,
  DEFAULT_TIMING,
  DIVISIONS,
  DIVISION_RANGE,
  EFFECT_AMOUNT_RANGE,
  EFFECT_IDS,
  EFFECT_MS_RANGES,
  defaultAmount,
  moveEffect,
  type DivisionId,
  type EffectId,
  type EffectSetting,
  type EffectTiming,
} from '../audio/effects'
import { FILTER_TYPES, type FilterType } from '../audio/filter'
import { ADSR_RANGES, DEFAULT_VOICE, type Voice } from '../audio/voice'
import type { PanelGroup } from '../state/panel'
import type { Settings } from '../state/settings'
import {
  CUTOFF_MAX_RANGE,
  CUTOFF_MIN_RANGE,
  DEBOUNCE_RANGE,
  DEFAULT_SETTINGS,
  OCTAVE_RANGE,
  VOLUME_BOTTOM_RANGE,
  VOLUME_TOP_RANGE,
} from '../state/settings'
import { AdsrGraph } from './AdsrGraph'
import { FilterGraph } from './FilterGraph'
import {
  IconPicker,
  PICKER_PAD,
  PICKER_VIEW_H,
  PICKER_VIEW_W,
  type PickerOption,
} from './IconPicker'
import { Knob } from './Knob'
import { FistIcon, RaiseIcon, RotateIcon } from './icons'
import { WaveformPicker } from './WaveformPicker'
import { arpGlyphPath } from './arpGlyph'
import { effectGlyphPaths } from './effectGlyph'
import { responsePath } from './filterShape'

/** How long the copy button reads "Copied" before falling back to its label —
    long enough to notice, short enough that the row is not stuck saying it. */
const COPY_FEEDBACK_MS = 1600

const ACCIDENTAL_LABELS: Record<Accidental, string> = {
  sharp: 'Sharps (C♯)',
  flat: 'Flats (D♭)',
}

const seconds = (value: number) => `${value.toFixed(2)}s`
const level = (value: number) => value.toFixed(2)
const percent = (value: number) => `${Math.round(value * 100)}%`
const hertz = (value: number) => `${value} Hz`
const kilohertz = (value: number) => `${(value / 1000).toFixed(1)} kHz`

/**
 * The steadiness setting counts tracking frames, so what it costs depends on how
 * fast the camera runs — four frames is 66ms at 60fps and 266ms at 15. The frame
 * count alone hides that, so show the milliseconds it is currently buying. `fps`
 * is 0 until the loop has measured itself.
 */
const steadiness = (frames: number, fps: number) =>
  fps > 0 ? `${frames}f · ${Math.round((frames / fps) * 1000)}ms` : `${frames}f`

const FILTER_TYPE_LABELS: Record<FilterType, string> = {
  lowpass: 'Lowpass',
  highpass: 'Highpass',
  bandpass: 'Bandpass',
}

/** What the sweep does to the sound, so the hint reads true for each type. */
const FILTER_HINTS: Record<FilterType, string> = {
  lowpass: 'Rotating your right hand sweeps the cutoff — anticlockwise muffles the top end, clockwise opens it up.',
  highpass: 'Rotating your right hand sweeps the cutoff — anticlockwise keeps the low end, clockwise thins it to air.',
  bandpass: 'Rotating your right hand slides a narrow band up the spectrum — anticlockwise for the low end, clockwise for the top.',
}

/** The two sweep ends, named for what each one sounds like on that filter. */
const CUTOFF_LABELS: Record<FilterType, [string, string]> = {
  lowpass: ['Closed', 'Open'],
  highpass: ['Full', 'Thin'],
  bandpass: ['Low', 'High'],
}

// Drawn at the middle of the sweep: the glyph is about which side of the cutoff
// survives, not where the cutoff happens to sit right now.
const FILTER_OPTIONS: PickerOption<FilterType>[] = FILTER_TYPES.map((type) => ({
  value: type,
  label: FILTER_TYPE_LABELS[type],
  path: responsePath(type, 0.5, PICKER_VIEW_W, PICKER_VIEW_H, PICKER_PAD),
}))

/**
 * Notation, not names: a dot for dotted and a T for triplet is the whole label
 * any of these get, because the readout sits under a 44px dial.
 */
const DIVISION_LABELS: Record<DivisionId, string> = {
  'thirty-second': '1/32',
  'sixteenth-triplet': '1/16T',
  sixteenth: '1/16',
  'eighth-triplet': '1/8T',
  'dotted-sixteenth': '1/16\u2022',
  eighth: '1/8',
  'quarter-triplet': '1/4T',
  'dotted-eighth': '1/8\u2022',
  quarter: '1/4',
  'half-triplet': '1/2T',
  'dotted-quarter': '1/4\u2022',
  half: '1/2',
  whole: '1/1',
}

/**
 * Compact on purpose: the readout sits under a 44px dial in a 340px panel, and
 * "2500 ms" would widen the column the six rows are aligned on.
 */
const period = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`)

const ARP_PATTERN_LABELS: Record<ArpPattern, string> = {
  up: 'Up',
  down: 'Down',
  updown: 'Up and down',
  downup: 'Down and up',
  random: 'Random',
}

const ARP_OPTIONS: PickerOption<ArpPattern>[] = ARP_PATTERNS.map((pattern) => ({
  value: pattern,
  label: ARP_PATTERN_LABELS[pattern],
  path: arpGlyphPath(pattern, PICKER_VIEW_W, PICKER_VIEW_H, PICKER_PAD),
}))

/** Reads as a span of the chord rather than as a bare count. */
const octaveSpan = (value: number) => `${value} oct`

const EFFECT_LABELS: Record<EffectId, string> = {
  bitcrusher: 'Bitcrusher',
  chorus: 'Chorus',
  tremolo: 'Tremolo',
  phaser: 'Phaser',
  delay: 'Delay',
  reverb: 'Reverb',
}

// The shapes never change, so they are drawn once for the module's lifetime.
const EFFECT_GLYPHS = Object.fromEntries(
  EFFECT_IDS.map((id) => [id, effectGlyphPaths(id, PICKER_VIEW_W, PICKER_VIEW_H, PICKER_PAD)]),
) as Record<EffectId, string[]>

interface Props {
  settings: Settings
  onChange: (next: Settings) => void
  /** Which group the rail has open, or `null` while the panel is closed. */
  group: PanelGroup | null
  /** Measured tracking frame rate, for costing the steadiness setting in ms. */
  fps: number
  /** Every saved song and which one is open; edits fold into the open one. */
  presets: PresetStore
  /** Why the last write to the song list failed, if it did; `null` once one lands. */
  presetError: string | null
  onOpenPreset: (id: string) => void
  onSavePreset: (name: string) => void
  onRenamePreset: (id: string, name: string) => void
  onDeletePreset: (id: string) => void
  onPastePreset: (payload: PresetPayload) => void
  /** Restores the defaults *and* closes the open song; App owns both halves. */
  onReset: () => void
  /** Puts the first-run walkthrough back on screen; App clears the flag. */
  onReplayCoach: () => void
  /** Every video input the browser will name, for the camera picker. */
  cameras: MediaDeviceInfo[]
  /** The camera currently feeding the tracker. */
  cameraId: string | null
  onSelectCamera: (deviceId: string) => void
  /** Why the last camera switch failed, if it did; `null` once one succeeds. */
  cameraError: string | null
}

export function SettingsPanel({
  settings,
  onChange,
  group,
  fps,
  presets,
  presetError,
  onOpenPreset,
  onSavePreset,
  onRenamePreset,
  onDeletePreset,
  onPastePreset,
  onReset,
  onReplayCoach,
  cameras,
  cameraId,
  onSelectCamera,
  cameraError,
}: Props) {
  const patch = (partial: Partial<Settings>) => onChange({ ...settings, ...partial })

  // Every control in this panel reports through one event named by `setting`,
  // rather than one event name each: twenty-odd names would be twenty-odd GA4
  // custom dimensions to register, where this is a single breakdown.
  const changed = (setting: string, value: unknown) => track('setting_changed', { setting, value })

  // For anything dragged. A knob emits on every pointer move and a slider on
  // every step crossed, so only the value it comes to rest on is reported —
  // keyed by setting, so two controls moved together do not cancel each other.
  const settling = (setting: string, value: unknown) =>
    trackSettled(setting, 'setting_changed', { setting, value })

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
    // The same tab both adds a section and switches to one already there; those
    // are different questions, so they are reported apart.
    changed(settings.sections[index].enabled ? 'section_switched' : 'section_added', index + 1)
    const sections = settings.sections[index].enabled
      ? settings.sections
      : setSection(index, { enabled: true, slots: section.slots.map((s) => ({ ...s })) })
    onChange({ ...settings, sections, activeSection: index })
  }

  const disableSection = (index: number) => {
    changed('section_removed', index + 1)
    const sections = setSection(index, { enabled: false })
    onChange({
      ...settings,
      sections,
      // Turning off the section you are on has to leave you somewhere.
      activeSection: index === active ? firstEnabled(sections) : active,
    })
  }

  const setVoice = (partial: Partial<Voice>) => patch({ voice: { ...settings.voice, ...partial } })

  // The rack and the arpeggiator lock to one tempo, so the dial is drawn in both
  // groups rather than sending someone to the other group to change it.
  const tempoRow = (hint: string) => (
    <div className="row effect-tempo">
      <span className="row-label">Tempo</span>
      <Knob
        label="Tempo"
        tone="bpm"
        showLabel={false}
        range={BPM_RANGE}
        reset={DEFAULT_SETTINGS.bpm}
        value={settings.bpm}
        format={(bpm) => `${bpm} BPM`}
        onChange={(bpm) => {
          settling('bpm', bpm)
          patch({ bpm })
        }}
      />
      <span className="hint effect-tempo-hint">{hint}</span>
    </div>
  )

  const setArp = (partial: Partial<ArpSettings>) => patch({ arp: { ...settings.arp, ...partial } })

  const patchEffect = (index: number, partial: Partial<EffectSetting>) =>
    patch({
      effects: settings.effects.map((fx, i) => (i === index ? { ...fx, ...partial } : fx)),
    })

  const setEffectAmount = (index: number, amount: number) => patchEffect(index, { amount })

  const setEffectTiming = (index: number, timing: EffectTiming, partial: Partial<EffectTiming>) =>
    patchEffect(index, { timing: { ...timing, ...partial } })

  // Which row was last moved, and by which button, for the focus repair below.
  const moved = useRef<{ id: EffectId; step: -1 | 1 } | null>(null)

  const moveEffectTo = (from: number, step: -1 | 1) => {
    // Which effect moved and which way, in one value: the rack only has three
    // slots, so the pair says everything about the order somebody wanted.
    changed('effect_order', `${settings.effects[from].id}:${step < 0 ? 'up' : 'down'}`)
    moved.current = { id: settings.effects[from].id, step }
    patch({ effects: moveEffect(settings.effects, from, from + step) })
  }

  /**
   * Reordering moves the row's DOM node, which blurs whatever was focused inside
   * it — so a keyboard reorder would end after a single press. Focus goes back to
   * the button that was pressed, or to its neighbour when that one has just gone
   * disabled because the row reached an end.
   */
  useEffect(() => {
    const last = moved.current
    if (!last) return
    moved.current = null
    const buttons = document.querySelectorAll<HTMLButtonElement>(
      `[data-fx="${last.id}"] .effect-step button`,
    )
    const pressed = buttons[last.step < 0 ? 0 : 1]
    const target =
      pressed && !pressed.disabled ? pressed : [...buttons].find((button) => !button.disabled)
    target?.focus()
  }, [settings.effects])

  // ---- Songs ----
  // None of this is persisted: a half-typed name or an open confirm must not
  // come back after a reload.
  const [draftName, setDraftName] = useState('')
  const [pasted, setPasted] = useState('')
  const [pending, setPending] = useState<{ id: string; action: 'open' | 'delete' } | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [copyFailed, setCopyFailed] = useState(false)
  const copyTimer = useRef<number | null>(null)

  const atCap = presets.items.length >= MAX_PRESETS
  const capTitle = `${MAX_PRESETS} songs is the limit — delete one to save another`
  // Parsed on every keystroke so the Add button's disabled state is honest
  // rather than optimistic. A paste is one event rather than a typing loop, and
  // the normalizers are the same ones a page load already runs.
  const pastedSong = pasted.trim() ? parsePayload(pasted) : null

  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current)
    },
    [],
  )

  /**
   * The control that was clicked is unmounted by the swap, which blurs it. Focus
   * goes to the cancel button rather than the confirm one — two Enters in a row
   * must not delete a song. Same repair the effects reorder above makes.
   */
  useEffect(() => {
    if (!pending) return
    document.querySelector<HTMLButtonElement>(`[data-song="${pending.id}"] .song-keep`)?.focus()
  }, [pending])

  const copySong = async (preset: Preset) => {
    try {
      await navigator.clipboard.writeText(toPayload(preset))
      changed('song_copied', presets.items.length)
      setCopyFailed(false)
      setCopied(preset.id)
      if (copyTimer.current) clearTimeout(copyTimer.current)
      // The label falling back to "Copy" is the only thing that says the flash
      // is over, which is why this control is a word and not a glyph.
      copyTimer.current = window.setTimeout(() => setCopied(null), COPY_FEEDBACK_MS)
    } catch {
      // Permitted by a user gesture, but a permissions policy can still refuse.
      setCopyFailed(true)
    }
  }

  const saveDraft = () => {
    if (atCap) return
    onSavePreset(draftName)
    setDraftName('')
  }

  const addPasted = () => {
    if (!pastedSong || atCap) return
    onPastePreset(pastedSong)
    setPasted('')
  }

  /**
   * Opening replaces what is being played. That only costs anything while no
   * song is open — once one is, every edit is already folded into it — so the
   * question is asked in exactly that case, and a normal open stays one click.
   */
  const requestOpen = (id: string) => {
    if (presets.activeId === null) setPending({ id, action: 'open' })
    else onOpenPreset(id)
  }

  const resolvePending = () => {
    if (!pending) return
    if (pending.action === 'delete') onDeletePreset(pending.id)
    else onOpenPreset(pending.id)
    setPending(null)
  }

  return (
    <aside className={`settings ${group ? 'open' : ''}`}>
      {/* Hidden panel keeps its DOM (so nothing re-mounts) but leaves the tab order. */}
      <div className="settings-body" id="settings-panel" inert={!group}>
        <section className="panel-group band-left" hidden={group !== 'chords'}>
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
              onChange={(e) => {
                settling('section_renamed', active + 1)
                patch({ sections: setSection(active, { name: e.target.value }) })
              }}
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
                    onChange={(e) => {
                      settling('chord_root', e.target.value)
                      setSlot(i, { chord: toChordName(e.target.value as Root, qualityId) })
                    }}
                  >
                    {ROOTS.map((r) => (
                      <option key={r} value={r}>{formatRoot(r, settings.accidental)}</option>
                    ))}
                  </select>
                  <select
                    value={qualityId}
                    aria-label={`Chord ${i + 1} quality`}
                    onChange={(e) => {
                      settling('chord_quality', e.target.value)
                      const next = QUALITIES.find((q) => q.id === e.target.value)
                      // A narrower quality has fewer notes to rotate, so an inversion
                      // carried over from a wider one has to come down with it.
                      setSlot(i, {
                        chord: toChordName(root, e.target.value as QualityId),
                        inversion: next ? Math.min(slot.inversion, maxInversion(next)) : 0,
                      })
                    }}
                  >
                    {QUALITY_GROUPS.map((group) => (
                      <optgroup key={group.family} label={group.family}>
                        {group.qualities.map((q) => (
                          <option key={q.id} value={q.id}>{formatQuality(q.label)}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div className="row voicing">
                  <span className="voicing-label">inv</span>
                  <select
                    value={slot.inversion}
                    aria-label={`Chord ${i + 1} inversion`}
                    onChange={(e) => {
                      settling('inversion', Number(e.target.value))
                      setSlot(i, { inversion: Number(e.target.value) })
                    }}
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
                    onChange={(e) => {
                      settling('slash_bass', e.target.value === root ? 'none' : e.target.value)
                      setSlot(i, { bass: e.target.value === root ? null : (e.target.value as Root) })
                    }}
                  >
                    {ROOTS.map((r) => (
                      <option key={r} value={r}>{formatRoot(r, settings.accidental)}</option>
                    ))}
                  </select>
                </div>
                {/* A name like `maddb13` says nothing about what it sounds like,
                    so the slot spells out what the rows above add up to — the
                    quality, the inversion and the bass together, in the order
                    they will be voiced — and the octave they sound at sits with
                    them rather than crowding the quality picker off its row. */}
                <div className="row slot-sound">
                  <p className="slot-notes">
                    {formatSlotNotes(slot, settings.octave, settings.accidental).join(' · ')}
                  </p>
                  <div className="octave-step">
                    <button
                      type="button"
                      aria-label={`Lower chord ${i + 1} an octave`}
                      disabled={slot.octave <= -MAX_OCTAVE_OFFSET}
                      onClick={() => {
                        settling('chord_octave', slot.octave - 1)
                        setSlot(i, { octave: slot.octave - 1 })
                      }}
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
                      onClick={() => {
                        settling('chord_octave', slot.octave + 1)
                        setSlot(i, { octave: slot.octave + 1 })
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
          <label className="row">
            <span className="row-label">Base octave</span>
            <input
              type="range" {...OCTAVE_RANGE}
              value={settings.octave}
              onChange={(e) => {
                settling('base_octave', Number(e.target.value))
                patch({ octave: Number(e.target.value) })
              }}
            />
            <span className="row-value">{settings.octave}</span>
          </label>
          {/* Naming only — the chord itself is stored under its sharp name. */}
          <label className="row">
            <span className="row-label">Note names</span>
            <select
              value={settings.accidental}
              onChange={(e) => {
                changed('accidental', e.target.value)
                patch({ accidental: e.target.value as Accidental })
              }}
            >
              {ACCIDENTALS.map((a) => (
                <option key={a} value={a}>{ACCIDENTAL_LABELS[a]}</option>
              ))}
            </select>
          </label>
        </section>

        <section className="panel-group band-left" hidden={group !== 'sound'}>
          <h2>Sound</h2>
          <p className="hint">
            One voice for everything the left hand plays. Pick its wave shape from the four
            buttons — they are drawn as they sound, thin and clean at the left, buzzy at the
            right. The curve below is a single chord's life: it fades in, falls to the level it
            holds at, then fades out when you drop the hand.
          </p>
          <WaveformPicker
            value={settings.voice.waveform}
            onChange={(waveform) => {
              changed('waveform', waveform)
              setVoice({ waveform })
            }}
          />
          <AdsrGraph voice={settings.voice} />
          <div className="knob-row">
            <Knob
              label="Attack"
              tone="attack"
              range={ADSR_RANGES.attack}
              reset={DEFAULT_VOICE.attack}
              value={settings.voice.attack}
              format={seconds}
              onChange={(attack) => {
                settling('attack', attack)
                setVoice({ attack })
              }}
            />
            <Knob
              label="Decay"
              tone="decay"
              range={ADSR_RANGES.decay}
              reset={DEFAULT_VOICE.decay}
              value={settings.voice.decay}
              format={seconds}
              onChange={(decay) => {
                settling('decay', decay)
                setVoice({ decay })
              }}
            />
            <Knob
              label="Sustain"
              tone="sustain"
              range={ADSR_RANGES.sustain}
              reset={DEFAULT_VOICE.sustain}
              value={settings.voice.sustain}
              format={level}
              onChange={(sustain) => {
                settling('sustain', sustain)
                setVoice({ sustain })
              }}
            />
            <Knob
              label="Release"
              tone="release"
              range={ADSR_RANGES.release}
              reset={DEFAULT_VOICE.release}
              value={settings.voice.release}
              format={seconds}
              onChange={(release) => {
                settling('release', release)
                setVoice({ release })
              }}
            />
          </div>
        </section>

        <section className="panel-group band-left" hidden={group !== 'arp'}>
          <h2>Arpeggiator</h2>
          <p className="hint">
            Switched on, a held chord is played one note at a time instead of all at
            once — the same five left-hand chords, and the same right hand on the volume
            and the filter, only now the chord has a rhythm. Each new chord starts its
            pattern from the beginning, so the timing follows your hand.
          </p>
          <label className="row checkbox">
            <input
              type="checkbox"
              checked={settings.arp.enabled}
              onChange={(e) => {
                changed('arp_enabled', e.target.checked)
                setArp({ enabled: e.target.checked })
              }}
            />
            <span>Arpeggiate <em>(hold a chord to hear it)</em></span>
          </label>
          {/* Drawn as they are walked: the staircase climbs, falls or turns. */}
          <IconPicker
            label="Pattern"
            tone="left"
            value={settings.arp.pattern}
            options={ARP_OPTIONS}
            onChange={(pattern) => {
              changed('arp_pattern', pattern)
              setArp({ pattern })
            }}
          />
          {tempoRow('A locked rate follows it.')}
          <label className="row checkbox">
            <input
              type="checkbox"
              checked={settings.arp.timing.lock}
              onChange={(e) => {
                changed('arp_lock', e.target.checked)
                setArp({ timing: { ...settings.arp.timing, lock: e.target.checked } })
              }}
            />
            <span>Lock the rate to the tempo</span>
          </label>
          <p className="hint">
            Rate is how long each note gets, gate how much of that it actually sounds
            for — low is staccato, all the way up runs the notes together. Octaves
            climbs the same chord again an octave higher before it repeats.
          </p>
          <div className="knob-row" style={{ '--knob-cols': 3 } as CSSProperties}>
            {/* Locked, the knob walks an index into DIVISIONS — the same trick the
                rack's rates use, so its own step does the snapping. */}
            <Knob
              label="Rate"
              tone="arp-rate"
              range={settings.arp.timing.lock ? DIVISION_RANGE : ARP_MS_RANGE}
              reset={
                settings.arp.timing.lock
                  ? DIVISIONS.indexOf(DEFAULT_ARP.timing.division)
                  : DEFAULT_ARP.timing.ms
              }
              value={
                settings.arp.timing.lock
                  ? DIVISIONS.indexOf(settings.arp.timing.division)
                  : settings.arp.timing.ms
              }
              format={(value) =>
                settings.arp.timing.lock ? DIVISION_LABELS[DIVISIONS[value]] : period(value)
              }
              onChange={(value) => {
                settling('arp_rate', value)
                setArp({
                  timing: settings.arp.timing.lock
                    ? { ...settings.arp.timing, division: DIVISIONS[value] }
                    : { ...settings.arp.timing, ms: value },
                })
              }}
            />
            <Knob
              label="Octaves"
              tone="arp-octaves"
              range={ARP_OCTAVES_RANGE}
              reset={DEFAULT_ARP.octaves}
              value={settings.arp.octaves}
              format={octaveSpan}
              onChange={(octaves) => {
                settling('arp_octaves', octaves)
                setArp({ octaves })
              }}
            />
            <Knob
              label="Gate"
              tone="arp-gate"
              range={ARP_GATE_RANGE}
              reset={DEFAULT_ARP.gate}
              value={settings.arp.gate}
              format={percent}
              onChange={(gate) => {
                settling('arp_gate', gate)
                setArp({ gate })
              }}
            />
          </div>
        </section>

        <section className="panel-group band-right" hidden={group !== 'filter'}>
          <h2>Filter</h2>
          <p className="hint">{FILTER_HINTS[settings.filterType]} Upright sits halfway.</p>
          <IconPicker
            label="Filter type"
            tone="right"
            value={settings.filterType}
            options={FILTER_OPTIONS}
            onChange={(filterType) => {
              changed('filter_type', filterType)
              patch({ filterType })
            }}
          />
          <FilterGraph
            type={settings.filterType}
            cutoffMin={settings.cutoffMin}
            cutoffMax={settings.cutoffMax}
          />
          <div className="knob-row" style={{ '--knob-cols': 2 } as CSSProperties}>
            <Knob
              label={CUTOFF_LABELS[settings.filterType][0]}
              tone="cutoff-min"
              range={CUTOFF_MIN_RANGE}
              reset={DEFAULT_SETTINGS.cutoffMin}
              value={settings.cutoffMin}
              format={hertz}
              onChange={(cutoffMin) => {
                settling('cutoff_min', cutoffMin)
                patch({ cutoffMin })
              }}
            />
            <Knob
              label={CUTOFF_LABELS[settings.filterType][1]}
              tone="cutoff-max"
              range={CUTOFF_MAX_RANGE}
              reset={DEFAULT_SETTINGS.cutoffMax}
              value={settings.cutoffMax}
              format={kilohertz}
              onChange={(cutoffMax) => {
                settling('cutoff_max', cutoffMax)
                patch({ cutoffMax })
              }}
            />
          </div>
        </section>

        <section className="panel-group band-right" hidden={group !== 'effects'}>
          <h2>Effects</h2>
          <p className="hint">
            The same rack for everything you play, each effect with its own amount —
            anything left at zero is fully bypassed. They run top to bottom, and the
            arrows change that order. Tremolo, phaser and delay have a rate too,
            free in milliseconds or locked to the tempo.
          </p>
          {tempoRow('Locked effects and the arpeggiator follow it.')}
          <ol className="effect-chain">
            {settings.effects.map((effect, i) => (
              <li key={effect.id} className="effect-row" data-fx={effect.id}>
                <div className="effect-step">
                  <button
                    type="button"
                    aria-label={`Move ${EFFECT_LABELS[effect.id]} earlier`}
                    disabled={i === 0}
                    onClick={() => moveEffectTo(i, -1)}
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${EFFECT_LABELS[effect.id]} later`}
                    disabled={i === settings.effects.length - 1}
                    onClick={() => moveEffectTo(i, 1)}
                  >
                    ▼
                  </button>
                </div>
                <svg
                  className={`effect-glyph fx-${effect.id}`}
                  viewBox={`0 0 ${PICKER_VIEW_W} ${PICKER_VIEW_H}`}
                  aria-hidden="true"
                >
                  {EFFECT_GLYPHS[effect.id].map((d, part) => (
                    <path key={part} d={d} />
                  ))}
                </svg>
                <span className={effect.timing ? 'effect-name' : 'effect-name wide'}>
                  {EFFECT_LABELS[effect.id]}
                </span>
                {effect.timing && (
                  <>
                    {/* The row has no width for a caption, so the box carries the
                        whole label itself rather than leaning on a nearby word. */}
                    <input
                      type="checkbox"
                      className="effect-lock"
                      aria-label={`Lock ${EFFECT_LABELS[effect.id]} to the tempo`}
                      title={`Lock ${EFFECT_LABELS[effect.id]} to the tempo`}
                      checked={effect.timing.lock}
                      onChange={(e) => {
                        changed('effect_lock', `${effect.id}:${e.target.checked}`)
                        setEffectTiming(i, effect.timing!, { lock: e.target.checked })
                      }}
                    />
                    {/* Locked, the knob walks an index into DIVISIONS, so its own
                        step is what snaps it to the three note values. */}
                    <Knob
                      label={`${EFFECT_LABELS[effect.id]} rate`}
                      tone={effect.id}
                      showLabel={false}
                      range={effect.timing.lock ? DIVISION_RANGE : EFFECT_MS_RANGES[effect.id]!}
                      reset={
                        effect.timing.lock
                          ? DIVISIONS.indexOf(DEFAULT_TIMING[effect.id]!.division)
                          : DEFAULT_TIMING[effect.id]!.ms
                      }
                      value={
                        effect.timing.lock
                          ? DIVISIONS.indexOf(effect.timing.division)
                          : effect.timing.ms
                      }
                      format={(value) =>
                        effect.timing!.lock ? DIVISION_LABELS[DIVISIONS[value]] : period(value)
                      }
                      onChange={(value) => {
                        settling('effect_rate', effect.id)
                        setEffectTiming(
                          i,
                          effect.timing!,
                          effect.timing!.lock
                            ? { division: DIVISIONS[value] }
                            : { ms: value },
                        )
                      }}
                    />
                  </>
                )}
                <Knob
                  label={`${EFFECT_LABELS[effect.id]} amount`}
                  tone={effect.id}
                  showLabel={false}
                  range={EFFECT_AMOUNT_RANGE}
                  reset={defaultAmount(effect.id)}
                  value={effect.amount}
                  format={percent}
                  onChange={(amount) => {
                    settling('effect_amount', effect.id)
                    setEffectAmount(i, amount)
                  }}
                />
              </li>
            ))}
          </ol>
        </section>

        <section className="panel-group band-right" hidden={group !== 'volume'}>
          <h2>Volume range</h2>
          <p className="hint">Where in the frame your right hand reads as loudest and quietest.</p>
          <label className="row">
            <span className="row-label">Top (100%)</span>
            <input
              type="range" {...VOLUME_TOP_RANGE}
              value={settings.volumeTop}
              onChange={(e) => {
                settling('volume_top', Number(e.target.value))
                patch({ volumeTop: Number(e.target.value) })
              }}
            />
            <span className="row-value">{settings.volumeTop.toFixed(2)}</span>
          </label>
          <label className="row">
            <span className="row-label">Bottom (0%)</span>
            <input
              type="range" {...VOLUME_BOTTOM_RANGE}
              value={settings.volumeBottom}
              onChange={(e) => {
                settling('volume_bottom', Number(e.target.value))
                patch({ volumeBottom: Number(e.target.value) })
              }}
            />
            <span className="row-value">{settings.volumeBottom.toFixed(2)}</span>
          </label>
        </section>

        {/* The machine's own green rather than a hand's ink: a list of saved
            songs is about the instrument, not about what either hand does. */}
        <section className="panel-group band-app" hidden={group !== 'songs'}>
          <h2>Songs</h2>
          <p className="hint">
            A song is everything you can hear — the sections and their chords, the voice,
            the arpeggiator, the filter, the effects and the tempo. It carries nothing
            about your camera, so a song someone sends you plays with your tracking and
            your hands.
          </p>
          <p className="hint">
            Open one and it stays open: everything you change afterwards is kept in it,
            with nothing to press. Resetting the sound closes the song rather than
            overwriting it, so it is still here afterwards.
          </p>
          {presetError && (
            <p className="hint error" role="alert">
              {presetError}
            </p>
          )}

          {/* First in the group, so "keep what I am playing" is the thing in reach. */}
          <div className="row song-save">
            <input
              type="text"
              value={draftName}
              maxLength={MAX_PRESET_NAME}
              placeholder="Name this song"
              aria-label="Name for the song you are playing"
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                e.preventDefault()
                saveDraft()
              }}
            />
            <button
              type="button"
              className="song-add"
              disabled={atCap}
              title={atCap ? capTitle : 'Save what you are playing as a song'}
              onClick={saveDraft}
            >
              Save
            </button>
          </div>

          {presets.items.length === 0 ? (
            <p className="hint">
              Nothing saved yet. Build a progression, name it above, and it will keep
              itself from then on.
            </p>
          ) : (
            <ul className="song-list">
              {presets.items.map((preset, i) => {
                const label = presetLabel(preset, i)
                const open = preset.id === presets.activeId
                return (
                  <li
                    key={preset.id}
                    className={`song-row ${open ? 'open' : ''}`}
                    data-song={preset.id}
                  >
                    <button
                      type="button"
                      className="song-open"
                      // A toggle in appearance only — the lamp says which song is
                      // taking the edits, and picking it again is not "close".
                      aria-pressed={open}
                      aria-label={open ? `${label} is open` : `Open ${label}`}
                      title={open ? 'This song is open' : `Open ${label}`}
                      disabled={open}
                      onClick={() => requestOpen(preset.id)}
                    >
                      <span className="song-lamp" aria-hidden="true" />
                    </button>
                    {/* A song name is player-authored, which is the one thing the
                        scribble strip is for. */}
                    <input
                      type="text"
                      className="song-name"
                      value={preset.name}
                      maxLength={MAX_PRESET_NAME}
                      placeholder={`Song ${i + 1}`}
                      aria-label={`Name of ${label}`}
                      onChange={(e) => {
                        settling('song_renamed', i + 1)
                        onRenamePreset(preset.id, e.target.value)
                      }}
                    />
                    {pending?.id === preset.id ? (
                      <div
                        className="song-confirm"
                        role="group"
                        aria-label={
                          pending.action === 'delete'
                            ? `Delete ${label}?`
                            : `Open ${label} and replace what you are playing?`
                        }
                        // Escape closes the whole rack. With a question open on a
                        // row it means "not that", so the strip takes the key
                        // rather than letting it reach App's listener.
                        onKeyDown={(e) => {
                          if (e.key !== 'Escape') return
                          e.stopPropagation()
                          setPending(null)
                        }}
                      >
                        <span className="song-confirm-label">
                          {pending.action === 'delete' ? 'Delete?' : 'Not saved — open?'}
                        </span>
                        <button type="button" className="song-yes" onClick={resolvePending}>
                          Yes
                        </button>
                        <button
                          type="button"
                          className="song-keep"
                          onClick={() => setPending(null)}
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="song-copy"
                          aria-label={`Copy ${label} to the clipboard`}
                          title="Copy this song, to paste somewhere else"
                          onClick={() => void copySong(preset)}
                        >
                          {copied === preset.id ? 'Copied' : 'Copy'}
                        </button>
                        <button
                          type="button"
                          className="song-remove"
                          aria-label={`Delete ${label}`}
                          title="Delete this song"
                          onClick={() => setPending({ id: preset.id, action: 'delete' })}
                        >
                          ×
                        </button>
                      </>
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          {copyFailed && (
            <p className="hint error" role="alert">
              Your browser blocked the clipboard. You can still select the song's text by
              hand if you need it.
            </p>
          )}

          <div className="song-paste">
            <label className="song-paste-label" htmlFor="song-paste-field">
              Paste a song
            </label>
            <p className="hint">
              Someone sent you one? Drop it in — it lands as a new song and opens. Copying
              your own back gives you a second, separate song.
            </p>
            {/* A textarea rather than an input: the payload is pretty-printed, and
                an input would show one line of two thousand characters. */}
            <textarea
              id="song-paste-field"
              rows={2}
              value={pasted}
              spellCheck={false}
              placeholder="Paste the song text here"
              onChange={(e) => setPasted(e.target.value)}
            />
            {pasted.trim() && !pastedSong && (
              <p className="hint error" role="alert">
                That is not a DJ Hands song.
              </p>
            )}
            <button
              type="button"
              className="song-add"
              disabled={!pastedSong || atCap}
              title={atCap ? capTitle : 'Add the pasted song'}
              onClick={addPasted}
            >
              Add song
            </button>
          </div>
        </section>

        <section className="panel-group band-app" hidden={group !== 'tracking'}>
          <h2>Tracking</h2>
          {/* Enumeration only names devices once permission has been granted, so
              the list is empty on a browser that refuses it — and there is
              nothing to pick between with a single camera either. */}
          {cameras.length > 1 && (
            <>
              <label className="row">
                <span className="row-label">Camera</span>
                <select
                  value={cameraId ?? ''}
                  onChange={(e) => {
                      changed('camera', e.target.selectedIndex + 1)
                      onSelectCamera(e.target.value)
                    }}
                >
                  {cameras.map((camera, i) => (
                    <option key={camera.deviceId} value={camera.deviceId}>
                      {camera.label || `Camera ${i + 1}`}
                    </option>
                  ))}
                </select>
              </label>
              {/* A switch that fails leaves the previous camera playing, so the
                  picture gives nothing away — the reason has to be said. */}
              {cameraError && (
                <p className="hint error" role="alert">{cameraError}</p>
              )}
            </>
          )}
          <p className="hint">
            Steadiness is how long a gesture must hold before it counts. Higher rides out
            flicker; lower switches chords sooner. It is the delay you hear between moving
            a finger and the chord landing, so keep it as low as still reads cleanly.
          </p>
          <label className="row">
            <span className="row-label">Steadiness</span>
            <input
              type="range" {...DEBOUNCE_RANGE}
              value={settings.debounceFrames}
              onChange={(e) => {
                settling('steadiness', Number(e.target.value))
                patch({ debounceFrames: Number(e.target.value) })
              }}
            />
            <span className="row-value">{steadiness(settings.debounceFrames, fps)}</span>
          </label>
          <label className="row checkbox">
            <input
              type="checkbox"
              checked={settings.swapHands}
              onChange={(e) => {
                changed('swap_hands', e.target.checked)
                patch({ swapHands: e.target.checked })
              }}
            />
            <span>Swap hands <em>(if left/right are reversed)</em></span>
          </label>
          <label className="row checkbox">
            <input
              type="checkbox"
              checked={settings.showOverlay}
              onChange={(e) => {
                changed('show_overlay', e.target.checked)
                patch({ showOverlay: e.target.checked })
              }}
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
              onChange={(e) => {
                changed('reactive_overlay', e.target.checked)
                patch({ reactiveOverlay: e.target.checked })
              }}
            />
            <span>Sound-reactive hands <em>(glow follows what you hear)</em></span>
          </label>
        </section>

        {/* The reference the start screen used to carry. It sits here rather
            than in front of the camera because this is where you come back to
            it — including for the section switch, which nothing else explains. */}
        <section className="panel-group band-app" hidden={group !== 'help'}>
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
              <span className="key left"><FistIcon /></span>
              <span>
                <strong>Left hand, fist.</strong> Lets the chord go — silence.
              </span>
            </li>
            <li>
              <span className="key right"><RaiseIcon /></span>
              <span>
                <strong>Right hand, higher or lower.</strong> Volume. Raise it to swell, drop it to
                fade away.
              </span>
            </li>
            <li>
              <span className="key right"><RotateIcon /></span>
              <span>
                <strong>Right hand, rotate.</strong> Sweeps the filter set in the Filter group:
                clockwise runs the cutoff up, anticlockwise back down.
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

        {/* Credits, kept off the start screen's critical path — the people and the
            prior art behind the instrument, for whoever goes looking afterwards. */}
        <section className="panel-group band-app" hidden={group !== 'about'}>
          <h2>About</h2>
          {/* The camera claim is the one people actually want, so it is stated
              plainly and without an "entirely"/"no server" absolute that the
              analytics tag and the coffee widget would both make untrue. */}
          <p className="hint">
            DJ Hands is a webcam instrument that runs in your browser. Your camera never
            leaves this tab — frames go straight into the model on your machine and are
            thrown away, never recorded, never uploaded. No account either, and everything
            you build here saves in this browser.
          </p>
          <ul className="about-list">
            <li>
              <span className="about-label">Inspired by</span>
              <a
                href="https://gesture-synth-weld.vercel.app"
                target="_blank"
                rel="noreferrer"
                onClick={() => track('outbound_click', { link: 'gesture-synth', from: 'about' })}
              >
                gesture-synth
              </a>
              <p className="hint">
                Respect to the original for the idea of turning a webcam into an instrument.
                DJ Hands is an independent take on it.
              </p>
            </li>
            <li>
              <span className="about-label">Built by</span>
              <a
                href="https://www.linkedin.com/in/yusif-programmer/"
                target="_blank"
                rel="noreferrer"
                onClick={() => track('outbound_click', { link: 'linkedin', from: 'about' })}
              >
                Yusif Aliyev
              </a>
              <p className="hint">Say hello on LinkedIn.</p>
            </li>
            <li>
              <span className="about-label">Music as</span>
              <a
                href="https://www.joeinthestudio.com"
                target="_blank"
                rel="noreferrer"
                onClick={() => track('outbound_click', { link: 'joe-in-the-studio', from: 'about' })}
              >
                Joe in the Studio
              </a>
              <p className="hint">The project the chords come from.</p>
            </li>
          </ul>
        </section>

        {/* Through App rather than `onChange`: resetting must close the open song
            instead of folding the defaults into it. */}
        <button className="reset" onClick={() => {
            changed('reset', 'all')
            onReset()
          }}>
          Reset to defaults
        </button>
      </div>
    </aside>
  )
}
