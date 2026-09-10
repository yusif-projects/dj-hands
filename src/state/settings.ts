import {
  DEFAULT_ACCIDENTAL,
  DEFAULT_CHORD_SLOTS,
  MAX_OCTAVE_OFFSET,
  ROOTS,
  isAccidental,
  isChordName,
  maxInversion,
  parseChord,
  type Accidental,
  type ChordSlot,
  type Root,
} from '../audio/chords'
import {
  DEFAULT_SECTIONS,
  MAX_SECTION_NAME,
  SECTION_COUNT,
  firstEnabled,
  type SongSection,
} from '../audio/sections'
import { DEFAULT_FILTER_TYPE, isFilterType, type FilterType } from '../audio/filter'
import {
  BPM_RANGE,
  DEFAULT_BPM,
  DEFAULT_EFFECTS,
  EFFECT_IDS,
  cloneEffects,
  defaultAmount,
  normalizeEffects,
  type EffectId,
  type EffectSetting,
} from '../audio/effects'
import { DEFAULT_ARP, cloneArp, normalizeArp, type ArpSettings } from '../audio/arp'
import { DEFAULT_CLOCK, cloneClock, normalizeClock, type ClockSettings } from '../audio/clock'
import {
  ADSR_RANGES,
  DEFAULT_VOICE,
  OSC_LAYER_RANGES,
  isWaveformName,
  levelsFromMix,
  type Voice,
} from '../audio/voice'

/** Bounds for the filter sweep, disjoint so `cutoffMin < cutoffMax` always holds. */
export const CUTOFF_MIN_RANGE = { min: 50, max: 1000, step: 10 }
export const CUTOFF_MAX_RANGE = { min: 1000, max: 12000, step: 100 }

// The panel drew these four inline until songs arrived. A song can now come off
// somebody else's clipboard, which makes a value no slider could ever produce
// possible for the first time — so the bounds the panel offers and the bounds
// the normalizer enforces have to be one thing rather than two that agree.
export const OCTAVE_RANGE = { min: 1, max: 5, step: 1 }
export const VOLUME_TOP_RANGE = { min: 0, max: 0.5, step: 0.01 }
export const VOLUME_BOTTOM_RANGE = { min: 0.5, max: 1, step: 0.01 }
export const DEBOUNCE_RANGE = { min: 1, max: 12, step: 1 }

export interface Settings {
  /** Five named banks of chord slots; the right hand picks which one is live. */
  sections: SongSection[]
  /** Index into `sections` of the bank the left hand is currently playing. */
  activeSection: number
  /** The one synth voice; the right hand no longer switches between several. */
  voice: Voice
  /** Global octave every chord slot is offset from. */
  octave: number
  /** Whether black keys are named with sharps or flats; display only. */
  accidental: Accidental
  /** Frame of the video where volume reads as 1.0 (near the top). */
  volumeTop: number
  /** Frame position where volume reads as 0.0 (near the bottom). */
  volumeBottom: number
  /** Which side of the cutoff the rotation sweep keeps. */
  filterType: FilterType
  /** Cutoff in Hz at full anticlockwise rotation. */
  cutoffMin: number
  /** Cutoff in Hz at full clockwise rotation. */
  cutoffMax: number
  /** Every effect with its own wet mix; the array's order is the chain order. */
  effects: EffectSetting[]
  /** Tempo the rack's locked effects and a locked arpeggiator snap their rate to. */
  bpm: number
  /** The arpeggiator: whether the held chord is walked, and how. */
  arp: ArpSettings
  /** The machine's clock: the grid a chord change snaps to, and the metronome. */
  clock: ClockSettings
  /** Consecutive frames a gesture must hold before it commits. */
  debounceFrames: number
  /** Flips MediaPipe's handedness labels when they come out inverted. */
  swapHands: boolean
  showOverlay: boolean
  /** Whether the drawn skeleton reacts to the sound, or stays flat. */
  reactiveOverlay: boolean
}

