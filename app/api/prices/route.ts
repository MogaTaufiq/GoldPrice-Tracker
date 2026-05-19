import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import type { DateRange, GoldSource } from '@/types'

function getDateRangeFilter(range: DateRange): string | null {
  if (range === 'all') return null
  const days = range === '7d' ? 7 : range === '14d' ? 14 : 30
  const from = new Date()
  from.setDate(from.getDate() - days)
  return from.toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' })
}

const VALID_SOURCES: GoldSource[] = ['antam', 'international', 'nasril']

// GET /api/prices?range=30d&sources=antam,international,nasril
export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams
    const range = (params.get('range') ?? '30d') as DateRange
    const sourcesParam = params.get('sources')

    const sources: GoldSource[] = sourcesParam
      ? (sourcesParam.split(',').filter(s => VALID_SOURCES.includes(s as GoldSource)) as GoldSource[])
      : VALID_SOURCES

    const supabase = createServerSupabaseClient()
    let query = supabase
      .from('gold_prices')
      .select('*')
      .in('source', sources)
      .order('date', { ascending: true })

    const fromDate = getDateRangeFilter(range)
    if (fromDate) {
      query = query.gte('date', fromDate)
    }

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// POST /api/prices — insert Nasril price (admin only, auth enforced by middleware)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { date, price_sell, notes } = body

    // Validate
    if (!date || !price_sell) {
      return NextResponse.json({ error: 'date and price_sell are required' }, { status: 400 })
    }
    if (typeof price_sell !== 'number' || price_sell <= 0) {
      return NextResponse.json({ error: 'price_sell must be a positive number' }, { status: 400 })
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'date must be YYYY-MM-DD format' }, { status: 400 })
    }

    const supabase = createServerSupabaseClient()
    const { data, error } = await supabase
      .from('gold_prices')
      .upsert(
        {
          date,
          source: 'nasril',
          price_sell,
          price_buy: null,
          created_by: 'admin',
          notes: notes ?? null,
        },
        { onConflict: 'date,source' }
      )
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
