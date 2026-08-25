import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'

/**
 * Creates the hand tracker. Model and WASM runtime are served from `public/`
 * (see scripts/fetch-assets.mjs) so there is no CDN dependency at runtime.
 */
export async function createHandLandmarker(): Promise<HandLandmarker> {
  const vision = await FilesetResolver.forVisionTasks(`${import.meta.env.BASE_URL}wasm`)
  return HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: `${import.meta.env.BASE_URL}models/hand_landmarker.task`,
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    numHands: 2,
    minHandDetectionConfidence: 0.6,
    minHandPresenceConfidence: 0.6,
    minTrackingConfidence: 0.6,
  })
}
