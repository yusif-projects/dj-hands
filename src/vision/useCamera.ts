import { useCallback, useRef, useState } from 'react'

export type CameraStatus = 'idle' | 'starting' | 'ready' | 'error'

/** Owns the webcam stream and its <video> element lifecycle. */
export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [status, setStatus] = useState<CameraStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const start = useCallback(async () => {
    const video = videoRef.current
    if (!video) throw new Error('Video element is not mounted')

    setStatus('starting')
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false,
      })
      streamRef.current = stream
      video.srcObject = stream
      await new Promise<void>((resolve) => {
        if (video.readyState >= 2) return resolve()
        video.onloadedmetadata = () => resolve()
      })
      await video.play()
      setStatus('ready')
      return stream
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Camera permission was denied. Allow access and try again.'
          : err instanceof DOMException && err.name === 'NotFoundError'
            ? 'No camera was found on this device.'
            : err instanceof Error
              ? err.message
              : 'Could not start the camera.'
      setError(message)
      setStatus('error')
      throw err
    }
  }, [])

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setStatus('idle')
  }, [])

  return { videoRef, status, error, start, stop }
}