/**
 * Everything a song is: what you can hear, and nothing about the room it is
 * played in. Saved under a name by `state/presets.ts`, and the shape that
 * travels between browsers on the clipboard.
 *
 * Written as what it leaves out rather than what it takes, so a setting added
 * later joins songs by default — which is the right default, because nearly
 * everything this instrument grows is musical. A new *camera* setting has to be
 * named here, or it will start travelling between browsers with the songs.
 *
 * `activeSection` is left out because it is a playing position rather than part
 * of the song, and because the right hand rewrites it mid-performance: folding
 * it in would put a storage write on a gesture path that `selectSection` in
 * App.tsx deliberately keeps free.
 */
export type Song = Omit<
  Settings,
  'activeSection' | 'debounceFrames' | 'swapHands' | 'showOverlay' | 'reactiveOverlay'
>

/**
 * Rest destructuring, so the slice follows `Song` rather than a hand-kept list
 * that would drift the first time a field was added to one and not the other.
 * The five bindings exist only to keep their keys out of the rest — hence the
 * underscores, which is how the linter is told a name is deliberately unused.
 */
export function toSong(settings: Settings): Song {
  const {
    activeSection: _activeSection,
    debounceFrames: _debounceFrames,
    swapHands: _swapHands,
    showOverlay: _showOverlay,
    reactiveOverlay: _reactiveOverlay,
    ...song
  } = settings
  return song
}

/**
 * Puts a song on the instrument. The section you are standing on is not part of
 * the song, so it is kept rather than reset — but the incoming sections decide
 * whether it still exists. It matters that this lands somewhere valid: the
 * debouncer only reports a finger count when it *changes*, so a hand held at
 * three while a song opens would not re-select until it moved.
 */
export function applySong(settings: Settings, song: Song): Settings {
  return {
    ...settings,
    ...song,
    activeSection: normalizeActiveSection(settings.activeSection, song.sections),
  }
}

// Each bump orphans the older blob rather than upgrading it: v2 dropped the
// five-preset array for a single `voice`, and v3 folded the parallel `chords`
// and `chordOctaves` arrays into `chordSlots`. Neither is merge-compatible, and
// the dead keys would be re-saved forever.
//
// v4, v5 and v6 are the exceptions: v4 wraps `chordSlots` in a section, v5
// splits the single send into the effects rack, and v6 splits the second
// oscillator's one `mixB` crossfade into a level per oscillator. All three are
// pure reshapes with nothing to lose, so the old payload is carried over rather
// than orphaned.
//
// Purely additive keys do not need a bump: `loadSettings` spreads the defaults
// under the stored blob, so an older payload simply picks up the new default.
// `arp` is one of those, and so is `clock` — both arrive switched off, so a
// returning player picks them up without hearing anything change.
const STORAGE_KEY = 'gesture-music.settings.v6'
const LEGACY_KEY_V5 = 'gesture-music.settings.v5'
const LEGACY_KEY_V4 = 'gesture-music.settings.v4'
const LEGACY_KEY_V3 = 'gesture-music.settings.v3'

export const DEFAULT_SETTINGS: Settings = {
  sections: DEFAULT_SECTIONS.map((section) => ({
    ...section,
    slots: section.slots.map((slot) => ({ ...slot })),
  })),
  activeSection: 0,
  voice: { ...DEFAULT_VOICE },
  octave: 3,
  accidental: DEFAULT_ACCIDENTAL,
  volumeTop: 0.15,
  volumeBottom: 0.85,
  filterType: DEFAULT_FILTER_TYPE,
  cutoffMin: 200,
  cutoffMax: 8000,
  // Deep, or every copy of the defaults would share one timing object.
  effects: cloneEffects(DEFAULT_EFFECTS),
  bpm: DEFAULT_BPM,
  // Deep, for the same reason the effects are: the nested `timing` would be shared.
  arp: cloneArp(DEFAULT_ARP),
  clock: cloneClock(DEFAULT_CLOCK),
  // Two frames is enough to reject a stray now that each finger latches between
  // two thresholds; every frame beyond that is latency you hear on a chord change.
  debounceFrames: 2,
  swapHands: false,
  showOverlay: true,
  reactiveOverlay: true,
}

export function loadSettings(): Settings {
  try {
    return normalizeSettings(readStored())
  } catch {
    return DEFAULT_SETTINGS
  }
}

/**
 * The one validation layer — and now the one for songs off a clipboard too. A
 * payload somebody pasted is exactly as untrusted as a blob hand-edited in
 * devtools, so both arrive here rather than each growing checks of its own.
 *
 * Every unknown key rides the spread through untouched. That is deliberate: it
 * is what lets an older build re-save a song from a newer one without stripping
 * the fields it did not understand.
 */
