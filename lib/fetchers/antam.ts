import { createServerSupabaseClient } from '@/lib/supabase'
import { logFetchError, logFetchSuccess } from '@/lib/fetch-logger'
import type { FetchResult } from '@/types'

const MIN_PRICE = 1_500_000
const MAX_PRICE = 6_000_000

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

interface AntamTodayResponse {
  status: string
  data: AntamPriceEntry[]
}

export async function fetchAntamPrice(
  triggeredBy: 'cron' | 'manual' = 'cron'
): Promise<FetchResult> {
  const start = Date.now()
  try {
    if (!ANTAM_API_KEY) {
      throw new Error('ANTAM_API_KEY tidak dikonfigurasi')
    }

    // GET /api/prices/today/antam — returns array of weights
    const res = await fetch(`${ANTAM_API_BASE}/prices/today/antam`, {
      headers: {
        'X-API-Key': ANTAM_API_KEY,
        'Accept': 'application/json',
      },
      next: { revalidate: 0 },
    })

    if (!res.ok) throw new Error(`Antam API HTTP ${res.status}`)

    const json: AntamTodayResponse = await res.json()

    if (json.status !== 'success' || !Array.isArray(json.data)) {
      throw new Error(`Antam API response tidak valid: ${json.status}`)
    }

    // Filter: 1 gram Antam dari source resmi
    const entry = json.data.find(
      d => d.weight === 1 && d.resource === 'antam'
    )

    if (!entry) {
      throw new Error('Antam 1g tidak ditemukan di response API')
    }

    const priceSell = entry.sell_price
    const priceBuy  = entry.buyback_price

    if (!priceSell || priceSell <= 0) throw new Error(`sell_price tidak valid: ${priceSell}`)
    if (!priceBuy  || priceBuy  <= 0) throw new Error(`buyback_price tidak valid: ${priceBuy}`)

    // Sanity check
    if (priceSell < MIN_PRICE || priceSell > MAX_PRICE) {
      throw new Error(`sell_price di luar rentang wajar: Rp ${priceSell.toLocaleString('id-ID')}`)
    }

    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' })
    const supabase = createServerSupabaseClient()
    const { error: dbError } = await supabase.from('gold_prices').upsert(
      {
        date: today,
        source: 'antam',
        price_sell: priceSell,
        price_buy: priceBuy,
        created_by: 'system',
        notes: entry.sell_price_change != null
          ? `Perubahan: ${entry.sell_price_change > 0 ? '+' : ''}${entry.sell_price_change.toLocaleString('id-ID')}`
          : null,
      },
      { onConflict: 'date,source' }
    )
    if (dbError) throw new Error(`DB upsert gagal: ${dbError.message}`)

    const duration = Date.now() - start
    await logFetchSuccess({
      source: 'antam',
      durationMs: duration,
      triggeredBy,
      message: `Jual: Rp ${priceSell.toLocaleString('id-ID')} | Beli: Rp ${priceBuy.toLocaleString('id-ID')}${entry.sell_price_change != null ? ` | Δ ${entry.sell_price_change > 0 ? '+' : ''}${entry.sell_price_change.toLocaleString('id-ID')}` : ''}`,
    })

    return { ok: true, source: 'antam', price: { price_sell: priceSell, price_buy: priceBuy } }
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
