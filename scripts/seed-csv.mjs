#!/usr/bin/env node
/**
 * scripts/seed-csv.mjs
 * 
 * 1. Hapus semua data lama dari gold_prices
 * 2. Import harga_emas_lama.csv ke Supabase
 * 
 * Run: node scripts/seed-csv.mjs
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// ── Load .env.local ──
function loadEnv() {
  const lines = readFileSync(resolve(ROOT, '.env.local'), 'utf8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim()
    if (key) process.env[key] = val
  }
}
loadEnv()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || SERVICE_ROLE_KEY.includes('placeholder')) {
  console.error('❌  SUPABASE_SERVICE_ROLE_KEY not set in .env.local')
  process.exit(1)
}

const HEADERS = {
  'apikey': SERVICE_ROLE_KEY,
  'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'resolution=merge-duplicates,return=representation',
}

// ── Parse "Rp2,955,000" → 2955000 ──
function parseRupiah(str) {
  if (!str || str.trim() === '') return null
  const cleaned = str.replace(/[Rp\s,]/g, '').trim()
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

// ── Parse CSV ──
function parseCSV(csvPath) {
  const text = readFileSync(csvPath, 'utf8')
  const lines = text.trim().split('\n')
  const [headerLine, ...rows] = lines
  const headers = headerLine.split(',').map(h => h.trim())

  return rows.map(row => {
    // Handle quoted fields like "Rp2,955,000"
    const fields = []
    let current = ''
    let inQuote = false
    for (const ch of row) {
      if (ch === '"') { inQuote = !inQuote }
      else if (ch === ',' && !inQuote) { fields.push(current); current = '' }
      else { current += ch }
    }
    fields.push(current)

    const record = {}
    headers.forEach((h, i) => { record[h] = fields[i]?.trim() ?? '' })
    return record
  })
}

// ── Build Supabase rows from CSV record ──
function buildRows(record) {
  const rows = []
  const date = record.date
  if (!date) return rows

  const antamJual = parseRupiah(record.antam_jual)
  const antamBeli = parseRupiah(record.antam_beli)
  const international = parseRupiah(record.international)
  const nasril = parseRupiah(record.nasril)

  // Antam: only insert if at least jual exists
  if (antamJual !== null) {
    rows.push({
      date,
      source: 'antam',
      price_sell: antamJual,
      price_buy: antamBeli,
      created_by: 'system',
    })
  }

  // International
  if (international !== null) {
    rows.push({
      date,
      source: 'international',
      price_sell: international,
      created_by: 'system',
    })
  }

  // Nasril
  if (nasril !== null) {
    rows.push({
      date,
      source: 'nasril',
      price_sell: nasril,
      created_by: 'admin',
    })
  }

  return rows
}

async function run() {
  console.log('\n🪙  Gold Price Tracker — CSV Import\n')

  // ── Step 1: Delete all existing data ──
  console.log('🗑️  Menghapus semua data lama...')
  const delRes = await fetch(`${SUPABASE_URL}/rest/v1/gold_prices?id=neq.00000000-0000-0000-0000-000000000000`, {
    method: 'DELETE',
    headers: HEADERS,
  })
  if (!delRes.ok) {
    const body = await delRes.text()
    console.error(`❌ Gagal hapus data: HTTP ${delRes.status} — ${body}`)
    process.exit(1)
  }
  console.log('✅ Semua data lama dihapus\n')

  // ── Step 2: Parse CSV ──
  const csvPath = resolve(ROOT, 'harga_emas_lama.csv')
  console.log(`📂 Membaca CSV: ${csvPath}`)
  const records = parseCSV(csvPath)
  console.log(`   ${records.length} baris ditemukan`)

  // Build all rows
  const allRows = []
  for (const record of records) {
    const rows = buildRows(record)
    allRows.push(...rows)
  }
  console.log(`   ${allRows.length} rows akan diinsert\n`)

  // Preview
  console.log('   Preview (3 baris pertama):')
  allRows.slice(0, 3).forEach(r =>
    console.log(`   ${r.date} | ${r.source.padEnd(13)} | jual: ${r.price_sell} | beli: ${r.price_buy ?? '-'}`)
  )
  console.log('')

  // ── Step 3: Insert in batches of 20 ──
  // Normalize: all rows must have same keys for Supabase batch insert
  const normalizedRows = allRows.map(r => ({
    date: r.date,
    source: r.source,
    price_sell: r.price_sell ?? null,
    price_buy: r.price_buy ?? null,
    usd_rate: r.usd_rate ?? null,
    usd_price: r.usd_price ?? null,
    created_by: r.created_by ?? 'system',
    notes: r.notes ?? null,
  }))
  const BATCH = 20
  let inserted = 0
  for (let i = 0; i < normalizedRows.length; i += BATCH) {
    const batch = normalizedRows.slice(i, i + BATCH)
    const res = await fetch(`${SUPABASE_URL}/rest/v1/gold_prices`, {
      method: 'POST',
      headers: {
        ...HEADERS,
        'Prefer': 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(batch),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error(`❌ Batch ${i}–${i + BATCH} gagal: HTTP ${res.status} — ${body}`)
      process.exit(1)
    }
    inserted += batch.length
    process.stdout.write(`\r📤 Insert: ${inserted}/${allRows.length} rows`)
  }

  console.log(`\n✅ Import selesai! ${inserted} rows berhasil diinsert\n`)

  // ── Step 4: Verify ──
  const verifyRes = await fetch(
    `${SUPABASE_URL}/rest/v1/gold_prices?select=source,date&order=date.desc&limit=5`,
    { headers: HEADERS }
  )
  const verifyData = await verifyRes.json()
  console.log('🔍 Verifikasi (5 data terbaru):')
  verifyData.forEach(r => console.log(`   ${r.date} | ${r.source}`))
  console.log('\n✅ Siap! Sekarang jalankan fetch API untuk data hari ini.')
  console.log('   → GET http://localhost:3001/api/fetch  (manual trigger)\n')
}

run().catch(err => {
  console.error('❌ Error:', err)
  process.exit(1)
})
