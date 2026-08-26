import { FilesetResolver, HandLandmarker, type HandLandmarkerOptions } from '@mediapipe/tasks-vision'

const TUNING = {
  runningMode: 'VIDEO',
  numHands: 2,
  minHandDetectionConfidence: 0.6,
  minHandPresenceConfidence: 0.6,
  minTrackingConfidence: 0.6,
} satisfies Partial<HandLandmarkerOptions>

/**
 * MediaPipe uploads each video frame through a WebGL context before it ever
 * reaches the model, so WebGL is required even for the CPU delegate. Chrome
 * blocklists drivers and disables WebGL far more readily than Safari does, and
 * without this check that case surfaces as a WASM "memory access out of bounds"
 * trap on every frame instead of something a user can act on.
 */
function hasWebGL(): boolean {
  const canvas = document.createElement('canvas')
  try {
    return !!(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
  } catch {
    return false
  }
}

/**
 * Creates the hand tracker. Model and WASM runtime are served from `public/`
 * (see scripts/fetch-assets.mjs) so there is no CDN dependency at runtime.
 */
export async function createHandLandmarker(): Promise<HandLandmarker> {
  if (!hasWebGL()) {
    throw new Error(
      'Hand tracking needs WebGL, which this browser has disabled. In Chrome, check that ' +
        '"Use graphics acceleration when available" is on in Settings → System, then restart it.',
    )
  }

  const vision = await FilesetResolver.forVisionTasks(`${import.meta.env.BASE_URL}wasm`)
  const modelAssetPath = `${import.meta.env.BASE_URL}models/hand_landmarker.task`

  try {
    return await HandLandmarker.createFromOptions(vision, {
      ...TUNING,
      baseOptions: { modelAssetPath, delegate: 'GPU' },
    })
  } catch (err) {
    // Some Chrome/driver combinations expose WebGL but still fail to build the
    // GPU inference graph. CPU inference runs at the same frame rate here, so
    // it is a straight fallback rather than a degraded mode.
    console.warn('Hand tracking: GPU delegate unavailable, falling back to CPU.', err)
    return await HandLandmarker.createFromOptions(vision, {
      ...TUNING,
      baseOptions: { modelAssetPath, delegate: 'CPU' },
    })
  }
}
