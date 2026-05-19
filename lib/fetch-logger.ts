import { createServerSupabaseClient } from '@/lib/supabase'
import type { GoldSource } from '@/types'

interface LogSuccessParams {
  source: GoldSource | 'all'
  durationMs: number
  triggeredBy?: 'cron' | 'manual'
  message?: string
}

interface LogErrorParams {
  source: GoldSource | 'all'
  durationMs: number
  errorMessage: string
  triggeredBy?: 'cron' | 'manual'
}

export async function logFetchSuccess(params: LogSuccessParams): Promise<void> {
  const supabase = createServerSupabaseClient()
  const { error } = await supabase.from('fetch_logs').insert({
    source: params.source,
    status: 'success',
    message: params.message ?? 'Fetch completed successfully',
    duration_ms: params.durationMs,
    triggered_by: params.triggeredBy ?? 'cron',
  })
  if (error) {
    // Use console.error here ONLY because this IS the logger — can't recurse
    console.error('[fetch-logger] Failed to write success log:', error.message)
  }
}

export async function logFetchError(params: LogErrorParams): Promise<void> {
  const supabase = createServerSupabaseClient()
  const { error } = await supabase.from('fetch_logs').insert({
    source: params.source,
    status: 'error',
    message: params.errorMessage,
    duration_ms: params.durationMs,
    triggered_by: params.triggeredBy ?? 'cron',
  })
  if (error) {
    console.error('[fetch-logger] Failed to write error log:', error.message)
  }
}

export async function logFetchPartial(params: {
  source: GoldSource | 'all'
  durationMs: number
  message: string
  triggeredBy?: 'cron' | 'manual'
}): Promise<void> {
  const supabase = createServerSupabaseClient()
  const { error } = await supabase.from('fetch_logs').insert({
    source: params.source,
    status: 'partial',
    message: params.message,
    duration_ms: params.durationMs,
    triggered_by: params.triggeredBy ?? 'cron',
  })
  if (error) {
    console.error('[fetch-logger] Failed to write partial log:', error.message)
  }
}
