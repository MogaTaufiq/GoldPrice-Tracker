import { NextResponse } from 'next/server'
import { runAllFetchers } from '@/lib/fetchers'

// POST /api/fetch — manual trigger by admin (auth enforced by middleware)
export async function POST() {
  const startTime = Date.now()

  const result = await runAllFetchers('manual')

  return NextResponse.json({
    status: result.overallStatus,
    successCount: result.successCount,
    errorCount: result.errorCount,
    durationMs: Date.now() - startTime,
    results: result.results.map(r => ({
      source: r.source,
      ok: r.ok,
      price: r.price ?? null,
      error: r.error ?? null,
    })),
  })
}
