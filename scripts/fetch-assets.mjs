// Vendors the MediaPipe hand-tracking model and WASM runtime into public/ so the
// app has no CDN dependency at runtime and works offline.
import { mkdir, copyFile, readdir, stat } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'
const modelDir = join(root, 'public', 'models')
const modelPath = join(modelDir, 'hand_landmarker.task')
const wasmSrc = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm')
const wasmDest = join(root, 'public', 'wasm')

const exists = async (p) => stat(p).then(() => true, () => false)

await mkdir(modelDir, { recursive: true })
if (await exists(modelPath)) {
  console.log('model: already present')
} else {
  console.log('model: downloading hand_landmarker.task ...')
  const res = await fetch(MODEL_URL)
  if (!res.ok) throw new Error(`model download failed: ${res.status} ${res.statusText}`)
  await pipeline(Readable.fromWeb(res.body), createWriteStream(modelPath))
  console.log('model: done')
}

await mkdir(wasmDest, { recursive: true })
for (const file of await readdir(wasmSrc)) {
  await copyFile(join(wasmSrc, file), join(wasmDest, file))
}
console.log('wasm: copied runtime files')
