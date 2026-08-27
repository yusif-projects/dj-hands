# Troubleshooting

## Nothing starts

### "Camera permission was denied"

The browser blocked `getUserMedia`. Re-allow the site in the address-bar
permission menu (Chrome: the camera icon; Safari: Settings → Websites → Camera)
and click **Start camera & audio** again. On macOS, also check
**System Settings → Privacy & Security → Camera** for the browser itself — a
browser denied at the OS level reports the same error.

### "No camera was found on this device"

No video input is enumerated. Check that the camera is not physically
disconnected, disabled in BIOS/UEFI, or held exclusively by another app — some
video-conferencing apps hold the device even when minimized.

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
   the volume meter in the HUD.
2. **Is a chord committed?** The left HUD card should name a chord. A fist is
   deliberate silence.
3. **Is the volume range sane?** If **Top** and **Bottom** have been dragged
   close together, only a narrow band of the frame produces sound. Reset to
   defaults (0.15 / 0.85).
4. **Is the tab muted?** Browsers mute background tabs' audio contexts and
   suspend timers; the app must be in the foreground.

## Left and right are reversed

Turn on **Swap hands** in the settings panel.

MediaPipe labels handedness assuming a mirrored selfie image, but the app feeds
it the raw camera frame, so the label is inverted by default to compensate.
Cameras and drivers differ in whether they mirror in hardware — some do it
themselves, which double-inverts. The setting undoes the correction.

## Chords flicker or feel twitchy

Raise **Steadiness**. It sets how many consecutive frames a finger count must
hold before it commits (default 4, max 12). Higher is more stable and slightly
less responsive. Low light and busy backgrounds both make the raw count noisier,
so a well-lit plain background helps more than any setting.

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

Check the fps counter in the HUD corner.

- The GPU delegate may have failed and silently fallen back to CPU — look for
  `Hand tracking: GPU delegate unavailable, falling back to CPU.` in the
  console. For this model at this resolution the two run at comparable speed, so
  this is rarely the real cause.
- Other tabs doing heavy work, or a laptop in low-power mode, will show up here.
- The loop is driven by `requestAnimationFrame` and skips frames whose
  `video.currentTime` has not advanced, so an fps reading below the camera's
  capture rate is expected on a 30 fps webcam with a 60 Hz display.

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
