'use client'

import { useState } from 'react'
import { formatRupiah } from '@/lib/format'
import styles from './NasrilInput.module.css'

interface Props {
  onSaved?: () => void
}

export default function NasrilInput({ onSaved }: Props) {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' })

  const [date, setDate] = useState(today)
  const [priceRaw, setPriceRaw] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [open, setOpen] = useState(false)

  // Format as user types: allow digits only, show as Rp number
  const handlePriceChange = (val: string) => {
    const digits = val.replace(/\D/g, '')
    setPriceRaw(digits)
  }

  const priceNum = parseInt(priceRaw, 10) || 0
  const pricePreview = priceNum > 0 ? formatRupiah(priceNum) : ''

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!priceNum || priceNum < 1_000_000) {
      setStatus('error')
      setMessage('Harga minimal Rp 1.000.000')
      return
    }

    setStatus('loading')
    setMessage('')

    try {
      const res = await fetch('/api/prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, price_sell: priceNum, notes: notes || null }),
      })

      const json = await res.json()

      if (!res.ok) {
        throw new Error(json.error ?? `HTTP ${res.status}`)
      }

      setStatus('success')
      setMessage(`✅ Harga Nasril ${formatRupiah(priceNum)} untuk ${date} berhasil disimpan!`)
      setPriceRaw('')
      setNotes('')
      setOpen(false)
      onSaved?.()
    } catch (err) {
      setStatus('error')
      setMessage(`❌ Gagal menyimpan: ${String(err)}`)
    }
  }

  return (
    <div className={styles.wrapper}>
      {/* ── Toggle button ── */}
      <button
        type="button"
        id="nasril-input-toggle"
        onClick={() => setOpen(v => !v)}
        className={`btn btn-sm ${open ? 'btn-ghost' : 'btn-primary'} ${styles.toggleBtn}`}
        aria-expanded={open}
      >
        <span>{open ? '✕ Tutup' : '+ Input Harga Nasril'}</span>
      </button>

      {/* ── Inline success toast (outside form) ── */}
      {status === 'success' && !open && (
        <p className={styles.successToast}>{message}</p>
      )}

      {/* ── Collapsible form ── */}
      {open && (
        <div className={styles.formCard} role="dialog" aria-label="Input Harga Nasril">
          <div className={styles.formHeader}>
            <h3 className={styles.formTitle}>Input Harga Nasril</h3>
            <p className={styles.formSub}>Harga manual dari toko Nasril</p>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.row}>
              {/* Date */}
              <div className={styles.field}>
                <label htmlFor="nasril-date" className={styles.label}>Tanggal</label>
                <input
                  id="nasril-date"
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  max={today}
                  className={`input ${styles.input}`}
                  required
                />
              </div>

              {/* Price */}
              <div className={styles.field}>
                <label htmlFor="nasril-price" className={styles.label}>
                  Harga Jual (Rp/gram)
                </label>
                <input
                  id="nasril-price"
                  type="text"
                  inputMode="numeric"
                  placeholder="2900000"
                  value={priceRaw}
                  onChange={e => handlePriceChange(e.target.value)}
                  className={`input ${styles.input}`}
                  required
                />
                {pricePreview && (
                  <span className={styles.pricePreview}>{pricePreview}</span>
                )}
              </div>
            </div>

            {/* Notes */}
            <div className={styles.field}>
              <label htmlFor="nasril-notes" className={styles.label}>
                Catatan <span className={styles.optional}>(opsional)</span>
              </label>
              <input
                id="nasril-notes"
                type="text"
                placeholder="cth: Harga promo, dapat diskon, dll"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                maxLength={200}
                className={`input ${styles.input}`}
              />
            </div>

            {/* Status message */}
            {message && status !== 'success' && (
              <p className={`${styles.statusMsg} ${status === 'error' ? styles.error : ''}`}>
                {message}
              </p>
            )}

            {/* Actions */}
            <div className={styles.actions}>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn btn-ghost btn-sm"
              >
                Batal
              </button>
              <button
                type="submit"
                id="nasril-submit-btn"
                disabled={status === 'loading' || !priceNum}
                className="btn btn-primary btn-sm"
              >
                {status === 'loading' ? 'Menyimpan...' : 'Simpan Harga'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
