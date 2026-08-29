import { useEffect, useRef, useState } from 'react'
import type { HandLandmarker } from '@mediapipe/tasks-vision'
import type { SynthEngine } from '../audio/SynthEngine'
import type { Settings } from '../state/settings'
import { FingerLatch, GestureDebouncer, type Point } from './fingerCount'
import { rotationAmount } from './handRotation'
import {
  LEFT_HUE,
  RIGHT_HUE,
  bloomProgress,
  clearOverlay,
  drawChordBloom,
  drawHand,
  drawVolumeGuides,
  followLevel,
  neutralStyle,
} from './drawOverlay'

/** Milliseconds a hand may vanish before its chord is released. */
const HAND_GRACE_MS = 300
/** One-pole smoothing coefficient for the volume follower. */
const VOLUME_SMOOTHING = 0.25
/** Same, for the filter sweep; rotation is noisier than wrist height. */
const CUTOFF_SMOOTHING = 0.2
/** HUD refresh rate; the loop itself runs at full frame rate. */
const HUD_INTERVAL_MS = 100
/** Rise and fall rates of the overlay's level follower; see `followLevel`. */
const LEVEL_ATTACK = 0.55
const LEVEL_RELEASE = 0.08
/** How long a chord change's rings take to expand and fade. */
const BLOOM_MS = 500

export interface LiveState {
  leftGesture: number
  rightGesture: number
  leftSeen: boolean
  rightSeen: boolean
  volume: number
  /** Filter sweep position, 0-1; resolve to Hz with `cutoffHz`. */
  cutoff: number
  /** Measured output level, 0-1. Follows the signal, not the volume gesture. */
  level: number
  fps: number
}

const EMPTY_LIVE: LiveState = {
  leftGesture: 0,
  rightGesture: 0,
  leftSeen: false,
  rightSeen: false,
  volume: 0,
  cutoff: 1,
  level: 0,
  fps: 0,
}

interface Args {
  videoRef: React.RefObject<HTMLVideoElement | null>
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  landmarker: HandLandmarker | null
  engine: SynthEngine | null
  settings: Settings
  active: boolean
  /** Called on a right-hand gesture change; App decides whether it takes. */
  onSelectSection: (index: number) => void
}

/**
 * The render loop: detect -> count -> drive audio -> draw. Runs at display rate
 * and writes to a mutable ref; React state is updated only ~10x/second for the
 * HUD, so rendering never gates the audio.
 */
