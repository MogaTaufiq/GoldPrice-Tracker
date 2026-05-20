import type { GoldPrice, PriceCardData, GoldSource } from '@/types'
import { percentChange } from '../format.ts'
import { interpolateGaps, calculateSMA } from './moving-average.ts'

const SOURCE_LABELS: Record<GoldSource, string> = {
  antam: 'Antam',
  international: 'International',
  nasril: 'Nasril',
}

/**
 * Trend signal thresholds (±2% from MA-30).
 * Business rule: see architecture.md §9.
 */
const TREND_LOWER = 0.98
const TREND_UPPER = 1.02

export function getTrendSignal(
  currentPrice: number | null,
  ma30: number | null
): 'murah' | 'normal' | 'mahal' | null {
  if (currentPrice === null || ma30 === null) return null
  if (currentPrice <= ma30 * TREND_LOWER) return 'murah'
  if (currentPrice >= ma30 * TREND_UPPER) return 'mahal'
  return 'normal'
}

/**
 * Compute summary card data for a single source from a sorted (asc) price array.
 */
export function computePriceCardData(
  source: GoldSource,
  prices: GoldPrice[],    // sorted ascending by date
  allDates: string[]      // full date range labels (for SMA alignment)
): PriceCardData {
  const priceMap = new Map(prices.map(p => [p.date, p]))

  // Build aligned sell price array matching allDates
  const sellSeries: (number | null)[] = allDates.map(d => priceMap.get(d)?.price_sell ?? null)

  // MA-30 (interpolate all sources to handle weekend/missing data gracefully)
  const interpolatedSeries = interpolateGaps(sellSeries)
  const ma30Series = calculateSMA(interpolatedSeries, 30)

  const latestIdx = [...sellSeries].reverse().findIndex(v => v !== null)
  const latestActualIdx = latestIdx === -1 ? -1 : sellSeries.length - 1 - latestIdx

  const latestPrice = latestActualIdx >= 0 ? sellSeries[latestActualIdx] : null
  const latestDate = latestActualIdx >= 0 ? allDates[latestActualIdx] : null

  // Yesterday: look for most recent price before latestActualIdx
  let yesterdayPrice: number | null = null
  for (let i = latestActualIdx - 1; i >= 0; i--) {
    if (sellSeries[i] !== null) { yesterdayPrice = sellSeries[i]; break }
  }

  // 30 days ago (use interpolated series so it doesn't break if exactly 30 days ago was a Sunday)
  const thirtyDaysAgo = allDates.length >= 30 ? interpolatedSeries[allDates.length - 30] : interpolatedSeries[0]

  // Period high/low from non-null values
  const definedPrices = sellSeries.filter((v): v is number => v !== null)
  const periodHigh = definedPrices.length ? Math.max(...definedPrices) : null
  const periodLow = definedPrices.length ? Math.min(...definedPrices) : null

  const ma30Today = latestActualIdx >= 0 ? ma30Series[latestActualIdx] : null

  return {
    source,
    label: SOURCE_LABELS[source],
    latestPrice,
    latestDate,
    changeVsYesterday: percentChange(yesterdayPrice, latestPrice),
    changeVs30d: percentChange(thirtyDaysAgo ?? null, latestPrice),
    trendSignal: getTrendSignal(latestPrice, ma30Today),
    periodHigh,
    periodLow,
  }
}
