---
name: DJ Hands
description: A dark instrument panel where colour only ever means a hand, a stage, or a signal that is live.
colors:
  bg: "#0b0e14"
  stage: "#05070c"
  console: "#0d1119"
  recessed: "#10141d"
  raised: "#151a25"
  panel: "rgba(18, 22, 32, 0.92)"
  border: "rgba(255, 255, 255, 0.1)"
  border-hover: "rgba(255, 255, 255, 0.28)"
  track: "rgba(255, 255, 255, 0.12)"
  text: "#e8ecf4"
  muted: "#8b93a7"
  left: "#4dd6ff"
  right: "#ff9f43"
  accent: "#6c8cff"
  on-accent: "#0b0e14"
  left-edge: "color-mix(in srgb, #4dd6ff 40%, transparent)"
  left-legend: "color-mix(in srgb, #4dd6ff 8%, transparent)"
  left-live: "color-mix(in srgb, #4dd6ff 12%, transparent)"
  right-edge: "color-mix(in srgb, #ff9f43 40%, transparent)"
  right-legend: "color-mix(in srgb, #ff9f43 8%, transparent)"
  right-live: "color-mix(in srgb, #ff9f43 12%, transparent)"
  accent-live: "color-mix(in srgb, #6c8cff 12%, transparent)"
  selection: "color-mix(in srgb, #6c8cff 35%, transparent)"
  adsr-attack: "#ff7b8a"
  adsr-decay: "#4dd6ff"
  adsr-sustain: "#ffe27a"
  adsr-release: "#c07bff"
  cutoff-min: "#ff9f43"
  cutoff-max: "#ffcf8a"
  fx-bpm: "#7ab8ff"
  fx-bitcrusher: "#b7f5da"
  fx-chorus: "#8ef0c8"
  fx-tremolo: "#72e8b8"
  fx-phaser: "#5bdfa8"
  fx-delay: "#4ddba0"
  fx-reverb: "#34c795"
  error: "#ffb3b3"
  error-bg: "rgba(255, 96, 96, 0.12)"
  error-border: "rgba(255, 96, 96, 0.35)"
typography:
  display:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "32px"
    fontWeight: 700
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.03em"
    fontFeature: "tabular-nums"
  title:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.02em"
  cta:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 600
  body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.55
  ui:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  detail:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 400
  label:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    letterSpacing: "0.07em"
  readout:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    fontFeature: "tabular-nums"
  micro:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "10px"
    fontWeight: 400
rounded:
  xs: "2px"
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  xxl: "16px"
  xxxl: "18px"
  pill: "999px"
  circle: "50%"
spacing:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "12px"
  xxl: "18px"
  xxxl: "20px"
  card: "34px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    typography: "{typography.cta}"
    rounded: "{rounded.lg}"
    padding: "13px"
    width: "100%"
  button-primary-hover:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
  button-primary-disabled:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
  button-reset:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.lg}"
    padding: "9px"
    width: "100%"
  rail-button:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.muted}"
    rounded: "{rounded.pill}"
    height: "40px"
    width: "40px"
  rail-button-active:
    backgroundColor: "{colors.accent-live}"
    textColor: "{colors.text}"
    rounded: "{rounded.pill}"
    height: "40px"
    width: "40px"
  chord-pad:
    backgroundColor: "rgba(10, 12, 18, 0.7)"
    textColor: "{colors.muted}"
    rounded: "{rounded.md}"
    padding: "4px 6px 5px"
  chord-pad-on:
    backgroundColor: "{colors.left-live}"
    textColor: "{colors.left}"
    rounded: "{rounded.md}"
    padding: "4px 6px 5px"
  section-tab:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.text}"
    typography: "{typography.detail}"
    rounded: "{rounded.md}"
    padding: "6px 7px"
  section-tab-active:
    backgroundColor: "{colors.right-live}"
    textColor: "{colors.text}"
    typography: "{typography.detail}"
    rounded: "{rounded.md}"
    padding: "6px 7px"
  text-input:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.text}"
    typography: "{typography.ui}"
    rounded: "{rounded.md}"
    padding: "6px 8px"
  card-recessed:
    backgroundColor: "{colors.recessed}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: "8px"
  hud-bar:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text}"
    rounded: "{rounded.xl}"
    padding: "10px 18px"
  start-card:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text}"
    rounded: "{rounded.xxl}"
    padding: "34px"
  hand-badge-left:
    backgroundColor: "{colors.left-legend}"
    textColor: "{colors.left}"
    typography: "{typography.detail}"
    rounded: "{rounded.sm}"
    padding: "2px 6px"
  hand-badge-right:
    backgroundColor: "{colors.right-legend}"
    textColor: "{colors.right}"
    typography: "{typography.detail}"
    rounded: "{rounded.sm}"
    padding: "2px 6px"
  hand-group-left:
    backgroundColor: "{colors.left-legend}"
    textColor: "{colors.muted}"
    rounded: "{rounded.lg}"
    padding: "10px 12px"
  hand-group-right:
    backgroundColor: "{colors.right-legend}"
    textColor: "{colors.muted}"
    rounded: "{rounded.lg}"
    padding: "10px 12px"
  knob-dial:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.muted}"
    rounded: "{rounded.circle}"
    size: "52px"