export function normalizeSettings(parsed: Partial<Settings> | null | undefined): Settings {
  // An array spreads into nonsense and a string into indexed characters, and a
  // null throws on the first property read. `readStored` can produce none of
  // those; a clipboard can produce all three.
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return DEFAULT_SETTINGS
  // Normalized first: the active index is only valid against the real sections.
  const sections = normalizeSections(parsed.sections)
  return {
    ...DEFAULT_SETTINGS,
    ...parsed,
    // Guard against a stored array of the wrong length from an older build.
    sections,
    activeSection: normalizeActiveSection(parsed.activeSection, sections),
    voice: normalizeVoice(parsed.voice),
    octave: clampInteger(parsed.octave, OCTAVE_RANGE.min, OCTAVE_RANGE.max, DEFAULT_SETTINGS.octave),
    accidental: isAccidental(parsed.accidental) ? parsed.accidental : DEFAULT_ACCIDENTAL,
    volumeTop: clampRange(parsed.volumeTop, VOLUME_TOP_RANGE, DEFAULT_SETTINGS.volumeTop),
    volumeBottom: clampRange(
      parsed.volumeBottom,
      VOLUME_BOTTOM_RANGE,
      DEFAULT_SETTINGS.volumeBottom,
    ),
    filterType: isFilterType(parsed.filterType) ? parsed.filterType : DEFAULT_FILTER_TYPE,
    cutoffMin: clampRange(parsed.cutoffMin, CUTOFF_MIN_RANGE, DEFAULT_SETTINGS.cutoffMin),
    cutoffMax: clampRange(parsed.cutoffMax, CUTOFF_MAX_RANGE, DEFAULT_SETTINGS.cutoffMax),
    effects: normalizeEffects(parsed.effects),
    bpm: clampRange(parsed.bpm, BPM_RANGE, DEFAULT_SETTINGS.bpm),
    arp: normalizeArp(parsed.arp),
    clock: normalizeClock(parsed.clock),
    debounceFrames: clampInteger(
      parsed.debounceFrames,
      DEBOUNCE_RANGE.min,
      DEBOUNCE_RANGE.max,
      DEFAULT_SETTINGS.debounceFrames,
    ),
    // `=== true` would read an absent key as false, and two of these default on.
    swapHands: parsed.swapHands === true,
    showOverlay: typeof parsed.showOverlay === 'boolean' ? parsed.showOverlay : true,
    reactiveOverlay:
      typeof parsed.reactiveOverlay === 'boolean' ? parsed.reactiveOverlay : true,
  }
}

/** A song validated the only way anything is validated here: as settings. */
export function normalizeSong(parsed: unknown): Song {
  return toSong(normalizeSettings(parsed as Partial<Settings>))
}

export function saveSettings(settings: Settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Storage can be unavailable (private mode); settings just won't persist.
  }
}

function readStored(): Partial<Settings> | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw) return JSON.parse(raw) as Partial<Settings>
  const v5 = readLegacyV5()
  if (v5) return fromMix(v5)
  // Both older shapes carry the single send, so they take the same reshape —
  // v3's chords are folded into sections first, then the send is split. They
  // predate the second oscillator entirely, so `fromMix` finds nothing to do;
  // it is applied anyway rather than reasoned about at each call site.
  const older = readLegacyV4() ?? migrateV3()
  return older ? fromMix(fromSend(older)) : null
}

/** Reads the v5 blob, consuming its key, for the same reason `readLegacyV4` does. */
function readLegacyV5(): Record<string, unknown> | null {
  const raw = localStorage.getItem(LEGACY_KEY_V5)
  if (!raw) return null
  localStorage.removeItem(LEGACY_KEY_V5)
  return JSON.parse(raw) as Record<string, unknown>
}

/**
 * v6 replaced the second oscillator's single `mixB` — one knob crossfading
 * between the two shapes — with a level on each, so a third could be stacked
 * without the pair's knob having to mean something else. `levelsFromMix` picks
 * the levels that reproduce the old gains exactly, so a patch somebody left
 * mid-blend comes back sounding the way they left it.
 *
 * A blob with no `mixB` at all predates the second oscillator and passes
 * through untouched, which is what lets the v3 and v4 paths run it blindly.
 */
