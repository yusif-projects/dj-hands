import * as Tone from 'tone'
import {
  DEFAULT_ARP,
  arpSequence,
  cloneArp,
  randomStep,
  type ArpSettings,
} from './arp'
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
 * Scheduling headroom to give the arpeggiator's clock, in seconds.
 *
 * `App` starts the context at a `lookAhead` of 0, because a chord struck the
 * moment a hand moves wants none — see AUDIO.md#scheduling-latency. Sequenced
 * material does: with no headroom a detection frame that runs long lands the
 * next step late, which is heard as a stumble rather than as latency. 30ms is
 * enough to ride one out and is itself hidden behind the wait for the next step,
 * so the arpeggiator is the only thing that pays for it — hence set here, on the
 * engine that knows whether anything is sequenced, rather than at start-up.
 */
const ARP_LOOKAHEAD = 0.03
/** Shortest note the gate may cut a step down to; below this a step only clicks. */
const MIN_GATE_SECONDS = 0.01
/**
 * How far into a step a chord change may land and still count as belonging to it.
 *
 * Detection lags the hand by tens of milliseconds and the debouncer holds a
 * count for a frame or two on top of that, so a change meant for the beat always
 * arrives just after it. Inside the window its first note is played straight
 * away and is heard as an attack that dragged; past it the next step is the
 * nearer of the two and the walk starts there instead.
 */
const ARP_CAPTURE = 0.35
/**
 * Silent steps the clock keeps turning through before it stops.
 *
 * A hand reshaping from one chord to the next passes through a fist, and
 * stopping the clock there means the chord on the far side has to found the grid
 * again — which is what makes a progression impossible to play in time. A fist
 * held longer than this is a deliberate stop, and ends the pattern.
 */
