---
name: DJ Hands
description: A 1980s studio console you play with your hands in front of a camera.
colors:
  void: "#1a1812"
  well: "#2b2820"
  panel: "#423e33"
  face: "#524d40"
  face-hi: "#5e5949"
  legend: "#f3f1e6"
  legend-dim: "#c6c2ae"
  strip: "#d8d3bc"
  on-ink: "#1a1812"
  left: "#8ecbf2"
  right: "#f0b45c"
  lamp: "#a6dc84"
  alert: "#f5948a"
  env-1: "#dcf0ff"
  env-2: "#b6dcf7"
  env-3: "#8ecbf2"
  env-4: "#5b9cc6"
  cutoff-min: "#c98a3c"
  cutoff-max: "#f9d7a4"
  bevel: "rgba(255, 255, 255, 0.07)"
  shade: "rgba(0, 0, 0, 0.38)"
  groove: "rgba(0, 0, 0, 0.45)"
  well-depth: "rgba(0, 0, 0, 0.5)"
  screw-depth: "rgba(0, 0, 0, 0.55)"
  seat-depth: "rgba(0, 0, 0, 0.7)"
  drop: "rgba(0, 0, 0, 0.4)"
  rule: "rgba(255, 255, 255, 0.1)"
  rule-hi: "rgba(255, 255, 255, 0.26)"
  chain-1: "#5b5648"
  chain-2: "#524e41"
  chain-3: "#4a4639"
  chain-4: "#423e33"
  chain-5: "#3a3730"
  chain-6: "#322f28"
typography:
  display:
    fontFamily: "Archivo, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "clamp(40px, 10vw, 62px)"
    fontWeight: 700
    lineHeight: 0.9
    letterSpacing: "-0.03em"
    fontVariation: "font-stretch: 122%"
  headline:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "32px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.03em"
    fontVariation: "font-stretch: 108%"
  title:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.02em"
    fontVariation: "font-stretch: 108%"
  body:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
    fontFeature: "tabular-nums"
  body-small:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  body-prose:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  detail:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "normal"
  readout:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "normal"
    fontFeature: "tabular-nums"
  legend:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "10.5px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.14em"
    fontVariation: "font-stretch: 112%; text-transform: uppercase"
  legend-small:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "9.5px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.12em"
    fontVariation: "font-stretch: 112%; text-transform: uppercase"
  legend-condensed:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "10.5px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.05em"
    fontVariation: "font-stretch: 84%; text-transform: uppercase"
rounded:
  hairline: "1px"
  panel: "2px"
  unit: "3px"
  screw: "50%"
spacing:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "14px"
  2xl: "18px"
  3xl: "24px"
components:
  button-lamp:
    backgroundColor: "{colors.lamp}"
    textColor: "{colors.on-ink}"
    typography: "{typography.legend}"
    rounded: "{rounded.panel}"
    padding: "14px"
    width: "100%"
  button-panel:
    backgroundColor: "{colors.face}"
    textColor: "{colors.legend}"
    typography: "{typography.legend}"
    rounded: "{rounded.panel}"
    padding: "7px 14px"
  button-panel-hover:
    backgroundColor: "{colors.face-hi}"
  rail-button:
    backgroundColor: "{colors.face}"
    textColor: "{colors.legend-dim}"
    rounded: "{rounded.panel}"
    size: "40px"
  rail-button-active:
    textColor: "{colors.lamp}"
  channel-pad:
    backgroundColor: "{colors.well}"
    textColor: "{colors.legend-dim}"
    rounded: "{rounded.panel}"
    padding: "4px 6px 5px"
  channel-pad-on:
    textColor: "{colors.left}"
  select-panel:
    backgroundColor: "{colors.face}"
    textColor: "{colors.legend}"
    rounded: "{rounded.panel}"
    padding: "6px 22px 6px 8px"
  input-strip:
    backgroundColor: "{colors.strip}"
    textColor: "{colors.void}"
    rounded: "{rounded.hairline}"
    padding: "5px 8px"
  key-cap:
    backgroundColor: "{colors.face}"
    textColor: "{colors.legend}"
    rounded: "{rounded.panel}"
    padding: "0 6px"
    height: "24px"
  card-unit:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.legend}"
    rounded: "{rounded.unit}"
    padding: "30px 32px 28px"
  well-unit:
    backgroundColor: "{colors.well}"
    textColor: "{colors.legend-dim}"
    rounded: "{rounded.panel}"
    padding: "8px"
