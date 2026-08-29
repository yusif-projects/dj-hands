import { WAVEFORMS } from '../audio/voice'
import type { WaveformName } from '../audio/voice'
import {
  IconPicker,
  PICKER_PAD,
  PICKER_VIEW_H,
  PICKER_VIEW_W,
  type PickerOption,
} from './IconPicker'
import { waveformPath } from './waveformPath'

// The shapes never change, so they are drawn once for the module's lifetime.
const OPTIONS: PickerOption<WaveformName>[] = WAVEFORMS.map((waveform) => ({
  value: waveform,
  label: waveform,
  path: waveformPath(waveform, PICKER_VIEW_W, PICKER_VIEW_H, PICKER_PAD),
}))

interface Props {
  value: WaveformName
  onChange: (waveform: WaveformName) => void
}

export function WaveformPicker({ value, onChange }: Props) {
  return (
    <IconPicker label="Waveform" tone="left" value={value} options={OPTIONS} onChange={onChange} />
  )
}