---

# Design System: DJ Hands

## Overview

**Creative North Star: "Hands in the Dark"**

The room is dark and the player is lit. Everything that is not a hand recedes
into graphite — five near-black grounds separated only by a few percent of
lightness and a 10% white hairline — so that the two colours that matter have
nothing to compete with. Cyan is the left hand. Amber is the right hand. That
code is taught on the start card before the camera is even on, drawn onto the
player's own knuckles by the overlay, played back by the chord pads, used to
group the pickers in the settings panel, and stamped on every gesture badge in
the reference. A player learns it once and it is never violated.

The character is precise but warm. The mechanics are instrument-grade: dials
sweep 270° with the dead zone at the bottom, the hardware convention; every
changing number is tabular and sits in a reserved width so nothing in the
interface reflows because a value moved; a chord pad lights in 60ms and lets go
in 240ms because that is what the note does. But the palette is warmer than a
professional tool would permit itself — four envelope colours, a two-ended amber
filter sweep, a seven-step green ramp for the rack — and the discipline is not in
withholding colour, it is in never spending it on something that is not live.

There is no typeface to load and no image to fetch. The interface is the system
sans stack, line art drawn in-repo from the same maths the audio runs on, and
colour. That is the entire material vocabulary, and its restraint is why a
translucent bar of controls can sit on top of a live camera feed without
obscuring the person in it.

**Key Characteristics:**

- Two hand colours carrying one meaning each, used identically in five places.
- Grey at rest, colour when live — saturation is a state, not a style.
- Five graphite grounds and a 10% hairline; no drop shadows anywhere.
- Glass over the video, opaque tone in the column — two grounds, one rule.
- Tabular numerals in reserved widths; the layout never moves because a number did.
- Every glyph drawn in-repo from the audio's own maths, stroked in `currentColor`.
- System sans only. No web fonts, no icon packages, no raster UI assets.

## Colors

A dark, low-chroma ground carrying a small number of high-chroma signals. Nothing
in the palette is decorative: each colour is bound to a hand, a stage of the
envelope, an end of the filter sweep, or a position in the effects chain.

### Primary

- **Signal Cyan** (`--left`): the left hand. The overlay strokes the left hand's
  landmarks in it, the start card tints the left gesture column with it, a chord
  pad takes it the instant the chord commits, the waveform picker wears it because
  the voice is what the left hand plays, and the walkthrough's "holding" state
  turns it on. It means *the left hand is doing something right now* and it means
  nothing else.
- **Ember** (`--right`): the right hand, under the identical contract. Overlay,
  right gesture column, the live section tab, the filter picker, the HUD's arc and
  fader, and the walkthrough's right-hand hold state.

### Secondary

- **Periwinkle** (`--accent`): the interface's own voice, for what belongs to the
  app rather than to either hand — the start button, the walkthrough's completion
  and progress dot, the active rail button, the stat figures, the em-dash bullets,
  the credit links, and the `accent-color` on native checkboxes and ranges. It is
  the only colour allowed to be *about the software*.

### Tertiary

- **Coral, Signal Cyan, Honey, Orchid** (`--adsr-attack`, `--adsr-decay`,
  `--adsr-sustain`, `--adsr-release`): one colour per envelope stage, carried
  identically by the curve segment in the graph and by the knob that edits it.
  Decay deliberately reuses the left hand's cyan rather than introducing a fifth
  hue, so the panel stays inside one palette.
