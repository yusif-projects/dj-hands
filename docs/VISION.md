# Vision

## Camera capture

[useCamera.ts](../src/vision/useCamera.ts) owns the `MediaStream`. Every camera
is opened with the same capture mode; only the device varies:

```ts
{ width: { ideal: 960 }, height: { ideal: 540 }, frameRate: { ideal: 60 } }
```

The detect, the gesture debounce and the draw all tick once per camera frame, so
**the capture rate sets the floor on how soon a chord change can be heard**.
Asking for 60 fps halves that floor, and 540p is what makes 60 reachable on most
webcams. The lower resolution costs nothing in accuracy: the model downsamples to
its own input size regardless. Every constraint is `ideal`, so a camera that
cannot manage the mode falls back to its closest one rather than refusing to
open.

### Choosing a camera

`enumerateDevices` lists the video inputs, refreshed after every successful open
and on the `devicechange` event. Labels come back empty until camera permission
has been granted, so the list is only worth showing once a stream has opened at
least once.

`open(preferred, exact)` replaces whatever was playing, and stops the old tracks
only **once the new stream is live** — a camera that refuses to open leaves the
session with the picture it already had, and `status` stays `ready` rather than
falling to `error`. The two callers differ in how hard they ask:

| Caller | Constraint | Why |
| --- | --- | --- |
| `start()` — a remembered id | `deviceId: { ideal }` | A machine that has since lost that camera still starts on another |
| `select(id)` — the player picked | `deviceId: { exact }` | It must fail loudly rather than quietly hand back the camera already running |

The id that is stored is the one the track actually reports, not the one that was
asked for. It lives under its own `localStorage` key — see
[configuration](CONFIGURATION.md#the-cameras-key).

`describeCameraError` reads `name` off whatever was thrown rather than off a
narrowed type: Chrome's `OverconstrainedError` is its own interface and not an
`Error` at all.

| `name` | Message |
| --- | --- |
| `NotAllowedError` | Camera permission was denied. Allow access and try again. |
| `NotFoundError`, `OverconstrainedError` | That camera is no longer available. |
| `NotReadableError` | That camera is already in use by another app. |

A `devicechange` refreshes the list only. A stream on a camera that has gone away
ends on its own, and re-picking is the player's call.

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

### Hysteresis

A fingertip resting near its threshold flips state frame to frame, and every
flicker restarts `GestureDebouncer`'s streak — so a chord change cost far more
than the nominal debounce, and raising the debounce to cover it only made the
instrument feel slower. The fix is at the source: each digit is latched between
an **enter** and an **exit** edge either side of the single threshold, so only a
deliberate move changes it.

| Digit | Enter | Exit | Single threshold |
| --- | --- | --- | --- |
| Fingers | 1.14 | 1.06 | 1.1 |
| Thumb | 1.08 | 1.02 | 1.05 |

A curled digit has to beat the enter edge to read as extended; an extended one
has to fall under the exit edge to read as curled. Between the two it keeps
whatever it had. The count then settles as the hand arrives rather than several
frames later, which is what lets **Steadiness** default to 2 frames instead of 4.

The single thresholds are still the answer when the caller keeps no state: they
sit midway between each pair, which is what a one-shot classification wants.

### API

```ts
extendedFingers(landmarks, previous?) // → [thumb, index, middle, ring, pinky]
countExtendedFingers(landmarks)       // → 0…5;  0 (a fist) means "release"
```

`previous` is last frame's answer. Given one, each digit is measured against
whichever edge it has to cross to change state; without one, every digit is
measured against the single threshold.

`FingerLatch` carries that state for you — **one per hand**, since a shared latch
would let one hand's fingers set the other's edges:

```ts
const latch = new FingerLatch()
latch.count(landmarks)  // → 0…5, latched against last frame
latch.reset()           // back to all-curled
```

The loop resets a hand's latch when that hand passes its grace period. Otherwise
a hand that left the frame open comes back with its fingers still latched
extended, and reads high for a frame or two.

All of them return all-false / 0 for malformed input (fewer than 21 landmarks, or
a degenerate zero-size palm) rather than throwing, so a bad frame cannot take
down the loop.

## Debouncing

`GestureDebouncer` requires a raw count to repeat for N consecutive frames
before committing it:

```ts
const d = new GestureDebouncer(3)
d.push(3)  // → 0  (committed value unchanged)
d.push(3)  // → 0
d.push(3)  // → 3  (streak reached 3)
```

Without it, chords flicker while fingers are still in transit — a hand moving
from two to four fingers passes through three, and the model will happily report
it. N is the **Steadiness** setting (1–12 frames, default 2) and can be changed
live via `setFrames`; the loop pushes the current value in every frame.

Two frames is enough because the debouncer no longer has to absorb threshold
chatter as well — [the latch](#hysteresis) stops those strays being generated at
all, leaving the debouncer only the real in-transit counts to reject. Every frame
beyond that is latency you hear on a chord change, and what it costs depends on
the capture rate: at 60 fps two frames is 33 ms, at 15 fps it is 133 ms. The
panel shows the current cost in milliseconds beside the frame count for exactly
that reason.

`reset()` returns to a committed 0, used when the left hand disappears past its
grace period. The hand's `FingerLatch` is reset alongside it.

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

[handRotation.ts](../src/vision/handRotation.ts) turns landmarks into the filter
sweep the right hand drives.

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
  hue 203 (blue), right hand hue 34 (amber). The two hues are `--left` and
  `--right` from [styles.css](../src/styles.css) restated as numbers, because
  the colour a player learns on the start card has to be the colour drawn on
  their own knuckles; change one and change the other.
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
| Level | `engine.getLevel()` — the [meter tap](AUDIO.md#the-meter-tap) | Glow radius, stroke width, joint size, on both hands |
| Cutoff | `smoothedCutoff`, already in the loop | Colour temperature: dull and dark closed, full colour open |
| Chord change | the `leftGesture` transition | A bloom of up to *n* rings, *n* = the slot number |

**Saturation ceiling.** Open, `handColor` tops out at `BASE_SATURATION` 78%,
not 100%. The panel inks are painted rather than neon, and a fully saturated
stroke put a third, brighter pair of blues and ambers on screen in a product
whose whole colour rule is that one ink means one thing. 78 is where the
skeleton still reads over a moving camera feed and still matches the panel.
A closed filter takes another 45 points off it.

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
