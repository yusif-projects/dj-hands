# Audio

Two modules, cleanly split: [chords.ts](../src/audio/chords.ts) is pure music
theory with no audio in it at all, and [SynthEngine.ts](../src/audio/SynthEngine.ts)
is an imperative wrapper over a Tone.js graph. [voice.ts](../src/audio/voice.ts)
and [sections.ts](../src/audio/sections.ts) are plain data.

## Chord model

A chord name is a **root** plus a **quality suffix**: `C`, `Am`, `F#maj7`,
`A#m7b5`. Major is the bare root — no suffix.

### Roots

`C D E F G A B C# D# F# G# A#` — naturals first so the picker reads naturally.
Internally each maps to a semitone offset 0–11. Sharps are the only stored
spelling: a chord name, `ChordSlot.bass` and every `localStorage` blob always
carry `C#`, never `Db`.

Flats exist as **naming only**. `formatRoot(root, accidental)` and
`formatChord(chord, accidental)` respell the five black keys — `C#→D♭`, `D#→E♭`,
`F#→G♭`, `G#→A♭`, `A#→B♭` — for the root and bass pickers and for the HUD, driven
by the `accidental` setting. Naturals are untouched.

The formatters also **engrave**: the ASCII `#` and `b` a name is stored under are
typed, not musical, so nothing user-facing shows them. A sharp root reads `C♯`,
and `formatQuality(id)` puts the sign on a suffix's own degree — `m7b5` reads
`m7♭5`, `addb9` reads `add♭9`, `maj7#11` reads `maj7♯11`. That accidental belongs
to the quality rather than the root, so respelling leaves it where it is:
`D#m7b5` reads as `E♭m7♭5` and `D#maj7#11` as `E♭maj7♯11`. An accidental in a
suffix always sits on a degree number, so the sign is placed by looking for the
digit after it. Nothing downstream sees any of this — `parseChord` never has to
accept a flat or a sign, and switching the toggle changes no sound.

### Qualities

| family | id | label | intervals |
| --- | --- | --- | --- |
| Fifth | `5` | 5 | 0 7 |
| Triads | *(empty)* | maj | 0 4 7 |
| Triads | `m` | m | 0 3 7 |
| Triads | `sus2` | sus2 | 0 2 7 |
| Triads | `sus4` | sus4 | 0 5 7 |
| Triads | `aug` | aug | 0 4 8 |
| Triads | `dim` | dim | 0 3 6 |
| Sevenths | `7` | 7 | 0 4 7 10 |
| Sevenths | `m7` | m7 | 0 3 7 10 |
| Sevenths | `maj7` | maj7 | 0 4 7 11 |
| Sevenths | `mmaj7` | mmaj7 | 0 3 7 11 |
| Sevenths | `7sus4` | 7sus4 | 0 5 7 10 |
| Sevenths | `aug7` | aug7 | 0 4 8 10 |
| Sevenths | `augmaj7` | augmaj7 | 0 4 8 11 |
| Sevenths | `dim7` | dim7 | 0 3 6 9 |
| Sevenths | `m7b5` | m7b5 | 0 3 6 10 |
| Sixths | `6` | 6 | 0 4 7 9 |
| Sixths | `m6` | m6 | 0 3 7 9 |
| Sixths | `6/9` | 6/9 | 0 4 7 9 14 |
| Adds | `addb9` | addb9 | 0 4 7 13 |
| Adds | `maddb9` | maddb9 | 0 3 7 13 |
| Adds | `add9` | add9 | 0 4 7 14 |
| Adds | `madd9` | madd9 | 0 3 7 14 |
| Adds | `add11` | add11 | 0 4 7 17 |
| Adds | `madd11` | madd11 | 0 3 7 17 |
| Adds | `addb13` | addb13 | 0 4 7 20 |
| Adds | `maddb13` | maddb13 | 0 3 7 20 |
| Adds | `add13` | add13 | 0 4 7 21 |
| Adds | `madd13` | madd13 | 0 3 7 21 |
| Ninths | `9` | 9 | 0 4 7 10 14 |
| Ninths | `maj9` | maj9 | 0 4 7 11 14 |
| Ninths | `m9` | m9 | 0 3 7 10 14 |
| Ninths | `9sus4` | 9sus4 | 0 5 7 10 14 |
| Elevenths | `11` | 11 | 0 4 7 10 14 17 |
| Elevenths | `m11` | m11 | 0 3 7 10 14 17 |
| Elevenths | `maj11` | maj11 | 0 4 7 11 14 17 |
| Elevenths | `maj7#11` | maj7#11 | 0 4 7 11 18 |
| Thirteenths | `13` | 13 | 0 4 7 10 14 21 |
| Thirteenths | `maj13` | maj13 | 0 4 7 11 14 21 |
| Thirteenths | `m13` | m13 | 0 3 7 10 14 21 |