---

# Design System: DJ Hands

## Overview

**Creative North Star: "The Rack-Mounted Console"**

This is not a dark-mode web app. It is a 1980s studio console and synth front panel, photographed square on under a desk lamp: warm-grey painted metal, silkscreened small-caps legends, bevelled control faces, engraved grooves, countersunk screws, and a scribble-strip tape where the player writes a name themselves. Nothing floats. Every surface is either bolted into the panel or cut out of it, and the only true near-black in the system is what lives *behind* the monitor glass.

The density is instrument density: controls sit close, legends are smaller than the things they name, and values are pinned into reserved columns so nothing on the panel moves because a number changed. Colour is not decoration — it is a function code. The build spends exactly four inks, each legislated to one meaning, and pays for everything else in panel shade, bevel and engraved hairline. Where a lesser system would reach for a fifth hue (envelope stages, effects-chain position), this one reaches for lightness steps of an ink it already owns, or for the shade of the row's own metal.

Motion is one authored moment, not an idiom: the panel settles on power-on with the lamp lighting last, and the rack slides over the monitor rather than squeezing it. Both have reduced-motion paths that leave the machine readable and the lamp lit.

**Key Characteristics:**
- Warm-grey painted metal in five steps; nothing near-black except behind the glass
- A closed four-ink list, one meaning per ink, no fifth ink
- Depth entirely by inset bevel — raised faces and recessed wells, no drop shadows on controls
- One variable typeface working its real width axis instead of a second family
- Silkscreen legends: uppercase, letterspaced, widened, small
- 2-3px corners throughout; no pills, no soft cards
- Tabular numerals in reserved widths — the panel never reflows on a value

## Colors

A warm painted-grey machine carrying four coloured lamps, each of which means exactly one thing.

### Primary
- **Left-Hand Console Blue** (`--left`): the left hand and nothing else — the canvas overlay's skeleton (hue 203), the channel strips when a chord commits, the Chords and Sound band, the left legend plate and key cap.
- **Right-Hand Panel Amber** (`--right`): the right hand and nothing else — the overlay's right skeleton (hue 34), the filter arc, the LED ladder, the section tabs, every effect dial, the Filter/Effects/Volume band.

