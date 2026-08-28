# Vision

## The tracker

[MediaPipe Tasks Vision](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker)
`HandLandmarker`, running in `VIDEO` mode on WASM with a WebGL-backed GPU
delegate. Per frame it returns, for up to two hands, 21 3D landmarks in
normalized frame coordinates plus a handedness label with a confidence score.

(ARCore is sometimes assumed to do this. It is Android-native and has no hand
tracking at all.)

Tuning, in [landmarker.ts](../src/vision/landmarker.ts):

```ts
runningMode: 'VIDEO'
numHands: 2
minHandDetectionConfidence: 0.6
minHandPresenceConfidence: 0.6
minTrackingConfidence: 0.6
```

Model and runtime are loaded from `${BASE_URL}models/` and `${BASE_URL}wasm/` —
vendored into `public/` by `scripts/fetch-assets.mjs`, never from a CDN.

### WebGL preflight

`createHandLandmarker` checks for a WebGL context before doing anything else.
MediaPipe uploads each video frame through a WebGL context *before* it reaches
the model, so WebGL is required even for the CPU delegate. Chrome blocklists
drivers and disables WebGL far more readily than Safari does, and without the
preflight that case surfaces as a WASM `memory access out of bounds` trap on
every frame — unactionable. The check turns it into a sentence telling the user
to re-enable graphics acceleration.

### GPU → CPU fallback

Some Chrome/driver combinations expose WebGL but still fail to build the GPU
inference graph. Rather than failing the whole start, the creator catches it,
logs a warning, and rebuilds with `delegate: 'CPU'`. CPU inference runs at the
same frame rate for this model at this resolution, so it is a straight fallback,
not a degraded mode.

## Landmark indices

```
        8   12  16  20      ← TIP
        7   11  15  19      ← DIP
        6   10  14  18      ← PIP
    4   5    9  13  17      ← MCP (4 = thumb TIP)
    3
    2
    1
        0                   ← WRIST
```

| Digit | Indices |
| --- | --- |
| Thumb | 1 CMC, 2 MCP, 3 IP, 4 TIP |
| Index | 5 MCP, 6 PIP, 7 DIP, 8 TIP |
| Middle | 9, 10, 11, 12 |
| Ring | 13, 14, 15, 16 |
| Pinky | 17, 18, 19, 20 |

Coordinates are normalized: `x` and `y` run 0–1 across the frame, with `y = 0`
at the top.

## Finger counting

[fingerCount.ts](../src/vision/fingerCount.ts) is pure — landmarks in, booleans
out — and deliberately **rotation-invariant**.

The obvious test is `tip.y < pip.y`: is the fingertip higher on screen than the
knuckle. It works for a perfectly upright hand and falls apart the moment the
hand tilts, which is most of the time when someone is playing.

Instead, everything is measured as a **distance from the wrist**, normalized by
palm size (`wrist → middle MCP`):

```ts
extended = dist(wrist, tip) > dist(wrist, pip) * 1.1
```

An extended finger's tip is meaningfully further from the wrist than its own PIP
joint; a curled one is not. Because both terms are distances from the same
origin, rotating the hand does not change the comparison, and normalizing by
palm size keeps the 1.1 threshold valid at any distance from the camera.

### The thumb is different

A thumb does not curl toward the wrist, it tucks across the palm — so the
wrist-distance test does not separate the two states. It is measured against the
**pinky MCP** instead, the far side of the palm:

```ts
thumbOut = dist(thumbTip, pinkyMcp) > dist(thumbIp, pinkyMcp) * 1.05
```

An extended thumb abducts *away* from the palm, putting its tip further from the
pinky knuckle than its own IP joint. A tucked thumb does not. The looser ratio
(1.05 vs 1.1) reflects the smaller travel.

### API

```ts
extendedFingers(landmarks)      // → [thumb, index, middle, ring, pinky]
countExtendedFingers(landmarks) // → 0…5;  0 (a fist) means "release"
```

Both return all-false / 0 for malformed input (fewer than 21 landmarks, or a
degenerate zero-size palm) rather than throwing, so a bad frame cannot take down
the loop.

## Debouncing

`GestureDebouncer` requires a raw count to repeat for N consecutive frames
before committing it:

```ts
const d = new GestureDebouncer(4)
d.push(3)  // → 0  (committed value unchanged)
d.push(3)  // → 0
d.push(3)  // → 0
d.push(3)  // → 3  (streak reached 4)
```

Without it, chords flicker while fingers are still in transit — a hand moving
from two to four fingers passes through three, and the model will happily report
it. N is the **Steadiness** setting (1–12 frames, default 4) and can be changed
live via `setFrames`; the loop pushes the current value in every frame.

`reset()` returns to a committed 0, used when the left hand disappears past its
grace period.

## Handedness

The app feeds MediaPipe the raw camera frame, so its handedness label describes
the hand as it really is. `isUserLeftHand` takes the label at face value:

```ts
const reportedLeft = label === 'Left'
return swapHands ? !reportedLeft : reportedLeft
```

Cameras and drivers vary in whether they mirror in hardware; one that hands us an
already-flipped frame inverts the labels, and the **Swap hands** setting corrects
for it. The video element itself is displayed mirrored either way, so raising
your right hand moves the right side of the screen.

