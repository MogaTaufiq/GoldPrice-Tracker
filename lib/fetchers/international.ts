import { createServerSupabaseClient } from '@/lib/supabase'
import { logFetchSuccess, logFetchError } from '@/lib/fetch-logger'
import type { FetchResult } from '@/types'

const MIN_PRICE = 1_000_000
const MAX_PRICE = 5_000_000

// Troy ounce to gram conversion
const TROY_OZ_TO_GRAM = 31.1035

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

// International gold price (XAU) from Yahoo Finance, converted to IDR via Frankfurter
export async function fetchInternationalPrice(
  triggeredBy: 'cron' | 'manual' = 'cron'
): Promise<FetchResult> {
  const start = Date.now()
  try {
    // Step 1: Fetch Yahoo Finance data for the last 60 days to ensure enough overlap
    const yahooRes = await fetch(
      'https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1d&range=60d',
      {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        next: { revalidate: 0 },
      }
    )
    if (!yahooRes.ok) throw new Error(`Yahoo Finance returned HTTP ${yahooRes.status}`)

    const yahooData = await yahooRes.json()
    const result = yahooData?.chart?.result?.[0]
    const timestamps: number[] = result?.timestamp ?? []
    const closes: (number | null)[] = result?.indicators?.quote?.[0]?.close ?? []

    if (timestamps.length === 0 || closes.length === 0) {
      throw new Error('Yahoo Finance: Response kosong atau format tidak sesuai')
    }

    // Step 2: Map Yahoo prices and identify the start and end dates in Jakarta time
    const yahooPrices = new Map<string, number>()
    for (let i = 0; i < timestamps.length; i++) {
      const ts = timestamps[i]
      const price = closes[i]
      if (price !== null && price !== undefined && price > 0) {
        const dateStr = new Date(ts * 1000).toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' })
        yahooPrices.set(dateStr, price)
      }
    }

    const availableYahooDates = Array.from(yahooPrices.keys()).sort()
    if (availableYahooDates.length === 0) {
      throw new Error('Tidak ada data harga valid dari Yahoo Finance')
    }

    const startDate = availableYahooDates[0]
    const endDate = availableYahooDates[availableYahooDates.length - 1]

    // Step 3: Fetch USD -> IDR exchange rates from Frankfurter for this date range
    const fxRes = await fetch(`https://api.frankfurter.app/${startDate}..${endDate}?from=USD&to=IDR`, {
      redirect: 'follow',
      next: { revalidate: 0 },
    })
    if (!fxRes.ok) throw new Error(`Frankfurter returned HTTP ${fxRes.status}`)

    const fxData = await fxRes.json()
    const rates: Record<string, { IDR: number }> = fxData?.rates ?? {}

    // Helper: Find closest rate by checking current date or preceding business days
    function getClosestRate(targetDate: string): number | null {
      if (rates[targetDate]?.IDR) return rates[targetDate].IDR

      const rateDates = Object.keys(rates).sort()
      let closestRate: number | null = null
      for (const rDate of rateDates) {
        if (rDate <= targetDate) {
          closestRate = rates[rDate].IDR
        } else {
          break
        }
      }
      if (closestRate === null && rateDates.length > 0) {
        closestRate = rates[rateDates[0]].IDR
      }
      return closestRate
    }

    // Helper: Find closest Yahoo price by checking current date or preceding trading days
    function getClosestYahooPrice(targetDate: string): number | null {
      if (yahooPrices.has(targetDate)) return yahooPrices.get(targetDate)!

      let closestPrice: number | null = null
      for (const yDate of availableYahooDates) {
        if (yDate <= targetDate) {
          closestPrice = yahooPrices.get(yDate)!
        } else {
          break
        }
      }
      if (closestPrice === null && availableYahooDates.length > 0) {
        closestPrice = yahooPrices.get(availableYahooDates[0])!
      }
      return closestPrice
    }

    // Step 4: Generate the last 30 calendar days and populate prices
    const rows = []
    const dates = getLast30DaysWIB()

    for (const date of dates) {
      const usdPrice = getClosestYahooPrice(date)
      const usdRate = getClosestRate(date)

      if (usdPrice && usdRate) {
        const pricePerGramIDR = (usdPrice / TROY_OZ_TO_GRAM) * usdRate

        // Sanity check
        if (pricePerGramIDR >= MIN_PRICE && pricePerGramIDR <= MAX_PRICE) {
          rows.push({
            date,
            source: 'international',
            price_sell: Math.round(pricePerGramIDR),
            price_buy: null,
            usd_rate: Math.round(usdRate),
            usd_price: parseFloat(usdPrice.toFixed(4)),
            created_by: 'system',
          })
        }
      }
    }

    if (rows.length === 0) {
      throw new Error('Tidak ada baris data International valid setelah pemrosesan')
    }

    // Step 5: Upsert batch into database
    const supabase = createServerSupabaseClient()
    const { error: dbError } = await supabase.from('gold_prices').upsert(
      rows,
      { onConflict: 'date,source' }
    )
    if (dbError) throw new Error(`DB upsert failed: ${dbError.message}`)

    const duration = Date.now() - start
    const latestRow = rows[rows.length - 1]
    await logFetchSuccess({
      source: 'international',
      durationMs: duration,
      triggeredBy,
      message: `Retroactive fetch selesai. Diperbarui ${rows.length} hari. Terbaru (${latestRow.date}): Rp ${latestRow.price_sell.toLocaleString('id-ID')}/gram (USD ${latestRow.usd_price?.toFixed(2)}/oz @ ${latestRow.usd_rate?.toFixed(0)} IDR)`,
    })

    return {
      ok: true,
      source: 'international',
      price: {
        price_sell: latestRow.price_sell,
        usd_rate: latestRow.usd_rate,
        usd_price: latestRow.usd_price,
      },
    }
  } catch (err) {
    const duration = Date.now() - start
    await logFetchError({
      source: 'international',
      durationMs: duration,
      errorMessage: String(err),
      triggeredBy,
    })
    return { ok: false, source: 'international', error: String(err) }
  }
}
