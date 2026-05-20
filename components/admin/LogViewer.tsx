'use client'

import { useState, useEffect, useCallback } from 'react'
import type { FetchLog } from '@/types'
import { formatTimestampWIB } from '@/lib/format'
import styles from './LogViewer.module.css'

type StatusFilter = 'all' | 'success' | 'error' | 'partial'

export default function LogViewer() {
  const [logs, setLogs] = useState<FetchLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const limit = 20

  const fetchLogs = useCallback(async (p: number) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        page: String(p),
        limit: String(limit),
        ...(statusFilter !== 'all' && { status: statusFilter }),
      })
      const res = await fetch(`/api/logs?${params}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
      setLogs(json.data)
      setTotalCount(json.total)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchLogs(page)
  }, [page, fetchLogs])

  const totalPages = Math.ceil(totalCount / limit)

  function getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'success': return 'badge-success'
      case 'error': return 'badge-error'
      case 'partial': return 'badge-warning'
      default: return 'badge'
    }
  }

  function getStatusIcon(status: string): string {
    switch (status) {
      case 'success': return '✅'
      case 'error': return '❌'
      case 'partial': return '⚠️'
      default: return '•'
    }
  }

  return (
    <div className={styles.container}>
      {/* Header + Filter */}
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>📋 Error Log Viewer</h3>
          <p className={styles.subtitle}>Lihat history fetch API Antam & International</p>
        </div>
        
        <div className={styles.filters}>
          <label className={styles.filterLabel}>Filter Status:</label>
          <div className={styles.filterButtons}>
            {(['all', 'success', 'error', 'partial'] as StatusFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => {
                  setStatusFilter(f)
                  setPage(1)
                }}
                className={`btn btn-sm ${statusFilter === f ? 'btn-primary' : 'btn-ghost'}`}
              >
                {f === 'all' ? 'Semua' : f === 'success' ? '✅ Sukses' : f === 'error' ? '❌ Error' : '⚠️ Partial'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      {error && (
        <div className="alert alert-error" style={{ marginBottom: 'var(--sp-3)' }}>
          <span>⚠️ {error}</span>
        </div>
      )}

      {loading ? (
        <div className={styles.skeleton}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ animationDelay: `${i * 60}ms`, borderRadius: '0.5rem', height: '2.5rem', background: 'var(--color-bg-secondary)' }} className="skeleton" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <p className="text-muted" style={{ padding: 'var(--sp-4) 0', textAlign: 'center' }}>
          {statusFilter === 'all' ? 'Belum ada log.' : `Tidak ada log dengan status "${statusFilter}".`}
        </p>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.thTime}>Waktu (WIB)</th>
                <th className={styles.thSource}>Source</th>
                <th className={styles.thStatus}>Status</th>
                <th className={styles.thMessage}>Message</th>
                <th className={styles.thDuration}>Duration</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className={styles.row}>
                  <td className={styles.tdTime}>
                    <span className={styles.monospace}>{formatTimestampWIB(log.fetched_at)}</span>
                  </td>
                  <td className={styles.tdSource}>
                    <span className={styles.badge}>{log.source}</span>
                  </td>
                  <td className={styles.tdStatus}>
                    <span className={`badge ${getStatusBadgeClass(log.status)}`}>
                      {getStatusIcon(log.status)} {log.status}
                    </span>
                  </td>
                  <td className={styles.tdMessage}>
                    {log.message ? (
                      <span className={styles.message} title={log.message}>
                        {log.message}
                      </span>
                    ) : (
                      <span className={styles.empty}>—</span>
                    )}
                  </td>
                  <td className={styles.tdDuration}>
                    {log.duration_ms ? (
                      <span className={styles.monospace}>{log.duration_ms}ms</span>
                    ) : (
                      <span className={styles.empty}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn btn-sm btn-ghost"
          >
            ← Sebelumnya
          </button>
          <span className={styles.pageInfo}>
            Hal. {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="btn btn-sm btn-ghost"
          >
            Selanjutnya →
          </button>
        </div>
      )}
    </div>
  )
}
