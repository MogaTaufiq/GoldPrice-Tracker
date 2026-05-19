'use client'

import { useState, useEffect, useCallback } from 'react'
import type { GoldPrice, DateRange, MAOverlayConfig, PriceCardData } from '@/types'
import { computePriceCardData } from '@/lib/calculations/stats'
import GoldChart from '@/components/chart/GoldChart'
import ChartControls from '@/components/chart/ChartControls'
import PriceCard from '@/components/dashboard/PriceCard'
import PriceTable from '@/components/dashboard/PriceTable'
import FetchStatusBar from '@/components/dashboard/FetchStatusBar'
import styles from './page.module.css'

export default function DashboardPage() {
  const [prices, setPrices] = useState<GoldPrice[]>([])
  const [range, setRange] = useState<DateRange>('30d')
  const [maConfig, setMAConfig] = useState<MAOverlayConfig>({ show7d: false, show14d: false, show30d: true })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadPrices = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/prices?range=${range}`)
      if (!res.ok) throw new Error('Gagal memuat data harga')
      const json = await res.json()
      setPrices(json.data ?? [])
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [range])

  useEffect(() => { loadPrices() }, [loadPrices])

  // Build sorted unique date labels
  const allDates = [...new Set(prices.map(p => p.date))].sort()

  // Group by source
  const bySource = {
    antam: prices.filter(p => p.source === 'antam').sort((a, b) => a.date.localeCompare(b.date)),
    international: prices.filter(p => p.source === 'international').sort((a, b) => a.date.localeCompare(b.date)),
    nasril: prices.filter(p => p.source === 'nasril').sort((a, b) => a.date.localeCompare(b.date)),
  }

  // Card data
  const cards: PriceCardData[] = ['antam', 'international', 'nasril'].map(source =>
    computePriceCardData(
      source as 'antam' | 'international' | 'nasril',
      bySource[source as keyof typeof bySource],
      allDates
    )
  )

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <header className={styles.header}>
        <div className="container">
          <div className={styles.headerInner}>
            <div className={styles.brand}>
              <span className={styles.brandIcon}>🪙</span>
              <div>
                <h1 className={styles.brandTitle}>Gold Tracker</h1>
                <p className={styles.brandSub}>Harga Emas Keluarga</p>
              </div>
            </div>
            <div className={styles.headerActions}>
              <FetchStatusBar />
              <a href="/login" className="btn btn-ghost btn-sm" id="admin-login-btn">
                Admin
              </a>
            </div>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <div className="container">

          {/* ── Error state ── */}
          {error && (
            <div className={styles.errorBar} role="alert">
              ⚠️ {error}
              <button onClick={loadPrices} className={styles.retryBtn}>Coba lagi</button>
            </div>
          )}

          {/* ── Price Cards ── */}
          <section className={styles.cardsSection} aria-label="Ringkasan Harga">
            <div className={styles.cardsGrid}>
              {loading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className={`card ${styles.skeletonCard}`}>
                      <div className={`skeleton ${styles.skeletonLine}`} style={{ width: '60%', height: '14px' }} />
                      <div className={`skeleton ${styles.skeletonLine}`} style={{ width: '80%', height: '32px', margin: '12px 0' }} />
                      <div className={`skeleton ${styles.skeletonLine}`} style={{ width: '50%', height: '12px' }} />
                    </div>
                  ))
                : cards.map((card, i) => (
                    <PriceCard key={card.source} data={card} animationDelay={i * 50} />
                  ))
              }
            </div>
          </section>

          {/* ── Chart Section ── */}
          <section className={`card ${styles.chartSection}`} aria-label="Grafik Harga Emas">
            <div className={styles.chartHeader}>
              <h2 className={`heading ${styles.sectionTitle}`}>Grafik Harga</h2>
              <ChartControls
                range={range}
                onRangeChange={setRange}
                maConfig={maConfig}
                onMAConfigChange={setMAConfig}
              />
            </div>

            <div className={styles.chartWrapper} id="gold-price-chart">
              <GoldChart
                prices={prices}
                allDates={allDates}
                maConfig={maConfig}
                loading={loading}
              />
            </div>
          </section>

          {/* ── Data Table ── */}
          <section className={`card ${styles.tableSection}`} aria-label="Tabel Data Harga">
            <h2 className={`heading ${styles.sectionTitle}`}>Data Harga</h2>
            <PriceTable prices={prices} allDates={allDates} loading={loading} />
          </section>

        </div>
      </main>

      <footer className={styles.footer}>
        <div className="container">
          <p className="text-muted" style={{ textAlign: 'center' }}>
            Data otomatis diperbarui setiap hari pukul 12:00 WIB ·{' '}
            <a href="/admin" style={{ color: 'var(--color-text-muted)' }}>Admin Panel</a>
          </p>
        </div>
      </footer>
    </div>
  )
}
