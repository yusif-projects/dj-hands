/**
 * The machine's own clock: the beat everything is played against, and the grid a
 * chord change snaps to. Pure — the settings, the arithmetic of the grid, and
 * nothing else. `SynthEngine` owns the Tone loop that turns it, the same way it
 * owns the arpeggiator's.
 *
 * Called `clock` rather than `timing` because `EffectTiming` in
 * [effects.ts](effects.ts) already owns that word for an effect's *rate*. The
 * settings group this draws is still the Timing panel.
 */

export type QuantizeMode = 'off' | 'quarter' | 'half' | 'bar'

/** Picker order: free first, then the grid from the finest to the coarsest. */
export const QUANTIZE_MODES: QuantizeMode[] = ['off', 'quarter', 'half', 'bar']

export interface ClockSettings {
  /** Which grid a chord change waits for. `off` plays it the moment it is seen. */
  quantize: QuantizeMode
  /** Whether the metronome is audible. */
  click: boolean
  /** Whether the meter bridge's beat lamps light. */
  blink: boolean
}

/**
 * Four. The instrument is 4/4 and there is no time-signature setting, so this is
 * the one place the bar has a length — everything below counts in beats and
 * divides by it.
 */
export const BEATS_PER_BAR = 4

/**
 * The grid measured in beats. `off` is 0 rather than 1: a grid of every beat is
 * `quarter`, and free play is the absence of a grid, not the finest one.
 */
export const QUANTIZE_BEATS: Record<QuantizeMode, number> = {
  off: 0,
  quarter: 1,
  half: BEATS_PER_BAR / 2,
  bar: BEATS_PER_BAR,
}

/**
 * How each mode is named, for the panel and the meter bridge alike. The wording
 * lives here rather than in either of them, so the bridge cannot end up calling
 * the grid something the panel does not.
 */
export const QUANTIZE_LABELS: Record<QuantizeMode, string> = {
  off: 'Free',
  quarter: '¼ bar',
  half: '½ bar',
  bar: 'Bar',
}

/**
 * Off, and silent. Quantization changes when a chord is heard and the click adds
 * a sound nobody asked for, so both arrive switched off and an update changes
 * nothing a returning player hears — the promise the arpeggiator shipped on. The
 * lamps default on: they are a readout, and a metronome you cannot see is the
 * thing this was added to fix.
 */
export const DEFAULT_CLOCK: ClockSettings = {
  quantize: 'off',
  click: false,
  blink: true,
}

/** How long one beat lasts at `bpm`, in seconds. */
export function beatSeconds(bpm: number): number {
  return 60 / bpm
}

/**
 * Whether `beat` — counted from the clock's start, so 0 is the first beat of the
 * first bar — is a point on `mode`'s grid.
 *
 * This is the whole of quantization. With `half` the grid is beats 0, 2, 4…, so
 * a change made during beat 3 (index 2) has already missed that point and lands
 * on index 4, the next bar's beat 1; one made during beat 2 (index 1) lands on
 * index 2, beat 3. With `bar` anything in the bar lands on the next beat 1.
 */
export function isGridBeat(beat: number, mode: QuantizeMode): boolean {
  const beats = QUANTIZE_BEATS[mode]
  return beats > 0 && beat % beats === 0
}

/**
 * How many beats have passed since the last point on `mode`'s grid. Used to find
 * when that point was from the last beat, which is where the engine measures its
 * capture window back from.
 */
export function beatsSinceGrid(beat: number, mode: QuantizeMode): number {
  const beats = QUANTIZE_BEATS[mode]
  if (beats <= 0) return 0
  // Floored, so a beat counted from before the clock started still reads forward.
  return ((beat % beats) + beats) % beats
}

export function isQuantizeMode(value: unknown): value is QuantizeMode {
  return typeof value === 'string' && (QUANTIZE_MODES as string[]).includes(value)
}

/** A stored clock made trustworthy; junk and half-built objects resolve to defaults. */
export function normalizeClock(stored: unknown): ClockSettings {
  if (!stored || typeof stored !== 'object') return cloneClock(DEFAULT_CLOCK)
  const clock = stored as Partial<ClockSettings>
  return {
    quantize: isQuantizeMode(clock.quantize) ? clock.quantize : DEFAULT_CLOCK.quantize,
    // Anything but a real `true` reads as off: an update must never start
    // ticking under someone because a hand-edited blob held a truthy string.
    click: clock.click === true,
    // The one that defaults on, so an absent key has to fall through to it
    // rather than read as false.
    blink: typeof clock.blink === 'boolean' ? clock.blink : DEFAULT_CLOCK.blink,
  }
}

/** Flat, but copied all the same, so a clone is never the object it came from. */
export function cloneClock(clock: ClockSettings): ClockSettings {
  return { ...clock }
}
