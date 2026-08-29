import * as Tone from 'tone'
import { slotToNotes, type ChordSlot } from './chords'
import { DEFAULT_SEND_AMOUNT, DEFAULT_SEND_TARGET, sendWet, type SendTarget } from './effects'
import { DEFAULT_FILTER_TYPE, type FilterType } from './filter'
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

/** Quietest level the visualiser resolves; below this the overlay reads as silent. */
const METER_FLOOR_DB = -48
/** Kept light: the overlay's own follower does the shaping the eye responds to. */
const METER_SMOOTHING = 0.2

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
 * Maps a meter reading in dB onto 0-1 for the overlay. Linear in dB rather than
 * in amplitude, because a linear-amplitude glow spends almost all of its travel
 * in the top few dB and reads as an on/off switch.
 *
 * A silent meter reads -Infinity, so anything non-finite floors at 0.
 */
export function levelFromDb(db: number, floor: number = METER_FLOOR_DB): number {
  if (!Number.isFinite(db)) return 0
  const span = -floor
  if (span <= 0) return db >= 0 ? 1 : 0
  return clamp01((db - floor) / span)
}

/**
 * Imperative wrapper around the Tone graph. Called directly from the tracking
 * loop rather than through React effects, so audio never waits on a render.
 *
 * Graph: PolySynth -> Filter -> FeedbackDelay -> Reverb -> Volume -> Destination
 *
 * The delay sits before the reverb so its repeats are caught by the tail rather
 * than arriving dry after it. A Meter hangs off Volume as a dead end, feeding
 * `getLevel` for the overlay without altering what is heard.
 */
export class SynthEngine {
  private synth: Tone.PolySynth<Tone.Synth>
  private filter: Tone.Filter
  private delay: Tone.FeedbackDelay
  private reverb: Tone.Reverb
  private volume: Tone.Volume
  private meter: Tone.Meter

  private heldNotes: string[] | null = null
  private currentSlot: number | null = null
  private voice: Voice = { ...DEFAULT_VOICE }
  private filterType: FilterType = DEFAULT_FILTER_TYPE
  private cutoffMin = DEFAULT_CUTOFF_MIN
  private cutoffMax = DEFAULT_CUTOFF_MAX
  private cutoffAmount = 1
  private sendAmount = DEFAULT_SEND_AMOUNT
  private sendTarget: SendTarget = DEFAULT_SEND_TARGET
  private slots: ChordSlot[] = []
  private octave = 3

  constructor() {
    this.volume = new Tone.Volume(MIN_DB).toDestination()
    // Tapped post-volume so the wrist-height gesture scales what the overlay
    // sees. Analysis only: the meter's passthrough output goes nowhere, so this
    // fan-out costs no second path to the speakers.
    this.meter = new Tone.Meter({ smoothing: METER_SMOOTHING, channelCount: 1 })
    this.volume.connect(this.meter)
    // Both start bypassed; `applySend` below opens whichever one is assigned.
    this.reverb = new Tone.Reverb({ decay: 3, wet: 0 }).connect(this.volume)
    this.delay = new Tone.FeedbackDelay({
      delayTime: DELAY_TIME,
      feedback: DELAY_FEEDBACK,
      wet: 0,
    }).connect(this.reverb)
    // Opens fully until a hand is seen, so the first chord is not muffled.
    this.filter = new Tone.Filter({
      type: DEFAULT_FILTER_TYPE,
      frequency: DEFAULT_CUTOFF_MAX,
    }).connect(this.delay)
    this.synth = new Tone.PolySynth(Tone.Synth).connect(this.filter)
    // Extended chords run to five notes plus a slash bass, and release tails
    // hold voices past a change.
    this.synth.maxPolyphony = 32
    this.applyVoice(this.voice)
    this.applySend()
  }

  /** Chord and voicing for left-hand gestures 1-5. */
  setChordSlots(slots: ChordSlot[]) {
    this.slots = slots
    // Re-voice a sounding chord if its slot was just remapped.
    this.revoice()
  }

  setOctave(octave: number) {
    if (octave === this.octave) return
    this.octave = octave
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

  /** Lowpass, highpass or bandpass; the sweep drives whichever is set. */
  setFilterType(type: FilterType) {
    if (type === this.filterType) return
    this.filterType = type
    // Set rather than ramped: the response shape changes discontinuously anyway,
    // and Tone's `type` is a plain property with nothing to ramp.
    this.filter.type = type
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
    const config = this.slots[slot]
    if (!config) return []
    try {
      return slotToNotes(config, this.octave)
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
  }

  /**
   * Output level as 0-1, for the overlay. Read from the signal rather than from
   * the gesture, so a released chord's envelope and effect tails still register
   * after the hand has gone.
   */
  getLevel(): number {
    const value = this.meter.getValue()
    return levelFromDb(Array.isArray(value) ? value[0] : value)
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
    this.meter.dispose()
  }
}

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v))
}
