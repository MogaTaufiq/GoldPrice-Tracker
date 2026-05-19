import { NextResponse } from 'next/server'
import { runAllFetchers } from '@/lib/fetchers'

// GET /api/cron — called by Vercel Cron at 12:00 WIB daily
// Auth: x-cron-secret header (enforced by middleware.ts)
export async function GET() {
  const startTime = Date.now()

  const result = await runAllFetchers('cron')

  return NextResponse.json({
    status: result.overallStatus,
    successCount: result.successCount,
    errorCount: result.errorCount,
    durationMs: Date.now() - startTime,
    results: result.results.map(r => ({
      source: r.source,
      ok: r.ok,
      error: r.error ?? null,
    })),
  })
}
