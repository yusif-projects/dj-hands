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
  /** Named, because the sound panel draws two of these and they have to be told apart. */
  label?: string
  /** Greyed out — the shape it picks is not in the signal path. */
  disabled?: boolean
  onChange: (waveform: WaveformName) => void
}

export function WaveformPicker({ value, label = 'Waveform', disabled, onChange }: Props) {
  return (
    <IconPicker
      label={label}
      tone="left"
      value={value}
      options={OPTIONS}
      disabled={disabled}
      onChange={onChange}
    />
  )
}
