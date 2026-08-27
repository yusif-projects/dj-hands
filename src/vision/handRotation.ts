/**
 * Pure palm-rotation measurement from MediaPipe hand landmarks.
 *
 * Rotation is read from the wrist -> middle-MCP vector, the most stable line
 * through the palm: it does not move when fingers curl, so the reading survives
 * a changing finger count.
 */

import type { Point } from './fingerCount'

const WRIST = 0
const MIDDLE_MCP = 9

/** Tilt away from upright that sweeps the full range, each way. */
export const ROTATION_RANGE = Math.PI / 2

/**
 * The video and overlay are mirrored for display (`transform: scaleX(-1)`) but
 * landmarks come from the raw frame, so a turn that reads as clockwise to the
 * player runs the other way in landmark space. This sign puts the reading back
 * in the player's frame; flip it if the sweep ever feels inverted.
 */
const TILT_SIGN = 1

/** Upright — fingers straight up — in the landmark frame, where y grows downward. */
const UPRIGHT = Math.PI / 2

/**
 * Signed radians away from upright, as seen on the mirrored screen: positive is
 * clockwise. `null` when the palm vector is unusable.
 */
export function palmTilt(landmarks: Point[]): number | null {
  if (!landmarks || landmarks.length < 21) return null
  const wrist = landmarks[WRIST]
  const mcp = landmarks[MIDDLE_MCP]
  const dx = mcp.x - wrist.x
  const dy = mcp.y - wrist.y
  if (dx === 0 && dy === 0) return null
  // Negate dy so the angle reads as standard maths orientation despite y-down.
  const angle = Math.atan2(-dy, dx)
  return TILT_SIGN * wrapPi(angle - UPRIGHT)
}

/**
 * Palm tilt as 0-1 across `±ROTATION_RANGE`, upright sitting at 0.5. Clamps
 * rather than wraps, so turning a hand past the range parks at the extreme.
 */
export function rotationAmount(landmarks: Point[]): number | null {
  const tilt = palmTilt(landmarks)
  if (tilt === null) return null
  return clamp01((tilt + ROTATION_RANGE) / (2 * ROTATION_RANGE))
}

/** Folds an angle into [-PI, PI) so an upside-down hand does not jump a full turn. */
function wrapPi(radians: number): number {
  const wrapped = ((radians + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI)
  return wrapped - Math.PI
}

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v))
}