- **Ember and Pale Ember** (`--cutoff-min`, `--cutoff-max`): the two ends of the
  filter sweep, in the right hand's family because that is the hand whose rotation
  drives them. The span between them is washed behind both curves at 9% opacity.
- **The green ramp** (`--fx-bitcrusher` → `--fx-reverb`): six steps of one hue,
  light at the front of the signal path and dark at the back, so the rack reads as
  one group of controls and its shading states the running order.
- **Clock Blue** (`--fx-bpm`): the tempo, deliberately outside the green family
  because the tempo is not a link in the chain.

### Neutral

- **Deep Graphite** (`--bg`): the app ground.
- **Stage Void** (`stage`): behind the camera, and the outer stop of the start
  screen's radial gradient — the darkest surface in the product.
- **Console Graphite** (`console`): the settings column and the rail, which share
  a ground so an open panel and its rail read as one surface.
- **Recessed Graphite** (`recessed`): cards inside the panel — chord slots, effect
  rows, figure frames.
- **Raised Graphite** (`raised`): controls sitting on those cards — selects,
  inputs, tabs, steppers, rail buttons, knob bodies.
- **Smoked Glass** (`--panel`): the translucent ground of anything floating over
  the video.
- **Hairline** (`--border`): 10% white. The only separator in the system.
- **Screen White** (`--text`) and **Quiet Slate** (`--muted`): the two text
  colours. Muted is the default for labels, hints, readouts and resting controls;
  Screen White is a promotion, not a baseline.
- **Alarm Rose** (`error`): the sole error colour, on a 12% red wash inside a 35%
  red border.

Every colour above is a custom property on `:root`. **Screen White is never used
on a filled accent surface** — it reads 3.07:1 there, under AA at the 15px the
primary button runs — so a filled accent takes `--on-accent`, the app's own
ground, at 6.29:1. The accent itself cannot be darkened to solve this from the
other side: it also has to carry 6:1 as *text* on every panel ground.

### Tints

A hand colour is never written out with an alpha at a use site. Three derived
tints per hand, mixed from the token itself, and the **name is the rule**:

- **`-edge` (40%)** — a border that says which hand a thing belongs to.
- **`-legend` (8%)** — a ground under something that *labels* a hand: the start
  card's two columns, a gesture badge, the filter graph's swept span.
- **`-live` (12%)** — a ground under something that is playing, selected or
  running *right now*: a struck chord pad, the active song-section tab, the
  selected waveform or filter.

`--accent-live` is the same 12% for the rail's active button, which belongs to
the app rather than to either hand, and `--selection` is the accent at 35%.
These eight replaced seven different alphas that were saying three different
things. Choosing wrongly is now a word you can read rather than a number you
have to look up.

The one hand colour still written as a literal is the fader's glow, whose alpha
is a live expression of measured audio rather than a fixed step.

### Named Rules

**The Two Hands Rule.** Cyan is the left hand and amber is the right hand,
everywhere, without exception. A hand colour on a control that belongs to the
other hand — or to neither — is a defect, not a variation.

**The Live Colour Rule.** Grey is the resting state of everything. A colour
appearing on screen means that thing is playing, selected, running, or being
held. Colour is never spent on hierarchy, emphasis, or decoration. The tint
names enforce this: a `-legend` ground labels, a `-live` ground means *now*, and
reaching for the wrong one is visible in the diff.

**The Chain Ramp Rule.** The effects rack is one hue in six steps, lightest at
the front of the signal path and darkest at the back. Reordering the chain
reorders the shading. Anything that is not in the chain — the tempo — must leave
the family.

## Typography

**Display Font:** none — `ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`
**Body Font:** the same stack
**Label/Mono Font:** the same stack, with `font-variant-numeric: tabular-nums`

**Character:** the system's own voice, deliberately unbranded. There is no web
font to wait for, which is why the start card can render from prerendered markup
and look finished before a single byte of JavaScript arrives. Personality comes
from the numerals and the tracking, not the letterforms: negative tracking on the
large sizes so headings sit tight, positive tracking and uppercase on the small
ones so labels read as labels, and tabular figures everywhere a number can change.

### Hierarchy

- **Display** (700, 32px, -0.02em): the product name on the start card. The
  loudest word on the screen, on purpose.
- **Headline** (700, 28px, 1.0, -0.03em, tabular): the four stat figures. Sized
  deliberately *under* the display — the numbers are the argument, but the name of
  the thing still wins.
- **Title** (700, 20px, 1.3, -0.02em): landing section headings, the one size the
  landing prose adds to the card's scale.
