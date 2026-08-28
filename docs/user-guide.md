# User guide

## Playing

| Gesture | Effect |
| --- | --- |
| ✋ Left hand, 1–5 fingers | Plays chord slot 1–5, sustained for as long as you hold it |
| ✊ Left hand, fist (0 fingers) | Releases — silence |
| ↕️ Right hand height | Volume — higher in the frame is louder |
| 🔄 Right hand rotation | Lowpass filter — turn clockwise to open it up |
| 🤚 Right hand, 1–5 fingers | Switches to song section 1–5, if that section is turned on |
| ✊ Right hand, fist (0 fingers) | Nothing — the section holds |
| Left hand out of frame | After a ~300 ms grace period, the chord releases |
| Right hand out of frame | Volume and filter hold at their last value |

The two hands are independent. You can change chords with the left hand while
the right hand holds a volume and a filter position, or leave the right hand out
of frame entirely once the sound is where you want it.

Only a *change* in the right hand's finger count switches sections, so holding a
count steady while you shape volume changes nothing. A fist selects no section —
unlike the left hand, where a fist is the release, there is nothing sensible to
switch to — and dropping the hand out of frame holds the section along with the
volume and the filter.

Rotation is read from the line between your wrist and your middle knuckle, so it
does not care what your fingers are doing. Upright sits halfway through the
sweep; a quarter turn either way reaches the end of it.

Chord changes are legato: notes shared between the old and new chord keep
ringing rather than being retriggered, so moving from `C` to `Am` only re-attacks
the note that actually changed.

### Why the counting is forgiving

