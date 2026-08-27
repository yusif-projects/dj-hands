import * as Tone from 'tone'
import { chordToNotes, resolveOctave, type ChordName } from './chords'
import { DEFAULT_SEND_AMOUNT, DEFAULT_SEND_TARGET, sendWet, type SendTarget } from './effects'
import { DEFAULT_VOICE, type Voice } from './voice'

const MIN_DB = -40
const MAX_DB = 0
/** Volume ramp time; long enough to avoid zipper noise, short enough to feel live. */
const VOLUME_RAMP = 0.05
/** Cutoff ramp time; same trade-off as VOLUME_RAMP, and driven at frame rate too. */
const CUTOFF_RAMP = 0.05
/** Send ramp time; only settings move it, but a slider drag should not click. */
const SEND_RAMP = 0.05

/** The delay's character is fixed; only how much of it you hear is played. */
const DELAY_TIME = 0.25
const DELAY_FEEDBACK = 0.35

const DEFAULT_CUTOFF_MIN = 200
const DEFAULT_CUTOFF_MAX = 8000

/**
 * Maps a 0-1 rotation amount onto a cutoff in Hz. Exponential, because pitch and
 * brightness are heard in ratios: a linear sweep spends most of its travel in a
 * range that sounds identically open.
 */
export function cutoffHz(amount: number, min: number, max: number): number {
  const lo = Math.max(1, min)
  const hi = Math.max(lo, max)
  return lo * (hi / lo) ** clamp01(amount)
}

/**
 * Imperative wrapper around the Tone graph. Called directly from the tracking
 * loop rather than through React effects, so audio never waits on a render.
 *
 * Graph: PolySynth -> Filter -> FeedbackDelay -> Reverb -> Volume -> Destination
 *
 * The delay sits before the reverb so its repeats are caught by the tail rather
 * than arriving dry after it.
 */
export class SynthEngine {
  private synth: Tone.PolySynth<Tone.Synth>
  private filter: Tone.Filter
  private delay: Tone.FeedbackDelay
  private reverb: Tone.Reverb
  private volume: Tone.Volume

  private heldNotes: string[] | null = null
  private currentSlot: number | null = null
  private voice: Voice = { ...DEFAULT_VOICE }
  private cutoffMin = DEFAULT_CUTOFF_MIN
  private cutoffMax = DEFAULT_CUTOFF_MAX
  private cutoffAmount = 1
  private sendAmount = DEFAULT_SEND_AMOUNT
  private sendTarget: SendTarget = DEFAULT_SEND_TARGET
  private chords: ChordName[] = []
  private chordOctaves: number[] = []
  private octave = 3

  constructor() {
    this.volume = new Tone.Volume(MIN_DB).toDestination()
    // Both start bypassed; `applySend` below opens whichever one is assigned.
    this.reverb = new Tone.Reverb({ decay: 3, wet: 0 }).connect(this.volume)
    this.delay = new Tone.FeedbackDelay({
      delayTime: DELAY_TIME,
      feedback: DELAY_FEEDBACK,
      wet: 0,
    }).connect(this.reverb)
    // Opens fully until a hand is seen, so the first chord is not muffled.
    this.filter = new Tone.Filter({ type: 'lowpass', frequency: DEFAULT_CUTOFF_MAX }).connect(
      this.delay,
    )
    this.synth = new Tone.PolySynth(Tone.Synth).connect(this.filter)
    // Extended chords run to five notes, and release tails hold voices past a change.
    this.synth.maxPolyphony = 32
    this.applyVoice(this.voice)
    this.applySend()
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

  setVoice(voice: Voice) {
    const waveformChanged = voice.waveform !== this.voice.waveform
    this.voice = voice
    this.applyVoice(voice)

    // Tone's `set` only cleanly reaches idle voices, so a new waveform needs held
    // notes retriggered to be audible. An envelope edit does not: it lands on the
    // next attack, and retriggering would re-strike the chord on every slider tick.
    if (waveformChanged && this.heldNotes) {
      const notes = this.heldNotes
      this.synth.triggerRelease(notes)
      this.synth.triggerAttack(notes)
    }
  }

  private applyVoice(voice: Voice) {
    this.synth.set({
      oscillator: { type: voice.waveform } as Tone.SynthOptions['oscillator'],
      envelope: {
        attack: voice.attack,
        decay: voice.decay,
        sustain: voice.sustain,
        release: voice.release,
      },
    })
  }

  /** The Hz the rotation sweep runs between. */
  setCutoffRange(min: number, max: number) {
    this.cutoffMin = min
    this.cutoffMax = max
    this.setCutoff(this.cutoffAmount)
  }

  /** `amount` is 0-1; mapped exponentially onto the configured Hz range and ramped. */
  setCutoff(amount: number) {
    this.cutoffAmount = clamp01(amount)
    this.filter.frequency.rampTo(
      cutoffHz(this.cutoffAmount, this.cutoffMin, this.cutoffMax),
      CUTOFF_RAMP,
    )
  }

  /** Which effect(s) the send feeds; the rest stay fully dry. */
  setSendTarget(target: SendTarget) {
    this.sendTarget = target
    this.applySend()
  }

  /** `amount` is 0-1: the wet mix an assigned effect sits at. */
  setSendAmount(amount: number) {
    this.sendAmount = clamp01(amount)
    this.applySend()
  }

  /**
   * Both send edits land here, so a slider drag is heard on a chord that is
   * already sounding rather than only on the next one.
   */
  private applySend() {
    const { sendAmount, sendTarget } = this
    this.reverb.wet.rampTo(sendWet(sendAmount, sendTarget, 'reverb'), SEND_RAMP)
    this.delay.wet.rampTo(sendWet(sendAmount, sendTarget, 'delay'), SEND_RAMP)
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

  /** `level` is 0-1; mapped onto MIN_DB..MAX_DB and ramped. */
  setVolume(level: number) {
    const clamped = clamp01(level)
    const db = clamped === 0 ? -Infinity : MIN_DB + (MAX_DB - MIN_DB) * clamped
    this.volume.volume.rampTo(db, VOLUME_RAMP)
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
    this.delay.dispose()
    this.reverb.dispose()
    this.volume.dispose()
  }
}

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v))
}
