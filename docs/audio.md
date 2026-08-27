# Audio

Two modules, cleanly split: [chords.ts](../src/audio/chords.ts) is pure music
theory with no audio in it at all, and [SynthEngine.ts](../src/audio/SynthEngine.ts)
is an imperative wrapper over a Tone.js graph. [presets.ts](../src/audio/presets.ts)
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

## Presets

Five voices, selected by right-hand finger count:

| # | Name | Osc | Attack | Decay | Sustain | Release | Cutoff | Reverb |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Warm Pad | sawtooth | 0.6 | 0.4 | 0.80 | 1.6 | 1800 Hz | 0.55 |
| 2 | Square Lead | square | 0.01 | 0.2 | 0.70 | 0.3 | 3500 Hz | 0.05 |
| 3 | Soft Sine | sine | 0.15 | 0.3 | 0.85 | 0.8 | 5000 Hz | 0.25 |
| 4 | Pluck | triangle | 0.005 | 0.5 | 0.15 | 0.4 | 4000 Hz | 0.20 |
| 5 | Organ | fatsine | 0.02 | 0.05 | 1.00 | 0.1 | 6000 Hz | 0.15 |

Times are in seconds; sustain is a 0–1 level; reverb is a wet mix 0–1. Only the
oscillator is user-editable; the rest are fixed per preset. Available
oscillators: `sine`, `triangle`, `square`, `sawtooth`, `fatsine`, `fatsawtooth`.

## The Tone graph

```
PolySynth(Synth) → Filter(lowpass) → Reverb(decay 3) → Volume → destination
```

- **PolySynth** with `maxPolyphony = 32`. Extended chords run to five notes and
  release tails hold voices past a chord change, so the default polyphony is not
  enough.
- **Filter** — lowpass, cutoff ramped over 0.1 s on preset change.
- **Reverb** — fixed 3 s decay; the preset controls the wet mix, also ramped
  over 0.1 s.
- **Volume** — starts at `MIN_DB` (−40) so nothing blasts out at startup.

### Volume mapping

`setVolume(level)` takes 0–1 and maps it linearly onto −40…0 dB, ramped over
50 ms — long enough to avoid zipper noise, short enough to feel live. A level of
exactly 0 maps to `-Infinity` rather than −40 dB, so "quiet" really is silent.

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

Changing a *preset*, by contrast, does force a retrigger of held notes.
Tone's `set()` only cleanly reaches idle voices, so a timbre change would
otherwise not be audible until the next chord.

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
`m7`), and round-tripping every one of the 180 names.
