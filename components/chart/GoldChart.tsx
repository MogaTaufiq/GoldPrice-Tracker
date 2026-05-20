'use client'

import { useRef } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  type ChartDataset,
  type TooltipItem,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import type { GoldPrice, MAOverlayConfig } from '@/types'
import { computeAllSMAs, interpolateGaps } from '@/lib/calculations/moving-average'
import { formatRupiah, formatDate } from '@/lib/format'
import styles from './GoldChart.module.css'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

interface Props {
  prices: GoldPrice[]
  allDates: string[]
  maConfig: MAOverlayConfig
  loading: boolean
}

// Source colors
const C = {
  antamJual:     '#f5a623',
  antamBeli:     '#d4891c',
  international: '#4a90e2',
  nasril:        '#27ae60',
}

const MA_COLORS: Record<number, string> = {
  7:  'rgba(255,255,255,0.3)',
  14: 'rgba(255,220,80,0.45)',
  30: 'rgba(245,166,35,0.65)',
}

// ─── Gap normalisation ────────────────────────────────────────────
// For Antam / International: linear interpolation across gaps.
// Already implemented in moving-average.ts, but we also need to
// handle leading/trailing nulls by clamping to nearest known value.
// This is identical to interpolateGaps — already correct.
// For Nasril: no interpolation, spanGaps: false creates visual breaks.
// ─────────────────────────────────────────────────────────────────

