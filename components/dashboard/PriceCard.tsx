'use client'

import type { PriceCardData } from '@/types'
import { formatRupiah, formatPercent, formatDate } from '@/lib/format'
import styles from './PriceCard.module.css'

interface Props {
  data: PriceCardData
  animationDelay?: number
}

const SOURCE_CONFIG = {
  antam:         { label: 'Antam Jual', icon: '🏅', color: 'var(--color-antam-jual)' },
  international: { label: 'International', icon: '🌍', color: 'var(--color-international)' },
  nasril:        { label: 'Nasril', icon: '🏪', color: 'var(--color-nasril)' },
}

const TREND_CONFIG = {
  murah:  { label: '🟢 Murah', className: 'badge-murah' },
  normal: { label: '🟡 Normal', className: 'badge-normal' },
  mahal:  { label: '🔴 Mahal', className: 'badge-mahal' },
}

export default function PriceCard({ data, animationDelay = 0 }: Props) {
  const config = SOURCE_CONFIG[data.source]
  const trend = data.trendSignal ? TREND_CONFIG[data.trendSignal] : null

  const changeYesterdayPositive = (data.changeVsYesterday ?? 0) >= 0
  const change30dPositive = (data.changeVs30d ?? 0) >= 0

  return (
    <div
      className={`card ${styles.card} animate-fade-in-up`}
      style={{
        animationDelay: `${animationDelay}ms`,
        '--source-color': config.color,
      } as React.CSSProperties}
      id={`price-card-${data.source}`}
    >
      {/* Accent line */}
      <div className={styles.accentLine} />

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.sourceInfo}>
          <span className={styles.icon}>{config.icon}</span>
          <span className={styles.sourceLabel}>{config.label}</span>
        </div>
        {trend && (
          <span className={`badge ${trend.className} ${styles.trendBadge}`}>
            {trend.label}
          </span>
        )}
      </div>

      {/* Main price */}
      <div className={styles.priceBlock}>
        <div className={`price-value ${styles.mainPrice}`}>
          {data.latestPrice ? formatRupiah(data.latestPrice) : '—'}
        </div>
        {data.latestDate && (
          <div className="text-muted">{formatDate(data.latestDate)}</div>
        )}
      </div>

      {/* Change stats */}
      <div className={styles.stats}>
        <div className={styles.statItem}>
          <span className="text-muted">vs Kemarin</span>
          <span className={`${styles.changeVal} ${data.changeVsYesterday !== null ? (changeYesterdayPositive ? styles.positive : styles.negative) : ''}`}>
            {data.changeVsYesterday !== null ? formatPercent(data.changeVsYesterday) : '—'}
          </span>
        </div>
        <div className={styles.statItem}>
          <span className="text-muted">vs 30 hari</span>
          <span className={`${styles.changeVal} ${data.changeVs30d !== null ? (change30dPositive ? styles.positive : styles.negative) : ''}`}>
            {data.changeVs30d !== null ? formatPercent(data.changeVs30d) : '—'}
          </span>
        </div>
      </div>

      {/* High / Low */}
      {(data.periodHigh || data.periodLow) && (
        <div className={styles.highLow}>
          <div className={styles.hlItem}>
            <span className={styles.hlLabel}>↑ Tertinggi</span>
            <span className={styles.hlValue}>{data.periodHigh ? formatRupiah(data.periodHigh) : '—'}</span>
          </div>
          <div className={styles.hlItem}>
            <span className={styles.hlLabel}>↓ Terendah</span>
            <span className={styles.hlValue}>{data.periodLow ? formatRupiah(data.periodLow) : '—'}</span>
          </div>
        </div>
      )}
    </div>
  )
}
