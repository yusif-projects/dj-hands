import * as Tone from 'tone'
import {
  DEFAULT_ARP,
  arpSequence,
  cloneArp,
  randomStep,
  type ArpSettings,
} from './arp'
import {
  BEATS_PER_BAR,
  DEFAULT_CLOCK,
  beatSeconds,
  beatsSinceGrid,
  cloneClock,
  isGridBeat,
  type ClockSettings,
} from './clock'
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
import { DEFAULT_VOICE, layerDetune, layerGainsDb, type Voice } from './voice'

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
 * Scheduling headroom to give anything sequenced, in seconds.
 *
 * `App` starts the context at a `lookAhead` of 0, because a chord struck the
 * moment a hand moves wants none — see AUDIO.md#scheduling-latency. Sequenced
 * material does: with no headroom a detection frame that runs long lands the
 * next event late, which is heard as a stumble rather than as latency. 30ms is
 * enough to ride one out and is itself hidden behind the wait for the next
 * event, so only sequenced material pays for it — hence set here, on the engine
 * that knows what is sequenced, rather than at start-up.
 */
const SEQUENCE_LOOKAHEAD = 0.03
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
 * How far past a grid point a chord change may land and still be played on it.
 *
 * The same problem `ARP_CAPTURE` solves, one layer up: the camera, the detector
 * and the debouncer between them make every gesture late, so a chord meant for
 * the beat always arrives just after it. Without a window it would miss the grid
 * point it was aimed at and wait for the next one — a whole bar, at the coarsest
 * setting, for being twenty milliseconds human.
 *
 * A fraction of a *beat* rather than of the grid: how late a player is does not
 * grow with the length of the bar. A fifth of one is 100ms at 120 BPM.
 */
const QUANTIZE_CAPTURE = 0.2
/** The click, a fifth apart, so the downbeat is heard as the downbeat. */
const CLICK_HIGH_HZ = 1600
const CLICK_LOW_HZ = 1100
/** Short enough to read as a click rather than as a note the instrument played. */
const CLICK_DECAY = 0.03
/** Under the chords rather than over them: a metronome is a reference, not a part. */
const CLICK_DB = -12
/**
 * How late a beat may be delivered and still be worth clicking, as a fraction of
 * a beat.
 *
 * A blocked main thread — the hand model loading, a long detection frame, a
 * backgrounded tab — leaves the transport handing over ticks well after the times
 * they carry, sometimes several in one moment. A click that cannot be placed on
 * the beat is worse than no click: it is heard as an extra note, and a whole
 * backlog of them at once is heard as a stutter. So a beat this far past is
 * counted and skipped.
 *
 * Half a beat, because what is being excluded is a click that has lost its
 * meaning rather than one that ran a little late — and only the sound is skipped.
 * The grid's phase is kept, so the next beat lands exactly where it would have,
 * and the lamps keep counting: a readout is most wanted on the machine that is
 * struggling, and React coalesces a burst of them into the one that arrived last.
 */
const STALE_CLICK = 0.5

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

/** One beat of the clock, as the meter bridge draws it. */
export interface BeatPulse {
  /** Beats since the clock started, so a bar is four consecutive values. */
  beat: number
  /** Where in the bar it fell: 0 is the downbeat. */
  beatInBar: number
}

/**
 * Imperative wrapper around the Tone graph. Called directly from the tracking
 * loop rather than through React effects, so audio never waits on a render.
 *
 * Graph: PolySynth A ─┐
 *        PolySynth B ─┼─> Filter -> [the effects, in their configured order] ->
 *        PolySynth C ─┘   Volume -> Destination
 *
 * Three oscillators rather than one, balanced equal-power and detunable against
 * each other, sharing a single envelope and everything downstream of the filter.
 * The second and third are off by default and, while they are, are never
 * triggered at all — see `live`.
 *
 * The rack's order is the player's to set, so the chain is rebuilt rather than
 * fixed. The default puts the delay before the reverb, so its repeats are caught
 * by the tail rather than arriving dry after it. A Meter hangs off Volume as a
 * dead end, feeding `getLevel` for the overlay without altering what is heard.
 *
 * Two things here are not driven by the render loop. The **clock** turns for the
 * whole session on a `Tone.Loop` of its own: it is the beat the metronome sounds
 * and the lamps blink on, and the grid a chord change waits for when quantization
 * is on. The **arpeggiator** rides the same transport on a second loop while it is
 * on, and the gesture that would have sustained a chord hands it a sequence instead.
 */
