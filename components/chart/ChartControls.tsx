'use client'

import type { DateRange, MAOverlayConfig } from '@/types'
import styles from './ChartControls.module.css'

interface Props {
  range: DateRange
  onRangeChange: (range: DateRange) => void
  maConfig: MAOverlayConfig
  onMAConfigChange: (config: MAOverlayConfig) => void
}

const RANGES: { label: string; value: DateRange }[] = [
  { label: '7H', value: '7d' },
  { label: '14H', value: '14d' },
  { label: '30H', value: '30d' },
  { label: 'Semua', value: 'all' },
]

export default function ChartControls({ range, onRangeChange, maConfig, onMAConfigChange }: Props) {
  function toggleMA(key: keyof MAOverlayConfig) {
    onMAConfigChange({ ...maConfig, [key]: !maConfig[key] })
  }

  return (
    <div className={styles.controls}>
      {/* Date Range Picker */}
      <div className={styles.group}>
        <span className={styles.groupLabel}>Periode</span>
        <div className={styles.btnGroup} role="group" aria-label="Pilih periode">
          {RANGES.map(r => (
            <button
              key={r.value}
              id={`range-${r.value}`}
              className={`btn btn-ghost btn-sm ${range === r.value ? 'active' : ''}`}
              onClick={() => onRangeChange(r.value)}
              aria-pressed={range === r.value}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* MA Toggle */}
      <div className={styles.group}>
        <span className={styles.groupLabel}>Moving Average</span>
        <div className={styles.btnGroup} role="group" aria-label="Toggle Moving Average">
          <button
            id="toggle-ma-7"
            className={`btn btn-ghost btn-sm ${maConfig.show7d ? 'active' : ''}`}
            onClick={() => toggleMA('show7d')}
            aria-pressed={maConfig.show7d}
          >
            MA-7
          </button>
          <button
            id="toggle-ma-14"
            className={`btn btn-ghost btn-sm ${maConfig.show14d ? 'active' : ''}`}
            onClick={() => toggleMA('show14d')}
            aria-pressed={maConfig.show14d}
          >
            MA-14
          </button>
          <button
            id="toggle-ma-30"
            className={`btn btn-ghost btn-sm ${maConfig.show30d ? 'active' : ''}`}
            onClick={() => toggleMA('show30d')}
            aria-pressed={maConfig.show30d}
          >
            MA-30
          </button>
        </div>
      </div>
    </div>
  )
}
