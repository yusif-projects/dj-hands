import { useEffect, useRef, useState } from 'react'
import type { HandLandmarker } from '@mediapipe/tasks-vision'
import type { SynthEngine } from '../audio/SynthEngine'
import type { Settings } from '../state/settings'
import { GestureDebouncer, countExtendedFingers, type Point } from './fingerCount'
import { LEFT_COLOR, RIGHT_COLOR, clearOverlay, drawHand, drawVolumeGuides } from './drawOverlay'

/** Milliseconds a hand may vanish before its chord is released. */
const HAND_GRACE_MS = 300
/** One-pole smoothing coefficient for the volume follower. */
const VOLUME_SMOOTHING = 0.25
/** HUD refresh rate; the loop itself runs at full frame rate. */
const HUD_INTERVAL_MS = 100

export interface LiveState {
  leftGesture: number
  rightGesture: number
  leftSeen: boolean
  rightSeen: boolean
  volume: number
  fps: number
}

const EMPTY_LIVE: LiveState = {
  leftGesture: 0,
  rightGesture: 0,
  leftSeen: false,
  rightSeen: false,
  volume: 0,
  fps: 0,
}

interface Args {
  videoRef: React.RefObject<HTMLVideoElement | null>
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  landmarker: HandLandmarker | null
  engine: SynthEngine | null
  settings: Settings
  active: boolean
}

/**
 * The render loop: detect -> count -> drive audio -> draw. Runs at display rate
 * and writes to a mutable ref; React state is updated only ~10x/second for the
 * HUD, so rendering never gates the audio.
 */
export function useHandTracking({ videoRef, canvasRef, landmarker, engine, settings, active }: Args) {
  const [live, setLive] = useState<LiveState>(EMPTY_LIVE)
  const liveRef = useRef<LiveState>(EMPTY_LIVE)

  // Read settings from a ref so changing a chord does not restart the loop.
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  useEffect(() => {
    if (!active || !landmarker || !engine) return
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const leftDebouncer = new GestureDebouncer(settings.debounceFrames)
    const rightDebouncer = new GestureDebouncer(settings.debounceFrames)
    let lastVideoTime = -1
    let leftSeenAt = 0
    let smoothedVolume = 0
    let lastHudAt = 0
    let lastFrameAt = 0
    let fps = 0
    let raf = 0

    const loop = () => {
      raf = requestAnimationFrame(loop)
      const now = performance.now()
      const cfg = settingsRef.current

      if (video.readyState < 2 || video.videoWidth === 0) return
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
      }

      // detectForVideo requires strictly increasing timestamps; skip repeats.
      if (video.currentTime === lastVideoTime) return
      lastVideoTime = video.currentTime

      const result = landmarker.detectForVideo(video, now)

      leftDebouncer.setFrames(cfg.debounceFrames)
      rightDebouncer.setFrames(cfg.debounceFrames)

      let leftLandmarks: Point[] | null = null
      let rightLandmarks: Point[] | null = null

      for (let i = 0; i < result.landmarks.length; i++) {
        const label = result.handedness[i]?.[0]?.categoryName
        if (!label) continue
        if (isUserLeftHand(label, cfg.swapHands)) leftLandmarks = result.landmarks[i]
        else rightLandmarks = result.landmarks[i]
      }

      // --- Left hand: chord selection -------------------------------------
      let leftGesture = leftDebouncer.value
      if (leftLandmarks) {
        leftSeenAt = now
        leftGesture = leftDebouncer.push(countExtendedFingers(leftLandmarks))
      } else if (now - leftSeenAt > HAND_GRACE_MS) {
        leftDebouncer.reset()
        leftGesture = 0
      }
      engine.setChordSlot(leftGesture > 0 ? leftGesture - 1 : null)

      // --- Right hand: preset + volume ------------------------------------
      let rightGesture = rightDebouncer.value
      if (rightLandmarks) {
        rightGesture = rightDebouncer.push(countExtendedFingers(rightLandmarks))
        if (rightGesture > 0) engine.setPreset(rightGesture - 1)

        // Wrist height drives volume: y is 0 at the top of the frame.
        const y = rightLandmarks[0].y
        const span = cfg.volumeBottom - cfg.volumeTop
        const level = span > 0 ? clamp01((cfg.volumeBottom - y) / span) : 0
        smoothedVolume += (level - smoothedVolume) * VOLUME_SMOOTHING
        engine.setVolume(smoothedVolume)
      }
      // When the right hand is gone the volume holds rather than jumping.

      // --- Draw -------------------------------------------------------------
      clearOverlay(ctx)
      if (cfg.showOverlay) {
        drawVolumeGuides(ctx, cfg.volumeTop, cfg.volumeBottom)
        if (leftLandmarks) drawHand(ctx, leftLandmarks, LEFT_COLOR)
        if (rightLandmarks) drawHand(ctx, rightLandmarks, RIGHT_COLOR)
      }

      // --- Publish ----------------------------------------------------------
      if (lastFrameAt) fps = fps * 0.9 + (1000 / Math.max(1, now - lastFrameAt)) * 0.1
      lastFrameAt = now

      liveRef.current = {
        leftGesture,
        rightGesture,
        leftSeen: !!leftLandmarks,
        rightSeen: !!rightLandmarks,
        volume: smoothedVolume,
        fps,
      }
      if (now - lastHudAt >= HUD_INTERVAL_MS) {
        lastHudAt = now
        setLive(liveRef.current)
      }
    }

    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      engine.releaseAll()
      clearOverlay(ctx)
      setLive(EMPTY_LIVE)
    }
    // `settings` is intentionally excluded: the loop reads it via settingsRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, landmarker, engine, videoRef, canvasRef])

  return { live, liveRef }
}

/**
 * MediaPipe labels handedness assuming a mirrored (selfie) image, but we feed it
 * the raw camera frame, so the label comes back inverted relative to the user's
 * real hand. Invert it by default; the "Swap hands" setting undoes this for
 * cameras that behave differently.
 */
function isUserLeftHand(label: string, swapHands: boolean): boolean {
  const reportedLeft = label === 'Left'
  return swapHands ? reportedLeft : !reportedLeft
}

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v))
}