## Palm rotation

[handRotation.ts](../src/vision/handRotation.ts) turns landmarks into the
lowpass sweep the right hand drives.

The angle comes from the **wrist → middle MCP** vector — the most stable line
through the palm. It does not move when fingers curl, so the reading survives a
changing finger count, which matters because that same hand's finger count picks
the song section, and because finger counting is itself deliberately
rotation-*invariant*: the two measurements have to be independent, or switching
section would drag the filter with it and turning the filter would switch section.

```ts
palmTilt(landmarks)        // signed radians from upright, or null
rotationAmount(landmarks)  // 0-1 across ±ROTATION_RANGE, or null
```

Three details worth knowing:

- **Upright is 0.5**, not 0. A quarter turn (`ROTATION_RANGE = π/2`) each way
  reaches the ends of the sweep.
- **The tilt is wrapped** into a half-turn around zero before it is clamped, so
  an upside-down hand parks at an extreme instead of jumping a full turn.
- **The reading is mirrored.** The video and overlay carry
  `transform: scaleX(-1)`, but landmarks come from the raw frame, so a turn that
  reads as clockwise to the player runs the other way in landmark space.
  `TILT_SIGN` puts the reading back in the player's frame — flip it if the sweep
  ever feels inverted.

`null` comes back for fewer than 21 landmarks or a zero-length palm vector; the
loop then leaves the cutoff where it was.

## Volume from hand height

The right wrist's `y` is mapped through the configured range:

```ts
level = clamp01((volumeBottom - y) / (volumeBottom - volumeTop))
smoothed += (level - smoothed) * 0.25
```

`y = 0` is the top of the frame, so the subtraction flips it — higher hand,
higher level. The one-pole filter at 0.25 takes the jitter out of raw landmark
positions without adding noticeable lag. When the right hand leaves the frame,
the smoothed value simply holds; nothing resets it.

## Overlay

[drawOverlay.ts](../src/vision/drawOverlay.ts) draws onto a canvas sized to the
video's intrinsic resolution, so normalized landmarks scale by `width`/`height`
directly:

- **Skeleton** — 21 bone pairs, 3 px strokes plus 4 px joint dots. Left hand
  hue 194 (blue), right hand hue 29 (orange).
- **Volume guides** — two dashed horizontal lines at `volumeTop` and
  `volumeBottom`, so the usable range is visible while you tune it.
- **Chord bloom** — rings expanding from the left palm on a chord change.

All of it is skipped when **Show hand skeleton** is off; the canvas is still
cleared each frame.

### Sound-reactive hands

With **Sound-reactive hands** on, the skeleton is driven by three signals rather
than drawn flat. The point is that the instrument currently looks identical
whether it is silent, striking a chord, or ringing out a tail.

| Signal | Source | Drives |
| --- | --- | --- |
| Level | `engine.getLevel()` — the [meter tap](audio.md#the-meter-tap) | Glow radius, stroke width, joint size, on both hands |
| Cutoff | `smoothedCutoff`, already in the loop | Colour temperature: dull and dark closed, full colour open |
| Chord change | the `leftGesture` transition | A bloom of up to *n* rings, *n* = the slot number |

**Neutral reduction.** At `level: 0, cutoff: 1` — which is what `neutralStyle`
returns, and what the loop passes when the toggle is off — `handColor` returns
the base colour and the sizes fall back to 3 px and 4 px. The reactive path is
then pixel-identical to the flat one, so the toggle is honest and there is only
one drawing routine to maintain. `drawOverlay.test.ts` asserts this directly.

**The follower.** `followLevel` is an asymmetric one-pole: `LEVEL_ATTACK` 0.55
rising, `LEVEL_RELEASE` 0.08 falling. A symmetric filter fast enough to catch an
attack also makes the decaying tail flicker; one slow enough to smooth the tail
mushes the attack. It runs every frame even with the overlay hidden, so
unhiding it does not jump from silence.

**Bloom timing.** The bloom fires on the same `leftGesture` transition that
`setChordSlot` acts on, tracked in the loop — no callback out of the engine is
needed, since the engine early-returns on exactly that comparison. It runs for
`BLOOM_MS` (500 ms) and `bloomProgress` returns `null` rather than clamping, so
a finished bloom stops being drawn instead of sticking at full radius.

**Ring sizing.** Ring *i* is drawn at `BLOOM_RADIUS - i * BLOOM_RING_SPACING`
(0.3 and 0.1) of the smaller canvas axis, scaled by progress, so each ring
trails the one before it and the count is countable. Rings at or below zero
radius are skipped, which caps the bloom at three: slots 3, 4 and 5 are not
distinguishable by ring count. Widening the spread means raising `BLOOM_RADIUS`
or lowering `BLOOM_RING_SPACING` — five rings need
`BLOOM_RADIUS > 4 * BLOOM_RING_SPACING`.

**Draw batching.** Canvas applies the shadow per draw call, so a glow over the
naive per-joint `arc`/`fill` loop would cost 21 shadowed fills per hand. The
skeleton is one `stroke()` and all 21 joints are one `fill()` — two shadowed
calls per hand, four per frame. The joints need a `moveTo` before each `arc`,
or consecutive arcs are joined by a line.
