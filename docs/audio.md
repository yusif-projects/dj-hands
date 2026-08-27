# Audio

Two modules, cleanly split: [chords.ts](../src/audio/chords.ts) is pure music
theory with no audio in it at all, and [SynthEngine.ts](../src/audio/SynthEngine.ts)
is an imperative wrapper over a Tone.js graph. [voice.ts](../src/audio/voice.ts)
is plain data.

## Chord model

A chord name is a **root** plus a **quality suffix**: `C`, `Am`, `F#maj7`,
`A#m7b5`. Major is the bare root — no suffix.

### Roots

`C D E F G A B C# D# F# G# A#` — naturals first so the picker reads naturally.
Internally each maps to a semitone offset 0–11. Sharps only; there is no flat
spelling.

### Qualities

| id | label | intervals |
| --- | --- | --- |
| *(empty)* | maj | 0 4 7 |
| `m` | min | 0 3 7 |
| `7` | 7 | 0 4 7 10 |
| `m7` | min7 | 0 3 7 10 |
| `maj7` | M7 | 0 4 7 11 |
| `6` | 6 | 0 4 7 9 |
| `m6` | m6 | 0 3 7 9 |
| `9` | 9 | 0 4 7 10 14 |
| `maj9` | maj9 | 0 4 7 11 14 |
| `add9` | add9 | 0 4 7 14 |
| `sus2` | sus2 | 0 2 7 |
| `sus4` | sus4 | 0 5 7 |
| `dim` | dim | 0 3 6 |
| `dim7` | dim7 | 0 3 6 9 |
| `m7b5` | m7b5 | 0 3 6 10 |

Intervals past 11 are intentional — a `14` voices the ninth an octave up rather
than crowding it against the root.

12 roots × 15 qualities = **180 chords**, enumerated in `CHORDS` for validation
and tests.

### API

```ts
parseChord('F#m7')      // → { root: 'F#', quality: { id: 'm7', … } } | null
isChordName(x)          // type guard, used when loading persisted settings
toChordName('F#', 'm7') // → 'F#m7'
chordToNotes('Am', 3)   // → ['A3', 'C4', 'E4']
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
chord this thick.

Earlier builds shipped five fixed presets picked by right-hand finger count.
That hand now drives the filter instead, and the finger count on it is unused —
see [vision](vision.md#palm-rotation).

## The Tone graph

```
PolySynth(Synth) → Filter(lowpass) → Reverb(decay 3) → Volume → destination
```

- **PolySynth** with `maxPolyphony = 32`. Extended chords run to five notes and
  release tails hold voices past a chord change, so the default polyphony is not
  enough.
- **Filter** — lowpass, swept by right-hand rotation. See below.
- **Reverb** — fixed 3 s decay at a fixed `REVERB_WET` of 0.25. Rotation owns the
  filter, so the wet mix stays out of the way rather than being another knob.
- **Volume** — starts at `MIN_DB` (−40) so nothing blasts out at startup.

### Volume mapping

`setVolume(level)` takes 0–1 and maps it linearly onto −40…0 dB, ramped over
50 ms — long enough to avoid zipper noise, short enough to feel live. A level of
exactly 0 maps to `-Infinity` rather than −40 dB, so "quiet" really is silent.

### Filter mapping

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
octaves. The filter is built wide open so the first chord is not muffled before a
hand has ever been seen.

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
calls `revoice()`, which recomputes the current slot's notes and diffs them in —
so the change is heard immediately without a retrigger of unchanged notes.

`setVoice` splits on what changed. A new **waveform** forces a retrigger of held
notes: Tone's `set()` only cleanly reaches idle voices, so the timbre change
would otherwise not be audible until the next chord. An **envelope** edit does
not — ADSR legitimately applies to the next attack, and the panel fires
`setVoice` on every slider input event, so retriggering would re-strike the chord
on each tick of a drag.

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
`m7`), and round-tripping every one of the 180 names, and `cutoffHz` is checked
at its ends, its geometric midpoint, and outside its range.
