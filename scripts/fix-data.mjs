#!/usr/bin/env node
/**
 * scripts/fix-data.mjs
 * 
 * 1. Hapus SEMUA data (Antam, Intl, Nasril) yang lebih lama dari 7 hari lalu (< 12 Mei 2026)
 * 2. Hapus data Antam yang salah antara 12 Mei - 18 Mei
 * 3. Fetch data Antam asli dari API (sejarah 7 hari)
 * 4. Insert data Antam yang asli ke database
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
const ANTAM_KEY = process.env.ANTAM_API_KEY

const HEADERS = {
  'apikey': SERVICE_ROLE_KEY,
  'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
}

async function run() {
  console.log('\n🧹  Pembersihan Data Emas\n')

  const SEVEN_DAYS_AGO = '2026-05-12'
  const TODAY = '2026-05-19'

  // 1. Hapus semua data yang lebih tua dari 7 hari
  console.log(`1️⃣  Menghapus semua data sebelum ${SEVEN_DAYS_AGO}...`)
  const delOld = await fetch(`${SUPABASE_URL}/rest/v1/gold_prices?date=lt.${SEVEN_DAYS_AGO}`, {
    method: 'DELETE',
    headers: HEADERS,
  })
  if (!delOld.ok) throw new Error(await delOld.text())
  console.log('   ✅ Selesai')

  // 2. Hapus data Antam (12 - 18 Mei) karena itu dummy/salah
  console.log(`2️⃣  Menghapus dummy data Antam (${SEVEN_DAYS_AGO} s/d 18 Mei)...`)
  const delAntam = await fetch(`${SUPABASE_URL}/rest/v1/gold_prices?source=eq.antam&date=gte.${SEVEN_DAYS_AGO}&date=lt.${TODAY}`, {
    method: 'DELETE',
    headers: HEADERS,
  })
  if (!delAntam.ok) throw new Error(await delAntam.text())
  console.log('   ✅ Selesai')

  // 3. Fetch data Antam dari API
  console.log('3️⃣  Mengambil data asli dari Antam API...')
  const apiRes = await fetch(`https://emas.maulanar.my.id/api/prices?brand=ANTAM&resource=antam&weight=1&sort_by=updated_at&order=desc&limit=15`, {
    headers: { 'X-API-Key': ANTAM_KEY, 'Accept': 'application/json' }
  })
  if (!apiRes.ok) throw new Error(await apiRes.text())
  
  const apiJson = await apiRes.json()
  const antamData = apiJson.data || []
  
  // Filter hanya data >= 12 Mei dan < 19 Mei (karena 19 Mei sudah ada & valid)
  const toInsert = antamData
    .filter(d => d.updated_at >= SEVEN_DAYS_AGO && d.updated_at < TODAY)
    .map(d => ({
      date: d.updated_at,
      source: 'antam',
      price_sell: d.sell_price,
      price_buy: d.buyback_price,
      created_by: 'system',
      notes: 'Historical data from API'
    }))

  console.log(`   Ditemukan ${toInsert.length} baris data Antam valid untuk minggu ini.`)

  if (toInsert.length > 0) {
    console.log('4️⃣  Menyimpan data Antam asli ke database...')
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/gold_prices`, {
      method: 'POST',
      headers: {
        ...HEADERS,
        'Prefer': 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(toInsert)
    })
    if (!insertRes.ok) throw new Error(await insertRes.text())
    console.log('   ✅ Berhasil disimpan!')
  }

  console.log('\n🎉  Selesai! Data sekarang bersih dan valid.')
}

run().catch(console.error)
