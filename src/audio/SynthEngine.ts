import * as Tone from 'tone'
import { chordToNotes, resolveOctave, type ChordName } from './chords'
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
  private chordOctaves: number[] = []
  private octave = 3

  constructor() {
    this.volume = new Tone.Volume(MIN_DB).toDestination()
    this.reverb = new Tone.Reverb({ decay: 3, wet: PRESETS[0].reverb }).connect(this.volume)
    this.filter = new Tone.Filter({ type: 'lowpass', frequency: PRESETS[0].cutoff }).connect(this.reverb)
    this.synth = new Tone.PolySynth(Tone.Synth).connect(this.filter)
    // Extended chords run to five notes, and release tails hold voices past a change.
    this.synth.maxPolyphony = 32
    this.applyPreset(this.presets[0])
  }

  /** Chord slots for left-hand gestures 1-5. */
  setChords(chords: ChordName[]) {
    this.chords = chords
    // Re-voice a sounding chord if its slot was just remapped.
    this.revoice()
  }

  setOctave(octave: number) {
    if (octave === this.octave) return
    this.octave = octave
    this.revoice()
  }

  /** Per-slot octave shifts, applied on top of the global octave. */
  setChordOctaves(offsets: number[]) {
    this.chordOctaves = offsets
    this.revoice()
  }

  /** Re-voices the sounding chord so a chord or octave edit is heard immediately. */
  private revoice() {
    if (this.currentSlot === null) return
    this.voiceNotes(this.notesForSlot(this.currentSlot))
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
    this.currentSlot = slot
    this.voiceNotes(slot === null ? [] : this.notesForSlot(slot))
  }

  private notesForSlot(slot: number): string[] {
    const chord = this.chords[slot]
    if (!chord) return []
    try {
      return chordToNotes(chord, resolveOctave(this.octave, this.chordOctaves[slot]))
    } catch {
      // An unusable chord name silences its own slot rather than the whole loop.
      return []
    }
  }

  /**
   * Moves the sounding voices to `notes`. Notes common to the old and new chord
   * keep ringing: Tone hands out a fresh voice per attack and only recycles one
   * once it falls silent, so releasing and re-attacking a still-sounding note in
   * the same tick leaves the old voice audible over the new one.
   */
  private voiceNotes(notes: string[]) {
    const held = this.heldNotes ?? []
    const release = held.filter((note) => !notes.includes(note))
    const attack = notes.filter((note) => !held.includes(note))
    if (release.length) this.synth.triggerRelease(release)
    if (attack.length) this.synth.triggerAttack(attack)
    this.heldNotes = notes.length > 0 ? notes : null
    // Temporary: shows in the dev console which notes each chord actually voices.
    if (import.meta.env.DEV) {
      console.debug('[synth] slot', this.currentSlot, this.chords[this.currentSlot ?? -1], notes)
    }
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
