import { useCallback, useEffect, useRef, useState } from 'react'
import * as Tone from 'tone'
import type { HandLandmarker } from '@mediapipe/tasks-vision'
import { flushSettled, track } from './analytics'
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
import { summarizeSession } from './sessionStats'
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
  // Mirrors of the two disposable handles, for the unmount cleanup below.
  const engineRef = useRef<SynthEngine | null>(null)
  const landmarkerRef = useRef<HandLandmarker | null>(null)
  engineRef.current = engine
  landmarkerRef.current = landmarker
  // When the session started, and whether its summary has already gone out.
  const startedAt = useRef(0)
  const sessionSent = useRef(false)
  const {
    videoRef,
    start: startCamera,
    stop: stopCamera,
    error: cameraError,
    devices: cameras,
    deviceId: cameraId,
    select: selectCamera,
  } = useCamera()

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
    // Closing is picking the open group again, and says nothing about interest
    // in it — only the opening is worth a reach metric.
    if (next) track('panel_group_opened', { group: next })
  }

  const { live, statsRef } = useHandTracking({
    videoRef,
    canvasRef,
    landmarker,
    engine,
    settings,
    active: started,
    onSelectSection: selectSection,
  })

  /**
   * Pressing Stop and closing the tab are the same ending, and the second is the
   * common one — so the summary is sent from a shared path that either can call,
   * guarded so doing both does not count the session twice.
   */
  const endSession = useCallback(() => {
    if (!startedAt.current || sessionSent.current) return
    sessionSent.current = true
    // A knob moved in the last half-second is still sitting in a debounce timer
    // that the page may not live long enough to run.
    flushSettled()
    const seconds = (performance.now() - startedAt.current) / 1000
    track('session_ended', summarizeSession(statsRef.current, seconds, coachDone))
  }, [statsRef, coachDone])

  // `pagehide` rather than `unload`: it still fires when the page goes into the
  // back/forward cache, which `unload` suppresses.
  useEffect(() => {
    window.addEventListener('pagehide', endSession)
    return () => window.removeEventListener('pagehide', endSession)
  }, [endSession])

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
    engine?.setEffects(settings.effects, settings.bpm)
  }, [engine, settings.effects, settings.bpm])

  const handleStart = async () => {
    setLoading(true)
    setStartError(null)
    try {
      // Both the AudioContext and getUserMedia require this user gesture.
      await Tone.start()
      // An un-timed trigger resolves to `currentTime + lookAhead`, and lookAhead
      // defaults to 100ms. That headroom exists to keep sequenced material from
      // scheduling late; nothing here is sequenced — every chord is struck the
      // moment a hand moves — so it is a flat 100ms between gesture and sound.
      // Tone floors the ticker's own interval at 10ms when this is zero.
      Tone.getContext().lookAhead = 0
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
      synth.setEffects(settings.effects, settings.bpm)
      setLandmarker(tracker)
      setEngine(synth)
      setStarted(true)
      startedAt.current = performance.now()
      sessionSent.current = false
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
    track('coach_replayed')
  }

  const handleStop = () => {
    // Before the teardown below: clearing `started` unmounts the render loop.
    endSession()
    setStarted(false)
    stopCamera()
    engine?.dispose()
    engineRef.current = null
    setEngine(null)
    landmarker?.close()
    landmarkerRef.current = null
    setLandmarker(null)
  }

  // Unmount only. Keyed on the values themselves this fired on every Stop too —
  // the cleanup for the old pair runs the moment they are cleared — so the
  // engine and the tracker were torn down twice, and MediaPipe's second
  // `close()` traps inside the WASM graph. That throw lands in React's commit,
  // which unmounts the whole tree, so Stop left a blank page instead of the
  // start screen. The refs hold the live pair without re-keying the effect.
  useEffect(() => {
    return () => {
      engineRef.current?.dispose()
      landmarkerRef.current?.close()
    }
  }, [])

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
          fps={live.fps}
          onReplayCoach={replayCoach}
          cameras={cameras}
          cameraId={cameraId}
          onSelectCamera={selectCamera}
          cameraError={cameraError}
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
