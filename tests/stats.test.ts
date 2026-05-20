import test from 'node:test'
import assert from 'node:assert'
import { getTrendSignal } from '../lib/calculations/stats.ts'
import { formatRupiah, formatPercent, percentChange } from '../lib/format.ts'

test('getTrendSignal - logic thresholds', () => {
  // Test cases for trend signal based on MA-30 (thresholds: 98% and 102%)
  const ma30 = 1000000

  // Under 98% -> murah (cheap)
  assert.strictEqual(getTrendSignal(979999, ma30), 'murah')
  assert.strictEqual(getTrendSignal(980000, ma30), 'murah') // exact 98% is <=

  // Over 102% -> mahal (expensive)
  assert.strictEqual(getTrendSignal(1020001, ma30), 'mahal')
  assert.strictEqual(getTrendSignal(1020000, ma30), 'mahal') // exact 102% is >=

  // Between 98% and 102% -> normal
  assert.strictEqual(getTrendSignal(1000000, ma30), 'normal')
  assert.strictEqual(getTrendSignal(990000, ma30), 'normal')
  assert.strictEqual(getTrendSignal(1010000, ma30), 'normal')

  // Null checks
  assert.strictEqual(getTrendSignal(null, ma30), null)
  assert.strictEqual(getTrendSignal(1000000, null), null)
})

test('formatRupiah - million vs thousands formatting', () => {
  // Millions formatted as "Rp X,XX jt"
  assert.strictEqual(formatRupiah(1000000), 'Rp 1,00 jt')
  assert.strictEqual(formatRupiah(1250000), 'Rp 1,25 jt')
  assert.strictEqual(formatRupiah(1256000), 'Rp 1,26 jt') // rounds to 2 decimals

  // Thousands formatted with standard Indonesian separator "."
  assert.strictEqual(formatRupiah(980000), 'Rp 980.000')
  assert.strictEqual(formatRupiah(5000), 'Rp 5.000')

  // Edge cases
  assert.strictEqual(formatRupiah(null), '—')
  assert.strictEqual(formatRupiah(NaN), '—')
})

test('formatPercent - sign and decimals', () => {
  assert.strictEqual(formatPercent(2.3456), '+2.35%')
  assert.strictEqual(formatPercent(-1.2), '-1.20%')
  assert.strictEqual(formatPercent(0), '+0.00%')
  assert.strictEqual(formatPercent(null), '—')
})

test('percentChange - calculate correctly', () => {
  assert.strictEqual(percentChange(100, 110), 10)
  assert.strictEqual(percentChange(100, 95), -5)
  assert.strictEqual(percentChange(null, 100), null)
  assert.strictEqual(percentChange(100, null), null)
  assert.strictEqual(percentChange(0, 100), null) // division by zero
})