- **CTA** (600, 15px): the start button, and the base size of the document.
- **Body** (400, 14px, 1.55–1.65): prose, gesture rows, the walkthrough prompt.
- **UI** (400, 13px, 1.5): settings rows, labels, selects, section names.
- **Detail** (400, 12px): hints, sub-lines, fine print, readouts beside a control.
- **Label** (600, 11px, 0.07em, uppercase): stat labels, hand names, group
  headings, rail tips, the HUD's section name (at 0.08em).
- **Readout** (400, 11px, tabular): knob values, octaves, tab numbers, frame rate.

### Named Rules

**The Six Sizes Rule.** The start card runs on six sizes and no others: 32 title,
28 stat figure, 15 call to action, 14 prose, 12 detail, 11 uppercase label.
Anything that lands between two of them is a mistake, not a nuance. New surfaces
extend this scale only by adding a size deliberately and once — the landing prose
added exactly one (20px) and reused everything else; the app chrome added 13 for
settings rows and 10 for the smallest readouts. Nine sizes carry the entire
product. A tenth needs a reason.

**The Reserved Width Rule.** Any number that changes gets `tabular-nums` and a
reserved width. The filter readout holds `7ch` because "2.4 kHz" is the widest it
gets; the octave stepper holds `22px`; the pad's note line holds `15px` of height
whether or not a chord is sounding. Nothing in the interface may move because a
value did.

## Layout

One stage, one overlay and a rail. The stage takes all remaining width and
**never resizes**; the settings panel is a fixed **340px** parked against the
rail's inner edge and slid in over the camera with `translateX`; the rail is
**56px**, reserved as `padding-right` on the app shell rather than given to a
flex item, because both the rail and the panel are positioned rather than laid
out.

The panel overlays rather than squeezing for two reasons. Opening it costs one
compositor transform instead of 200ms of relaying the video, the canvas and the
HUD to a new width — on a surface whose render loop is driving audio, that
matters. And the stage holding still is why the view of your own hands does not
jump when the panel opens. The cost is that the panel covers the rightmost 340px
of the camera view; the tracker still reads the whole frame, so only the player's
view is occluded, never the tracking. The mobile bottom sheet has always worked
this way — desktop now matches it.

Because the panel covers the stage's right edge, the two controls pinned there
step aside for it: the HUD bar shifts **170px** and the Stop button **340px**,
both on transforms. Those distances are not chosen — they are exactly where a
shrinking stage used to put them, so the visible result is unchanged.

**340 is the number the panel is solved against.** A settings row leaves 282px of
usable width inside it, and every grid in the panel is fitted to that: the effects
rack is a six-column grid (`28px 44px 1fr 24px 44px 44px`) so that six rows align
column by column even though only three of them carry a lock and a rate; the
section tabs go three across rather than five, because five across 340px leaves
about twenty pixels for a name, which is not a name; the knob rows take a
`--knob-cols` custom property, four across in the envelope and fewer where the
dial shares a row.

Content indents rather than nests: a chord slot's second and third lines are
padded to **34px**, the width of the slot badge (24px) plus its gap (10px), so the
three lines of a slot line up without a container.

Spacing runs on a 4-based rhythm from 4 to 24, with 34px reserved for the start
card's inner padding and a 56/72/96 set for the landing prose's vertical breathing.

The start screen is one column of `min(560px, 100%)`, centred with `margin: auto`
inside a flex container rather than `place-items`, so a card taller than the
viewport scrolls instead of having its top clipped. The hero holds
`calc(100dvh - 48px)` — dvh, not vh, so mobile browser chrome cannot push the
scroll cue off the screen.

**Breakpoints** are three, each earning its own decision rather than sharing a
generic set:

- **860px** — the panel turns from a right-hand overlay into a bottom sheet
  (`translateY(100%)` rather than `translateX(100%)` when closed), the HUD and
  Stop stop stepping aside because nothing is taken from the right any more, and
  the rail relays as a horizontal row of 36px circles tucked under the Stop
  button.
- **700px** — the HUD sheds its section name, pad numerals and note line. The pads
  still carry the chord, and position in the row still carries the finger count.
- **520px** — the stat row folds from four columns to two and the hand columns
  stack, keeping the numbers big rather than shrinking them.

### Named Rules