const ARP_IDLE_STEPS = 4

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
 *
 * The arpeggiator is the one thing here that is not driven by the render loop: a
 * `Tone.Loop` on the transport walks the held chord's notes while it is on, and
 * the same gesture that would have sustained a chord instead hands it a sequence.
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
  private arp: ArpSettings = cloneArp(DEFAULT_ARP)
  /** The held chord in the pattern's walk order; empty while nothing is arping. */
  private sequence: string[] = []
  /** Where in `sequence` the last step landed; -1 before a chord's first note. */
  private arpIndex = -1
  /** Whether the clock is turning. It outlives a fist, so the grid survives one. */
  private arpRunning = false
  /** Context time the last step was scheduled for: the phase of the grid. */
  private lastStepAt = -Infinity
  /** Consecutive steps with nothing to play, counted against ARP_IDLE_STEPS. */
  private idleSteps = 0
  private loop: Tone.Loop

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
    // Built before the rack, which reads it back when the tempo moves: it is a
    // scheduled event with no nodes of its own, so an arpeggiator nobody turns on
    // costs a stopped loop and nothing else.
    this.loop = new Tone.Loop((time) => this.step(time), arpSeconds(this.arp, this.bpm))
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
    // Rebuilt rather than restarted: an edit made mid-pattern lands on the next
    // step, where re-anchoring the clock to a knob drag would stutter the rhythm.
    if (this.arp.enabled) this.sequence = this.arpNotes()
    else this.voiceNotes(this.notesForSlot(this.currentSlot))
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
    // The rack and the arpeggiator share one tempo, so a locked pattern has to
    // follow a tempo edit that arrives through here as well as through `setArp`.
    if (this.arp.enabled) this.loop.interval = arpSeconds(this.arp, this.bpm)
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
   * The whole arpeggiator at once — on/off, pattern, rate, octave span and gate —
   * taken with the tempo for the same reason `setEffects` is: a locked rate is a
   * function of both, and splitting them would apply the same timing twice.
   *
   * Switching it on or off mid-chord hands the held shape over between the two
   * ways of playing it rather than dropping it: a sustained chord is released
   * into the pattern, and the pattern is released back into a sustained chord.
   */
  setArp(arp: ArpSettings, bpm: number = this.bpm) {
    const was = this.arp.enabled
    this.arp = arp
    this.bpm = bpm
    this.loop.interval = arpSeconds(arp, bpm)

    if (arp.enabled) {
      // Sequenced material needs the headroom a gesture does not; see
      // ARP_LOOKAHEAD. Set before the first step is scheduled.
      Tone.getContext().lookAhead = ARP_LOOKAHEAD
      const transport = Tone.getTransport()
      if (transport.state !== 'started') transport.start()
      if (was) {
        // A pattern or octave edit: rebuild what is walked, but leave the clock
        // where it is — re-anchoring it on every tick of a knob drag would
        // stutter the rhythm the drag is trying to hear.
        this.sequence = this.arpNotes()
      } else {
        // Whatever the old mode was sustaining has to be let go, or it drones
        // underneath the pattern for as long as the shape is held.
        if (this.heldNotes) this.synth.triggerRelease(this.heldNotes)
        this.heldNotes = null
        this.anchorArp()
      }
      return
    }

    if (!was) return
    this.stopArp()
    Tone.getContext().lookAhead = 0
    // The shape is still held, so the chord it names should still be sounding:
    // turning the arpeggiator off otherwise reads as a mute.
    if (this.currentSlot !== null) this.voiceNotes(this.notesForSlot(this.currentSlot))
  }

  /** The held chord in the pattern's walk order, or nothing while none is held. */
  private arpNotes(): string[] {
    if (this.currentSlot === null) return []
    return arpSequence(this.notesForSlot(this.currentSlot), this.arp.pattern, this.arp.octaves)
  }

  /**
   * Starts the pattern on the chord that opens a phrase: the sequence is built,
   * the walk starts at its first note, and the clock is anchored to the gesture
   * so that note lands *with* it rather than up to a step later. A phrase begins
   * where the hand says it does — this is an instrument you play, not a sequencer
   * you play along to.
   *
   * Only a phrase anchors. Once the clock is turning every chord after it goes
   * through `moveArp` and leaves the grid alone.
   */
  private anchorArp() {
    this.sequence = this.arpNotes()
    this.arpIndex = -1
    this.idleSteps = 0
    if (!this.sequence.length) {
      this.stopArp()
      return
    }
    // Cancelled before it is restarted: `start` on a loop that is already
    // scheduled leaves the old phase running beside the new one.
    this.loop.cancel(0)
    this.loop.start(Tone.getTransport().seconds)
    this.arpRunning = true
  }

  /**
   * A new chord under a turning clock: the notes change, the grid does not. The
   * hand sets the pulse once, at the top of the phrase; moving it again on every
   * chord after that is what made a progression impossible to play in time, since
   * a change is only ever seen as fast as the camera and the debouncer allow.
   *
   * Inside `ARP_CAPTURE` of the last step the change belongs to that step, so its
   * first note is played now; past it, the walk starts on the next one. A step
   * that is scheduled but has not sounded yet reads as a negative age and waits,
   * which is the safe side of the two: it costs a step, where playing early would
   * sound the new chord ahead of a note the old one has already booked.
   *
   * Nothing to play is not a stop — the clock keeps turning and `step` counts the
   * silence, so a hand passing through a fist keeps the grid it came in on.
   */
  private moveArp() {
    this.sequence = this.arpNotes()
    this.arpIndex = -1
    this.idleSteps = 0
    if (!this.sequence.length) return
    if (!this.arpRunning) {
      this.anchorArp()
      return
    }
    const now = Tone.now()
    const age = now - this.lastStepAt
    if (age >= 0 && age < ARP_CAPTURE * arpSeconds(this.arp, this.bpm)) this.playStep(0, now)
  }

  private stopArp() {
    this.loop.stop()
    this.arpRunning = false
    this.sequence = []
    this.arpIndex = -1
    this.idleSteps = 0
  }

  /**
   * One step. Runs off the transport rather than the render loop, so `time` is
   * the moment Tone scheduled it for and every trigger is placed at it rather
   * than at whenever the callback happened to run.
   */
  private step(time: number) {
    // Kept on every tick, the silent ones included: this is the phase of the
    // grid, and the capture window in `moveArp` is measured back from it.
    this.lastStepAt = time
    const { sequence } = this
    if (!sequence.length) {
      // A fist, or a slot whose chord will not parse. The clock rides it out for
      // a moment rather than stopping, so a hand on its way between two chords
      // does not have to found the grid again on the far side.
      if (++this.idleSteps > ARP_IDLE_STEPS) this.stopArp()
      return
    }
    this.idleSteps = 0
    this.playStep(
      this.arp.pattern === 'random'
        ? randomStep(sequence.length, this.arpIndex)
        : (this.arpIndex + 1) % sequence.length,
      time,
    )
  }

  /**
   * One note of the walk, placed at `time`. Attack and release together: a step is
   * a note of its own length, and the voice diffing `voiceNotes` does is for
   * holding a chord, not for playing one.
   */
  private playStep(index: number, time: number) {
    this.arpIndex = index
    this.synth.triggerAttackRelease(this.sequence[index], this.gateSeconds(), time)
  }

  /** How long one step rings, from the gate's share of it. */
  private gateSeconds(): number {
    return Math.max(MIN_GATE_SECONDS, this.arp.gate * arpSeconds(this.arp, this.bpm))
  }

  /**
   * Sustain semantics: a new slot releases the old chord and attacks the new one;
   * `null` (fist or hand lost) releases everything.
   */
  setChordSlot(slot: number | null) {
    if (slot === this.currentSlot) return
    this.currentSlot = slot
    if (this.arp.enabled) this.moveArp()
    else this.voiceNotes(slot === null ? [] : this.notesForSlot(slot))
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
    this.stopArp()
  }

  dispose() {
    this.releaseAll()
    // The transport is global and outlives this engine, so the loop has to be
    // taken off it by hand — a stopped-but-scheduled event left behind would be
    // stepped a second time by the next session's engine.
    this.loop.dispose()
    Tone.getTransport().stop()
    // Both handed back the way they were found, so the next session starts from
    // the same place this one did rather than from whatever it left behind.
    Tone.getContext().lookAhead = 0
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

/** The arpeggiator's step length in seconds, from whichever side of its lock is live. */
function arpSeconds(arp: ArpSettings, bpm: number): number {
  return effectMs(arp.timing, bpm) / 1000
}

/** A period in milliseconds as the rate in Hz an LFO wants. */
function hz(ms: number): number {
  return 1000 / ms
}