### Secondary
- **Ready Lamp Green** (`--lamp`): the app's own ready/active state only — the start button, the rail's active unit, the tempo dial (the machine's clock, not a link in the chain), the app-owned band, focus rings, caret and selection.

### Tertiary
- **Fault Coral** (`--alert`): errors only, on a 15% wash with a 45% border. It appears nowhere else.

### Neutral
- **Behind-The-Glass Black** (`--void`): the camera well, screw holes, panel-figure grounds, and the border under a lit ink.
- **Engraved Well** (`--well`): recessed carriers — chord slots, channel strips, slot badges, rail tips, stepper bodies — and the bay the start unit is mounted in, which is the page ground behind the frame rails.
- **Painted Panel** (`--panel`): the machine's ground at `#423e33`, and the browser theme colour declared in `index.html` and `site.webmanifest`.
- **Control Face** / **Face Highlight** (`--face`, `--face-hi`): raised, pressable faces and their hover state.
- **Silkscreen White** / **Silkscreen Dim** (`--legend`, `--legend-dim`): the only two inks legends are printed in. `--legend-dim` on `--panel` measures 5.96:1.
- **Scribble-Strip Tape** (`--strip`): the one light surface in the machine.

### Depth alphas

Depth is spent in alpha on the panel rather than in more colours. These six are the whole vocabulary, and every bevel, groove and drop in the system is built from them.

- **Bevel** `rgba(255, 255, 255, 0.07)` (`--bevel`): light caught on the top edge of a raised face.
- **Shade** `rgba(0, 0, 0, 0.38)` (`--shade`): the same face casting into its own bottom edge.
- **Groove** `rgba(0, 0, 0, 0.45)` (`--track`): the unlit track behind any fill — knob ring, HUD arc, LED ladder. Cut darker than its panel, never lighter.
- **Hairline** `rgba(255, 255, 255, 0.1)` (`--rule`) and **Lit hairline** `rgba(255, 255, 255, 0.26)` (`--rule-hi`): the engraved separator, and what it becomes on hover or under a leader.
- **Well depth** `rgba(0, 0, 0, 0.5)` and **screw depth** `rgba(0, 0, 0, 0.55)`: the inner shadow of a recess and of a countersunk screw.
- **Drop** `rgba(0, 0, 0, 0.35–0.45)`: reserved for one object genuinely in front of another — the rack over the monitor, the bridge over the feed, a tip over the rack. Never for lifting a control.

### Named Rules
**The Closed Ink List Rule.** There are four inks — left hand, right hand, lamp, alert — and each means one thing. A new state does not get a new hue; it gets a lightness step of the ink that already owns it (`--env-1..4` are the left hand's blue) or a panel shade (`--chain-shade`, six steps front-to-back through the effects chain). There is no fifth ink.

**The Ownership Band Rule.** Every settings group wears a 2px band in the ink of whoever owns it: `.band-left` for Chords and Sound, `.band-right` for Filter, Effects and Volume, `.band-app` for Tracking, How to play and About. A group with no owner does not exist.

**The Legend-Is-Not-Live Rule.** A 16% ink wash labels a thing as belonging to a hand; a 28% wash says that hand is playing *now*. A legend plate never wears the live value.

**The Engraved Figure Rule.** Numbers stay silkscreen white. Inks mean a hand or a state, so a readout never takes one.

**The Named-By-You Rule.** The pale tape (`--strip`) appears only where the player has named something themselves. It is never used for a label the app wrote.

## Typography

**Display Font:** Archivo Variable (with ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif)
**Body Font:** Archivo Variable — the same face
**Label/Mono Font:** none; legends are Archivo widened, and numerals are `tabular-nums` on the body

**Character:** One self-hosted variable neo-grotesque (`public/fonts/archivo-latin.woff2`, latin subset, `wght` 400-700, `wdth` 62-125), preloaded, with a real fallback stack because the start card is prerendered. Hierarchy comes from scale, case, weight and the width axis — the discipline a machine's silkscreen actually has, where every legend on the box came off the same drum.

### Hierarchy

Nine steps and a display clamp carry the entire product. Anything landing between two of them is a mistake, not a nuance.

- **Display** (700, clamp 40px-62px, 0.9, -0.03em, width 122%, uppercase): the panel head, silkscreened across the top plate. The plate is flush with the unit's inner face — its side margins equal the card's own padding — so nothing crosses the chassis edge. The clamp floors at 40px, so the phone needs no override.
- **Figure** (700, 32px, 1.0, -0.03em, width 108%, tabular): the stat figures, right-aligned in their reserved channel column. One size at every width — the column widens on a phone rather than the figure shrinking.
- **Title** (700, 20px, 1.25, -0.02em, width 108%): landing section headings, and the word that stands where a figure would.
- **Base** (400, 15px, 1.5, tabular): the running app's document size.
- **Body** (400, 14px, 1.6): prose, gesture rows, the walkthrough prompt. The landing runs it at a 68ch measure.
- **UI** (400, 13px): rack rows, selects, section names, the scribble strip.
- **Detail** (400, 12px, 1.45): hints, sub-lines, fine print, readouts beside a control.
- **Readout** (400, 11px, tabular): any live value — knob values, octaves, tab numbers, frame rate, the filter's hertz.
- **Legend** (600, 10.5px, 0.14em, width 112%, uppercase): the silkscreen. Group headings, hand names, rail tips, stat entries, panel buttons, and effect names at width 84%.
- **Sub-legend** (600, 9.5px, 0.12em, width 112%, uppercase): a legend inside a control — knob labels, strip numerals, filter kind, coach state.

### Named Rules
**The One Drum Rule.** One family, no second face. If a label needs to feel different, change size, case, weight or `font-stretch` — never the family.

**The Condense-Before-You-Grow Rule.** When a legend does not fit a load-bearing column, the legend condenses. The effect-name column is solved against the 282px the 340px rack leaves, so "TREMOLO" is set at `font-stretch: 84%` rather than the column growing.

**The Reserved Width Rule.** Live values are tabular numerals in a reserved width — the filter readout holds 7ch for "2.4 kHz", the pad foot holds 15px whether or not a chord plays. Nothing in the interface moves because a value did.

## Layout

The running app is a full-height flex row: the camera stage takes the remaining width inside a 10px margin, and 56px of right padding is *reserved* for the rack rail rather than given to a flex item, because both the rail and the rack that parks under it are positioned.

The settings rack is a fixed 340px overlay pinned at `right: 56px`. It overlays the monitor rather than squeezing it, so opening it animates a single transform instead of relaying the video, canvas and HUD every frame — and the view of your own hands does not jump. Every grid inside it is solved against the 282px that 340px leaves: effect rows are `28px 44px 1fr 24px 44px 44px`, section tabs go three across, chord-slot lines indent to 34px (the 24px badge plus its 10px gap).

The start screen is a single 620px column between two fixed 40px rack rails, with the panel filling `100dvh - 40px` and the landing prose starting below the fold on a 30px ruled spine.

Spacing rhythm runs on even 2px steps clustered at 4/6/8/10/12/14/18, with 24px as the target and badge module.

`viewport-fit=cover` puts the page under the notch and the home indicator, so every edge the console reaches is written as `env(safe-area-inset-*)` added to the gutter that is already there — the rail's right edge, the stage's left, the meter bridge's floor, the dock's, and the start screen's box and its two fixed frame rails. The inset is added to the reserved strip rather than the layout being pulled in from the glass, so the panel still bleeds to the edge behind the cutout.

Breakpoints, all authored against a specific failure:
- **1000px** — frame rails narrow to 24px (bounded at `min-width: 521px` so the phone block still wins).
- **860px** — the rack becomes a bottom sheet at 60% max-height; the rail relays as a dock bolted along the bottom of the console, eight units sharing the width at 34px tall, and the sheet rests on the dock rather than on the screen edge; the stage loses its bezel.
- **700px** — the HUD sheds its section legend and note line; the strips still carry the chord.
- **700px, portrait only** — the HUD becomes two rows: the five channel strips take the whole first line, the section legend and the right hand's dial and ladder take the second, and the slot numerals and note line come back. Gated on orientation because a phone on its side is short rather than narrow, and there the second row costs height it does not have.
- **861px and under 560px tall** — a phone held sideways: the vertical rail tightens to 34px units so its eight buttons still fit the height.
- **620px** — frame rails narrow again to 14px; the chassis still reads as the same object.
- **520px** — phone: the hero drops below the Buy Me a Coffee widget, hand plates and landing cells go one-up, stat columns narrow.

### Named Rules
**The 24px Target Floor.** No interactive box is smaller than 24px square — steppers, effect locks, checkboxes and slot badges all sit exactly on it.

**The Load-Bearing Width Rule.** The settings body keeps the platform scrollbar. Styling one at all opts out of the macOS overlay bar, and the 10px it takes comes straight out of the 340px rack, cutting the effect name column below what "Tremolo" needs. Only the start screen, where the column is wide, gets a styled 10px bar.

**The Overlay-Never-Squeeze Rule.** Panels slide over the stage; they never resize it.

## Elevation & Depth

Depth is a **bevel system**, not a drop-shadow system. `--raise` and `--recess` are both *inset*: a raised face catches light on its top edge and casts into its own bottom edge, and a recessed well does the reverse. Nothing in this interface floats. The few outer shadows that exist are seating shadows for a piece genuinely lifted off the panel — the rack, the bottom sheet, the HUD bar, the rail tip — and they are always soft, always dark, never offset diagonally. The start unit is deliberately **not** among them: it is bolted between the rails rather than floating in front of them, and its face reads against the darker bay on tone alone.

### Shadow Vocabulary
- **Raise** (`inset 0 1px 0 var(--bevel), inset 0 -1px 0 var(--shade)`): every pressable face — panel buttons, rail buttons, selects, slider thumbs, key caps, effect rows, the head plate.
- **Recess** (`inset 0 1px 3px rgba(0,0,0,0.5), inset 0 -1px 0 var(--bevel)`): everything cut into the panel — the camera well, channel strips, slot badges, chord slots, tracks, panel figures, and the pressed/active state of a raised face.
- **Seating** (`-8px 0 24px rgba(0,0,0,0.35)` on the rack, `0 -8px 24px rgba(0,0,0,0.4)` under the bottom sheet, `0 2px 10px rgba(0,0,0,0.4)` under the HUD bar): straight-down ambient only, and only for a piece that is over another piece.
- **Lamp glow** (`0 0 22px rgba(166,220,132,0.34)`): the start button lit, and the LED ladder's audio-reactive burn. On the button it is carried by `.primary::after` so the power-on animates `opacity` alone; painting a box-shadow every frame is the one non-composited animation this interface is not allowed.

### Named Rules
**The Inset-Only Rule.** Control depth is inset. A control that reads as raised uses `--raise`; pressing it swaps to `--recess`. Outer shadow is reserved for a piece that is physically over another piece, and is straight down.

**The Groove Rule.** An unlit track is a groove *cut into* the panel — darker than its panel, never lighter. Every meter, arc, ladder and slider track uses `--track` (black at 45%).

**The Brushed-Metal Rule.** `--brushed` (a 100° striation gradient) goes over the flat paint only on the pieces that would really be rolled metal: the head plate, the meter bridge, Stop, the frame rails, the landing bays' ears and the mobile rail. Never on a well, never on a whole page.

## Shapes

Corners are effectively square: 2px on everything you press or that is cut into the panel, 3px on the larger chassis pieces (the stage, the start card, the HUD bar, the coach), 1px on the tape input and inner LED segments, and 50% only for the screw holes and knob caps. There are no pills and no soft cards.

Form comes from edges instead: a 1px `--rule` hairline (or `--void` where a piece is bolted down), a 2px coloured band along one edge to code ownership, and engraved leader lines that run from a label across its row. Panel figures — the ADSR envelope, the filter sweep — all live in the same recessed cutout so every drawing in the rack is the same window. Screw-hole rhythm (radial gradients at a 96px/80px/72px repeat) is what makes a rail read as a 19-inch rail.

## Components

### Buttons
- **Shape:** square-cut (2px), 1px hairline border, raised bevel.
- **Lamp (primary):** the illuminated button on the panel's bottom rail — full-width, lamp green ground, panel-black text (`--on-ink`, never silkscreen white on a lit ink), 14px padding, 12px/0.16em widened caps. It is the only lit surface on the start screen. Focus ring flips to `--void` (9.49:1) because a green ring on a green button is invisible.
- **Panel button (Stop, tabs, scroll cue, reset):** `--face` under a brushed striation where the piece is metal, silkscreen caps at 10.5px/0.14em. Hover lifts to `--face-hi` and brightens the border to `--rule-hi`; active swaps `--raise` for `--recess` so the face presses in.
- **Ghost:** the reset and skip buttons are transparent with a dim legend; hover fills to `--face`.
- **Disabled:** 0.3 opacity, shadow removed, cursor default.

### Cards / Containers
- **Rack unit (`.start-card`, `.landing-cell`):** panel ground against the darker bay, 3px/2px corner, `--void` border, `--raise` only — no drop. The start unit's head plate is flush inside that border with two inboard screws; `.landing-cell` keeps its left mounting ear.
- **Well unit (`.chord-slot`, `.hand-group`, `.coach-stuck`):** `--well` ground, recessed, hairline border, 8-12px internal padding.
- **Legend plate:** a well unit with a 2px top border in its owning hand's ink and a 16% wash of that ink.

### Inputs / Fields
- **Select:** a rotary cutout — raised `--face`, 2px corner, native arrow replaced by a drawn chevron so the control belongs to the machine and not the platform.
- **Range:** a fader in a cut groove — 5px `--track` runnable track with `--recess`, a 12x20px moulded thumb on a `--face-hi`→`--face` gradient with a `--void` edge; the row reserves 24px of height.
- **Text (scribble strip):** the one light field — `--strip` tape, `--void` text, 1px corner, recessed, semi-condensed 13px. Placeholder at 45% black.
- **Checkbox / lock:** 24px square, recessed `--well`, checked fills with the right hand's ink and carries a drawn 10px bar rather than the platform tick.
- **Focus:** one treatment everywhere — `:focus` clears the browser ring so a pointer press leaves nothing behind, `:focus-visible` puts back a 2px lamp-green outline at 2px offset.
- **Error:** coral text on a 15% wash with a 45% border, 2px corner.

### Navigation
The **rack rail** is a 56px vertical strip down the right edge with the screw holes a 19-inch rail actually has at top and bottom. Units are 40px raised faces carrying a drawn 20px line glyph in `currentColor`; the active unit takes the machine's own lamp green (never a hand's ink, because the rail is not about left or right) and inverts to recessed. Labels live in a hover/focus tip in condensed caps, suppressed while the rack is open because the open group's heading already names it. Below 860px the rail lays on its side as a row of 32px buttons with the tip flipping underneath.

### Signature Components
**The meter bridge (HUD).** A brushed panel bar along the bottom rail of the monitor: five channel strips for the chord slots, an engraved-rule-separated section legend, then the filter arc and the LED ladder. A hand that is merely visible dims its half to 0.45 — being seen must never be louder than playing. Strips release over 0.24s and catch in 0.06s, so the bridge feels played rather than refreshed.

**The effects rack.** Six units stacked in signal order, chain position carried by the row's own panel shade (`--chain-shade`, `#5b5648` at the front through `#322f28` at the back) so reordering the chain reorders the shading and nothing spends an ink on it. Untimed effects give their lock and rate cells back to the name.

**Panel dials.** A 270° sweep with the dead zone at the bottom, drawn once and used at 52px in the rack, 44px in an effect row and 40px on the bridge. The knob body is `--face` on a `--void` edge; the track is the groove; the fill and pointer take the ink of whoever owns the parameter — envelope stages in four steps of the left hand's blue, filter ends in the two cutoff ambers, effects in the right hand's amber, tempo alone in lamp green.

**Power-on.** The start panel settles block by block (0.55s exponential ease-out, 50ms stagger) from an already-visible default, and the lamp lights last at 0.3s. Under `prefers-reduced-motion` the animation does not run and the lamp is simply lit — it is a state, not an entrance.

## Do's and Don'ts

### Do:
- **Do** spend colour only as a function code: `--left` for the left hand, `--right` for the right, `--lamp` for the app's own ready/active state, `--alert` for errors.
- **Do** express a new gradation as lightness steps of an ink you already own (the four envelope stages) or as panel shade (the six chain steps).
- **Do** build depth with `--raise` and `--recess`, and press a control by swapping raise for recess.
- **Do** cut tracks darker than their panel with `--track`.
- **Do** set every label as silkscreen: uppercase, 0.12-0.16em, `font-stretch: 112%`, 9.5-10.5px, never larger than the thing it names.
- **Do** reserve widths for live values and use tabular numerals.
- **Do** hold every interactive box at 24px or larger.
- **Do** give each settings group an ownership band in its owner's ink.
- **Do** overlay panels on the stage and animate transform only.
- **Do** ship a reduced-motion path that leaves states (a lit lamp) legible.

### Don't:
- **Don't** introduce a fifth ink, or use any of the four decoratively.
- **Don't** put a coloured ink on a numeric readout; figures stay silkscreen white.
- **Don't** use silkscreen white text on a lit ink — a filled lamp takes `--on-ink` panel black.
- **Don't** use `--strip` tape for anything the app named; it is only for what the player named.
- **Don't** round past 3px, and never build a pill.
- **Don't** add a second typeface; change scale, case, weight or `font-stretch` instead.
- **Don't** widen a load-bearing column to fit a legend — condense the legend.
- **Don't** style a scrollbar inside the 340px rack.
- **Don't** put a `backdrop-filter` over the camera feed; that frame budget belongs to the synth.
- **Don't** resize the stage to reveal a panel.
