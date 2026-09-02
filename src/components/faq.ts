/**
 * The landing FAQ, and the `FAQPage` structured data built from it.
 *
 * One array feeds both the rendered section and the JSON-LD that
 * `scripts/prerender.mjs` stamps into `index.html`. Google requires the two to
 * agree — an answer that only exists in the markup is an invalid rich result —
 * and keeping them as one source is what makes that impossible to get wrong.
 *
 * Pure and React-free so the prerender can call it in Node.
 */

export interface FaqEntry {
  /** Phrased the way it would be typed into a search box, not as a heading. */
  question: string
  /** Plain text. No markup — it has to survive into JSON-LD verbatim. */
  answer: string
}

export const FAQ: FaqEntry[] = [
  {
    question: 'Do I need a MIDI keyboard or any music gear?',
    answer:
      'No. A webcam is the only input device. There is nothing to plug in, nothing to install, and no account to make — open the page, allow the camera, and your hands are the controller.',
  },
  {
    question: 'Is my webcam video uploaded anywhere?',
    answer:
      'Never. Hand tracking and sound both run inside your browser, on your own machine. There is no backend and no server to send video to: frames go from the camera to the tracker and are discarded. Nothing is recorded, and nothing leaves your device.',
  },
  {
    question: 'Is DJ Hands free?',
    answer:
      'Yes, completely. No ads, no accounts, no paid tier, and no trial. It is open source under the Apache 2.0 licence.',
  },
  {
    question: 'Do I need to know music theory to play it?',
    answer:
      'No. Every chord slot is already filled with a chord that sounds good with the others, so holding up fingers plays music straight away. The theory is there if you want it — inversions, slash bass and forty chord qualities are all editable — but you can ignore all of it and still play.',
  },
  {
    question: 'Which browsers does it work in?',
    answer:
      'Current Chrome, Safari and Firefox on desktop. It needs WebGL, a webcam, and a secure origin, since browsers refuse camera access over plain HTTP.',
  },
  {
    question: 'Does it work on a phone or tablet?',
    answer:
      'It runs, but it is built for a desktop or laptop webcam. Hold the device in landscape and stand back far enough for both hands to be in frame — in a small frame the difference between four and five fingers gets unreliable.',
  },
  {
    question: 'Why is my hand not being detected?',
    answer:
      'Almost always light or framing. Put a light in front of you rather than behind you, keep your whole hand inside the frame with fingers spread, and check that another app is not already holding the camera. If the tracker never starts at all, WebGL is usually disabled in the browser.',
  },
  {
    question: 'My left and right hands are reversed. Can I swap them?',
    answer:
      'Yes. Some cameras and virtual-camera drivers hand the browser an already-mirrored image, which flips the handedness the tracker reports. Turn on Swap hands under Tracking in the settings panel and the two hands change places.',
  },
  {
    question: 'Can I record what I play?',
    answer:
      'Not from inside the app. There is no recorder built in, so capture it the way you would any browser audio — a screen recorder, or routing the tab into a DAW with a virtual audio device.',
  },
  {
    question: 'How is this different from a regular software synth?',
    answer:
      'Under the sound it is a regular software synth: four waveforms, an ADSR envelope you draw by hand, a resonant filter, and a rack of six effects. What changes is the controller. Instead of a keyboard and knobs, chords come from how many fingers you hold up, volume from how high your hand is, and the filter sweep from the angle of your palm — so the gestures a performer already makes are the ones that shape the sound.',
  },
]

/**
 * The FAQ as a schema.org `FAQPage`, ready to drop into a
 * `<script type="application/ld+json">`.
 *
 * Pretty-printed on purpose: this ships in the served HTML, where a human
 * reading the source (or debugging a rich-result warning) is the likely reader,
 * and the bytes are irrelevant next to the model the app downloads later.
 */
export function faqJsonLd(): string {
  return JSON.stringify(
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQ.map(({ question, answer }) => ({
        '@type': 'Question',
        name: question,
        acceptedAnswer: { '@type': 'Answer', text: answer },
      })),
    },
    null,
    2,
  )
}