`QUALITY_GROUPS` is the table, and `QUALITIES` is flattened from it — the picker
draws one `<optgroup>` per family, so the groups on screen cannot drift out of
step with the order in code. Families run roughly by depth, but a quality sits
with the family it is *heard* as rather than the one its note count would put it
in: `dim7` and `m7b5` are sevenths, `6/9` is a sixth. Labels are the suffix
itself — engraved through `formatQuality` on the way to the picker, so it reads
the way the HUD will write it back; major, having no suffix, is the only one that
needs a name of its own.

Intervals past 11 are intentional — `13`/`14` voice the flat and the natural
ninth an octave up, `17`/`18` the eleventh, and `20`/`21` the flat and the
natural thirteenth two up, rather than crowding them against the root. That is
also what keeps the elevenths playable: `11`, `m11` and `maj11` all keep their
third, with the eleventh an octave above it rather than a semitone away, and
`7sus4`/`9sus4` are the no-third reading of the same stack.

The adds run major-then-minor by degree, and stop where the semitones do. There
is no `addb11`: intervals here are semitone counts with no enharmonic spelling,
and a flat eleventh is 16 semitones — the major third an octave up — so the name
could only ever mean a doubled third. `b9` and `b13` land on pitch classes the
triad does not already own, which is why those two exist and that one does not.

12 roots × 40 qualities = **480 chords**, enumerated in `CHORDS` for validation
and tests.

### Voicing

A chord name says *which* notes; a `ChordSlot` says how they are stacked. It is
the chord name plus three numbers, and it is what a settings slot stores:

```ts
interface ChordSlot {
  chord: ChordName      // root + quality
  inversion: number     // 0 = root position
  bass: Root | null     // slash bass; null = the chord's own root
  octave: number        // −2…+2 on top of the global octave
}
```

**Inversion** rotates the lowest tones up an octave — `C` at inversion 1 is
`E3 G3 C4`. It is bounded by the quality's note count: `maxInversion(quality)`
is `intervals.length - 1`, so a triad rotates twice and a 9 chord four times.
Anything higher is clamped rather than rejected, which is what lets the picker
switch a 9 chord down to a triad without stranding an out-of-range inversion.
The result is re-sorted, because an extension already voiced an octave up (the
`14` in `add9`) can outrank a tone that was just rotated past it.

**Alt bass** adds a note *under* the chord rather than replacing one. Its
interval is `((bass - root + 12) % 12) - 12`, always −11…−1, which keeps it below
every chord tone whether the chord is inverted or not. A bass equal to the
chord's own root is treated as no slash at all — that is what the picker's
default position means.

That negative interval is the reason note spelling goes through one helper:
JS `%` keeps the sign of its left operand, so a bare `absolute % 12` indexes off
the end of `PITCH_NAMES` for anything below C0. The helper uses a floored modulo
and clamps the octave at `MIN_OCTAVE`, folding a bass back up rather than
emitting a subsonic octave under an already-low chord.

### Sections

Five slots is one progression, not a song. A **section** is a named bank of those
five slots, defined in [sections.ts](../src/audio/sections.ts):

```ts
interface SongSection {
  name: string        // '' renders as `Section N`, capped at MAX_SECTION_NAME
  enabled: boolean    // off sections are dimmed and unreachable by gesture
  slots: ChordSlot[]  // one per left-hand finger count
}
```

There are always `SECTION_COUNT` (5) of them in storage — one per right-hand
finger count — but only the first starts enabled. The other four exist so the
array length is fixed and needs no add/remove migration, and stay unreachable
until the player turns one on, so a stray finger count cannot drop the left hand
into a bank nobody has written. Section 1 can never be turned off: `firstEnabled`
is the fallback for a section that is removed while it is live, and it has to
land somewhere.

