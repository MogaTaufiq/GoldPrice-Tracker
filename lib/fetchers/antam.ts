import { createServerSupabaseClient } from '@/lib/supabase'
import { logFetchError, logFetchSuccess } from '@/lib/fetch-logger'
import type { FetchResult } from '@/types'

const MIN_PRICE = 1_000_000
const MAX_PRICE = 5_000_000

// emas.maulanar.my.id API docs:
// GET /api/prices/today/antam → array of prices per weight
// Filter: weight === 1 (1 gram), resource === 'antam'
const ANTAM_API_BASE = (process.env.ANTAM_API_BASE_URL ?? 'https://emas.maulanar.my.id/api')
  .replace(/\/+$/, '') // strip trailing slash
const ANTAM_API_KEY = process.env.ANTAM_API_KEY

interface AntamPriceEntry {
  brand: string
  resource: string
  weight: number
  sell_price: number
  buyback_price: number
  date: string
  updated_at: string
  sell_price_change?: number
  buyback_price_change?: number
}

function getLast30DaysWIB(): string[] {
  const wibDateStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' })
  const [year, month, day] = wibDateStr.split('-').map(Number)
  const dates: string[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(year, month - 1, day - i, 12, 0, 0)
    const dateStr = d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' })
    dates.push(dateStr)
  }
  return dates
}

export async function fetchAntamPrice(
  triggeredBy: 'cron' | 'manual' = 'cron'
): Promise<FetchResult> {
  const start = Date.now()
  try {
    if (!ANTAM_API_KEY) {
      throw new Error('ANTAM_API_KEY tidak dikonfigurasi')
    }

    // GET /api/prices — returns list of recent prices
    const res = await fetch(`${ANTAM_API_BASE}/prices?brand=ANTAM&resource=antam&weight=1&limit=30`, {
      headers: {
        'X-API-Key': ANTAM_API_KEY,
        'Accept': 'application/json',
      },
      next: { revalidate: 0 },
    })

    if (!res.ok) throw new Error(`Antam API HTTP ${res.status}`)

    const json = await res.json()

    if (json.status !== 'success' || !Array.isArray(json.data) || json.data.length === 0) {
      throw new Error(`Antam API response tidak valid atau kosong: ${json.status}`)
    }

    const sortedApiEntries = [...json.data]
      .filter((d: AntamPriceEntry) => d.weight === 1 && d.resource === 'antam')
      .sort((a: AntamPriceEntry, b: AntamPriceEntry) => a.updated_at.localeCompare(b.updated_at))

    if (sortedApiEntries.length === 0) {
      throw new Error('Tidak ada data Antam 1g valid di response API')
    }

    const dates = getLast30DaysWIB()
    const apiPricesMap = new Map<string, AntamPriceEntry>()
    for (const entry of sortedApiEntries) {
      apiPricesMap.set(entry.updated_at, entry)
    }

    const rows = []
    let lastSeenEntry: AntamPriceEntry | null = null
    const startDate = dates[0]

    // Seed lastSeenEntry with the latest available entry that is BEFORE the start of our 30-day range
    for (const entry of sortedApiEntries) {
      if (entry.updated_at < startDate) {
        lastSeenEntry = entry
      } else {
        break
      }
    }

    for (const date of dates) {
      const entry = apiPricesMap.get(date)
      if (entry) {
        lastSeenEntry = entry
      }

      if (lastSeenEntry) {
        const priceSell = lastSeenEntry.sell_price
        const priceBuy  = lastSeenEntry.buyback_price

        // Sanity check
        if (priceSell >= MIN_PRICE && priceSell <= MAX_PRICE && priceBuy > 0) {
          rows.push({
            date,
            source: 'antam',
            price_sell: priceSell,
            price_buy: priceBuy,
            created_by: 'system',
            notes: entry ? (entry.sell_price_change != null
              ? `Perubahan: ${entry.sell_price_change > 0 ? '+' : ''}${entry.sell_price_change.toLocaleString('id-ID')}`
              : null) : 'Filled from previous day',
          })
        }
      }
    }

    if (rows.length === 0) {
      throw new Error('Tidak ada baris data Antam valid setelah pemrosesan dan sanity check')
    }

    const supabase = createServerSupabaseClient()
    const { error: dbError } = await supabase.from('gold_prices').upsert(
      rows,
      { onConflict: 'date,source' }
    )
    if (dbError) throw new Error(`DB upsert gagal: ${dbError.message}`)

    const duration = Date.now() - start
    const latestRow = rows[rows.length - 1]
    await logFetchSuccess({
      source: 'antam',
      durationMs: duration,
      triggeredBy,
      message: `Retroactive fetch selesai. Diperbarui ${rows.length} hari. Terbaru (${latestRow.date}): Jual: Rp ${latestRow.price_sell.toLocaleString('id-ID')} | Beli: Rp ${latestRow.price_buy.toLocaleString('id-ID')}`,
    })

    return { ok: true, source: 'antam', price: { price_sell: latestRow.price_sell, price_buy: latestRow.price_buy } }
  } catch (err) {
    const duration = Date.now() - start
    await logFetchError({
      source: 'antam',
      durationMs: duration,
      errorMessage: String(err),
      triggeredBy,
    })
    return { ok: false, source: 'antam', error: String(err) }
  }
}