**The 340 Rule.** The settings panel is 340px and every grid inside it is solved
against the 282px that leaves. A control that only fits by shrinking the panel's
type is the wrong control.

**The 24px Floor Rule.** No control is smaller than 24×24, the WCAG 2.2 minimum
target. The panel's steppers and the tempo lock were 22×15, 22×20 and 16×16 —
desktop-first sizes on a surface that becomes a touch-driven bottom sheet below
860px. Where a control must stay visually small, grow the target, not the ink.

**The Load-Bearing Width Rule.** Inside the panel, 10px is a feature. Styling a
scrollbar — `scrollbar-color`, `scrollbar-width`, or any `::-webkit-scrollbar`
rule — opts that container out of the macOS overlay scrollbar and makes it take
layout width. In `.settings-body` that costs the effect row's flexible name
column 60px → 51px, under what "Tremolo" needs. Theme a scrollbar only where the
container's width is not solved against.

## Elevation & Depth

There are no drop shadows in this system. Depth comes from two mechanisms, and
which one applies is decided by what the surface sits on.

**Over the video, surfaces are glass.** The HUD bar, the walkthrough card, the
Stop button and the rail tooltip are translucent (`rgba(18, 22, 32, 0.92)` or
darker) with an 8–10px `backdrop-filter` blur. The blur is legibility, not
decoration: it lets a bar of controls sit on a moving camera feed without hiding
the person in it.

**In the settings column, surfaces are opaque tone.** Console → recessed → raised
is a three-step graphite ladder, each step a few percent lighter than the last,
with a 10% white hairline doing the separating. No blur, no translucency, no
shadow.

The single `box-shadow` in the stylesheet is on a lit fader segment, and it is not
elevation — its blur radius and alpha are both driven by `--level`, the measured
audio, so the fader keeps glowing through the release and the reverb tail after
the chord has been dropped.

### Named Rules

**The Two Grounds Rule.** Anything floating over the camera is glass; anything in
the settings column is opaque tone. Never mix them — a blurred card inside the
panel or an opaque card over the video both break the model.

**The Only Shadow Rule.** The one `box-shadow` in the system is a meter, driven by
real audio. A shadow used to lift a surface is a defect.

## Shapes

Corner radius encodes what a thing is for.

**Circles and pills are for things you press without reading**: the rail buttons
(40px circles, 36px on mobile), the Stop button, the scroll cue, the rail
tooltips, and the walkthrough's progress dots are all `999px`; the knob dial and
the landing step numerals are true circles.

**Rectangles with an 8–10px radius are for things you read**: chord pads, section
tabs, selects, inputs, steppers (8px); chord slots, effect rows, figure frames and
hand groups (10px). Small badges and bare text buttons drop to 6px. Larger
containers scale up — the walkthrough at 14px, the HUD bar at 16px, the start card
at 18px.

The scale is 2 / 6 / 8 / 10 / 14 / 16 / 18 / pill / circle, and the 2px belongs to
exactly one element: a fader segment, which is 5px wide and would read as a
lozenge at any other value. Every other radius in the product is one of the
remaining steps. A value between two steps is drift, not a decision.

Borders are always the same hairline: `1px solid rgba(255, 255, 255, 0.1)`. There
are exactly three ways a border may change, all of them stateful: it brightens to
28% white on hover, it takes a hand colour or the accent when active, and it turns
dashed at 45% opacity to mean *off* (a disabled song section).

Line art is stroked, never filled: `stroke-width` 1.5 for rail icons, 2 for picker
glyphs and effect glyphs, 2.5 for the knob pointer, 3 for envelope segments,
filter curves and knob arcs, always with round caps and joins. Icons stroke
`currentColor`, so a rail button's hover and active colours reach its glyph
without a rule of its own.

### Named Rules

**The Round Means Reach Rule.** If it is a bare glyph you press without reading,
it is round. If it carries a word or a number you read, it is a rectangle.

**The Hairline-Only Rule.** Every border in the system is the same 10% white
hairline. Weight never varies; only colour and dash do, and only to signal state.

## Components

### Buttons

- **Shape:** a 10px rectangle for both the primary call to action and ghost
  buttons; pills for icon-only controls. Buttons used to sit at 11px and 9px
  respectively, a difference no eye could resolve and no rule could justify.
- **Primary:** Periwinkle ground, `--on-accent` text — the app's own near-black,
  not white — 600 at 15px, 13px of padding, full width. The only filled button in
  the product, and the dark foreground is what keeps it legible on a colour bright
  enough to double as text elsewhere.
