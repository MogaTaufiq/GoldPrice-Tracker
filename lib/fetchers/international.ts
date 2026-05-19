import { createServerSupabaseClient } from '@/lib/supabase'
import { logFetchSuccess, logFetchError } from '@/lib/fetch-logger'
import type { FetchResult } from '@/types'

const MIN_PRICE = 1_500_000
const MAX_PRICE = 6_000_000

// Troy ounce to gram conversion
const TROY_OZ_TO_GRAM = 31.1035

// International gold price (XAU) from Yahoo Finance, converted to IDR via Frankfurter
export async function fetchInternationalPrice(
  triggeredBy: 'cron' | 'manual' = 'cron'
): Promise<FetchResult> {
  const start = Date.now()
  try {
    // Step 1: Get gold price in USD from Yahoo Finance
    const yahooRes = await fetch(
      'https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1d&range=1d',
      {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        next: { revalidate: 0 },
      }
    )
    if (!yahooRes.ok) throw new Error(`Yahoo Finance returned HTTP ${yahooRes.status}`)

    const yahooData = await yahooRes.json()
    const closes = yahooData?.chart?.result?.[0]?.indicators?.quote?.[0]?.close
    if (!closes || closes.length === 0) throw new Error('Yahoo Finance: no price data in response')

    const usdPricePerOz: number = closes[closes.length - 1]
    if (!usdPricePerOz || usdPricePerOz <= 0) throw new Error(`Yahoo Finance: invalid price ${usdPricePerOz}`)

    // Step 2: Get USD → IDR exchange rate from Frankfurter
    const fxRes = await fetch('https://api.frankfurter.app/latest?from=USD&to=IDR', {
      redirect: 'follow',
      next: { revalidate: 0 },
    })
    if (!fxRes.ok) throw new Error(`Frankfurter returned HTTP ${fxRes.status}`)

    const fxData = await fxRes.json()
    const usdToIdr: number = fxData?.rates?.IDR
    if (!usdToIdr || usdToIdr <= 0) throw new Error(`Frankfurter: invalid rate ${usdToIdr}`)

    // Step 3: Convert to IDR per gram
    const pricePerGramIDR = (usdPricePerOz / TROY_OZ_TO_GRAM) * usdToIdr

    // Step 4: Sanity check
    if (pricePerGramIDR < MIN_PRICE || pricePerGramIDR > MAX_PRICE) {
      throw new Error(
        `Price failed sanity check: Rp ${pricePerGramIDR.toFixed(0)} (expected ${MIN_PRICE}–${MAX_PRICE})`
      )
    }

    // Step 5: Upsert into database
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' })
    const supabase = createServerSupabaseClient()
    const { error: dbError } = await supabase.from('gold_prices').upsert(
      {
        date: today,
        source: 'international',
        price_sell: Math.round(pricePerGramIDR),
        price_buy: null,
        usd_rate: Math.round(usdToIdr),
        usd_price: parseFloat(usdPricePerOz.toFixed(4)),
        created_by: 'system',
      },
      { onConflict: 'date,source' }
    )
    if (dbError) throw new Error(`DB upsert failed: ${dbError.message}`)

    const duration = Date.now() - start
    await logFetchSuccess({
      source: 'international',
      durationMs: duration,
      triggeredBy,
      message: `Rp ${Math.round(pricePerGramIDR).toLocaleString('id-ID')}/gram (USD ${usdPricePerOz.toFixed(2)}/oz @ ${usdToIdr.toFixed(0)} IDR)`,
    })

    return {
      ok: true,
      source: 'international',
      price: {
        price_sell: Math.round(pricePerGramIDR),
        usd_rate: Math.round(usdToIdr),
        usd_price: parseFloat(usdPricePerOz.toFixed(4)),
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
