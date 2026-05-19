import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

// GET /api/logs?limit=20&status=error — fetch audit logs (admin only)
export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams
    const limit = Math.min(parseInt(params.get('limit') ?? '20'), 100)
    const status = params.get('status') // 'success' | 'error' | 'partial' | null (all)
    const page = parseInt(params.get('page') ?? '1')
    const offset = (page - 1) * limit

    const supabase = createServerSupabaseClient()
    let query = supabase
      .from('fetch_logs')
      .select('*', { count: 'exact' })
      .order('fetched_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status && ['success', 'error', 'partial'].includes(status)) {
      query = query.eq('status', status)
    }

    const { data, error, count } = await query
    if (error) throw error

    return NextResponse.json({ data, total: count, page, limit })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