- **Hover / Focus:** `filter: brightness(1.08)` — the fill is already the accent,
  so the hover brightens it rather than changing it. Disabled drops to 0.6 opacity
  with a default cursor.
- **Ghost / Reset:** transparent ground, Quiet Slate text, hairline border. Hover
  promotes the text to Screen White and the border to 28% white. This is the
  system's standard secondary treatment and it appears on the Reset button, the
  section remove control and the scroll cue.
- **Text-only:** the walkthrough's Skip is a bare muted label that promotes to
  Screen White on hover. No border, no ground.

### Chips

- **Section tabs:** Raised Graphite ground, hairline border, 12px text, an 8px
  radius, laid out three across. Selected takes the **right hand's amber** — that
  is the hand that switches sections — as both border and a 12% wash. A disabled
  section renders `dashed` at 45% opacity and centres its glyph.
- **Hand badges** (`.key`): a 34px-minimum inline grid used wherever a gesture is
  named. Neutral by default; `.left` and `.right` take their hand's colour at 40%
  border, 10% ground, full-strength text. This is the same component on the start
  card and in the in-app gesture reference, which is what makes the code portable
  between them.

### Cards / Containers

- **Corner Style:** 10px for panel cards, 16px for the HUD bar, 18px for the start
  card, 14px for the walkthrough.
- **Background:** Recessed Graphite in the column; Smoked Glass over the video.
- **Shadow Strategy:** none. See Elevation & Depth.
- **Border:** the hairline, always. The walkthrough is the one card that tints its
  border by state — cyan when it wants the left hand, amber when it wants the
  right, Periwinkle when the step is done.
- **Internal Padding:** 8px for panel cards, 10–18px for glass, 34px for the start
  card.

### Inputs / Fields

- **Style:** Raised Graphite ground, hairline border, 8px radius, 6px/8px padding,
  Screen White text, placeholder in Quiet Slate. Selects share the identical
  treatment so a dropdown and a text field are indistinguishable at rest.
