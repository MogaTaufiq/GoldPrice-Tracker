import test from 'node:test'
import assert from 'node:assert'
import { interpolateGaps, calculateSMA } from '../lib/calculations/moving-average.ts'

test('interpolateGaps - basic and edge cases', () => {
  // No nulls
  assert.deepStrictEqual(interpolateGaps([10, 20, 30]), [10, 20, 30])

  // Single gap interpolation
  assert.deepStrictEqual(interpolateGaps([10, null, 30]), [10, 20, 30])

  // Multiple gap interpolation
  assert.deepStrictEqual(interpolateGaps([10, null, null, 40]), [10, 20, 30, 40])

  // Leading gaps filled with first known value
  assert.deepStrictEqual(interpolateGaps([null, null, 10, 20]), [10, 10, 10, 20])

  // Trailing gaps filled with last known value
  assert.deepStrictEqual(interpolateGaps([10, 20, null, null]), [10, 20, 20, 20])

  // Mix of leading, middle, and trailing gaps
  assert.deepStrictEqual(interpolateGaps([null, 10, null, 30, null]), [10, 10, 20, 30, 30])

  // All nulls
  assert.deepStrictEqual(interpolateGaps([null, null, null]), [null, null, null])
})

test('calculateSMA - strict mode (no nulls allowed in window)', () => {
  const values = [10, 20, 30, 40, 50, 60, 70]
  
  // SMA-7 (needs 7 items)
  const sma7 = calculateSMA(values, 7)
  assert.deepStrictEqual(sma7, [null, null, null, null, null, null, 40])

  // SMA-7 with a null in the window (should return null for that point)
  const valuesWithNull = [10, 20, 30, null, 50, 60, 70]
  const sma7WithNull = calculateSMA(valuesWithNull, 7, false)
  assert.deepStrictEqual(sma7WithNull, [null, null, null, null, null, null, null])
})

test('calculateSMA - lenient mode (allows nulls in window, e.g., Nasril)', () => {
  const values = [10, 20, null, 40, null, 60, 70]
  
  // SMA-7 with allowNullInWindow = true (index 6 window: [10, 20, null, 40, null, 60, 70])
  // Non-nulls: [10, 20, 40, 60, 70] (Sum = 200, Count = 5, Avg = 40)
  const sma7Lenient = calculateSMA(values, 7, true)
  assert.strictEqual(sma7Lenient[6], 40)
  assert.strictEqual(sma7Lenient[0], null)
  assert.strictEqual(sma7Lenient[5], null) // index 5 not enough history for window 7
})