function fromMix(blob: Record<string, unknown>): Partial<Settings> {
  const voice = blob.voice
  if (!voice || typeof voice !== 'object') return blob as Partial<Settings>
  const { mixB, ...rest } = voice as Record<string, unknown>
  if (mixB === undefined) return blob as Partial<Settings>
  const stored = Number(mixB)
  // An unreadable one lands on the even pair the knob defaulted to, not on
  // silence. Left unvalidated beyond that; `normalizeVoice` is the only validator.
  return {
    ...(blob as Partial<Settings>),
    voice: { ...rest, ...levelsFromMix(Number.isFinite(stored) ? stored : 0.5) } as Voice,
  }
}

// What the single send could be set to, what it fell back to, and the only two
// effects it could ever reach — chorus is new, so nothing routes to it. Only
// `fromSend` still cares about any of this.
const LEGACY_SEND_TARGETS = ['reverb', 'delay', 'both']
const LEGACY_DEFAULT_TARGET = 'reverb'
const LEGACY_SEND_EFFECTS: EffectId[] = ['delay', 'reverb']

/** Reads the v4 blob, consuming its key: an unreadable one must not be retried forever. */
function readLegacyV4(): Record<string, unknown> | null {
  const raw = localStorage.getItem(LEGACY_KEY_V4)
  if (!raw) return null
  localStorage.removeItem(LEGACY_KEY_V4)
  return JSON.parse(raw) as Record<string, unknown>
}

/**
 * v5 split the single send — one target, one amount shared between reverb and
 * delay — into three effects with their own amounts in an order the player can
 * change. The old amount lands on whichever effects the old target named, so an
 * update keeps the sound it had; chorus is new, so it starts silent.
 */
function fromSend(blob: Record<string, unknown>): Partial<Settings> {
  const { sendTarget, sendAmount, ...rest } = blob
  const stored = Number(sendAmount)
  // A blob with no send at all still played the old defaults, so it migrates to
  // them rather than to silence.
  const wet = Number.isFinite(stored) ? stored : defaultAmount('reverb')
  const target = LEGACY_SEND_TARGETS.includes(sendTarget as string)
    ? sendTarget
    : LEGACY_DEFAULT_TARGET
  const routed = (id: EffectId) =>
    LEGACY_SEND_EFFECTS.includes(id) && (target === id || target === 'both')
  return {
    ...(rest as Partial<Settings>),
    // Left unvalidated on purpose; `normalizeEffects` is the only validator.
    effects: EFFECT_IDS.map((id) => ({ id, amount: routed(id) ? wet : 0 })),
  }
}

/**
 * v4 replaced the flat `chordSlots` array with five named sections. Every other
 * v3 key survives unchanged, so the old payload is reshaped rather than dropped:
 * the chords the player had built become section 1, and the rest spreads across
 * as it always did. The v3 key is consumed either way — a blob that cannot be
 * read would otherwise be retried on every load forever.
 */
function migrateV3(): Record<string, unknown> | null {
  const raw = localStorage.getItem(LEGACY_KEY_V3)
  if (!raw) return null
  localStorage.removeItem(LEGACY_KEY_V3)
  const { chordSlots, ...rest } = JSON.parse(raw) as Record<string, unknown>
  return {
    ...rest,
    // Left unvalidated on purpose; `normalizeSections` is the only validator.
    sections: DEFAULT_SECTIONS.map((section, i) =>
      i === 0 ? { ...section, slots: chordSlots as ChordSlot[] } : section,
    ),
  }
}

function normalizeSections(sections: unknown): SongSection[] {
  const stored = Array.isArray(sections) ? sections : []
  // Mapping over the defaults pins the length to the section count, whatever
  // was stored — the same guard `normalizeChordSlots` applies to slots.
  return DEFAULT_SECTIONS.map((fallback, i) => {
    const section = (stored[i] ?? {}) as Partial<SongSection>
    return {
      name:
        typeof section.name === 'string'
          ? section.name.slice(0, MAX_SECTION_NAME)
          : fallback.name,
      // Section 1 is where the left hand falls back to, so it can never be off.
      enabled: i === 0 || section.enabled === true,
      slots: normalizeChordSlots(section.slots),
    }
  })
}

