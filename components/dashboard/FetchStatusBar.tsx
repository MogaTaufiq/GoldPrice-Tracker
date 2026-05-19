'use client'

import { useEffect, useState } from 'react'
import type { FetchLog } from '@/types'
import { formatTimestampWIB } from '@/lib/format'
import styles from './FetchStatusBar.module.css'

export default function FetchStatusBar() {
  const [lastLog, setLastLog] = useState<FetchLog | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadLastLog() {
      try {
        const res = await fetch('/api/logs?limit=1')
        if (!res.ok) return
        const json = await res.json()
        setLastLog(json.data?.[0] ?? null)
      } catch {
        // Silently fail — status bar is non-critical
      } finally {
        setLoading(false)
      }
    }
    loadLastLog()
  }, [])

  if (loading) {
    return <div className={`skeleton ${styles.skeleton}`} />
  }

  if (!lastLog) {
    return (
      <div className={`${styles.bar} ${styles.never}`}>
        <span className={styles.dot} />
        <span>Belum ada fetch</span>
      </div>
    )
  }

  const statusClass = lastLog.status === 'success' ? styles.success
    : lastLog.status === 'partial' ? styles.partial
    : styles.error

  const statusIcon = lastLog.status === 'success' ? '✅'
    : lastLog.status === 'partial' ? '⚠️'
    : '❌'

  return (
    <div className={`${styles.bar} ${statusClass}`} title={lastLog.message ?? undefined}>
      <span>{statusIcon}</span>
      <span className={styles.label}>
        {formatTimestampWIB(lastLog.fetched_at)}
      </span>
    </div>
  )
}
