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

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/**
 * Which of the five digits are extended, thumb first.
 * Distances are normalized by palm size so the thresholds hold at any distance
 * from the camera.
 */
export function extendedFingers(landmarks: Point[]): boolean[] {
  if (!landmarks || landmarks.length < 21) return [false, false, false, false, false]

  const wrist = landmarks[WRIST]
  const palm = dist(wrist, landmarks[MIDDLE_MCP])
  if (palm === 0) return [false, false, false, false, false]

  // A curled thumb tucks toward the palm; an extended one abducts away from it,
  // so measure both thumb joints against the far side of the palm.
  const pinkyMcp = landmarks[PINKY_MCP]
  const thumbOut =
    dist(landmarks[THUMB_TIP], pinkyMcp) > dist(landmarks[THUMB_IP], pinkyMcp) * THUMB_RATIO

  const fingers = FINGER_JOINTS.map(
    ([pip, tip]) => dist(wrist, landmarks[tip]) > dist(wrist, landmarks[pip]) * EXTENDED_RATIO,
  )

  return [thumbOut, ...fingers]
}

/** Number of extended digits, 0-5. 0 (a fist) means "release". */
export function countExtendedFingers(landmarks: Point[]): number {
  return extendedFingers(landmarks).filter(Boolean).length
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
