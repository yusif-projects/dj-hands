# Troubleshooting

## Nothing starts

### "Camera permission was denied"

The browser blocked `getUserMedia`. Re-allow the site in the address-bar
permission menu (Chrome: the camera icon; Safari: Settings → Websites → Camera)
and click **Start camera & audio** again. On macOS, also check
**System Settings → Privacy & Security → Camera** for the browser itself — a
browser denied at the OS level reports the same error.

### "That camera is no longer available"

No video input matched. Check that the camera is not physically disconnected or
disabled in BIOS/UEFI. If it appears after you unplug and replug a webcam, the
app was asking for a remembered device id that the browser no longer recognises —
pick the camera again under **Tracking → Camera** and the new id is stored.

### "That camera is already in use by another app"

Another program holds the device exclusively. Some video-conferencing apps keep
it even while minimized; quit them and try again. On Windows this is the common
case, since fewer drivers there allow a camera to be opened twice.

### "Hand tracking needs WebGL, which this browser has disabled"

MediaPipe uploads every frame through a WebGL context before inference, so
WebGL is required even for the CPU delegate. In Chrome, check
**Settings → System → "Use graphics acceleration when available"** and restart
the browser. Visit `chrome://gpu` to see whether the driver has been
blocklisted. Firefox exposes the same under `about:config` →
`webgl.disabled`.

Without this preflight the failure would appear as a WASM
`memory access out of bounds` trap on every frame — if you see that, you are on
a build predating the check.

### The camera works, but startup hangs

The model is ~7 MB. On a first visit over a slow connection the **Starting…**
state can last a while. It is fetched from the same origin, not a CDN, and is
cached afterwards.

### Nothing happens at all, no error

Both `AudioContext` and `getUserMedia` require a user gesture — the app cannot
auto-start, which is why the start screen exists. If clicking does nothing,
check the console for a thrown error that predates the app's own handler.

## No sound

1. **Is the right hand in frame?** Volume follows right-hand height and starts
   at silence. Raise your right hand into the upper part of the frame and watch
   the fader in the HUD bar fill.
2. **Is a chord committed?** A chord pad should be lit and the note line should
   name its notes. A fist is deliberate silence.
3. **Is the filter shut?** Either end of the sweep can be nearly inaudible — a
   lowpass closed right down, a highpass or bandpass run up past the chord.
   Bring the hand back upright, or widen the two knobs in the Filter section.
4. **Is the volume range sane?** If **Top** and **Bottom** have been dragged
   close together, only a narrow band of the frame produces sound. Reset to
   defaults (0.15 / 0.85).
5. **Is the tab muted?** Browsers mute background tabs' audio contexts and
   suspend timers; the app must be in the foreground.

## The wrong camera opens

Pick the one you want under **Tracking → Camera**; the row appears once the
browser reports more than one video input. Switching is live — the chord you are
holding keeps ringing, and the tracking loop is not restarted. The choice is
remembered for next time.

If a switch fails, the message says why and **the camera that was already running
stays running**, so a bad pick cannot leave you with no picture.

Browsers withhold camera *labels* until camera permission has been granted, so
before the first successful start the entries read `Camera 1`, `Camera 2` and so
on. After that they carry their real names.

## Left and right are reversed

Turn on **Swap hands** in the settings panel.

MediaPipe labels the hand it actually sees, and the app feeds it the raw camera
frame, so the labels are used as they come. Cameras and drivers differ in whether
they mirror in hardware — one that flips the frame itself inverts every label,
and the setting corrects for that.

The first-run walkthrough offers this itself: if a step stalls for twelve seconds
with one hand in frame and it is the other one, the card says so rather than
leaving you waving at a prompt that will never tick off.

## A walkthrough step never ticks off

Each step waits for its gesture to hold steady for about 400 ms, so a shape
passed through on the way to another does not count. If one will not complete:

- **Check which hand is being read.** The left hand lights a chord pad; the
  right hand moves the fader and the filter arc. If those respond to the wrong
  hand, see [above](#left-and-right-are-reversed).
- **Get the whole hand in frame.** The wrist landmark drives both the volume step
  and the release step; a hand cropped at the bottom edge counts badly.
- **For the volume step, go high.** It wants the volume past 75%, which at the
  default range puts your wrist in the top third of the frame — watch the fader
  in the HUD rather than guessing.

**Skip** dismisses the walkthrough for good. **Replay walkthrough**, in the
**How to play** panel group, brings it back.

## Chords flicker or feel twitchy

Raise **Steadiness**. It sets how many consecutive frames a finger count must
hold before it commits (default 2, max 12). Higher is more stable and slightly
less responsive — and the setting shows what the current value costs in
milliseconds, so you can see the trade rather than guess at it.

Low light and busy backgrounds both make the raw count noisier, so a well-lit
plain background helps more than any setting. A finger parked exactly on the edge
between curled and extended is already held by hysteresis rather than allowed to
chatter, so if a count is genuinely unstable the cause is usually the picture,
not the threshold.

## Fingers are miscounted

- **Fill more of the frame.** Counting normalizes by palm size, so it is
  distance-invariant in principle, but a hand only a few dozen pixels across
  gives the model little to work with.
- **Separate your fingers.** Adjacent extended fingers are fine, but a finger
  half-curled sits right at the threshold.
- **The thumb is the usual culprit.** It is detected by abduction away from the
  palm, not by curl. A thumb resting alongside the index finger reads as tucked.
- **Turn on the skeleton overlay** to see what the model actually sees.

## Low frame rate

Check the fps counter above the HUD bar's right corner.

- The GPU delegate may have failed and silently fallen back to CPU — look for
  `Hand tracking: GPU delegate unavailable, falling back to CPU.` in the
  console. For this model at this resolution the two run at comparable speed, so
  this is rarely the real cause.
- Other tabs doing heavy work, or a laptop in low-power mode, will show up here.
- The loop is driven by `requestAnimationFrame` and skips frames whose
  `video.currentTime` has not advanced, so the reading tracks the camera's
  capture rate, not the display's. The app asks every camera for 960×540 at
  60 fps, but the constraints are `ideal` — a webcam that only manages 30 gives
  30, and the counter shows it. That is the single biggest lever on how soon a
  chord change is heard, so a camera with a 60 fps mode is worth picking under
  **Tracking → Camera**.

## Settings do not persist

`localStorage` is unavailable in some private-browsing configurations. Writes
are wrapped in try/catch, so the app works normally but forgets everything on
reload. Nothing to fix beyond leaving private mode.

If settings persist but look wrong after an upgrade, the loader validates and
repairs stored values field-by-field — an unrecognized chord name falls back to
that slot's default rather than breaking the app. **Reset to defaults** clears
it entirely.

## VS Code Live Server

Live Server **cannot serve the source directory**. It is a plain static file
server: the browser cannot parse `src/main.tsx`, and it cannot resolve bare
imports like `tone`. Use `npm run dev`, which already gives you hot reload.

If you specifically want Live Server, build first and point it at the output:

```bash
npm run build      # produces dist/
```

Then right-click `dist/index.html` → **Open with Live Server**. The build uses
relative asset paths (`base: './'`), so it works from any subdirectory.

One catch: **the camera only works on a secure origin.** `localhost` and
`127.0.0.1` count as secure, but Live Server's "open on LAN address"
(e.g. `192.168.x.x`) does not, and the browser will silently refuse camera
access there.

## Testing on another device over the network

Same constraint: a plain `http://192.168.x.x` origin is not secure, so the
camera will not start. Use an HTTPS tunnel (`ngrok`, `cloudflared`) pointed at
the dev server, or test against the deployed site.
