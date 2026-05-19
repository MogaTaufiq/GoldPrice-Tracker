import { fetchAntamPrice } from './antam'
import { fetchInternationalPrice } from './international'
import type { FetchResult } from '@/types'

export interface RunAllFetchersResult {
  results: FetchResult[]
  overallStatus: 'success' | 'partial' | 'error'
  successCount: number
  errorCount: number
}

/**
 * Orchestrator: runs all automatic fetchers (Antam + International).
 * Nasril is MANUAL only — never included here.
 *
 * Each fetcher handles its own error logging.
 * This function just aggregates results and determines overall status.
 */
export async function runAllFetchers(
  triggeredBy: 'cron' | 'manual' = 'cron'
): Promise<RunAllFetchersResult> {
  // Run both fetchers in parallel
  const [antamResult, internationalResult] = await Promise.all([
    fetchAntamPrice(triggeredBy),
    fetchInternationalPrice(triggeredBy),
  ])

  const results = [antamResult, internationalResult]
  const successCount = results.filter(r => r.ok).length
  const errorCount = results.filter(r => !r.ok).length

  let overallStatus: 'success' | 'partial' | 'error'
  if (successCount === results.length) overallStatus = 'success'
  else if (successCount === 0) overallStatus = 'error'
  else overallStatus = 'partial'

  return { results, overallStatus, successCount, errorCount }
}
