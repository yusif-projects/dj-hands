import * as Tone from 'tone'
import { slotToNotes, type ChordSlot } from './chords'
import {
  BITCRUSHER_BITS,
  CHORUS_DELAY_TIME,
  CHORUS_DEPTH,
  CHORUS_FREQUENCY,
  DEFAULT_BPM,
  DEFAULT_EFFECTS,
  DEFAULT_TIMING,
  DELAY_FEEDBACK,
  DELAY_MAX_SECONDS,
  EFFECT_IDS,
  PHASER_BASE_FREQUENCY,
  PHASER_OCTAVES,
  REVERB_DECAY,
  TREMOLO_DEPTH,
  cloneEffects,
  effectMs,
  type EffectId,
  type EffectSetting,
} from './effects'
import { DEFAULT_FILTER_TYPE, cutoffHz, type FilterType } from './filter'
import { DEFAULT_VOICE, type Voice } from './voice'

// `cutoffHz` moved to `filter.ts` so the HUD can label the sweep without
// importing the Tone graph. Re-exported because this was its address first.
export { cutoffHz } from './filter'

const MIN_DB = -40
const MAX_DB = 0
/** Volume ramp time; long enough to avoid zipper noise, short enough to feel live. */
const VOLUME_RAMP = 0.05
/** Cutoff ramp time; same trade-off as VOLUME_RAMP, and driven at frame rate too. */
const CUTOFF_RAMP = 0.05
/** Effect ramp time; only settings move it, but a knob drag should not click. */
const EFFECT_RAMP = 0.05

/**
 * The node behind each effect. Typed per id rather than as one union, so the
 * three timed effects' own parameters — `delayTime` on one, `frequency` on the
 * other two — are reachable without narrowing a node back down at every use.
 */
interface EffectNodes {
  bitcrusher: Tone.BitCrusher
  chorus: Tone.Chorus
  tremolo: Tone.Tremolo
  phaser: Tone.Phaser
  delay: Tone.FeedbackDelay
  reverb: Tone.Reverb
}

const DEFAULT_CUTOFF_MIN = 200
const DEFAULT_CUTOFF_MAX = 8000

/** Quietest level the visualiser resolves; below this the overlay reads as silent. */
const METER_FLOOR_DB = -48
/** Kept light: the overlay's own follower does the shaping the eye responds to. */
const METER_SMOOTHING = 0.2

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
 * Graph: PolySynth -> Filter -> [the effects, in their configured order] ->
 * Volume -> Destination
 *
 * The rack's order is the player's to set, so the chain is rebuilt rather than
 * fixed. The default puts the delay before the reverb, so its repeats are caught
 * by the tail rather than arriving dry after it. A Meter hangs off Volume as a
 * dead end, feeding `getLevel` for the overlay without altering what is heard.
 */
export class SynthEngine {
  private synth: Tone.PolySynth<Tone.Synth>
  private filter: Tone.Filter
  private nodes: EffectNodes
  private volume: Tone.Volume
  private meter: Tone.Meter

  private heldNotes: string[] | null = null
  private currentSlot: number | null = null
  private voice: Voice = { ...DEFAULT_VOICE }
  private filterType: FilterType = DEFAULT_FILTER_TYPE
  private cutoffMin = DEFAULT_CUTOFF_MIN
  private cutoffMax = DEFAULT_CUTOFF_MAX
  private cutoffAmount = 1
  private effects: EffectSetting[] = cloneEffects(DEFAULT_EFFECTS)
  private bpm = DEFAULT_BPM
  /** The chain as it is currently wired, so only a real reorder rebuilds it. */
  private order: EffectId[] = []
  private slots: ChordSlot[] = []
  private octave = 3

