'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './page.module.css'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      if (!res.ok) {
        const json = await res.json()
        setError(json.error ?? 'Login gagal')
        return
      }

      router.push('/admin')
    } catch {
      setError('Terjadi kesalahan. Coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.icon}>🪙</span>
          <h1 className={`heading ${styles.title}`}>Admin Login</h1>
          <p className="text-muted">Gold Tracker — Panel Admin</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className="input-group">
            <label htmlFor="admin-password" className="input-label">
              Password Admin
            </label>
            <input
              id="admin-password"
              type="password"
              className="input"
              placeholder="Masukkan password..."
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <div className={styles.errorMsg} role="alert">
              ⚠️ {error}
            </div>
          )}

          <button
            id="login-submit-btn"
            type="submit"
            className="btn btn-primary"
            disabled={loading || !password}
            style={{ width: '100%' }}
          >
            {loading ? 'Masuk...' : 'Masuk ke Admin Panel'}
          </button>
        </form>

        <a href="/" className={styles.backLink}>← Kembali ke Dashboard</a>
      </div>
    </div>
  )
}
