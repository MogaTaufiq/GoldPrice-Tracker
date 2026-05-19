// Shared number and date formatting utilities
// Always import from here — never inline format logic in components

/**
 * Format IDR gold price as "Rp 1,05 jt" or "Rp 980.000"
 */
export function formatRupiah(value: number | null): string {
  if (value === null || isNaN(value)) return '—'
  if (value >= 1_000_000) {
    return `Rp ${(value / 1_000_000).toFixed(2).replace('.', ',')} jt`
  }
  return `Rp ${value.toLocaleString('id-ID')}`
}

/**
 * Format percentage change with sign: "+2.34%" or "-1.20%"
 */
export function formatPercent(value: number | null): string {
  if (value === null || isNaN(value)) return '—'
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

/**
 * Format date string 'YYYY-MM-DD' to Indonesian locale: "15 Jan 2025"
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Format a full ISO timestamp to Jakarta time: "12:00 WIB, 15 Jan 2025"
 */
export function formatTimestampWIB(isoString: string): string {
  const date = new Date(isoString)
  const time = date.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  })
  const dateStr = date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  })
  return `${time} WIB, ${dateStr}`
}

/**
 * Get today's date string in 'YYYY-MM-DD' format (Jakarta timezone)
 */
export function getTodayWIB(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' })
}

/**
 * Compute percentage change from old to new value
 */
export function percentChange(oldVal: number | null, newVal: number | null): number | null {
  if (oldVal === null || newVal === null || oldVal === 0) return null
  return ((newVal - oldVal) / oldVal) * 100
}