The engine never sees a section. `App` resolves
`settings.sections[settings.activeSection].slots` and pushes just that array
through `setChordSlots`, so switching sections and editing a chord are the same
operation as far as the audio is concerned — both land in `revoice()`, and a
switch made under a held chord keeps its common tones ringing.

### API

```ts
parseChord('F#m7')      // → { root: 'F#', quality: { id: 'm7', … } } | null
isChordName(x)          // type guard, used when loading persisted settings
toChordName('F#', 'm7') // → 'F#m7'
chordToNotes('Am', 3)   // → ['A3', 'C4', 'E4']
chordToNotes('C', 3, { inversion: 1, bass: 'E' })  // → ['E2', 'E3', 'G3', 'C4']
maxInversion(quality)   // → 2 for a triad, 4 for a 9 chord, 5 for a 13
slotToNotes(slot, 3)    // resolveOctave + chordToNotes for one slot
formatQuality('m7b5')   // → 'm7♭5', a suffix engraved for display
formatChordSlot(slot)   // → 'C' or 'C/E', how the HUD names it
formatSlotNotes(slot, 3) // → ['C', 'E', 'G'], the HUD's note line, voiced order
resolveOctave(3, +1)    // → 4, clamped to 0…7
```

Two subtleties in the parser:

- **Sharps are two characters**, so it tries a 2-char root before a 1-char one.
  Otherwise `C#` parses as root `C` with an unknown quality `#`.
- **Longest suffix wins.** Qualities are matched longest-first so `m7b5` is not
  mis-parsed as `m7` followed by junk, or as bare `m`.

`chordToNotes` rolls the octave over correctly when an interval crosses B→C:
`chordToNotes('B', 3)` is `['B3', 'D#4', 'F#4']`, not `['B3','D#3','F#3']`.
An unknown name throws — callers in the engine catch it and silence that slot
rather than the whole loop.

## The voice

There is one voice, and it is fully user-editable — a waveform plus an ADSR
envelope, defined in [voice.ts](../src/audio/voice.ts):

| Field | Default | Range |
| --- | --- | --- |
| `waveform` | `sawtooth` | `sine` · `triangle` · `square` · `sawtooth` |
| `attack` | 0.15 s | 0.005…2 s |
| `decay` | 0.3 s | 0.005…2 s |
| `sustain` | 0.8 | 0…1 |
| `release` | 0.8 s | 0.02…4 s |

Attack and release have a floor above zero: an instant edge clicks audibly on a
chord this thick. `ADSR_RANGES` is both the clamp for stored settings and the
sweep of the four knobs in the panel.

The panel draws the envelope above those knobs.
[adsrShape.ts](../src/audio/adsrShape.ts) is the geometry behind that picture —
pure, and unaware of both Tone and the DOM. It lays the envelope out in a unit
box: the three timed stages divide the width in proportion to their seconds,
blended against a floor so a 5 ms attack beside a 4 s release is still a visible
edge, and sustain — which has no duration of its own — gets a fixed plateau.

