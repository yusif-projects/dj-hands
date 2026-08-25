# Gesture Chord Synth

Play chords with your hands in the browser. The webcam tracks both hands; your
left hand picks the chord, your right hand picks the sound and sets the volume
by how high you hold it.

| Gesture | Effect |
| --- | --- |
| Left hand, 1–5 fingers | Plays chord slot 1–5, sustained while you hold it |
| Left hand, fist | Silence |
| Right hand, 1–5 fingers | Selects synth preset 1–5 |
| Right hand height | Volume — higher is louder |

All 24 chords are selectable per slot: C, Cm, D, Dm, E, Em, F, Fm, G, Gm, A, Am,
B, Bm, C#, C#m, D#, D#m, F#, F#m, G#, G#m, A#, A#m.

## Run it

```bash
npm install
npm run dev     # also vendors the tracking model on first run
```

Open http://localhost:5173, click **Start camera & audio**, and allow webcam
access. Video never leaves your device — tracking runs entirely in the browser.

```bash
npm test        # pure-logic tests (chords, finger counting)
npm run build   # typecheck + production build
```

## How it works

Hand tracking is [MediaPipe Tasks Vision](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker)
`HandLandmarker`, which returns 21 3D landmarks plus a handedness label per hand,
running on WASM/WebGL. (ARCore, which is sometimes assumed to do this, is
Android-native and has no hand tracking at all.)

Finger counting is computed from those landmarks in [fingerCount.ts](src/vision/fingerCount.ts).
The tests are rotation-invariant — distances are measured from the wrist and
normalized by palm size — so counting survives a tilted hand, which a naive
`tip.y < pip.y` check does not.

Audio is [Tone.js](https://tonejs.github.io/): `PolySynth → Filter → Reverb → Volume`,
driven imperatively from the tracking loop in [SynthEngine.ts](src/audio/SynthEngine.ts).

The render loop in [useHandTracking.ts](src/vision/useHandTracking.ts) runs at
display rate and writes to a mutable ref, updating React state only ~10×/second
for the HUD — so rendering never gates the audio.

## Settings

The panel on the right persists to `localStorage`:

- **Chords** per left-hand finger count, plus a global octave
- **Oscillator** per right-hand preset
- **Volume range** — where in the frame your hand reads as loudest and quietest
- **Steadiness** — frames a gesture must hold before it commits (debounce)
- **Swap hands** — flip if left and right come out reversed on your camera
- **Show hand skeleton** — the tracking overlay

### If your hands are reversed

MediaPipe labels handedness assuming a mirrored selfie image, but the app feeds
it the raw camera frame, so the label is inverted by default to compensate.
Cameras and drivers vary; if the app reads your hands backwards, turn on **Swap
hands**.
