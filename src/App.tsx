import { useEffect, useRef, useState } from 'react'
import * as Tone from 'tone'
import type { HandLandmarker } from '@mediapipe/tasks-vision'
import { SynthEngine } from './audio/SynthEngine'
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

  const { live } = useHandTracking({
    videoRef,
    canvasRef,
    landmarker,
    engine,
    settings,
    active: started,
  })

  useEffect(() => saveSettings(settings), [settings])

  // Push settings the engine caches into it whenever they change.
  useEffect(() => {
    engine?.setChords(settings.chords)
  }, [engine, settings.chords])
  useEffect(() => {
    engine?.setOctave(settings.octave)
  }, [engine, settings.octave])
  useEffect(() => {
    engine?.setChordOctaves(settings.chordOctaves)
  }, [engine, settings.chordOctaves])
  useEffect(() => {
    engine?.setPresets(settings.presets)
  }, [engine, settings.presets])

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
      synth.setChords(settings.chords)
      synth.setOctave(settings.octave)
      synth.setChordOctaves(settings.chordOctaves)
      synth.setPresets(settings.presets)
      setLandmarker(tracker)
      setEngine(synth)
      setStarted(true)
    } catch (err) {
      setStartError(
        cameraError ?? (err instanceof Error ? err.message : 'Something went wrong starting up.'),
      )
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
            chords={settings.chords}
            chordOctaves={settings.chordOctaves}
            octave={settings.octave}
            presets={settings.presets}
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
