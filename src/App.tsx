import { useCallback, useEffect, useRef, useState } from 'react'
import * as Tone from 'tone'
import type { HandLandmarker } from '@mediapipe/tasks-vision'
import { track } from './analytics'
import { SynthEngine } from './audio/SynthEngine'
import { sectionLabel } from './audio/sections'
import { Coach } from './components/Coach'
import { Hud } from './components/Hud'
import { PanelRail } from './components/PanelRail'
import { SettingsPanel } from './components/SettingsPanel'
import { StartScreen } from './components/StartScreen'
import { loadCoachDone, setCoachDone } from './state/firstRun'
import { loadPanelGroup, savePanelGroup, type PanelGroup } from './state/panel'
import { loadSettings, saveSettings, type Settings } from './state/settings'
import { createHandLandmarker } from './vision/landmarker'
import { useCamera } from './vision/useCamera'
import { useHandTracking } from './vision/useHandTracking'

export default function App() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  const [started, setStarted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [coachDone, setCoachDoneState] = useState(loadCoachDone)
  // A first-timer meets the walkthrough, not a settings panel — and on a narrow
  // screen the panel is a bottom sheet that would sit on top of the coach card.
  // Reading the stored group without writing it keeps their choice for later.
  const [openGroup, setOpenGroup] = useState<PanelGroup | null>(() =>
    loadCoachDone() ? loadPanelGroup() : null,
  )
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

  // Picking the group already showing is how the panel closes. Written through
  // on the click rather than from an effect, so mounting never writes.
  const selectGroup = (id: PanelGroup) => {
    const next = openGroup === id ? null : id
    setOpenGroup(next)
    savePanelGroup(next)
  }

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
    engine?.setFilterType(settings.filterType)
  }, [engine, settings.filterType])
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
      synth.setFilterType(settings.filterType)
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

  // Finished or skipped — either way it has done its job and does not come back.
  const finishCoach = () => {
    setCoachDone(true)
    setCoachDoneState(true)
  }

  // Asked for from the "How to play" group, which is open at the time. The panel
  // closes so the walkthrough has the frame, and the hands, to itself.
  const replayCoach = () => {
    setCoachDone(false)
    setCoachDoneState(false)
    setOpenGroup(null)
    savePanelGroup(null)
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
            filterType={settings.filterType}
            cutoffMin={settings.cutoffMin}
            cutoffMax={settings.cutoffMax}
          />
        )}
        {started && (
          <button className="stop" onClick={handleStop}>
            Stop
          </button>
        )}
        {started && !coachDone && <Coach live={live} onDone={finishCoach} />}
      </div>

      {started && (
        <SettingsPanel
          settings={settings}
          onChange={setSettings}
          group={openGroup}
          onReplayCoach={replayCoach}
        />
      )}
      {started && <PanelRail open={openGroup} onSelect={selectGroup} />}

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
