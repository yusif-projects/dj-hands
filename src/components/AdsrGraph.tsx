import { envelopeShape } from '../audio/adsrShape'
import type { ShapePoint } from '../audio/adsrShape'
import type { Voice } from '../audio/voice'

// The unit box maps into this frame. The axes sit outside the plot so the
// attack ramp starts on the corner rather than on top of the vertical rule.
const VIEW_W = 300
const VIEW_H = 112
const AXIS_X = 22
const PLOT_LEFT = 30
const PLOT_RIGHT = 286
const PLOT_TOP = 14
const PLOT_BOTTOM = 96

interface Props {
  voice: Voice
}

/** The envelope drawn as the classic ADSR figure. Display only — the knobs edit it. */
export function AdsrGraph({ voice }: Props) {
  const { segments, points } = envelopeShape(voice)

  return (
    <svg
      className="adsr-graph"
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      role="img"
      aria-label="Envelope shape"
    >
      <path
        className="adsr-axis"
        d={`M ${AXIS_X} ${PLOT_TOP - 6} L ${AXIS_X} ${PLOT_BOTTOM} L ${VIEW_W - 6} ${PLOT_BOTTOM}`}
      />
      {segments.map((segment) => (
        <line
          key={segment.stage}
          className={`adsr-seg adsr-${segment.stage}`}
          x1={px(segment.from)}
          y1={py(segment.from)}
          x2={px(segment.to)}
          y2={py(segment.to)}
        />
      ))}
      {points.map((point, i) => (
        <circle key={i} className="adsr-dot" cx={px(point)} cy={py(point)} r={3.5} />
      ))}
    </svg>
  )
}

function px(point: ShapePoint): number {
  return PLOT_LEFT + point.x * (PLOT_RIGHT - PLOT_LEFT)
}

function py(point: ShapePoint): number {
  return PLOT_BOTTOM - point.y * (PLOT_BOTTOM - PLOT_TOP)
}