  constructor() {
    this.volume = new Tone.Volume(MIN_DB).toDestination()
    // Tapped post-volume so the wrist-height gesture scales what the overlay
    // sees. Analysis only: the meter's passthrough output goes nowhere, so this
    // fan-out costs no second path to the speakers.
    this.meter = new Tone.Meter({ smoothing: METER_SMOOTHING, channelCount: 1 })
    this.volume.connect(this.meter)
    // All six start bypassed and unchained; `setEffects` below wires them in
    // the configured order and opens whichever ones carry an amount.
    this.nodes = {
      // The crusher's quantizer is an AudioWorklet, and Tone registers the
      // module asynchronously — until it resolves the node passes dry. It is
      // built here rather than lazily so that wait is spent during startup,
      // not on the first drag of its knob.
      bitcrusher: new Tone.BitCrusher(BITCRUSHER_BITS),
      // The LFO has to be started by hand, or the chorus is silent at any wet.
      chorus: new Tone.Chorus({
        frequency: CHORUS_FREQUENCY,
        delayTime: CHORUS_DELAY_TIME,
        depth: CHORUS_DEPTH,
        wet: 0,
      }).start(),
      // Same LFO rule as the chorus.
      tremolo: new Tone.Tremolo({
        frequency: hz(DEFAULT_TIMING.tremolo!.ms),
        depth: TREMOLO_DEPTH,
        wet: 0,
      }).start(),
      // The phaser starts its own LFOs in its constructor; nothing to start.
      phaser: new Tone.Phaser({
        frequency: hz(DEFAULT_TIMING.phaser!.ms),
        octaves: PHASER_OCTAVES,
        baseFrequency: PHASER_BASE_FREQUENCY,
        wet: 0,
      }),
      // `maxDelay` is fixed at construction and Tone defaults it to a second.
      // Tone bounds `delayTime` by it and throws past it rather than clamping,
      // so an undersized buffer is a crash on the first long division, not a
      // quiet mistuning. `DELAY_MAX_SECONDS` derives the size it has to be.
      delay: new Tone.FeedbackDelay({
        delayTime: DEFAULT_TIMING.delay!.ms / 1000,
        maxDelay: DELAY_MAX_SECONDS,
        feedback: DELAY_FEEDBACK,
        wet: 0,
      }),
      reverb: new Tone.Reverb({ decay: REVERB_DECAY, wet: 0 }),
    }
    // Tone types the BitCrusher's option bag as its worklet's, which carries no
    // `wet`, so the one node that cannot be closed in its constructor is closed
    // here instead.
    this.nodes.bitcrusher.wet.value = 0
    // Opens fully until a hand is seen, so the first chord is not muffled.
    this.filter = new Tone.Filter({
      type: DEFAULT_FILTER_TYPE,
      frequency: DEFAULT_CUTOFF_MAX,
    })
    this.synth = new Tone.PolySynth(Tone.Synth).connect(this.filter)
    // Extended chords run to five notes plus a slash bass, and release tails
    // hold voices past a change.
    this.synth.maxPolyphony = 32
    this.applyVoice(this.voice)
    // Nothing is chained yet, so this both opens the amounts and builds the chain.
    this.setEffects(this.effects)
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

  /**
   * The whole rack at once: each effect's wet mix, each timed effect's rate, and
   * the order they run in. Every edit lands here, so a knob drag is heard on a
   * chord that is already sounding rather than only on the next one.
   *
   * `bpm` is taken alongside rather than held as its own setter because a locked
   * effect's rate is a function of both, and splitting them would mean applying
   * the same timing twice for one edit.
   */
  setEffects(effects: EffectSetting[], bpm: number = this.bpm) {
    this.effects = effects
    this.bpm = bpm
    for (const effect of effects) {
      this.nodes[effect.id].wet.rampTo(clamp01(effect.amount), EFFECT_RAMP)
      if (effect.timing) this.setTiming(effect.id, effectMs(effect.timing, bpm))
    }
    if (!this.sameOrder(effects)) this.rewire()
  }

  /**
   * One timed effect's period, in milliseconds. The two LFOs take a frequency
   * and the delay a time, so this is where the rack's one unit fans back out.
   *
   * Ramped rather than set, like every other parameter here. On the delay that
   * pitch-bends the tail while it moves, the way a tape delay does — deliberate,
   * and the better of the two: setting `delayTime` outright clicks instead.
   */
  private setTiming(id: EffectId, ms: number) {
    if (id === 'delay') this.nodes.delay.delayTime.rampTo(ms / 1000, EFFECT_RAMP)
    else if (id === 'tremolo') this.nodes.tremolo.frequency.rampTo(hz(ms), EFFECT_RAMP)
    else if (id === 'phaser') this.nodes.phaser.frequency.rampTo(hz(ms), EFFECT_RAMP)
  }

  private sameOrder(effects: EffectSetting[]): boolean {
    const { order } = this
    return order.length === effects.length && order.every((id, i) => id === effects[i].id)
  }

  /**
   * Rebuilds the chain between the filter and the volume. Tone's no-argument
   * `disconnect` drops every outgoing connection, so the old order is torn down
   * whole rather than unpicked link by link.
   *
   * A reorder is a settings-panel action, and the brief discontinuity it puts
   * through a sounding chord is accepted rather than crossfaded around.
   */
  private rewire() {
    this.filter.disconnect()
    for (const id of EFFECT_IDS) this.nodes[id].disconnect()

    let tail: Tone.ToneAudioNode = this.filter
    for (const { id } of this.effects) {
      tail.connect(this.nodes[id])
      tail = this.nodes[id]
    }
    tail.connect(this.volume)
    this.order = this.effects.map((effect) => effect.id)
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
    for (const id of EFFECT_IDS) this.nodes[id].dispose()
    this.volume.dispose()
    this.meter.dispose()
  }
}

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v))
}

/** A period in milliseconds as the rate in Hz an LFO wants. */
function hz(ms: number): number {
  return 1000 / ms
}