- **Focus:** one rule covers the whole product. `:is(button, a, input, select,
  [tabindex]):focus` clears the browser ring, and the identically weighted
  `:focus-visible` immediately after it draws a 2px Periwinkle outline at 2px
  offset. Keyboard focus is always visible; a pointer press never leaves a ring
  behind. The single exception is a control already *filled* with the accent —
  the primary button and the walkthrough's Go — which rings in Screen White,
  because an accent ring around an accent fill reads as a halo rather than an
  edge (5.88:1 against the card in the offset gap, against white's 15.26:1).
- **Disabled:** 0.3 opacity and a default cursor on steppers; 0.45 on a whole
  checkbox row, via `:has(input:disabled)`.
- **Native controls** (`input[type=range]`, checkboxes) are left native and tinted
  with `accent-color: var(--accent)` rather than rebuilt.

### Navigation

- **Style:** a vertical rail of 40px circles on Console Graphite, one per settings
  group, each a bare 20px line glyph in Quiet Slate.
- **States:** hover promotes glyph to Screen White and border to 28% white. Active
  takes **Periwinkle**, not a hand colour — the rail is not about left or right.
- **Labels:** the glyph is unlabelled, so `aria-label` carries the spoken name and
  a pill-shaped tooltip carries the visible one, fading in on hover *and*
  `:focus-visible` so keyboard users get the same disclosure as mouse users.
- **Mobile:** below 860px the rail becomes a horizontal row of 36px circles with
  no ground of its own, and tooltips move below the button.

### Rotary Knob (signature)

The system's defining control, and the reason the panel reads as an instrument.

- A 270° sweep with the dead zone at the bottom — the hardware convention, and the
  one that leaves the pointer unambiguous at both extremes.
- 52px in the envelope grid, 44px where it shares a row with a name.
- Four layers: a Raised Graphite body, a 12%-white track, a fill arc in the
  control's own tone, and a 2.5px pointer in the same tone. The label takes the
  tone too; the value below stays Quiet Slate and tabular.
- **Hardware you can also type into.** Vertical drag (`ns-resize`, 160px of travel
  crosses the full range, `touch-action: none` so a drag never scrolls the panel),
  double-click to reset, and a complete keyboard contract — arrows step, page keys
  step ten, Home and End jump to the bounds — on a `role="slider"` with live
  `aria-valuetext`.

### Chord Pad (signature)

Five pads in a row, one per left-hand finger count. Neutral at rest; on strike it
takes Signal Cyan for text, border and a 12% wash. The transition is asymmetric on
purpose: **60ms in, 240ms out**, matching the note's own attack and release. It is
the one detail that makes the bar feel played rather than refreshed. Under
`prefers-reduced-motion` the transition is removed entirely and the pad snaps.

### Effect Row (signature)

One card per effect, stacked in running order, laid out on a six-column grid so
that rows align column by column even though only three effects carry a tempo lock
and a rate. Each row leads with a reorder stepper, then a glyph drawn from the
effect's own transfer function in that effect's step of the green ramp, then the
name — which spans into the lock and rate columns when the effect has neither.

### Browser surfaces

The parts the product does not draw still belong to it, and each is themed from
the palette rather than left at a default:

- **Selection:** Periwinkle at 35% with Screen White text — the accent, since a
  selection is the interface acting rather than a hand playing.
- **Caret:** Periwinkle, on every text field.
- **Scrollbars:** the start screen runs a thin bar with a transparent track and a
  pill thumb at `--border-hover`, inset by a 3px transparent border clipped to the
  padding box, promoting to Quiet Slate on hover. The settings body is the other
  scroll container and deliberately keeps the platform's own bar — see the
  Load-Bearing Width Rule in Layout.
- **Native control tint:** `accent-color` is declared once on `:root` and
  inherited, so range thumbs and checkboxes take Periwinkle without a rule each.

## Do's and Don'ts

### Do:

- **Do** bind every colour to a meaning before you use it. If you cannot say what
  a new colour *is* — which hand, which stage, which position in the chain — it
  does not belong in the palette.
- **Do** give any changing number `font-variant-numeric: tabular-nums` and a
  reserved width, so the layout cannot move because a value did.
- **Do** use the hairline (`1px solid rgba(255, 255, 255, 0.1)`) for every border,
  and change only its colour or dash to signal state.
- **Do** let the global `:focus` / `:focus-visible` pair cover new controls rather
  than writing a focus rule per component; add a control to the selector list only
  if it is focusable by something other than a tag or `tabindex`.
- **Do** theme any browser surface a new feature exposes — selection, caret,
  scrollbar, native control tint — from the palette, the first time it appears.
- **Do** match glass to video and opaque tone to the column — the Two Grounds Rule.
- **Do** draw new glyphs in-repo, stroked in `currentColor`, with round caps and
  joins, at the weight its size calls for (1.5 at 20px, 2 at picker size, 3 for
  figure curves).
- **Do** solve any new panel layout against 282px of usable row width.

### Don't:

- **Don't** use colour decoratively. Grey is the resting state of everything; a
  colour on screen means that thing is live, selected, or running. Colour is never
  spent on hierarchy or emphasis.
- **Don't** introduce an icon package, an icon font, or an imported SVG set. Every
  glyph in this product is drawn from the same maths the audio runs on —
  `waveformPath`, `effectGlyphPaths`, `filterShape`, `adsrShape` — which is why the
  picture and the sound can never disagree.
- **Don't** invent a second type scale. Six sizes carry the card (32/28/15/14/12/11)
  and the app chrome adds 20, 13 and 10 deliberately. A size that lands between two
  existing ones is a mistake, not a nuance.
- **Don't** animate anything that is not encoding audio. The pad's 60ms/240ms
  asymmetry and the fader's level-driven glow are the sound made visible; under
  `prefers-reduced-motion` values must snap, never merely slow down.
- **Don't** add a drop shadow. Depth is tone and glass; the only `box-shadow` in
  the system is a meter.
- **Don't** give a hand colour to something that is not that hand, and don't give a
  hand colour to the app's own chrome — that is Periwinkle's job.
- **Don't** put a thick coloured edge on one side of a card to signal what it
  belongs to. The system already has an idiom for that — a tinted border with a
  wash of the same colour — and it is used at 8% for a legend, 10–12% for a live
  state.
- **Don't** put Screen White or any near-white on a filled accent surface. It
  fails AA. Filled accent takes `--on-accent`.
- **Don't** style the scrollbar of a container whose width something is solved
  against. It stops being an overlay bar and starts taking 10px.
- **Don't** load a web font or ship a raster UI asset. The interface is system
  sans, line art and colour, and its ability to render instantly from prerendered
  markup depends on staying that way.