Finger counting is measured from the wrist and normalized by palm size, so it
holds up when your hand is tilted or at a different distance from the camera. A
naive "is the fingertip above the knuckle" test does not. See
[vision](vision.md#finger-counting) for the details.

A gesture must also hold steady for a few consecutive frames before it commits
(**Steadiness** in settings), which stops chords from flickering while your
fingers are still in transit.

## The HUD

The overlay on the camera stage shows:

- **Left hand · chord** — the chord name and the octave it is actually playing
  at, plus the raw finger count. A slash bass shows in the name, as `C/E`. The
  card dims when the hand is not detected.
- **Volume** — a vertical meter, 0–100%, following the smoothed level.
- **Right hand · filter** — the current cutoff, plus the raw finger count and
  the song section it is on. The section is named even when the hand is gone,
  because it holds.
- **fps** — the render loop's frame rate, smoothed. Useful for spotting a
  browser that has fallen back to slow inference.

Two dashed horizontal lines mark the top and bottom of the volume range. The
hand skeleton is drawn in blue for the left hand and orange for the right.

### The hands react to the sound

The skeleton is the sound visualiser — there is no separate panel to read, and
nothing covers your face or hands.

- **Glow and thickness follow what you actually hear.** Both hands brighten on
  an attack and fade as the chord decays. Because the level is measured on the
  audio and not on your gesture, the glow keeps going after you drop the chord,
  showing the release and the reverb or delay tail ringing out.
- **Colour follows the filter.** Rotate your right palm and both hands run from
  dark and muted with the filter closed to full colour with it open.
- **Rings count the chord.** Each time the left hand picks a new chord, rings
  expand from the palm — one per finger, so you can see which slot was
  recognised without looking at the HUD. Slots 4 and 5 draw three rings, the
  same as slot 3: the rings are spaced inward from a fixed outer radius and the
  fourth lands at zero. The right hand blooms the same way on a section change,
  in orange, and only when the switch actually took — asking for a section that
  is turned off draws nothing.
- **Raising your right hand brightens everything**, because the level is read
  after the volume gesture.

Turn it off with **Sound-reactive hands** in the settings panel; the skeleton
then draws flat, exactly as it did before.

## The sound

One voice, shaped entirely in the settings panel: a waveform — `sine`,
`triangle`, `square`, or `sawtooth` — and its ADSR envelope.

The waveform is a row of four buttons, each drawn as the wave it picks, and the
one you are on lights up cyan. Hover a button for its name. Arrow keys walk the
row once it has focus, wrapping at both ends. The shapes run from smooth to
harsh in that order: sine is a plain tone, triangle a soft one, square hollow
and reedy, sawtooth the brightest and buzziest.

The envelope is drawn above its four knobs, each in the colour of the stage it
controls, so the curve is the shape of a single chord's life. Turn a knob by
dragging it up or down; it also takes the arrow and page keys once focused, and
a double-click puts it back to its default.

| Knob | What it does |
| --- | --- |
| Attack | How long a chord takes to fade in when you raise fingers |
| Decay | How long it takes to fall from that peak to the sustain level |
| Sustain | The level a held chord settles at, 0–1 — the flat stretch of the curve |
| Release | How long it takes to fade out after you make a fist |

A long attack with a long release gives a pad; a near-zero attack with a low
sustain and short decay gives a pluck. Changing the waveform while a chord is
sounding retriggers it so you hear the new timbre straight away; envelope edits
apply to the next chord, so a drag never stutters what is already ringing.

The **Filter** section sets the two ends of the rotation sweep — a floor as low
as 50 Hz and a ceiling as high as 12 kHz. See
[audio](audio.md#filter-mapping) for the exact mapping.

The **Effects** section sets a fixed send behind everything you play — no
gesture touches it. **Effect** picks what it feeds:

| Setting | What you hear |
| --- | --- |
| Reverb | A 3-second tail, the default |
| Delay | Repeats a quarter-second apart, feeding back at 0.35 |
| Delay + reverb | Both at once |

Whatever is not picked stays fully bypassed, so switching to **Delay** silences
the reverb rather than leaving it humming underneath.

**Amount** is the wet mix, 0–100% (default 25%). At 0 the sound is completely
dry. The delay's timing and feedback are fixed; only the amount is adjustable.

## Sections

Five chords is one progression, not a song. A **section** is a named set of those
five chords, and there are five of them — one per finger on your right hand.

You start with one, called *Verse*. The tab strip at the top of the panel shows
all five: the ones you have added by name, and the rest dimmed with a `+`. Tap a
dimmed tab to add that section; it starts as a copy of the section you were just
on, so you can change the two chords that actually differ instead of rebuilding
a progression from `C G Am F Em`. Rename it in the field under the strip — the
name is what the HUD and the tab show, and an empty one falls back to
`Section 2`, `Section 3`, and so on.

**×** removes the section you are on and drops you back to the first one that is
still there. The last remaining section cannot be removed, because the left hand
always needs somewhere to play from.

While you perform, your right hand's finger count picks the section — one finger
for the first, five for the fifth. A section you have not added yet is not
reachable, so a miscounted finger cannot drop you into an empty bank. If you are
holding a chord when you switch, it changes over to the new section's chord for
that same finger count immediately, and any notes the two chords share keep
ringing rather than being re-struck. The panel follows along, so the tab you are
looking at is always the one you are hearing.

## Chords

Each of the five slots in a section is freely assignable from **12 roots × 21
qualities = 252 chords**:

| Qualities | |
| --- | --- |
| Triads | maj, min, aug, dim, sus2, sus4 |
| Sevenths | 7, min7, maj7, dim7, m7b5 |
| Sixths | 6, m6 |
| Ninths | 9, maj9, m9, add9 |
| Thirteenths | 13, maj13, m13, add13 |

Roots are listed naturals-first: `C D E F G A B` then `C# D# F# G# A#`. The
quality picker is ordered by how many notes the chord has, so the six triads
come first and the thirteenths last.

**Note names** at the bottom of the section switches the black keys between
sharps and flats — `C#` or `Db`, `A#` or `Bb`. It renames them everywhere at
once: the root picker, the bass picker and the HUD. It is a naming choice only,
so the chords keep playing exactly the same notes.

Defaults are `C · G · Am · F · Em` — the I–V–vi–IV–iii of C major.

### Inversion and alt bass

Each slot has two more pickers on its second line, both optional.

**inv** chooses the inversion: `root` leaves the chord as it is, `1st` moves its
lowest note up an octave, `2nd` moves the lowest two, and so on. How far it goes
depends on the quality — a triad offers up to `2nd`, a seventh up to `3rd`, a
ninth up to `4th` and a thirteenth up to `5th`. Inversions are what stop a
progression from leaping: `C` to `G` in root position jumps a fifth in the bass,
while `C` to a second-inversion `G` moves it by a step. Switching to a quality
with fewer notes brings an out-of-range inversion down with it rather than
breaking the slot.

**bass** puts any note underneath the chord — a slash chord. It reads as the
chord's own root by default, which means no extra note; pick anything else and
that note sounds below the chord, as `C/E` or `G/B`. The bass is always voiced
below every chord tone, so it works together with an inversion rather than
fighting it. Setting it back to the root clears it.

Each slot also carries its own octave shift of −2…+2, applied on top of the
global **Base octave** (1–5, default 3). The combined octave is clamped to 0–7
so a shifted slot can never land somewhere unplayable. The HUD shows the
resolved octave, not the offset.

## Settings panel

The panel on the right persists to `localStorage` and applies live — edits are
heard immediately, including on a chord that is currently sounding.

It opens from the rail of six round icon buttons down the right edge of the
screen — one per group in the table below, named on hover. Clicking one opens
the panel on that group alone, so only ever one group is on screen; clicking the
lit button again slides the panel away. Which one you left open is remembered,
and survives **Reset to defaults**. On a narrow screen the rail becomes a row of
circles under the **Stop** button and the panel rises from the bottom.

These groups are panel navigation and have nothing to do with the five *song
sections* below, which are banks of chords your right hand switches between.

| Group | Control | Meaning |
| --- | --- | --- |
| Chords | Section tabs | Which of the five sections you are editing and hearing; a dimmed tab adds that section |
| | Name | What the tab and the HUD call this section, up to 18 characters |
| | × | Removes this section; disabled when it is the only one left |
| | Root / quality per slot | What each left-hand finger count plays in this section |
| | inv per slot | Inversion, `root` up to the quality's note count |
| | bass per slot | Slash bass; the chord's own root means none |
| | ± per slot | Octave shift for that slot, −2…+2 |
| | Base octave | Global octave, 1–5 — shared by every section |
| | Note names | Sharps or flats for the black keys; naming only, nothing sounds different |
| Sound | Waveform | Four buttons drawn as their waves: `sine`, `triangle`, `square`, `sawtooth` |
| | Attack / Decay / Sustain / Release | Knobs under the envelope graph; the shape every chord is played with |
| Filter | Closed | Cutoff at full anticlockwise rotation, 50–1000 Hz |
| | Open | Cutoff at full clockwise rotation, 1–12 kHz |
| Effects | Effect | Reverb, delay, or both |
| | Amount | Wet mix, 0–100% |
| Volume range | Top (100%) | Frame position that reads as full volume, 0–0.5 |
| | Bottom (0%) | Frame position that reads as silence, 0.5–1 |
| Tracking | Steadiness | Frames a gesture must hold before committing, 1–12 |
| | Swap hands | Flip handedness if left/right come out reversed |
| | Show hand skeleton | Toggles the tracking overlay |
| | Sound-reactive hands | Glow, colour and rings follow the sound; greyed out while the skeleton is hidden, since nothing is drawn to react |

**Reset to defaults** restores everything, including every section and its chord
assignments, the voice, the filter range, and the effect send.

Support lives outside the panel: the round **Buy me a coffee** button in the
top-left corner of every screen opens
[buymeacoffee.com/dj.hands](https://buymeacoffee.com/dj.hands) in a panel
without leaving the page. On a first visit it says hello with a short message
beside it, then hides itself and stays quiet on later visits.

Volume positions are given in normalized frame coordinates: `0.0` is the top
edge of the video, `1.0` is the bottom. Defaults are `0.15` and `0.85`, so
roughly the middle 70% of the frame is the usable range. Narrowing the range
makes volume more sensitive to small movements.

## Privacy

The camera stream never leaves the tab. There is no server, no upload, and no
recording — frames go straight from `getUserMedia` into the in-browser model and
are discarded.

Two things do talk to the network, neither of them touching the video. Google
Analytics on the deployed site sends page views plus the `session_started`,
`session_start_failed` and `support_click` events; see
[deployment](deployment.md#analytics). And the Buy Me a Coffee widget loads its
script from `cdnjs`, sets a `visited` cookie so its greeting only appears once,
and loads buymeacoffee.com in an iframe — but only once you click the button.
