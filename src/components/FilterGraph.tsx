import type { FilterType } from '../audio/filter'
import { response, responsePath, spectrumX } from './filterShape'

// The same frame as the ADSR figure, so the two groups line up down the panel.
const VIEW_W = 300
const VIEW_H = 112
const AXIS_X = 22
const PLOT_LEFT = 30
const PLOT_RIGHT = 286
const PLOT_TOP = 14
const PLOT_BOTTOM = 96
const PLOT_W = PLOT_RIGHT - PLOT_LEFT
const PLOT_H = PLOT_BOTTOM - PLOT_TOP
/** Half the curve's stroke width, so a flat pass band does not clip on the edge. */
const PAD = 2

interface Props {
  type: FilterType
  cutoffMin: number
  cutoffMax: number
}

/**
 * Both ends of the sweep on one log-frequency axis: the response the rotation
 * travels from, the one it travels to, and the span between them. Display only —
 * the knobs underneath do the editing.
 */
export function FilterGraph({ type, cutoffMin, cutoffMax }: Props) {
  const closed = spectrumX(cutoffMin)
  const open = spectrumX(cutoffMax)

  return (
    <svg
      className="panel-graph filter-graph"
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      role="img"
      aria-label="Filter sweep"
    >
      <path
        className="graph-axis"
        d={`M ${AXIS_X} ${PLOT_TOP - 6} L ${AXIS_X} ${PLOT_BOTTOM} L ${VIEW_W - 6} ${PLOT_BOTTOM}`}
      />
      <g transform={`translate(${PLOT_LEFT} ${PLOT_TOP})`}>
        {/* The stretch of spectrum a full rotation travels across. */}
        <rect
          className="filter-span"
          x={px(closed)}
          y={PAD}
          width={Math.max(0, px(open) - px(closed))}
          height={PLOT_H - PAD * 2}
        />
        <path className="filter-curve-min" d={responsePath(type, closed, PLOT_W, PLOT_H, PAD)} />
        <path className="filter-curve-max" d={responsePath(type, open, PLOT_W, PLOT_H, PAD)} />
        <circle className="graph-dot" cx={px(closed)} cy={py(type, closed)} r={3.5} />
        <circle className="graph-dot" cx={px(open)} cy={py(type, open)} r={3.5} />
      </g>
    </svg>
  )
}

/** The same inset mapping `responsePath` uses, so the dots sit on their curves. */
function px(x: number): number {
  return PAD + x * (PLOT_W - PAD * 2)
}

function py(type: FilterType, cutoff01: number): number {
  return PAD + (1 - response(type, cutoff01, cutoff01)) * (PLOT_H - PAD * 2)
}
