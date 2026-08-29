import { useCallback, useEffect, useRef, useState } from 'react'
import { loadCameraId, saveCameraId } from '../state/camera'

export type CameraStatus = 'idle' | 'starting' | 'ready' | 'error'

/** The capture mode every camera is asked for; only the device varies. */
// The detect, the gesture debounce and the draw all tick once per camera frame,
// so the capture rate sets the floor on how soon a chord change can be heard.
// Asking for 60 halves that floor; 540p is what makes 60 reachable on most
// webcams, and costs nothing in accuracy because the model downsamples to its
// own input size regardless. All `ideal`, so a camera that cannot manage it
// falls back to its closest mode.
const CAPTURE = {
  width: { ideal: 960 },
  height: { ideal: 540 },
  frameRate: { ideal: 60 },
}

/** Owns the webcam stream and its <video> element lifecycle. */
export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [status, setStatus] = useState<CameraStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  // The camera that is actually open, which is not always the one that was
  // asked for — a stored id can be stale, and the first start names none.
  const [deviceId, setDeviceId] = useState<string | null>(() => loadCameraId())

  // Labels come back empty until camera permission has been granted, so the
  // list is only worth anything once a stream has opened at least once.
  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return
    try {
      const all = await navigator.mediaDevices.enumerateDevices()
      setDevices(all.filter((d) => d.kind === 'videoinput'))
    } catch {
      // Enumeration is a nicety; a failure just leaves the list as it was.
    }
  }, [])

  /**
   * Opens a stream on the video element, replacing whatever was playing. The
   * old tracks are stopped only once the new stream is live, so a camera that
   * refuses to open leaves the session with the picture it already had.
   *
   * `exact` is for a camera the player picked: it must fail loudly rather than
   * quietly hand back the one already running. A remembered id uses `ideal`, so
   * a machine that has since lost that camera still starts on another.
   */
  const open = useCallback(
    async (preferred: string | null, exact = false) => {
      const video = videoRef.current
      if (!video) throw new Error('Video element is not mounted')

      setStatus('starting')
      setError(null)
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: preferred
            ? { ...CAPTURE, deviceId: exact ? { exact: preferred } : { ideal: preferred } }
            : { ...CAPTURE, facingMode: 'user' },
          audio: false,
        })
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = stream
        video.srcObject = stream
        await new Promise<void>((resolve) => {
          if (video.readyState >= 2) return resolve()
          video.onloadedmetadata = () => resolve()
        })
        await video.play()
        const opened = stream.getVideoTracks()[0]?.getSettings().deviceId ?? preferred ?? null
        setDeviceId(opened)
        saveCameraId(opened)
        setStatus('ready')
        void refreshDevices()
        return stream
      } catch (err) {
        setError(describeCameraError(err))
        // A failed switch has not touched the stream that was already running,
        // so the session carries on and only the message is new.
        setStatus(streamRef.current ? 'ready' : 'error')
        throw err
      }
    },
    [refreshDevices],
  )

  /** Starts on the remembered camera, or on the front-facing default. */
  const start = useCallback(() => open(deviceId), [open, deviceId])

  /** Swaps to another camera mid-session; the tracking loop keeps running. */
  const select = useCallback(
    async (id: string) => {
      if (id === deviceId) return
      // Nothing is open yet, so there is no stream to swap — remember the
      // choice and let the next start pick it up.
      if (!streamRef.current) {
        setDeviceId(id)
        saveCameraId(id)
        return
      }
      try {
        await open(id, true)
      } catch {
        // `open` has already put the reason on `error`, and the camera that was
        // running is still running; there is nothing further to do here.
      }
    },
    [open, deviceId],
  )

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setStatus('idle')
  }, [])

  // Plugging a camera in or pulling one out changes what the picker should
  // offer. Only the list is refreshed: a stream on a camera that has gone away
  // ends on its own, and re-picking is the player's call.
  useEffect(() => {
    const media = navigator.mediaDevices
    if (!media?.addEventListener) return
    const onChange = () => void refreshDevices()
    media.addEventListener('devicechange', onChange)
    return () => media.removeEventListener('devicechange', onChange)
  }, [refreshDevices])

  return { videoRef, status, error, devices, deviceId, start, select, stop }
}

/**
 * `getUserMedia` rejects with a DOMException for most of these, but Chrome's
 * OverconstrainedError is its own interface and not an Error at all, so the
 * name is read off whatever came back rather than off a narrowed type.
 */
function describeCameraError(err: unknown): string {
  const name = (err as { name?: unknown } | null)?.name
  switch (name) {
    case 'NotAllowedError':
      return 'Camera permission was denied. Allow access and try again.'
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'That camera is no longer available.'
    case 'NotReadableError':
      return 'That camera is already in use by another app.'
    default:
      return err instanceof Error && err.message ? err.message : 'Could not start the camera.'
  }
}