export class SynthEngine {
  private synthA: Tone.PolySynth<Tone.Synth>
  private synthB: Tone.PolySynth<Tone.Synth>
  private synthC: Tone.PolySynth<Tone.Synth>
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
  private clock: ClockSettings = cloneClock(DEFAULT_CLOCK)
  /** Beats since the transport started; 0 is the first beat of the first bar. */
  private beat = 0
  /** Context time the last beat was scheduled for: the phase of the grid. */
  private lastBeatAt = -Infinity
  /** The same beat in transport seconds, which is what a loop is started at. */
  private lastBeatSeconds = 0
  /**
   * The slot waiting for the next grid point. `undefined` is nothing waiting,
   * which `null` cannot mean — a fist waits on the grid like any other change.
   */
  private pendingSlot: number | null | undefined = undefined
  private beatLoop: Tone.Loop
  private click: Tone.Synth

  /** Where the beat is published, or `null` while nothing is listening. */
  private onBeat: ((pulse: BeatPulse) => void) | null = null

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
    this.synthA = new Tone.PolySynth(Tone.Synth).connect(this.filter)
    this.synthB = new Tone.PolySynth(Tone.Synth).connect(this.filter)
    this.synthC = new Tone.PolySynth(Tone.Synth).connect(this.filter)
    // Extended chords run to five notes plus a slash bass, and release tails
    // hold voices past a change. Counted per oscillator, since each allocates
    // its own — the three are never asked to share one budget.
    this.synthA.maxPolyphony = 32
    this.synthB.maxPolyphony = 32
    this.synthC.maxPolyphony = 32
    this.applyVoice(this.voice)
    // Built before the rack, which reads it back when the tempo moves: it is a
    // scheduled event with no nodes of its own, so an arpeggiator nobody turns on
    // costs a stopped loop and nothing else.
    this.loop = new Tone.Loop((time) => this.step(time), arpSeconds(this.arp, this.bpm))
    // Straight to the destination, deliberately past the filter, the rack and the
    // volume node: a metronome is a reference the player checks against, so the
    // right hand must not be able to fade it and the reverb must not smear it.
    // Its own level rather than a Volume of its own — one node, and one less
    // thing on a graph the player never sees.
    this.click = new Tone.Synth({
      volume: CLICK_DB,
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.001, decay: CLICK_DECAY, sustain: 0, release: 0.01 },
    }).toDestination()
    // The clock turns for the whole session rather than being started by whatever
    // first needs it. One callback twice a second that mostly does nothing costs
    // nothing, and it means switching the metronome or the grid on mid-session
    // finds a bar line already running instead of moving one.
    this.beatLoop = new Tone.Loop((time) => this.tick(time), beatSeconds(this.bpm))
    const transport = Tone.getTransport()
    if (transport.state !== 'started') transport.start()
    this.beatLoop.start(transport.seconds)
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

  /**
   * The oscillators that should sound. Every trigger path goes through this, so
   * nothing below has to know how many there are — and a layer that is switched
   * off costs no voice allocation at all rather than a muted one, which is worth
   * having on a page already running hand tracking at frame rate.
   */
  private get live(): Tone.PolySynth<Tone.Synth>[] {
    return [
      this.synthA,
      ...(this.voice.oscB ? [this.synthB] : []),
      ...(this.voice.oscC ? [this.synthC] : []),
    ]
  }

  setVoice(voice: Voice) {
    const previous = this.voice
    this.voice = voice
    this.applyVoice(voice)

    const held = this.heldNotes
    if (!held) return

    // Tone's `set` only cleanly reaches idle voices, so a new waveform needs held
    // notes retriggered to be audible. The envelope, the mix and the detune do
    // not: the first lands on the next attack and the other two are live signals
    // that reach a sounding voice on their own — and retriggering any of the
    // three would re-strike the chord on every tick of a knob drag.
    if (voice.waveform !== previous.waveform) {
      this.synthA.triggerRelease(held)
      this.synthA.triggerAttack(held)
    }
    // The layer switched in or out under a held chord. Only that oscillator
    // moves, so what is already ringing carries on and the toggle is heard as an
    // oscillator arriving or leaving rather than as the chord being played again.
    if (voice.oscB !== previous.oscB) {
      if (voice.oscB) this.synthB.triggerAttack(held)
      else this.synthB.triggerRelease(held)
    } else if (voice.oscB && voice.waveformB !== previous.waveformB) {
      this.synthB.triggerRelease(held)
      this.synthB.triggerAttack(held)
    }
    if (voice.oscC !== previous.oscC) {
      if (voice.oscC) this.synthC.triggerAttack(held)
      else this.synthC.triggerRelease(held)
    } else if (voice.oscC && voice.waveformC !== previous.waveformC) {
      this.synthC.triggerRelease(held)
      this.synthC.triggerAttack(held)
    }
  }

  private applyVoice(voice: Voice) {
    // One envelope for all three: this is a single voice with three oscillators
    // in it, not three instruments that happen to be playing the same notes.
    const envelope = {
      attack: voice.attack,
      decay: voice.decay,
      sustain: voice.sustain,
      release: voice.release,
    }
    this.synthA.set({
      oscillator: { type: voice.waveform } as Tone.SynthOptions['oscillator'],
      envelope,
    })
    this.synthB.set({
      oscillator: { type: voice.waveformB } as Tone.SynthOptions['oscillator'],
      envelope,
      // Cents, carrying the octave offset too, so every oscillator can be handed
      // the identical note name and each does its own transposing.
      detune: layerDetune(voice.octaveB, voice.detuneB),
    })
    this.synthC.set({
      oscillator: { type: voice.waveformC } as Tone.SynthOptions['oscillator'],
      envelope,
      detune: layerDetune(voice.octaveC, voice.detuneC),
    })
    // A layer that is switched off weighs nothing, which both silences it and
    // leaves its share of the power to the ones that are on — so A alone still
    // carries the patch at unity, and stacking a shape adds it rather than
    // pulling the level down by the 3dB an even pair would cost it.
    const [gainA, gainB, gainC] = layerGainsDb([
      voice.levelA,
      voice.oscB ? voice.levelB : 0,
      voice.oscC ? voice.levelC : 0,
    ])
    this.synthA.volume.rampTo(gainA, VOLUME_RAMP)
    this.synthB.volume.rampTo(gainB, VOLUME_RAMP)
    this.synthC.volume.rampTo(gainC, VOLUME_RAMP)
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
    this.applyTempo()
  }

  /**
   * Retimes both clocks to `this.bpm`. There is one tempo in the app and two
   * loops reading it, and it arrives through `setEffects` or `setArp` depending
   * on which effect happens to be listening — so the retiming lives here rather
   * than in whichever setter the edit came through.
   *
   * The arpeggiator's is left alone while it is off: its interval is set when it
   * is switched on, and moving a stopped loop only makes the next `start` argue
   * with the phase it is given.
   */
  private applyTempo() {
    if (this.arp.enabled) this.loop.interval = arpSeconds(this.arp, this.bpm)
    this.beatLoop.interval = beatSeconds(this.bpm)
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
    this.beatLoop.interval = beatSeconds(bpm)

    if (arp.enabled) {
      // Sequenced material needs the headroom a gesture does not; see
      // SEQUENCE_LOOKAHEAD. Set before the first step is scheduled.
      this.applyLookahead()
      if (was) {
        // A pattern or octave edit: rebuild what is walked, but leave the clock
        // where it is — re-anchoring it on every tick of a knob drag would
        // stutter the rhythm the drag is trying to hear.
        this.sequence = this.arpNotes()
      } else {
        // Whatever the old mode was sustaining has to be let go, or it drones
        // underneath the pattern for as long as the shape is held.
        if (this.heldNotes) for (const synth of this.live) synth.triggerRelease(this.heldNotes)
        this.heldNotes = null
        this.anchorArp()
      }
      return
    }

    if (!was) return
    this.stopArp()
    // The clock may still be sequencing even with the pattern off, so the rule
    // decides rather than this branch.
    this.applyLookahead()
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
  private anchorArp(seconds?: number) {
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
    // A phrase that opened on the grid anchors to that beat rather than to now,
    // which is what puts the pattern and the metronome on the same pulse. Free
    // play passes nothing and the hand sets the phase, as it always has.
    this.loop.start(seconds ?? Tone.getTransport().seconds)
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
  private moveArp(time?: number) {
    this.sequence = this.arpNotes()
    this.arpIndex = -1
    this.idleSteps = 0
    if (!this.sequence.length) return
    if (!this.arpRunning) {
      // Opened by a quantized change, so the pattern is founded on the beat that
      // carried it and the two clocks agree from the first note.
      this.anchorArp(time === undefined ? undefined : this.lastBeatSeconds)
      return
    }
    const now = time ?? Tone.now()
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
    const note = this.sequence[index]
    const gate = this.gateSeconds()
    for (const synth of this.live) synth.triggerAttackRelease(note, gate, time)
  }

  /** How long one step rings, from the gate's share of it. */
  private gateSeconds(): number {
    return Math.max(MIN_GATE_SECONDS, this.arp.gate * arpSeconds(this.arp, this.bpm))
  }

  /**
   * Sustain semantics: a new slot releases the old chord and attacks the new one;
   * `null` (fist or hand lost) releases everything.
   *
   * Quantized, the change is not played here but handed to the clock, which plays
   * it on the next point of the grid. A fist goes on the grid too — it is a change
   * to silence, and letting it through early is the one thing that would put a
   * progression back out of time. `releaseAll` is still immediate, so Stop cuts.
   *
   * Called every frame by the render loop, so the guard that rejects a repeat has
   * to come first and has to compare against what the chord *will* be rather than
   * what it is: with a change already waiting, that is the waiting one.
   */
  setChordSlot(slot: number | null) {
    const target = this.pendingSlot !== undefined ? this.pendingSlot : this.currentSlot
    if (slot === target) return
    if (this.clock.quantize === 'off') {
      this.commitSlot(slot)
      return
    }
    // Back to the chord that is already sounding, before the grid came round: a
    // change cancelled rather than a new one to schedule.
    if (slot === this.currentSlot) {
      this.pendingSlot = undefined
      return
    }
    // Late by less than the capture window belongs to the grid point that just
    // passed, so it is played now rather than made to wait for the next one.
    if (Tone.now() - this.lastGridAt() < QUANTIZE_CAPTURE * beatSeconds(this.bpm)) {
      this.commitSlot(slot)
      return
    }
    this.pendingSlot = slot
  }

  /**
   * When the last point of the current grid fell, in context time. Derived from
   * the last beat rather than stored, so changing the grid moves it immediately
   * instead of on the next beat.
   *
   * `lastBeatAt` is -Infinity until the first beat has been scheduled, which
   * makes the age of the last grid point infinite and every change miss the
   * window — the safe side, since there is no grid to be on yet.
   */
  private lastGridAt(): number {
    const since = beatsSinceGrid(this.beat - 1, this.clock.quantize)
    return this.lastBeatAt - since * beatSeconds(this.bpm)
  }

  /**
   * The chord change itself, once it is time to make it. `time` is the beat it
   * was placed on, so a quantized change is attacked *at* the beat rather than at
   * whenever the callback that carried it ran; free play passes nothing and gets
   * the immediate trigger it always had.
   */
  private commitSlot(slot: number | null, time?: number) {
    if (slot === this.currentSlot) return
    this.currentSlot = slot
    if (this.arp.enabled) this.moveArp(time)
    else this.voiceNotes(slot === null ? [] : this.notesForSlot(slot), time)
  }

  /**
   * Listens for the beat: called once per beat with where in the bar it fell.
   *
   * Called straight from the transport's callback rather than through Tone's draw
   * queue. The queue exists to land a visual on the animation frame nearest its
   * sound, which is worth having when a callback runs far ahead of what it books
   * — this one runs at most `SEQUENCE_LOOKAHEAD` (30 ms) early, well under the
   * point at which a flash and a click stop reading as one event. What the queue
   * would cost is the lamp itself: it drops anything more than a quarter-second
   * old without a word, so on a machine slow enough to need a readout the readout
   * is the first thing to go.
   *
   * One listener rather than a list, because one readout reads it. At the 240 BPM
   * ceiling it fires four times a second, well under the HUD's own 10 Hz publish,
   * so the React update it drives is nowhere near the per-frame `setState` the
   * render loop is built to avoid. A burst of beats delivered together coalesces
   * into one render on the last of them, which is the one worth drawing. Silent
   * while the lamps are off.
   */
  setOnBeat(listener: ((pulse: BeatPulse) => void) | null) {
    this.onBeat = listener
  }

  /** The clock's settings: the grid, the click and the lamps. */
  setClock(clock: ClockSettings) {
    this.clock = clock
    // Anything still waiting on a grid that no longer exists would never be
    // played, so switching quantization off lets it through now.
    if (clock.quantize === 'off' && this.pendingSlot !== undefined) {
      const slot = this.pendingSlot
      this.pendingSlot = undefined
      this.commitSlot(slot)
    }
    this.applyLookahead()
  }

  /**
   * One beat. Runs off the transport, so `time` is the moment Tone scheduled it
   * for and the click, the chord waiting on it and the lamp are all placed at it
   * rather than at whenever the callback happened to run.
   */
  private tick(time: number) {
    this.lastBeatAt = time
    this.lastBeatSeconds = Tone.getTransport().seconds
    const beatInBar = this.beat % BEATS_PER_BAR
    const late = Tone.getContext().currentTime - time
    // A beat already behind cannot be placed at its own time — Tone rejects a
    // trigger booked before one it has taken — so it is played at once instead.
    // `undefined` is what resolves a trigger to now.
    const place = late > 0 ? undefined : time

    if (this.clock.click && late <= STALE_CLICK * beatSeconds(this.bpm)) {
      this.click.triggerAttackRelease(
        beatInBar === 0 ? CLICK_HIGH_HZ : CLICK_LOW_HZ,
        CLICK_DECAY,
        place,
      )
    }
    // A chord waiting on this mark is played however late the beat carrying it
    // arrived: late by whatever the machine was busy with is a change that
    // dragged, where dropping it would hold the chord back another whole bar.
    if (this.pendingSlot !== undefined && isGridBeat(this.beat, this.clock.quantize)) {
      const slot = this.pendingSlot
      this.pendingSlot = undefined
      this.commitSlot(slot, place)
    }
    if (this.clock.blink) this.onBeat?.({ beat: this.beat, beatInBar })
    this.beat++
  }

  /**
   * The headroom is bought only when *audio* is sequenced. A click needs it or it
   * stumbles, and a quantized chord needs it and pays nothing for it, because it
   * is placed on the grid either way. The lamps alone do not raise it: a few
   * milliseconds of visual lead is invisible, and free play keeps the zero-latency
   * path a struck chord is built around.
   */
  private applyLookahead() {
    const sequenced = this.arp.enabled || this.clock.click || this.clock.quantize !== 'off'
    Tone.getContext().lookAhead = sequenced ? SEQUENCE_LOOKAHEAD : 0
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
  private voiceNotes(notes: string[], time?: number) {
    const held = this.heldNotes ?? []
    const release = held.filter((note) => !notes.includes(note))
    const attack = notes.filter((note) => !held.includes(note))
    for (const synth of this.live) {
      // `time` is passed only when the clock placed this change on a beat; an
      // undefined one is Tone's own "now", which is what free play wants.
      if (release.length) synth.triggerRelease(release, time)
      if (attack.length) synth.triggerAttack(attack, time)
    }
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
    // All three unconditionally, not `live`: a layer switched off a moment ago
    // may still be ringing out its release tail, and this is the stop-everything.
    this.synthA.releaseAll()
    this.synthB.releaseAll()
    this.synthC.releaseAll()
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
    this.beatLoop.dispose()
    Tone.getTransport().stop()
    // Both handed back the way they were found, so the next session starts from
    // the same place this one did rather than from whatever it left behind.
    Tone.getContext().lookAhead = 0
    this.synthA.dispose()
    this.synthB.dispose()
    this.synthC.dispose()
    this.filter.dispose()
    for (const id of EFFECT_IDS) this.nodes[id].dispose()
    this.volume.dispose()
    this.meter.dispose()
    this.click.dispose()
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
