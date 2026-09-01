# DJ Hands — Documentation

Play chords in the air. Your webcam is the instrument.

DJ Hands is a client-only React app: a webcam feed goes into a MediaPipe hand
tracker, finger counts come out, and those drive a Tone.js synth. Nothing is
uploaded — vision and audio both run in the browser tab.

Live at **[www.dj-hands.com](https://www.dj-hands.com)**.

## Contents

| Document | What is in it |
| --- | --- |
| [Getting started](getting-started.md) | Install, run, build, test, browser requirements |
| [User guide](user-guide.md) | Gestures, the walkthrough, the sound, chords, HUD, settings panel |
| [Architecture](architecture.md) | Module map, data flow, the render loop, design decisions |
| [Audio](audio.md) | Chord theory model, the Tone graph, voice handling, the filter |
| [Vision](vision.md) | Landmark model, rotation-invariant finger counting, debouncing, overlay |
| [Configuration](configuration.md) | Settings schema, persistence, environment variables |
| [Deployment](deployment.md) | GitHub Pages pipeline, custom domain, analytics, SEO assets |
| [Troubleshooting](troubleshooting.md) | Camera, WebGL, reversed hands, silent audio, a stalled walkthrough, static servers |
| [Contributing](contributing.md) | Test strategy, linting, code conventions |

## The 30-second version

```
webcam ──▶ HandLandmarker ──▶ fingerCount  ──▶ SynthEngine ──▶ 🔊
           (21 landmarks)     handRotation      PolySynth
                │                 (per hand)    → Filter
                └──▶ drawOverlay (canvas)       → Effects rack ×6
                                                → Volume
```

- **Left hand, 1–5 fingers** → chord slot 1–5, sustained while held. Fist → silence.
- **Right hand height** → volume.
- **Right hand rotation** → filter cutoff.
- **Right hand, 1–5 fingers** → song section 1–5, each its own bank of five chords.

A rack of six effects — bitcrusher, chorus, tremolo, phaser, delay and reverb,
each with its own amount and in an order you set — sits behind all of it, set in
the panel rather than played. Tremolo, phaser and delay carry a rate as well,
free in milliseconds or locked to the rack's tempo.

Everything is configurable from the settings panel and persists to
`localStorage`. See the [user guide](user-guide.md) to play, and
[architecture](architecture.md) to understand the code.
