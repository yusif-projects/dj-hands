import { useCallback, useEffect, useRef, useState } from 'react'
import * as Tone from 'tone'
import type { HandLandmarker } from '@mediapipe/tasks-vision'
import { track } from './analytics'
import { SynthEngine } from './audio/SynthEngine'
import { sectionLabel } from './audio/sections'
import { Hud } from './components/Hud'
import { SettingsPanel } from './components/SettingsPanel'
import { StartScreen } from './components/StartScreen'
import { loadSettings, saveSettings, type Settings } from './state/settings'
import { createHandLandmarker } from './vision/landmarker'
import { useCamera } from './vision/useCamera'
import { useHandTracking } from './vision/useHandTracking'

export default function App() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  const [started, setStarted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(true)
  const [landmarker, setLandmarker] = useState<HandLandmarker | null>(null)
  const [engine, setEngine] = useState<SynthEngine | null>(null)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const { videoRef, start: startCamera, stop: stopCamera, error: cameraError } = useCamera()

  const activeSection = settings.sections[settings.activeSection]

  // The right hand asks; this decides. A section that is turned off is not
  // reachable by gesture, and returning `s` unchanged skips both the re-render
  // and the storage write, so a steady hand costs nothing.
  const selectSection = useCallback((index: number) => {
    setSettings((s) => {
      if (index === s.activeSection || !s.sections[index]?.enabled) return s
      return { ...s, activeSection: index }
    })
  }, [])

  const { live } = useHandTracking({
    videoRef,
    canvasRef,
    landmarker,
    engine,
    settings,
    active: started,
    onSelectSection: selectSection,
  })

  useEffect(() => saveSettings(settings), [settings])

  // Push settings the engine caches into it whenever they change.
  useEffect(() => {
    engine?.setChordSlots(activeSection.slots)
  }, [engine, activeSection.slots])
  useEffect(() => {
    engine?.setOctave(settings.octave)
  }, [engine, settings.octave])
  useEffect(() => {
    engine?.setVoice(settings.voice)
  }, [engine, settings.voice])
  useEffect(() => {
    engine?.setCutoffRange(settings.cutoffMin, settings.cutoffMax)
  }, [engine, settings.cutoffMin, settings.cutoffMax])
  useEffect(() => {
    engine?.setSendTarget(settings.sendTarget)
  }, [engine, settings.sendTarget])
  useEffect(() => {
    engine?.setSendAmount(settings.sendAmount)
  }, [engine, settings.sendAmount])

  const handleStart = async () => {
    setLoading(true)
    setStartError(null)
    try {
      // Both the AudioContext and getUserMedia require this user gesture.
      await Tone.start()
      await startCamera()
      const [tracker, synth] = await Promise.all([
        createHandLandmarker(),
        Promise.resolve(new SynthEngine()),
      ])
      synth.setChordSlots(activeSection.slots)
      synth.setOctave(settings.octave)
      synth.setVoice(settings.voice)
      synth.setCutoffRange(settings.cutoffMin, settings.cutoffMax)
      synth.setSendTarget(settings.sendTarget)
      synth.setSendAmount(settings.sendAmount)
      setLandmarker(tracker)
      setEngine(synth)
      setStarted(true)
      track('session_started')
    } catch (err) {
      const message = cameraError ?? describeStartError(err)
      setStartError(message)
      track('session_start_failed', { reason: message })
    } finally {
      setLoading(false)
    }
  }

  const handleStop = () => {
    setStarted(false)
    stopCamera()
    engine?.dispose()
    setEngine(null)
    landmarker?.close()
    setLandmarker(null)
  }

  useEffect(() => {
    return () => {
      engine?.dispose()
      landmarker?.close()
    }
  }, [engine, landmarker])

  return (
    <div className="app">
      <div className="stage">
        {/* Mirrored so raising your right hand moves the right side of the screen. */}
        <video ref={videoRef} className="camera" playsInline muted autoPlay />
        <canvas ref={canvasRef} className="overlay" />
        {started && (
          <Hud
            live={live}
            chordSlots={activeSection.slots}
            sectionName={sectionLabel(activeSection, settings.activeSection)}
            octave={settings.octave}
            accidental={settings.accidental}
            cutoffMin={settings.cutoffMin}
            cutoffMax={settings.cutoffMax}
          />
        )}
        {started && (
          <button className="stop" onClick={handleStop}>
            Stop
          </button>
        )}
      </div>

      {started && (
        <SettingsPanel
          settings={settings}
          onChange={setSettings}
          open={panelOpen}
          onToggle={() => setPanelOpen((v) => !v)}
        />
      )}

      {!started && (
        <StartScreen onStart={handleStart} loading={loading} error={startError ?? cameraError} />
      )}
    </div>
  )
}

/**
 * MediaPipe rejects with its full C++ source-location trace attached, which is
 * unreadable in the start card. Keep the first line, which carries the actual
 * message, and drop the trace.
 */
function describeStartError(err: unknown): string {
  if (!(err instanceof Error)) return 'Something went wrong starting up.'
  const [firstLine] = err.message.split('\n')
  return firstLine.trim() || 'Something went wrong starting up.'
}
