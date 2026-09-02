<div align="center">

# 🎹 DJ Hands

**Play chords in the air. Your webcam is the instrument.**

[**▶ Try it live — dj-hands.com**](https://www.dj-hands.com)

[![Deploy](https://github.com/yusif-projects/dj-hands/actions/workflows/deploy.yml/badge.svg)](https://github.com/yusif-projects/dj-hands/actions/workflows/deploy.yml)
[![Release](https://img.shields.io/github/v/release/yusif-projects/dj-hands?label=release&color=8957e5)](https://github.com/yusif-projects/dj-hands/releases)
![React 19](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178c6?logo=typescript&logoColor=white)
![Tone.js](https://img.shields.io/badge/Audio-Tone.js-f24b6a)
![MediaPipe](https://img.shields.io/badge/Vision-MediaPipe-0097a7)
[![License](https://img.shields.io/badge/License-Apache_2.0-green)](LICENSE)

[![Buy Me a Coffee](https://img.shields.io/badge/Buy_Me_a_Coffee-support-FFDD00?logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/dj.hands)

</div>

---

Hold up both hands and play. The webcam tracks 21 landmarks per hand: your **left
hand picks the chord**, and your **right hand shapes it** — height sets the
volume, rotation sweeps a filter. Everything — vision and audio — runs in the
browser. No video ever leaves your device.

| Gesture | Effect |
| --- | --- |
| ✋ Left hand, 1–5 fingers | Plays chord slot 1–5, sustained while you hold it |
| ✊ Left hand, fist | Silence |
| ↕️ Right hand height | Volume — higher is louder |
| 🔄 Right hand rotation | Filter sweep — lowpass, highpass or bandpass |
| 🤚 Right hand, 1–5 fingers | Switches to song section 1–5 |

Five named song sections, each with its own five chord slots, the waveform and
its ADSR, the filter and volume ranges, the effects rack — amounts, the order it
runs in, and rates free or locked to a tempo — which camera feeds the tracker,
and tracking steadiness are all configurable in-app and persist to
`localStorage`. See the [user guide](docs/USER-GUIDE.md).

## Run it

```bash
npm install
npm run dev     # also vendors the tracking model + wasm on first run
```

Open http://localhost:5173, click **Start camera & audio**, and allow webcam
access.

```bash
npm test        # pure-logic tests (chords, finger counting, rotation, synth engine, overlay)
npm run build   # typecheck + production build
npm run lint    # oxlint
```

## How it works

```
webcam ──▶ HandLandmarker ──▶ fingerCount  ──▶ SynthEngine ──▶ 🔊
           (21 landmarks)     handRotation      PolySynth
                │                 (per hand)    → Filter
                └──▶ drawOverlay (canvas)       → Effects rack ×6
                          ▲                     → Volume
                          │                        └─▶ Meter
                          │
                          └──────── level ───────────────┘
```

MediaPipe Tasks Vision does the tracking, Tone.js does the sound, and the render
loop drives the synth imperatively so rendering never gates the audio. Details in
[architecture](docs/ARCHITECTURE.md).

## Documentation

| | |
| --- | --- |
| [Getting started](docs/GETTING-STARTED.md) | Install, run, build, test, project layout |
| [User guide](docs/USER-GUIDE.md) | Gestures, the sound, chords, HUD, settings |
| [Architecture](docs/ARCHITECTURE.md) | Module map, data flow, the render loop |
| [Audio](docs/AUDIO.md) | Chord model, Tone graph, voice handling |
| [Vision](docs/VISION.md) | Landmarks, finger counting, debouncing |
| [Configuration](docs/CONFIGURATION.md) | Settings schema, persistence, env vars |
| [Deployment](docs/DEPLOYMENT.md) | Pages pipeline, domain, analytics, SEO and prerendering, releases, rollback |
| [Troubleshooting](docs/TROUBLESHOOTING.md) | Camera, WebGL, reversed hands, no sound |
| [Contributing](docs/CONTRIBUTING.md) | Tests, conventions, extension points |
| [AI usage](docs/AI-USAGE.md) | Claude Code setup, the skills in this repo, vendoring and updating them |

## Support

DJ Hands is free, has no ads and no accounts, and runs entirely on your own
machine — there is no server to pay for, just the time. If it made you play
something you liked, you can
[**buy me a coffee**](https://buymeacoffee.com/dj.hands). The same button sits in
the top-left corner of the app.

## Credits

Built by **Yusif Aliyev** —
[LinkedIn](https://www.linkedin.com/in/yusif-programmer/) ·
[**Joe in the Studio**](https://www.joeinthestudio.com), my music project.

Inspired by [**gesture-synth**](https://gesture-synth-weld.vercel.app) — respect
to the original for the idea of turning a webcam into an instrument. DJ Hands is
an independent take on it: chord slots with inversion and slash bass, an editable
ADSR voice, a rotation-swept filter, and a rotation-invariant finger counter.

## License

Licensed under the [Apache License, Version 2.0](LICENSE). You are free to use,
modify, and redistribute DJ Hands, including commercially, provided you keep the
license and attribution notices and state your changes.
