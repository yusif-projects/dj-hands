import * as Tone from 'tone'
import { chordToNotes, type ChordName } from './chords'
import { PRESETS, type Preset } from './presets'

const MIN_DB = -40
const MAX_DB = 0
/** Volume ramp time; long enough to avoid zipper noise, short enough to feel live. */
const VOLUME_RAMP = 0.05

/**
 * Imperative wrapper around the Tone graph. Called directly from the tracking
 * loop rather than through React effects, so audio never waits on a render.
 *
 * Graph: PolySynth -> Filter -> Reverb -> Volume -> Destination
 */
export class SynthEngine {
  private synth: Tone.PolySynth<Tone.Synth>
  private filter: Tone.Filter
  private reverb: Tone.Reverb
  private volume: Tone.Volume

  private heldNotes: string[] | null = null
  private currentSlot: number | null = null
  private presetIndex = 0
  private presets: Preset[] = PRESETS.map((p) => ({ ...p }))
  private chords: ChordName[] = []
  private octave = 3

  constructor() {
    this.volume = new Tone.Volume(MIN_DB).toDestination()
    this.reverb = new Tone.Reverb({ decay: 3, wet: PRESETS[0].reverb }).connect(this.volume)
    this.filter = new Tone.Filter({ type: 'lowpass', frequency: PRESETS[0].cutoff }).connect(this.reverb)
    this.synth = new Tone.PolySynth(Tone.Synth).connect(this.filter)
    this.synth.maxPolyphony = 16
    this.applyPreset(this.presets[0])
  }

  /** Chord slots for left-hand gestures 1-5. */
  setChords(chords: ChordName[]) {
    this.chords = chords
    // Re-voice a sounding chord if its slot was just remapped.
    if (this.currentSlot !== null) {
      const slot = this.currentSlot
      this.currentSlot = null
      this.setChordSlot(slot)
    }
  }

  setOctave(octave: number) {
    if (octave === this.octave) return
    this.octave = octave
    if (this.currentSlot !== null) {
      const slot = this.currentSlot
      this.currentSlot = null
      this.setChordSlot(slot)
    }
  }

  setPresets(presets: Preset[]) {
    this.presets = presets
    this.setPreset(this.presetIndex, true)
  }

  /**
   * Sustain semantics: a new slot releases the old chord and attacks the new one;
   * `null` (fist or hand lost) releases everything.
   */
  setChordSlot(slot: number | null) {
    if (slot === this.currentSlot) return

    if (this.heldNotes) {
      this.synth.triggerRelease(this.heldNotes)
      this.heldNotes = null
    }
    this.currentSlot = slot

    if (slot === null) return
    const chord = this.chords[slot]
    if (!chord) return

    const notes = chordToNotes(chord, this.octave)
    this.synth.triggerAttack(notes)
    this.heldNotes = notes
  }

  setPreset(index: number, force = false) {
    if (index === this.presetIndex && !force) return
    const preset = this.presets[index]
    if (!preset) return
    this.presetIndex = index
    this.applyPreset(preset)

    // Tone's `set` only cleanly reaches idle voices, so retrigger anything held
    // to make the new timbre audible immediately.
    if (this.heldNotes) {
      const notes = this.heldNotes
      this.synth.triggerRelease(notes)
      this.synth.triggerAttack(notes)
    }
  }

  private applyPreset(preset: Preset) {
    this.synth.set({
      oscillator: { type: preset.oscillator } as Tone.SynthOptions['oscillator'],
      envelope: {
        attack: preset.attack,
        decay: preset.decay,
        sustain: preset.sustain,
        release: preset.release,
      },
    })
    this.filter.frequency.rampTo(preset.cutoff, 0.1)
    this.reverb.wet.rampTo(preset.reverb, 0.1)
  }

  /** `level` is 0-1; mapped onto MIN_DB..MAX_DB and ramped. */
  setVolume(level: number) {
    const clamped = Math.min(1, Math.max(0, level))
    const db = clamped === 0 ? -Infinity : MIN_DB + (MAX_DB - MIN_DB) * clamped
    this.volume.volume.rampTo(db, VOLUME_RAMP)
  }

  get preset() {
    return this.presetIndex
  }

  releaseAll() {
    this.synth.releaseAll()
    this.heldNotes = null
    this.currentSlot = null
  }

  dispose() {
    this.releaseAll()
    this.synth.dispose()
    this.filter.dispose()
    this.reverb.dispose()
    this.volume.dispose()
  }
}
