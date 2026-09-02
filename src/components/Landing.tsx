import { CHORDS, DEFAULT_CHORD_SLOTS, QUALITIES, ROOTS } from '../audio/chords'
import { EFFECT_IDS } from '../audio/effects'
import { FILTER_TYPES } from '../audio/filter'
import { SECTION_COUNT } from '../audio/sections'
import { WAVEFORMS } from '../audio/voice'
import { FAQ } from './faq'

/**
 * The prose below the start card: what DJ Hands is, how it works, what it can
 * do, and the FAQ.
 *
 * It exists to be read by a search engine. The start card is written for
 * someone already on the page with their hands up, so it says "1-5 chord" and
 * assumes the rest; nobody arrives here by searching for that. This section is
 * the same instrument described in the words people actually type — webcam,
 * hand tracking, gestures, browser, free — and it is the only text in the app
 * that is allowed to be long.
 *
 * Rendered inside `.start-screen`, which already scrolls, and torn down with it
 * on Start. It must stay Node-renderable: `scripts/prerender.mjs` runs this
 * through `renderToStaticMarkup` so the words reach crawlers that never execute
 * the bundle. A browser-only import anywhere under here breaks the build.
 */

/**
 * Counted from the audio modules for the same reason `STATS` is in
 * `StartScreen` — a claim about the instrument should be a reading of it, not a
 * number somebody remembered to update.
 */
const CAPABILITIES: { title: string; body: string }[] = [
  {
    title: 'Chords',
    body: `${CHORDS.length} of them — ${ROOTS.length} roots across ${QUALITIES.length} qualities, from plain triads to thirteenths and altered dominants. Any slot takes an inversion, a slash bass and an octave shift of its own.`,
  },
  {
    title: 'Song sections',
    body: `${SECTION_COUNT} named sections, each holding its own ${DEFAULT_CHORD_SLOTS.length} chords. Your right hand switches between them mid-performance, so a verse and a chorus are a gesture apart rather than a menu apart.`,
  },
  {
    title: 'The voice',
    body: `${WAVEFORMS.length} waveforms — sine, triangle, square, sawtooth — under an ADSR envelope you draw by dragging its corners. It is a real synth voice, not a sample.`,
  },
  {
    title: 'A filter you perform',
    body: `${FILTER_TYPES.length} filter types — lowpass, highpass and bandpass — swept by the rotation of your right palm. Turning your hand opens and closes the sound in real time, the way a knob would.`,
  },
  {
    title: 'An effects rack',
    body: `${EFFECT_IDS.length} effects — bitcrusher, chorus, tremolo, phaser, delay and reverb — each with its own depth, reorderable along the signal chain, and the timed ones lockable to a tempo grid.`,
  },
  {
    title: 'It remembers',
    body: 'Every chord, envelope, filter range and effect setting saves to your browser as you go. Close the tab and the instrument you built is the one waiting next time.',
  },
]

const STEPS: { n: string; title: string; body: string }[] = [
  {
    n: '1',
    title: 'The webcam watches your hands',
    body: 'A hand-tracking model finds 21 landmarks on each hand, sixty times a second, entirely inside the browser tab.',
  },
  {
    n: '2',
    title: 'Landmarks become gestures',
    body: 'Those points are read as a finger count and a palm angle — how many fingers you are holding up, and which way your hand is turned.',
  },
  {
    n: '3',
    title: 'Gestures play a synth',
    body: 'The count picks a chord, the height of your hand sets its volume, and the angle sweeps the filter. A Web Audio synth turns all of it into sound with no perceptible delay.',
  },
]

export function Landing() {
  return (
    <div className="landing">
      <section className="landing-section" id="about">
        <h2>A musical instrument you play with your hands, in the air</h2>
        <p>
          DJ Hands is a free online synthesizer you play with hand gestures in front of your
          webcam. There is nothing to download, nothing to install, no MIDI keyboard and no
          account — open the page, allow the camera, and hold up your hands.
        </p>
        <p>
          Your left hand plays the harmony: one to five fingers picks one of five chords, held for
          as long as you hold the shape, and a closed fist is silence. Your right hand shapes it —
          raise it to get louder, turn your palm to sweep the filter open or shut, and hold up
          fingers to jump between song sections. It is closer to conducting than to typing.
        </p>
        <p>
          Everything that makes sound runs on your own machine. The hand tracking and the synth are
          both browser code, and no frame of video is ever recorded, uploaded or sent anywhere —
          each one goes from the camera straight to the tracker and is discarded.
        </p>
      </section>

      <section className="landing-section">
        <h2>How hand tracking becomes music</h2>
        <ol className="landing-steps">
          {STEPS.map((step) => (
            <li key={step.n}>
              <span className="step-n" aria-hidden="true">
                {step.n}
              </span>
              <div>
                <strong>{step.title}</strong>
                <p>{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="landing-note">
          Computer vision by MediaPipe, sound by Tone.js over the Web Audio API. The tracking model
          and its runtime are served from this domain rather than a CDN, so nothing the instrument
          needs is fetched from a third party while you play.
        </p>
      </section>

      <section className="landing-section">
        <h2>Not a toy — a synth you actually build</h2>
        <div className="landing-grid">
          {CAPABILITIES.map((item) => (
            <div key={item.title} className="landing-cell">
              <strong>{item.title}</strong>
              <p>{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-section">
        <h2>Questions</h2>
        <dl className="landing-faq">
          {FAQ.map((entry) => (
            <div key={entry.question}>
              <dt>{entry.question}</dt>
              <dd>{entry.answer}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  )
}
