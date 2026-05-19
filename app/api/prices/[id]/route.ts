import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

type RouteContext = { params: Promise<{ id: string }> }

// PUT /api/prices/[id] — update a price record
export async function PUT(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params
    const body = await req.json()
    const { price_sell, price_buy, notes } = body

    // At least one price field required
    if (price_sell === undefined && price_buy === undefined) {
      return NextResponse.json({ error: 'At least one of price_sell or price_buy is required' }, { status: 400 })
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (price_sell !== undefined) updates.price_sell = price_sell
    if (price_buy !== undefined) updates.price_buy = price_buy
    if (notes !== undefined) updates.notes = notes

    const supabase = createServerSupabaseClient()
    const { data, error } = await supabase
      .from('gold_prices')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Record not found' }, { status: 404 })

    return NextResponse.json({ data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// DELETE /api/prices/[id] — delete a price record
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params
    const supabase = createServerSupabaseClient()
    const { error } = await supabase
      .from('gold_prices')
      .delete()
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
