# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two audiences, ordered — neither is secondary.

**Primary: the curious first-timer.** Arrives from a link or a search, on a
desktop or laptop with a webcam, with no music gear and possibly no theory. Their
job is to make a sound they like within seconds of allowing the camera. The first
thirty seconds belong to them: the start screen, the camera/audio unlock click,
and the first-run walkthrough that teaches the gestures by playing rather than by
reading.

**Second: the hobbyist musician or producer.** Stays past that first minute and
judges DJ Hands as an instrument — whether the chord slots, inversions, slash
bass, editable ADSR, swept filter and effects rack are worth configuring and
playing through. Everything past the walkthrough is designed for them.

## Product Purpose

DJ Hands turns a webcam into a playable chord instrument. The left hand picks the
chord, the right hand shapes it; hand tracking and sound both run in the browser
on the player's own machine.

Success is all four of these together, and no single one substitutes for the
others:

- the visitor actually plays — gets past the start screen, finishes the
  walkthrough, and holds chords for a real stretch;
- they come back — return visits, and configured setups that persisted;
- it gets shared — search traffic, links, people sending it to each other;
- it earns support — Buy Me a Coffee conversions are a real goal, not a footnote.

## Positioning

A two-handed gesture instrument where each hand has a distinct, simultaneous
role: left-hand finger count selects one of five chord slots and sustains it;
right-hand height sets volume, palm rotation sweeps the filter cutoff, and finger
count switches song section — all live, at once, from one camera.

What a neighboring webcam-synth could not truthfully copy:

- 480 chords — 12 roots across 40 qualities — with inversions and slash bass,
  editable per slot;
- five named song sections of five slots each, switched mid-performance by
  gesture;
- a rotation-invariant finger counter, so counting survives a tilted hand;
- a six-effect rack that is reorderable, with rates free or locked to a tempo;
- fully client-side operation: no backend exists, no video leaves the device, no
  account, and it runs offline after first load.

Openly an independent take on **gesture-synth**, credited in the README as the
inspiration for turning a webcam into an instrument. It is not a fork and shares
no code.

## Operating Context

- Built for a desktop or laptop webcam in current Chrome, Safari or Firefox.
  Requires WebGL, camera access and a secure origin. It runs on a phone or tablet
  in landscape, but a small frame makes four-versus-five fingers unreliable.
- Detection quality is dominated by the room, not the code: light in front of the
  player rather than behind, whole hand in frame, fingers spread, no other app
  holding the camera.
- Some cameras and virtual-camera drivers hand the browser an already-mirrored
  frame, which reverses handedness — **Swap hands** under Tracking corrects it.
- Both audio and camera require an explicit click to unlock, so the start screen
  press can never be designed away.
- Every setting persists to `localStorage`; there is nothing server-side to sync.
- A single client-rendered page. The start screen and landing prose are
  prerendered to static markup at build time so search engines have something to
  index.
- Deployed to https://www.dj-hands.com from GitHub Pages; a push to `main`
  publishes.

## Capabilities and Constraints

**Capabilities:** gesture-played chord slots with sustain and a release grace
period; five toggleable song sections; four waveforms with a hand-drawn ADSR
envelope; lowpass, highpass and bandpass filters swept by rotation; a
bitcrusher / chorus / tremolo / phaser / delay / reverb rack that is reorderable
and tempo-lockable; a live HUD with chord pads, filter arc, fader and meter; an
icon-rail settings panel opening one group at a time; a first-run walkthrough
that is skippable for good and replayable on demand.

**Durable constraints future work must preserve:**

- No backend, no uploads, no accounts, no server code — the privacy claim is
  structural, and adding a server would break the product, not just a promise.
- Free with no ads and no paid tier. Support is invited, never gated.
- The instrument's response outranks the interface: the render loop drives the
  synth imperatively, and rendering must never gate audio or drop held notes.
- The start-screen tree must stay renderable in Node for the prerender step, so
  nothing under it may touch browser or audio globals at module scope.
- Apache 2.0, with the license and attribution notices intact.

## Brand Commitments

- Name: **DJ Hands**. Author and sole maintainer: **Yusif Aliyev**.
- The hand colour code is shared vocabulary, not decoration: **cyan for the left
  hand, orange for the right**, used identically by the canvas overlay and the
  start-screen gesture summary so the code is already learned before the player
  sees their own hands.
- Voice: plain, concrete, second person, no hype. Claims stay literal ("no video
  ever leaves your device"), and the FAQ answers a question the way someone would
  actually type it.
- The interface is dark-only today (`color-scheme: dark`, theme colour `#0b0e14`,
  a single `styles.css`). Recorded as current fact — not confirmed as a binding
  identity constraint.
- The Buy Me a Coffee widget (`dj.hands`) sits in the top-left of the app and is
  part of the shipped surface.

## Evidence on Hand

**Real, and usable:**

- A live deployment at https://www.dj-hands.com with a release history.
- GA4 instrumentation (`VITE_GA_ID`, production builds only) carrying
  feature-usage events and a per-session play summary emitted on Stop.
- A complete documentation set in [docs/](docs/) — user guide, architecture,
  audio, vision, configuration, deployment, troubleshooting, contributing — plus
  [AGENTS.md](AGENTS.md).
- Landing prose and a FAQ in [src/components/faq.ts](src/components/faq.ts),
  which is the single source for both the rendered section and the `FAQPage`
  JSON-LD.
- Social/OG image at `public/og.png`, icon set, manifest, sitemap and
  `WebApplication` structured data.
- Credits: [Joe in the Studio](https://www.joeinthestudio.com), the author's
  music project, and the gesture-synth inspiration.

**Absent — future work must not fabricate these:** no testimonials, no named
users or customers, no user or play counts, no press coverage, no case studies,
no ratings or awards, no benchmarks, and no pricing (the product is free with no
paid tier).

## Product Principles

1. **Playable before readable.** The walkthrough is finished by playing, not by
   reading; instructions are a fallback, never the front door.
2. **Depth is opt-in and never in the way.** Every slot ships already sounding
   good, so theory is available to the musician and invisible to everyone else.
3. **Privacy is structural.** There is no server to send video to, and no future
   feature may make that sentence untrue.
4. **The instrument's response comes first.** Nothing in the interface may cost
   the sound its timing.
5. **Free, unconditionally.** No ads, no accounts, no gated features; support is
   asked for once and never enforced.

## Accessibility & Inclusion

**Undecided — no standard has been adopted.** Recorded so future work neither
invents a conformance claim nor assumes the question was settled.

Factual constraints as the product stands: playing requires two hands in frame, a
working webcam, and sight of the screen; the interface is dark-only. Whether
one-handed play, an alternate input, or a stated WCAG level becomes a goal is an
open product decision.
