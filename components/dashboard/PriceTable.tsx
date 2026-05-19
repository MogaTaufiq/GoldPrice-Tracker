'use client'

import type { GoldPrice } from '@/types'
import { formatRupiah, formatDate } from '@/lib/format'
import styles from './PriceTable.module.css'

interface Props {
  prices: GoldPrice[]
  allDates: string[]
  loading: boolean
}

export default function PriceTable({ prices, allDates, loading }: Props) {
  if (loading) {
    return (
      <div className={styles.wrapper}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={`skeleton ${styles.skeletonRow}`} style={{ animationDelay: `${i * 60}ms` }} />
        ))}
      </div>
    )
  }

  if (allDates.length === 0) {
    return <p className="text-muted" style={{ padding: 'var(--sp-4) 0' }}>Tidak ada data.</p>
  }

  // Build lookup maps
  const antamMap = new Map(prices.filter(p => p.source === 'antam').map(p => [p.date, p]))
  const intlMap = new Map(prices.filter(p => p.source === 'international').map(p => [p.date, p]))
  const nasrilMap = new Map(prices.filter(p => p.source === 'nasril').map(p => [p.date, p]))

  // Newest first
  const sortedDates = [...allDates].sort((a, b) => b.localeCompare(a))

  function getRowStatus(date: string): 'ok' | 'partial' | 'missing' {
    const hasAntam = antamMap.has(date)
    const hasIntl = intlMap.has(date)
    const hasNasril = nasrilMap.has(date)
    if (hasAntam && hasIntl) return hasNasril ? 'ok' : 'partial'  // Nasril missing = still partial but expected
    if (!hasAntam && !hasIntl) return 'missing'
    return 'partial'
  }

  return (
    <div className={styles.tableWrapper} id="price-data-table">
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.thDate}>Tanggal</th>
            <th className={styles.thPrice} style={{ color: 'var(--color-antam-jual)' }}>Antam Jual</th>
            <th className={styles.thPrice} style={{ color: 'var(--color-antam-beli)' }}>Antam Beli</th>
            <th className={styles.thPrice} style={{ color: 'var(--color-international)' }}>International</th>
            <th className={styles.thPrice} style={{ color: 'var(--color-nasril)' }}>Nasril</th>
            <th className={styles.thStatus}>Status</th>
          </tr>
        </thead>
        <tbody>
          {sortedDates.map((date) => {
            const antam = antamMap.get(date)
            const intl = intlMap.get(date)
            const nasril = nasrilMap.get(date)
            const status = getRowStatus(date)

            return (
              <tr key={date} className={styles.row}>
                <td className={styles.tdDate}>{formatDate(date)}</td>
                <td className={styles.tdPrice}>
                  {antam?.price_sell ? formatRupiah(antam.price_sell) : <span className={styles.empty}>—</span>}
                </td>
                <td className={styles.tdPrice}>
                  {antam?.price_buy ? formatRupiah(antam.price_buy) : <span className={styles.empty}>—</span>}
                </td>
                <td className={styles.tdPrice}>
                  {intl?.price_sell ? formatRupiah(intl.price_sell) : <span className={styles.empty}>—</span>}
                </td>
                <td className={styles.tdPrice}>
                  {nasril?.price_sell ? formatRupiah(nasril.price_sell) : <span className={styles.empty}>—</span>}
                </td>
                <td className={styles.tdStatus}>
                  {status === 'ok'      && <span className="badge badge-success">✅ OK</span>}
                  {status === 'partial' && <span className="badge badge-warning">⚠️ Partial</span>}
                  {status === 'missing' && <span className="badge badge-error">❌ Missing</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
