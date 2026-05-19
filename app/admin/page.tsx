'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import NasrilInput from '@/components/dashboard/NasrilInput'
import styles from './page.module.css'

export default function AdminPage() {
  const router = useRouter()
  const [fetchingToday, setFetchingToday] = useState(false)
  const [fetchMsg, setFetchMsg] = useState<string | null>(null)

  const handleLogout = () => {
    document.cookie = 'invest_admin_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT'
    router.push('/')
  }

  const fetchToday = useCallback(async () => {
    setFetchingToday(true)
    setFetchMsg(null)
    try {
      const res = await fetch('/api/fetch', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
      
      const results = json.results as Array<{ source: string; ok: boolean; error?: string }>
      const ok = results.filter(r => r.ok).map(r => r.source)
      const fail = results.filter(r => !r.ok).map(r => `${r.source}: ${r.error}`)
      
      let msg = ok.length > 0 ? `✅ Berhasil: ${ok.join(', ')}` : ''
      if (fail.length > 0) msg += (msg ? ' | ' : '') + `⚠️ ${fail.join(', ')}`
      
      setFetchMsg(msg || '✅ Selesai')
    } catch (err) {
      setFetchMsg(`❌ ${String(err)}`)
    } finally {
      setFetchingToday(false)
    }
  }, [])

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className="container">
          <div className={styles.headerInner}>
            <div className={styles.brand}>
              <span className={styles.brandIcon}>🔐</span>
              <div>
                <h1 className={styles.brandTitle}>Admin Panel</h1>
                <p className={styles.brandSub}>Manajemen Data Emas</p>
              </div>
            </div>
            <div className={styles.actions}>
              <a href="/" className="btn btn-ghost btn-sm">Lihat Dashboard</a>
              <button onClick={handleLogout} className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }}>
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="container">
        <div className={styles.mainGrid}>
          {/* Action: Manual Fetch */}
          <section className={`card ${styles.section}`}>
            <div className={styles.sectionHeader}>
              <div>
                <h2 className={styles.sectionTitle}>Fetch API Otomatis</h2>
                <p className="text-muted" style={{ fontSize: '0.85rem', margin: '4px 0 0 0' }}>
                  Tarik harga hari ini dari Antam & International
                </p>
              </div>
              <button
                onClick={fetchToday}
                disabled={fetchingToday}
                className="btn btn-sm btn-primary"
              >
                {fetchingToday ? '⏳ Fetching...' : '🔄 Fetch Sekarang'}
              </button>
            </div>
            {fetchMsg && (
              <div className={styles.fetchMsg} style={{ color: fetchMsg.includes('❌') ? 'var(--color-danger)' : 'var(--color-text-secondary)' }}>
                {fetchMsg}
              </div>
            )}
          </section>

          {/* Action: Nasril Input */}
          <section className={`card ${styles.section}`}>
            <div className={styles.sectionHeader}>
              <div>
                <h2 className={styles.sectionTitle}>Input Harga Nasril</h2>
                <p className="text-muted" style={{ fontSize: '0.85rem', margin: '4px 0 0 0' }}>
                  Masukkan harga manual dari grup WhatsApp
                </p>
              </div>
            </div>
            <NasrilInput onSaved={() => setFetchMsg('✅ Harga Nasril berhasil disimpan!')} />
          </section>
          
          {/* Placeholder for Data Table / Edit / Logs later */}
          <section className={`card ${styles.section}`} style={{ gridColumn: '1 / -1' }}>
            <h2 className={styles.sectionTitle}>Tabel Editor & Log (Segera Hadir)</h2>
            <p className="text-muted" style={{ fontSize: '0.9rem', marginTop: 'var(--sp-2)' }}>
              Fitur untuk mengedit/menghapus data dan melihat log error akan ditambahkan di sini.
            </p>
          </section>
        </div>
      </main>
    </div>
  )
}