Earlier builds shipped five fixed presets picked by right-hand finger count.
That hand now drives the filter, and its finger count picks the song section —
see [vision](vision.md#palm-rotation).

## The Tone graph

```
PolySynth(Synth) → Filter(low/high/bandpass) → [the rack] → Volume → destination
                                                                │
                                                                └─→ Meter

the rack, reorderable, default order:
  BitCrusher → Chorus → Tremolo → Phaser → FeedbackDelay → Reverb
```

- **PolySynth** with `maxPolyphony = 32`. Extended chords run to five notes and
  release tails hold voices past a chord change, so the default polyphony is not
  enough.
- **Filter** — lowpass, highpass or bandpass, swept by right-hand rotation. See
  below.
- **The effects rack** — six of them, in whatever order the panel has them. Each
  has a fixed character and a wet-mix knob; the three with a *rate* have a second
  knob for it as well, covered under [rate and tempo](#rate-and-tempo) below.

  | Node | Fixed character | Rate |
  | --- | --- | --- |
  | `BitCrusher` | `BITCRUSHER_BITS` 4 | — |
  | `Chorus` | `CHORUS_FREQUENCY` 1.5 Hz at `CHORUS_DEPTH` 0.7 | — |
  | `Tremolo` | `TREMOLO_DEPTH` 0.8 | 50–2000 ms, default 200 (5 Hz) |
  | `Phaser` | `PHASER_OCTAVES` 3 over `PHASER_BASE_FREQUENCY` 350 Hz | 250–10000 ms, default 2500 (0.4 Hz) |
  | `FeedbackDelay` | `DELAY_FEEDBACK` 0.35 | 20–1000 ms, default 250 |
  | `Reverb` | `REVERB_DECAY` of 3 s | — |

  These live in [effects.ts](../src/audio/effects.ts) rather than in the engine,
  because the panel draws its glyphs from the same numbers.

  Two of them have LFOs that must be `start()`-ed by hand or the effect is silent
  at any wet value: the chorus and the tremolo. The phaser starts its own. The
  crusher's quantizer runs in an `AudioWorklet` whose module Tone registers
  asynchronously, so it passes dry for the moment after construction — it is built
  during startup rather than lazily so that wait is never spent on a knob drag —
  and Tone types its option bag as the worklet's own, which carries no `wet`, so
  it is the one node closed after construction rather than in it.

  All six begin at `wet: 0`, unchained; `setEffects` wires them and opens
  whichever ones carry an amount. No gesture touches them — the rack is set in
  the panel and holds.
- **Volume** — starts at `MIN_DB` (−40) so nothing blasts out at startup.
- **Meter** — a dead-end tap for the overlay. Its output goes nowhere, so it
  changes nothing about what is heard.

### Scheduling latency

`App.tsx` sets `Tone.getContext().lookAhead = 0` immediately after `Tone.start()`.

An un-timed `triggerAttack` resolves to `currentTime + lookAhead`, and Tone
defaults `lookAhead` to 100 ms. That headroom exists so sequenced material has
time to be scheduled before it is due; nothing here is sequenced — every chord is
struck the moment a hand moves — so all it buys is a flat 100 ms between gesture
and sound, on top of the camera and detection latency the instrument already
carries. Tone floors the ticker's own interval at 10 ms when this is zero, so the
clock keeps running.

### The meter tap

`getLevel()` returns the output level as 0–1 for the sound-reactive overlay
(see [vision.md](vision.md#overlay)). Two decisions in it are deliberate:

- **It hangs off Volume, not off the synth.** Everything the player does is
  therefore in the reading: the envelope, the filter, the delay repeats, the
  reverb tail, and the wrist-height volume gesture. Raising your hand really
  does brighten the overlay, because it really is louder.
- **It reads the signal, not the gesture.** `smoothedVolume` in the render loop
  goes to zero the moment a hand leaves the frame, but the chord is still
  ringing out. Only a meter on the audio shows that tail.

`levelFromDb(db, floor = METER_FLOOR_DB)` does the mapping, and is linear in
**dB** across −48…0 rather than in amplitude. A linear-amplitude glow spends
nearly all of its travel in the top few dB and reads as an on/off switch. A
silent meter reports `-Infinity`, so anything non-finite floors at 0.

`METER_SMOOTHING` is kept low (0.2): the overlay runs its own asymmetric
follower, which is what the eye actually responds to.

### Volume mapping

`setVolume(level)` takes 0–1 and maps it linearly onto −40…0 dB, ramped over
50 ms — long enough to avoid zipper noise, short enough to feel live. A level of
exactly 0 maps to `-Infinity` rather than −40 dB, so "quiet" really is silent.

### Filter mapping

`setFilterType(type)` picks which of the three responses the sweep drives —
`lowpass`, `highpass` or `bandpass`, listed in
[filter.ts](../src/audio/filter.ts). It is set straight onto the Tone node rather
than ramped: the response shape changes discontinuously anyway, and `type` is a
plain property with nothing to ramp. The type only decides which side of the
cutoff survives; the sweep itself is identical for all three.

`setCutoff(amount)` takes 0–1 — right-hand rotation, smoothed — and maps it onto
the configured `cutoffMin`…`cutoffMax` range from `setCutoffRange`, ramped over
50 ms for the same reason volume is.

The mapping is **exponential**, `cutoffHz` in
[SynthEngine.ts](../src/audio/SynthEngine.ts):

```ts
min * (max / min) ** amount
```

Brightness is heard in ratios, not in Hz. A linear sweep from 200 Hz to 8 kHz
spends over three quarters of its travel above 2 kHz, where every position sounds
equally open; the exponential one gives each half of the turn the same number of
octaves. The filter is built at `cutoffMax` so a lowpass is wide open and the
first chord is not muffled before a hand has ever been seen.

### The effects rack

The rack is a **setting, not a gesture**. Every edit lands in one `setEffects`,
which ramps each node's `wet` to `clamp01(amount)` over 50 ms — only a knob drag
moves it, but the ramp keeps that drag from clicking on a chord that is already
sounding. An effect left at 0 sits fully dry rather than at some baseline, so
turning one down silences it instead of leaving it humming underneath.

Order is the player's, so the chain is rebuilt rather than fixed. `setEffects`
compares the incoming ids against the wiring it already has and calls `rewire`
only on a real reorder, which disconnects the filter and all six nodes — Tone's
no-argument `disconnect` drops every outgoing connection — then chains
`filter → …effects… → volume` afresh. A reorder is a panel action, so the brief
discontinuity it puts through a sounding chord is accepted rather than
crossfaded around.

The array's order *is* the chain order, which makes it the one thing that has to
be true: `normalizeEffects` guarantees every id appears exactly once, since a
missing id would strand that node outside the signal path and a duplicate would
try to wire one node in twice.

### Rate and tempo

Tremolo, phaser and delay — `TIMED_EFFECT_IDS` — have a period as well as an
amount. The rack stores it as **one quantity, a time in milliseconds**, and the
engine fans it back out at the last moment: `delayTime` takes `ms / 1000`, and
the two LFOs take `1000 / ms` as a frequency. That is why the panel calls the
phaser's control a period rather than the rate a phaser is usually described by.

Each one is stored both ways at once:

```ts
interface EffectTiming {
  lock: boolean          // snap to the grid, or run free
  division: DivisionId   // the note value used while locked
  ms: number             // the period used while unlocked
}
```

`effectMs(timing, bpm)` picks whichever side the lock names and leaves the other
alone. Storing both is the point: a lock can be turned off and back on and each
side still holds the rate that was dialled into it, rather than a value converted
out of the other one and rounded.

`DIVISIONS` holds thirteen note values — straight, dotted and triplet, from
`1/32` up to `1/1` — measured in beats by `DIVISION_BEATS`. A dot adds half the
note again; a triplet fits three into the space of two, so `1/8T` is two thirds
of an eighth rather than a third of one.

The array is ordered **by duration, not by family**, because the locked knob
drives an *index into it* rather than a duration. Its detents therefore run short
to long clockwise like every other knob in the panel, and `quantize` in
[knobMath.ts](../src/components/knobMath.ts) does the snapping, so there is no
second quantizer anywhere in the rack. Ordering by length interleaves the three
families, which is the point: what a player reaches for next is the neighbouring
*length*, not the neighbouring notation.

```
1/32  1/16T  1/16  1/8T  1/16•  1/8  1/4T  1/8•  1/4  1/2T  1/4•  1/2  1/1
0.125 0.167  0.25  0.333 0.375  0.5  0.667 0.75  1    1.333 1.5   2    4   beats
```

A locked division is free to resolve outside that effect's own
`EFFECT_MS_RANGES` bounds — `1/1` at 40 BPM is 6 s, well past the delay's manual
ceiling of 1 s. That is deliberate: the grid is the grid, the two sides are
stored independently, and clamping would make one division mean different things
on different effects while the readout went on claiming otherwise.

`bpm` is a single setting for the whole rack, read only by the effects whose lock
is on. It reaches the engine through `setEffects(effects, bpm)` rather than a
setter of its own: a locked rate is a function of both, and splitting them would
mean applying the same timing twice for one edit.

Two things worth not "fixing" later:

- **`maxDelay` is set at construction to `DELAY_MAX_SECONDS`.** Tone defaults it
  to one second and the underlying `DelayNode` cannot grow past whatever it was
  built with. The longest time the rack can ask for is a whole note at the
  slowest tempo — 60/40 × 4 = 6 s.

  Tone bounds the `delayTime` param by that buffer and **throws** past it rather
  than clamping — `Value must be within [0, 1], got: 6`, from `rampTo` as much as
  from a direct assignment. An undersized buffer is therefore not a quiet
  mistuning but a crash the first time a long division is picked, and because
  `setEffects` walks the whole rack in one loop, it abandons every effect after
  the delay on the way out.

  So the constant is **derived** from `DIVISIONS`, `BPM_RANGE` and the delay's
  own knob ceiling rather than written down, and a division added to the list
  widens the buffer on its own instead of outgrowing it. `effects.test.ts`
  asserts the sizing against that same data, since a number hard-coded to match
  would only restate the bug.
- **The rate is ramped, not set.** On the delay that pitch-bends the tail while
  it moves, the way a tape delay does. It is the better of the two: setting
  `delayTime` outright clicks instead.

The default is bitcrusher → chorus → tremolo → phaser → delay → reverb —
waveshaping, then modulation, then time, then space. The crusher leads because it
is the only one that rewrites the waveform itself; behind the modulation it would
be quantizing a signal already smeared by three LFOs, and its steps would read as
noise rather than as grit on the chord. The delay stays ahead of the reverb so
its repeats are caught by the tail rather than arriving dry after it.

A stored rack from before an effect existed simply gains it — `normalizeEffects`
appends anything missing at its default, which is silent — so an update never
changes what a returning player hears. It lands at the *end* of their chain
rather than at its canonical position, which only starts to matter once they turn
its knob up, and the reorder arrows are right there.

### Voice handling

`voiceNotes(notes)` diffs the sounding notes against the requested ones and only
releases what left and attacks what arrived:

```ts
const release = held.filter((n) => !notes.includes(n))
const attack  = notes.filter((n) => !held.includes(n))
```

This is not just an optimization. Tone hands out a fresh voice per attack and
only recycles one once it has fallen silent, so releasing and re-attacking a
still-sounding note within the same tick leaves the old voice audible *over* the
new one — an audible doubling on every chord change that shares notes. Diffing
avoids it, and has the pleasant side effect of making chord changes legato.

`SynthEngine.test.ts` pins exactly this behaviour: moving from `C` to `Am`
should attack only the note that changed, and common tones should never be
retriggered.

### Live edits

Editing a chord, the base octave, or a per-slot offset while a chord is sounding
— or switching to another song section — calls `revoice()`, which recomputes the current slot's notes and diffs them in —
so the change is heard immediately without a retrigger of unchanged notes.

`setVoice` splits on what changed. A new **waveform** forces a retrigger of held
notes: Tone's `set()` only cleanly reaches idle voices, so the timbre change
would otherwise not be audible until the next chord. An **envelope** edit does
not — ADSR legitimately applies to the next attack, and the panel fires
`setVoice` on every event of a knob drag, so retriggering would re-strike the
chord on each tick of that drag.

### Sustain semantics

```ts
engine.setChordSlot(n)     // release the old chord, attack the new one
engine.setChordSlot(null)  // fist, or hand lost → release everything
```

`setChordSlot` early-returns when the slot has not changed, so the loop can call
it every frame at no cost.

## Testing

`npm test` covers this module without an `AudioContext`: `SynthEngine.test.ts`
mocks the whole `tone` module with stub nodes that record attacks and releases,
then asserts on which notes are sounding. `chords.test.ts` checks triads,
sevenths, extensions, octave rollover, parser edge cases (`C#` vs `C`, `m7b5` vs
`m7`, `mmaj7` vs `maj7`), round-tripping every one of the 480 names, and the flat
spelling leaving no sharp root behind — and no `#` or `b` in any formatted name —
while the stored name still parses. `cutoffHz` is checked at its
ends, its geometric midpoint, and outside its range.

The same mock captures each effect's `wet` param and records every `connect` as
the engine builds its graph, so the rack is asserted end-to-end: the default
chain is wired in order, the chorus and tremolo LFOs are started, each effect
holds its own amount, an amount edit lands on a chord that is already sounding,
and a reorder rewires without leaving a node feeding the chain it was moved out
of.
`effects.test.ts` covers `moveEffect`, `normalizeEffects` and `isEffectId` on
their own. Note the mock is a **whitelist** — a Tone node added
to the graph without a matching stub fails every test in the file.
