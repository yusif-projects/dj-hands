import type { Point } from './fingerCount'

/** Bone pairs of the 21-point hand skeleton. */
const CONNECTIONS: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
]

export const LEFT_COLOR = '#4dd6ff'
export const RIGHT_COLOR = '#ff9f43'

export function clearOverlay(ctx: CanvasRenderingContext2D) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
}

/** Draws one hand's skeleton. Landmarks are normalized 0-1 in frame space. */
export function drawHand(ctx: CanvasRenderingContext2D, landmarks: Point[], color: string) {
  const { width: w, height: h } = ctx.canvas

  ctx.lineWidth = 3
  ctx.strokeStyle = color
  ctx.beginPath()
  for (const [a, b] of CONNECTIONS) {
    ctx.moveTo(landmarks[a].x * w, landmarks[a].y * h)
    ctx.lineTo(landmarks[b].x * w, landmarks[b].y * h)
  }
  ctx.stroke()

  ctx.fillStyle = color
  for (const p of landmarks) {
    ctx.beginPath()
    ctx.arc(p.x * w, p.y * h, 4, 0, Math.PI * 2)
    ctx.fill()
  }
}

/** Horizontal guides showing where the volume range tops out and bottoms out. */
export function drawVolumeGuides(ctx: CanvasRenderingContext2D, top: number, bottom: number) {
  const { width: w, height: h } = ctx.canvas
  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'
  ctx.lineWidth = 1
  ctx.setLineDash([8, 8])
  for (const y of [top, bottom]) {
    ctx.beginPath()
    ctx.moveTo(0, y * h)
    ctx.lineTo(w, y * h)
    ctx.stroke()
  }
  ctx.restore()
}
