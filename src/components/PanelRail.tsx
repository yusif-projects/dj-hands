import { PANEL_GROUPS, PANEL_GROUP_LABELS, type PanelGroup } from '../state/panel'
import {
  AboutIcon,
  ChordsIcon,
  EffectsIcon,
  FilterIcon,
  HelpIcon,
  SoundIcon,
  TrackingIcon,
  VolumeIcon,
} from './icons'

const ICONS: Record<PanelGroup, () => React.JSX.Element> = {
  chords: ChordsIcon,
  sound: SoundIcon,
  filter: FilterIcon,
  effects: EffectsIcon,
  volume: VolumeIcon,
  tracking: TrackingIcon,
  help: HelpIcon,
  about: AboutIcon,
}

interface Props {
  /** The group the panel is showing, or `null` while it is closed. */
  open: PanelGroup | null
  /** Picking the group already open is what closes the panel; App decides that. */
  onSelect: (group: PanelGroup) => void
}

export function PanelRail({ open, onSelect }: Props) {
  return (
    <nav className="panel-rail" aria-label="Settings groups">
      {PANEL_GROUPS.map((id) => {
        const Icon = ICONS[id]
        const label = PANEL_GROUP_LABELS[id]
        return (
          <button
            key={id}
            type="button"
            className={`rail-button ${open === id ? 'active' : ''}`}
            // Each button discloses the one shared panel region.
            aria-expanded={open === id}
            aria-controls="settings-panel"
            // The button is a bare glyph, so the name has to be spelled out.
            aria-label={label}
            title={label}
            onClick={() => onSelect(id)}
          >
            <Icon />
            <span className="rail-tip" aria-hidden="true">{label}</span>
          </button>
        )
      })}
    </nav>
  )
}
