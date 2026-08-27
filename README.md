<div align="center">

# 🎹 DJ Hands

**Play chords in the air. Your webcam is the instrument.**

[**▶ Try it live — dj-hands.com**](https://www.dj-hands.com)

[![Deploy](https://github.com/yusif-projects/gesture-music/actions/workflows/deploy.yml/badge.svg)](https://github.com/yusif-projects/gesture-music/actions/workflows/deploy.yml)
[![Release](https://img.shields.io/github/v/release/yusif-projects/gesture-music?label=release&color=8957e5)](https://github.com/yusif-projects/gesture-music/releases)
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

| Gesture | Effect |
| --- | --- |
| ✋ Left hand, 1–5 fingers | Plays chord slot 1–5, sustained while you hold it |
| ✊ Left hand, fist | Silence |
| 🤚 Right hand, 1–5 fingers | Selects synth preset 1–5 |
| ↕️ Right hand height | Volume — higher is louder |

Chord slots, oscillators, volume range, and tracking steadiness are all
configurable in-app and persist to `localStorage`. See the
[user guide](docs/user-guide.md).

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

MediaPipe Tasks Vision does the tracking, Tone.js does the sound, and the render
loop drives the synth imperatively so rendering never gates the audio. Details in
[architecture](docs/architecture.md).

## Documentation

| | |
| --- | --- |
| [Getting started](docs/getting-started.md) | Install, run, build, test, project layout |
| [User guide](docs/user-guide.md) | Gestures, presets, chords, HUD, settings |
| [Architecture](docs/architecture.md) | Module map, data flow, the render loop |
| [Audio](docs/audio.md) | Chord model, Tone graph, voice handling |
| [Vision](docs/vision.md) | Landmarks, finger counting, debouncing |
| [Configuration](docs/configuration.md) | Settings schema, persistence, env vars |
| [Deployment](docs/deployment.md) | Pages pipeline, domain, analytics, releases, rollback |
| [Troubleshooting](docs/troubleshooting.md) | Camera, WebGL, reversed hands, no sound |
| [Contributing](docs/contributing.md) | Tests, conventions, extension points |

## Credits

Built by **Yusif Aliyev** —
[LinkedIn](https://www.linkedin.com/in/yusif-programmer/) ·
[**Joe in the Studio**](https://www.joeinthestudio.com), my music project.

Inspired by [**gesture-synth**](https://gesture-synth-weld.vercel.app) — respect
to the original for the idea of turning a webcam into an instrument. DJ Hands is
an independent take on it: assignable chord slots, per-preset oscillators, and a
rotation-invariant finger counter.