export default function GoldChart({ prices, allDates, maConfig, loading }: Props) {
  const chartRef = useRef(null)

  // ── Loading skeleton ──────────────────────────────────────────
  if (loading) {
    return (
      <div className={styles.loadingWrapper}>
        <div className={styles.loadingPulse}>
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className={`skeleton ${styles.loadingBar}`}
              style={{
                height: `${20 + (i % 3) * 25}%`,
                animationDelay: `${i * 80}ms`,
              }}
            />
          ))}
        </div>
        <p className="text-muted" style={{ textAlign: 'center', marginTop: 'var(--sp-4)' }}>
          Memuat grafik...
        </p>
      </div>
    )
  }

  // ── Empty state ──────────────────────────────────────────────
  if (allDates.length === 0) {
    return (
      <div className={styles.emptyState}>
        <span style={{ fontSize: '2.5rem' }}>📉</span>
        <p className="text-muted">Belum ada data untuk periode ini.</p>
      </div>
    )
  }

  // ── Build aligned series ─────────────────────────────────────
  const antamMap       = new Map(prices.filter(p => p.source === 'antam').map(p => [p.date, p]))
  const intlMap        = new Map(prices.filter(p => p.source === 'international').map(p => [p.date, p]))
  const nasrilMap      = new Map(prices.filter(p => p.source === 'nasril').map(p => [p.date, p]))

  const rawAntamJual:  (number | null)[] = allDates.map(d => antamMap.get(d)?.price_sell ?? null)
  const rawAntamBeli:  (number | null)[] = allDates.map(d => antamMap.get(d)?.price_buy  ?? null)
  const rawIntl:       (number | null)[] = allDates.map(d => intlMap.get(d)?.price_sell  ?? null)
  const rawNasril:     (number | null)[] = allDates.map(d => nasrilMap.get(d)?.price_sell ?? null)

  // Interpolate gaps for market data (Antam + International) and Nasril
  const antamJualFilled = interpolateGaps(rawAntamJual)
  const antamBeliFilled = interpolateGaps(rawAntamBeli)
  const intlFilled      = interpolateGaps(rawIntl)
  const nasrilFilled    = interpolateGaps(rawNasril)

  // ── Build Chart.js datasets ──────────────────────────────────
  const datasets: ChartDataset<'line', (number | null)[]>[] = [
    {
      label: 'Antam Jual',
      data: antamJualFilled,
      borderColor: C.antamJual,
      backgroundColor: 'rgba(245,166,35,0.06)',
      borderWidth: 2.5,
      pointRadius: 0,
      pointHoverRadius: 5,
      pointHoverBackgroundColor: C.antamJual,
      tension: 0.3,
      fill: false,
      spanGaps: true,
    },
    {
      label: 'Antam Beli',
      data: antamBeliFilled,
      borderColor: C.antamBeli,
      backgroundColor: 'rgba(212,137,28,0.04)',
      borderWidth: 2,
      borderDash: [4, 3],
      pointRadius: 0,
      pointHoverRadius: 5,
      pointHoverBackgroundColor: C.antamBeli,
      tension: 0.3,
      fill: false,
      spanGaps: true,
    },
    {
      label: 'International',
      data: intlFilled,
      borderColor: C.international,
      backgroundColor: 'rgba(74,144,226,0.06)',
      borderWidth: 2.5,
      pointRadius: 0,
      pointHoverRadius: 5,
      pointHoverBackgroundColor: C.international,
      tension: 0.3,
      fill: false,
      spanGaps: true,
    },
    {
      label: 'Nasril',
      // Interpolate gaps to ensure the line is never broken
      data: nasrilFilled,
      borderColor: C.nasril,
      backgroundColor: 'rgba(39,174,96,0.06)',
      borderWidth: 2.5,
      pointRadius: (ctx) => {
        // Show dot only where original data exists
        return rawNasril[ctx.dataIndex] !== null ? 4 : 0
      },
      pointHoverRadius: 6,
      pointBackgroundColor: C.nasril,
      pointHoverBackgroundColor: C.nasril,
      tension: 0.2,
      fill: false,
      spanGaps: true,
    },
  ]

  // ── MA overlays ───────────────────────────────────────────────
  const maWindows = [7, 14, 30] as const
  for (const w of maWindows) {
    const key = `show${w}d` as keyof MAOverlayConfig
    if (!maConfig[key]) continue

    const smas = computeAllSMAs(rawAntamJual, rawAntamBeli, rawIntl, rawNasril, w)
    datasets.push({
      label: `MA-${w}`,
      data: smas.antamJual as (number | null)[],
      borderColor: MA_COLORS[w],
      borderWidth: 1.5,
      borderDash: [6, 4],
      pointRadius: 0,
      fill: false,
      spanGaps: true,
      tension: 0.3,
    })
  }

  // ── Chart options ─────────────────────────────────────────────
  const minVal = Math.min(
    ...[...antamJualFilled, ...intlFilled].filter((v): v is number => v !== null)
  )
  const maxVal = Math.max(
    ...[...antamJualFilled, ...intlFilled].filter((v): v is number => v !== null)
  )
  const padding = (maxVal - minVal) * 0.08

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    animation: { duration: 400 },
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        align: 'start' as const,
        labels: {
          color: 'rgba(255,255,255,0.6)',
          font: { size: 11, family: "'Inter', system-ui" },
          padding: 16,
          usePointStyle: true,
          pointStyleWidth: 20,
          boxHeight: 2,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(10,10,20,0.95)',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        titleColor: 'rgba(255,255,255,0.85)',
        bodyColor: 'rgba(255,255,255,0.65)',
        padding: 14,
        callbacks: {
          title: (items: TooltipItem<'line'>[]) => items[0]?.label ?? '',
          label: (ctx: TooltipItem<'line'>) => {
            if (ctx.parsed.y === null || ctx.parsed.y === undefined) return ''
            return `  ${ctx.dataset.label ?? ''}: ${formatRupiah(ctx.parsed.y)}`
          },
        },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255,255,255,0.03)', drawTicks: false },
        border: { color: 'rgba(255,255,255,0.06)' },
        ticks: {
          color: 'rgba(255,255,255,0.35)',
          font: { size: 10, family: "'Inter', system-ui" },
          maxTicksLimit: 10,
          maxRotation: 0,
          padding: 8,
        },
      },
      y: {
        min: minVal - padding > 0 ? minVal - padding : undefined,
        max: maxVal + padding,
        grid: { color: 'rgba(255,255,255,0.04)', drawTicks: false },
        border: { color: 'rgba(255,255,255,0.06)', dash: [4, 4] },
        ticks: {
          color: 'rgba(255,255,255,0.35)',
          font: { size: 10, family: "'Inter', system-ui" },
          maxTicksLimit: 7,
          padding: 10,
          callback: (value: string | number) =>
            typeof value === 'number' ? formatRupiah(value) : value,
        },
      },
    },
  }

  return (
    <div className={styles.chartContainer}>
      <Line
        ref={chartRef}
        data={{
          labels: allDates.map(formatDate),
          datasets,
        }}
        options={options}
      />
    </div>
  )
}
