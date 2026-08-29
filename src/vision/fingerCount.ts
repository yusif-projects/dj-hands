/**
 * Pure finger counting from MediaPipe hand landmarks.
 *
 * Landmark indices: wrist 0 | thumb 1-4 | index 5-8 | middle 9-12 |
 * ring 13-16 | pinky 17-20 (each finger: MCP, PIP, DIP, TIP).
 *
 * The tests are rotation-invariant on purpose: comparing `tip.y < pip.y` only
 * works for an upright hand, and falls apart the moment the hand tilts.
 */

export interface Point {
  x: number
  y: number
  z?: number
}

const WRIST = 0
const THUMB_IP = 3
const THUMB_TIP = 4
const MIDDLE_MCP = 9
const PINKY_MCP = 17

/** [PIP, TIP] for index, middle, ring, pinky. */
const FINGER_JOINTS: Array<[number, number]> = [
  [6, 8],
  [10, 12],
  [14, 16],
  [18, 20],
]

const EXTENDED_RATIO = 1.1
const THUMB_RATIO = 1.05

/**
 * Enter and exit edges either side of the single-threshold values above. A
 * fingertip resting near one threshold flips state frame to frame, and every
 * flicker restarts `GestureDebouncer`'s streak — so a chord change costs far
 * more than the nominal debounce. Latching each finger between two edges means
 * only a deliberate move changes it, and the count settles as the hand arrives
 * rather than several frames later.
 */
const EXTEND_ON = 1.14
const EXTEND_OFF = 1.06
const THUMB_ON = 1.08
const THUMB_OFF = 1.02

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

const NO_FINGERS: boolean[] = [false, false, false, false, false]

/**
 * The ratio a digit has to beat this frame: the exit edge if it was extended
 * last frame, the enter edge if it was curled, and the single midway threshold
 * when the caller keeps no state.
 */
function edgeFor(
  previous: boolean[] | undefined,
  index: number,
  on: number,
  off: number,
  stateless: number,
): number {
  if (!previous) return stateless
  return previous[index] ? off : on
}

/**
 * Which of the five digits are extended, thumb first.
 * Distances are normalized by palm size so the thresholds hold at any distance
 * from the camera.
 *
 * `previous` is last frame's answer. Given one, each digit is measured against
 * whichever edge it has to cross to change state; without one the digit is
 * classified against a single threshold midway between the two, which is what
 * a caller holding no state wants.
 */
export function extendedFingers(landmarks: Point[], previous?: boolean[]): boolean[] {
  if (!landmarks || landmarks.length < 21) return [...NO_FINGERS]

  const wrist = landmarks[WRIST]
  const palm = dist(wrist, landmarks[MIDDLE_MCP])
  if (palm === 0) return [...NO_FINGERS]

  // A curled thumb tucks toward the palm; an extended one abducts away from it,
  // so measure both thumb joints against the far side of the palm.
  const pinkyMcp = landmarks[PINKY_MCP]
  const thumbRatio = edgeFor(previous, 0, THUMB_ON, THUMB_OFF, THUMB_RATIO)
  const thumbOut =
    dist(landmarks[THUMB_TIP], pinkyMcp) > dist(landmarks[THUMB_IP], pinkyMcp) * thumbRatio

  const fingers = FINGER_JOINTS.map(([pip, tip], i) => {
    const ratio = edgeFor(previous, i + 1, EXTEND_ON, EXTEND_OFF, EXTENDED_RATIO)
    return dist(wrist, landmarks[tip]) > dist(wrist, landmarks[pip]) * ratio
  })

  return [thumbOut, ...fingers]
}

/** Number of extended digits, 0-5. 0 (a fist) means "release". */
export function countExtendedFingers(landmarks: Point[]): number {
  return extendedFingers(landmarks).filter(Boolean).length
}

/**
 * Carries one hand's per-finger state between frames, so `extendedFingers` can
 * measure each digit against the edge it actually has to cross. One per hand:
 * sharing a latch would let one hand's fingers set the other's thresholds.
 */
export class FingerLatch {
  private state: boolean[] = [...NO_FINGERS]

  /** Feeds one frame's landmarks; returns the latched count, 0-5. */
  count(landmarks: Point[]): number {
    this.state = extendedFingers(landmarks, this.state)
    return this.state.filter(Boolean).length
  }

  reset() {
    this.state = [...NO_FINGERS]
  }
}

/**
 * Requires a raw count to repeat for N consecutive frames before committing it.
 * Without this, chords flicker while fingers are still in transit.
 */
export class GestureDebouncer {
  private candidate = 0
  private streak = 0
  private committed = 0
  private frames: number

  constructor(frames: number) {
    this.frames = Math.max(1, frames)
  }

  setFrames(frames: number) {
    this.frames = Math.max(1, frames)
  }

  /** Feeds one frame's raw count; returns the currently committed gesture. */
  push(raw: number): number {
    if (raw === this.candidate) {
      this.streak++
    } else {
      this.candidate = raw
      this.streak = 1
    }
    if (this.streak >= this.frames) this.committed = this.candidate
    return this.committed
  }

  get value() {
    return this.committed
  }

  reset() {
    this.candidate = 0
    this.streak = 0
    this.committed = 0
  }
}