export function useHandTracking({
  videoRef,
  canvasRef,
  landmarker,
  engine,
  settings,
  active,
  onSelectSection,
}: Args) {
  const [live, setLive] = useState<LiveState>(EMPTY_LIVE)
  const liveRef = useRef<LiveState>(EMPTY_LIVE)

  // Read settings from a ref so changing a chord does not restart the loop.
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  // Same reason: a new callback identity each render must not restart it either.
  const selectSectionRef = useRef(onSelectSection)
  selectSectionRef.current = onSelectSection

  useEffect(() => {
    if (!active || !landmarker || !engine) return
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const leftDebouncer = new GestureDebouncer(settings.debounceFrames)
    const rightDebouncer = new GestureDebouncer(settings.debounceFrames)
    // One latch per hand: the debouncer rejects strays, the latch stops each
    // finger chattering across its threshold and creating them in the first place.
    const leftLatch = new FingerLatch()
    const rightLatch = new FingerLatch()
    let lastVideoTime = -1
    let leftSeenAt = 0
    let smoothedVolume = 0
    // Starts open, matching the filter the engine builds itself with.
    let smoothedCutoff = 1
    let smoothedLevel = 0
    let prevLeftGesture = 0
    let prevRightGesture = 0
    let bloomAt = 0
    let bloomRings = 0
    let sectionBloomAt = 0
    let sectionBloomRings = 0
    // Seeded from the current section so restarting the loop does not bloom.
    let prevSection = settings.activeSection
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
        leftGesture = leftDebouncer.push(leftLatch.count(leftLandmarks))
      } else if (now - leftSeenAt > HAND_GRACE_MS) {
        leftDebouncer.reset()
        // Otherwise a hand that left the frame open comes back with its fingers
        // still latched extended, and reads high for a frame or two.
        leftLatch.reset()
        leftGesture = 0
      }
      engine.setChordSlot(leftGesture > 0 ? leftGesture - 1 : null)

      // The same transition `setChordSlot` acts on, so the bloom fires exactly
      // when a chord is struck — no callback out of the engine needed.
      if (leftGesture !== prevLeftGesture) {
        if (leftGesture > 0) {
          bloomAt = now
          bloomRings = leftGesture
        }
        prevLeftGesture = leftGesture
      }

      // --- Right hand: song section + volume + filter ----------------------
      let rightGesture = rightDebouncer.value
      if (rightLandmarks) {
        rightGesture = rightDebouncer.push(rightLatch.count(rightLandmarks))

        // Wrist height drives volume: y is 0 at the top of the frame.
        const y = rightLandmarks[0].y
        const span = cfg.volumeBottom - cfg.volumeTop
        const level = span > 0 ? clamp01((cfg.volumeBottom - y) / span) : 0
        smoothedVolume += (level - smoothedVolume) * VOLUME_SMOOTHING
        engine.setVolume(smoothedVolume)

        // Palm rotation drives the filter cutoff.
        const rotation = rotationAmount(rightLandmarks)
        if (rotation !== null) {
          smoothedCutoff += (rotation - smoothedCutoff) * CUTOFF_SMOOTHING
          engine.setCutoff(smoothedCutoff)
        }
      }
      // When the right hand is gone volume, cutoff and the section all hold
      // rather than jumping — you can drop the hand without losing your place.

      // Only the transition is acted on, so a hand held steady while it shapes
      // volume does not re-select the section it is already on. A fist selects
      // nothing rather than section zero: unlike the left hand, where a fist is
      // the release, here there is nothing sensible to switch to.
      if (rightGesture !== prevRightGesture) {
        prevRightGesture = rightGesture
        if (rightGesture > 0) selectSectionRef.current(rightGesture - 1)
      }
      // Read back rather than assumed: App refuses a switch to a section that is
      // turned off, so the bloom only fires on one that actually took.
      if (cfg.activeSection !== prevSection) {
        prevSection = cfg.activeSection
        sectionBloomAt = now
        sectionBloomRings = cfg.activeSection + 1
      }

      // --- Draw -------------------------------------------------------------
      // Followed every frame even with the overlay hidden, so unhiding it does
      // not jump from silence, and so `level` below is always current.
      smoothedLevel = followLevel(smoothedLevel, engine.getLevel(), LEVEL_ATTACK, LEVEL_RELEASE)

      clearOverlay(ctx)
      if (cfg.showOverlay) {
        drawVolumeGuides(ctx, cfg.volumeTop, cfg.volumeBottom)
        // With the reactive toggle off these styles are the neutral ones, and
        // the hands are drawn exactly as they were before the overlay listened.
        const reactive = cfg.reactiveOverlay
        const left = reactive
          ? { hue: LEFT_HUE, level: smoothedLevel, cutoff: smoothedCutoff }
          : neutralStyle(LEFT_HUE)
        const right = reactive
          ? { hue: RIGHT_HUE, level: smoothedLevel, cutoff: smoothedCutoff }
          : neutralStyle(RIGHT_HUE)

        if (leftLandmarks) {
          const progress = reactive ? bloomProgress(now, bloomAt, BLOOM_MS) : null
          if (progress !== null) {
            drawChordBloom(ctx, leftLandmarks, bloomRings, progress, LEFT_HUE)
          }
          drawHand(ctx, leftLandmarks, left)
        }
        if (rightLandmarks) {
          const progress = reactive ? bloomProgress(now, sectionBloomAt, BLOOM_MS) : null
          if (progress !== null) {
            drawChordBloom(ctx, rightLandmarks, sectionBloomRings, progress, RIGHT_HUE)
          }
          drawHand(ctx, rightLandmarks, right)
        }
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
        cutoff: smoothedCutoff,
        level: smoothedLevel,
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
 * We feed MediaPipe the raw camera frame, and its handedness label describes the
 * hand as it really is, so the label is taken at face value: "Left" is the
 * user's left hand. The "Swap hands" setting inverts it for the cameras that
 * mirror in hardware and hand us an already-flipped frame.
 */
function isUserLeftHand(label: string, swapHands: boolean): boolean {
  const reportedLeft = label === 'Left'
  return swapHands ? !reportedLeft : reportedLeft
}

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v))
}
