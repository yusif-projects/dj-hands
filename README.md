<div align="center">

# 🎹 DJ Hands

**Play chords in the air. Your webcam is the instrument.**

[**▶ Try it live — dj-hands.com**](https://www.dj-hands.com)

[![Deploy](https://github.com/yusif-projects/gesture-music/actions/workflows/deploy.yml/badge.svg)](https://github.com/yusif-projects/gesture-music/actions/workflows/deploy.yml)
![React 19](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178c6?logo=typescript&logoColor=white)
![Tone.js](https://img.shields.io/badge/Audio-Tone.js-f24b6a)
![MediaPipe](https://img.shields.io/badge/Vision-MediaPipe-0097a7)

</div>

---

Hold up both hands and play. The webcam tracks 21 landmarks per hand: your **left
hand picks the chord**, your **right hand picks the sound**, and **how high you
hold it sets the volume**. Everything — vision and audio — runs in the browser.
No video ever leaves your device.

## Controls

| Gesture | Effect |
| --- | --- |
| ✋ Left hand, 1–5 fingers | Plays chord slot 1–5, sustained while you hold it |
| ✊ Left hand, fist | Silence |
| 🤚 Right hand, 1–5 fingers | Selects synth preset 1–5 |
| ↕️ Right hand height | Volume — higher is louder |

### Presets

| # | Preset | Character |
| --- | --- | --- |
| 1 | Warm Pad | Slow sawtooth swell, long reverb tail |
| 2 | Square Lead | Sharp attack, dry and cutting |
| 3 | Soft Sine | Rounded, gentle, mid reverb |
| 4 | Pluck | Fast decay, short and percussive |
| 5 | Organ | Fat sine, full sustain, near-instant release |

### Chords

Every slot is freely assignable from **12 roots × 15 qualities = 180 chords** —
maj, min, 7, min7, M7, 6, m6, 9, maj9, add9, sus2, sus4, dim, dim7, and m7b5 —
each with its own octave shift on top of the global octave. Defaults are
`C · G · Am · F · Em`.

## Run it

```bash
npm install
npm run dev     # also vendors the tracking model + wasm on first run
```

Open http://localhost:5173, click **Start camera & audio**, and allow webcam
access.

```bash
npm test        # pure-logic tests (chords, finger counting, synth engine)
npm run build   # typecheck + production build
npm run lint    # oxlint
```

## How it works

```
webcam ──▶ HandLandmarker ──▶ fingerCount ──▶ SynthEngine ──▶ 🔊
           (21 landmarks)      (per hand)      PolySynth
                │                              → Filter
                └──▶ drawOverlay (canvas)      → Reverb
                                               → Volume
```

**Tracking** is [MediaPipe Tasks Vision](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker)
`HandLandmarker` on WASM/WebGL, returning 21 3D landmarks plus a handedness
label per hand. (ARCore, sometimes assumed to do this, is Android-native and has
no hand tracking at all.)

**Finger counting** happens in [fingerCount.ts](src/vision/fingerCount.ts) and is
rotation-invariant: distances are measured from the wrist and normalized by palm
size, so counting survives a tilted hand — which a naive `tip.y < pip.y` check
does not.

**Audio** is [Tone.js](https://tonejs.github.io/) — `PolySynth → Filter → Reverb
→ Volume` — driven imperatively from the tracking loop in
[SynthEngine.ts](src/audio/SynthEngine.ts).

**The render loop** in [useHandTracking.ts](src/vision/useHandTracking.ts) runs at
display rate and writes to a mutable ref, updating React state only ~10×/second
for the HUD — so rendering never gates the audio.

## Settings

The panel on the right persists to `localStorage`:

- **Chords** — per left-hand finger count, with per-slot and global octave
- **Oscillator** — per right-hand preset
- **Volume range** — where in the frame your hand reads loudest and quietest
- **Steadiness** — frames a gesture must hold before it commits (debounce)
- **Swap hands** — flip if left and right come out reversed on your camera
- **Show hand skeleton** — the tracking overlay

### If your hands are reversed

MediaPipe labels handedness assuming a mirrored selfie image, but the app feeds
it the raw camera frame, so the label is inverted by default to compensate.
Cameras and drivers vary; if the app reads your hands backwards, turn on **Swap
hands**.

## Project layout

```
src/
├── audio/       chords.ts · presets.ts · SynthEngine.ts
├── vision/      landmarker.ts · useCamera.ts · useHandTracking.ts
│                fingerCount.ts · drawOverlay.ts
├── components/  StartScreen · Hud · SettingsPanel
├── state/       settings.ts (localStorage-backed)
└── __tests__/   pure-logic tests
scripts/         fetch-assets.mjs — vendors the model + wasm into public/
```

## Deployment

Pushes to `main` build and publish to GitHub Pages via
[deploy.yml](.github/workflows/deploy.yml), served at
[www.dj-hands.com](https://www.dj-hands.com).

### Using VS Code Live Server

Live Server cannot serve the source directly — it is a static file server, and
the browser cannot parse `src/main.tsx` or resolve bare imports like `tone`. Use
`npm run dev` instead, which already gives you hot reload.

If you specifically want Live Server, build first and point it at the output:

```bash
npm run build      # produces dist/
```

Then right-click `dist/index.html` → **Open with Live Server**. The build uses
relative asset paths (`base: './'`), so it works from any subdirectory.

Note that the camera only works on a secure origin. `localhost` and `127.0.0.1`
count as secure, but Live Server's "open on LAN address" (e.g. `192.168.x.x`)
does not, and the browser will silently refuse camera access there.