/** A stored index can point past the array, or at a section since turned off. */
function normalizeActiveSection(value: unknown, sections: SongSection[]): number {
  const index = clampInteger(value, 0, SECTION_COUNT - 1, 0)
  return sections[index].enabled ? index : firstEnabled(sections)
}

function normalizeChordSlots(slots: unknown): ChordSlot[] {
  const stored = Array.isArray(slots) ? slots : []
  // Mapping over the defaults pins the length to the slot count, whatever was stored.
  return DEFAULT_CHORD_SLOTS.map((fallback, i) => {
    const slot = (stored[i] ?? {}) as Partial<ChordSlot>
    const chord = isChordName(slot.chord) ? slot.chord : fallback.chord
    return {
      chord,
      // The chord is resolved by now, so the inversion clamps to that quality's
      // note count rather than to a generic ceiling.
      inversion: clampInteger(slot.inversion, 0, maxInversion(parseChord(chord)!.quality), 0),
      bass: ROOTS.includes(slot.bass as Root) ? (slot.bass as Root) : null,
      octave: clampInteger(slot.octave, -MAX_OCTAVE_OFFSET, MAX_OCTAVE_OFFSET, fallback.octave),
    }
  })
}

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, Math.round(parsed)))
}

function normalizeVoice(voice: unknown): Voice {
  if (!voice || typeof voice !== 'object') return { ...DEFAULT_VOICE }
  const stored = voice as Partial<Voice>
  return {
    waveform: isWaveformName(stored.waveform) ? stored.waveform : DEFAULT_VOICE.waveform,
    attack: clampRange(stored.attack, ADSR_RANGES.attack, DEFAULT_VOICE.attack),
    decay: clampRange(stored.decay, ADSR_RANGES.decay, DEFAULT_VOICE.decay),
    sustain: clampRange(stored.sustain, ADSR_RANGES.sustain, DEFAULT_VOICE.sustain),
    release: clampRange(stored.release, ADSR_RANGES.release, DEFAULT_VOICE.release),
    levelA: clampRange(stored.levelA, OSC_LAYER_RANGES.level, DEFAULT_VOICE.levelA),
    // A voice saved before an oscillator existed has none of its five keys, so
    // it picks up the defaults — and the first of them is `false`, which is why
    // an old song still sounds exactly the way it was saved. A pre-v2 `mixB` is
    // already `levelA` and `levelB` by the time it arrives here; converting it
    // is the migrations' job, not this one's.
    oscB: typeof stored.oscB === 'boolean' ? stored.oscB : DEFAULT_VOICE.oscB,
    waveformB: isWaveformName(stored.waveformB) ? stored.waveformB : DEFAULT_VOICE.waveformB,
    levelB: clampRange(stored.levelB, OSC_LAYER_RANGES.level, DEFAULT_VOICE.levelB),
    detuneB: clampRange(stored.detuneB, OSC_LAYER_RANGES.detune, DEFAULT_VOICE.detuneB),
    // Integer, unlike the other two: half an octave is the detune's job, and a
    // hand-edited fraction here should snap rather than ride along.
    octaveB: clampInteger(
      stored.octaveB,
      OSC_LAYER_RANGES.octave.min,
      OSC_LAYER_RANGES.octave.max,
      DEFAULT_VOICE.octaveB,
    ),
    oscC: typeof stored.oscC === 'boolean' ? stored.oscC : DEFAULT_VOICE.oscC,
    waveformC: isWaveformName(stored.waveformC) ? stored.waveformC : DEFAULT_VOICE.waveformC,
    levelC: clampRange(stored.levelC, OSC_LAYER_RANGES.level, DEFAULT_VOICE.levelC),
    detuneC: clampRange(stored.detuneC, OSC_LAYER_RANGES.detune, DEFAULT_VOICE.detuneC),
    octaveC: clampInteger(
      stored.octaveC,
      OSC_LAYER_RANGES.octave.min,
      OSC_LAYER_RANGES.octave.max,
      DEFAULT_VOICE.octaveC,
    ),
  }
}

function clampRange(value: unknown, range: { min: number; max: number }, fallback: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(range.max, Math.max(range.min, parsed))
}
