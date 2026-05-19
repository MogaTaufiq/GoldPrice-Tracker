/**
 * Simple Moving Average calculator
 *
 * Business rules:
 * - Antam / International: use linear interpolation to fill gaps before SMA calc
 * - Nasril: skip missing days entirely (no interpolation)
 * - If fewer than N data points exist for a window, return null for that point
 */

/**
 * Linearly interpolate gaps (null values) in a series.
 * Used for Antam and International before SMA calculation.
 */
export function interpolateGaps(values: (number | null)[]): (number | null)[] {
  const result = [...values]
  let i = 0
  while (i < result.length) {
    if (result[i] === null) {
      // Find the previous non-null
      let prevIdx = i - 1
      while (prevIdx >= 0 && result[prevIdx] === null) prevIdx--

      // Find the next non-null
      let nextIdx = i + 1
      while (nextIdx < result.length && result[nextIdx] === null) nextIdx++

      const hasPrev = prevIdx >= 0
      const hasNext = nextIdx < result.length

      if (hasPrev && hasNext) {
        // Linear interpolation between prev and next
        const prevVal = result[prevIdx]!
        const nextVal = result[nextIdx]!
        const steps = nextIdx - prevIdx
        for (let j = prevIdx + 1; j < nextIdx; j++) {
          result[j] = prevVal + ((nextVal - prevVal) * (j - prevIdx)) / steps
        }
        i = nextIdx
      } else if (hasPrev) {
        // Fill tail with last known value
        for (let j = i; j < result.length; j++) result[j] = result[prevIdx]!
        break
      } else if (hasNext) {
        // Fill head with first known value
        for (let j = 0; j < nextIdx; j++) result[j] = result[nextIdx]!
        i = nextIdx
      } else {
        break // All null
      }
    }
    i++
  }
  return result
}

/**
 * Calculate SMA-N for a series of values.
 *
 * @param values  Array of numbers (may include nulls for Nasril)
 * @param window  Number of days for the moving average (7, 14, or 30)
 * @param allowNullInWindow  If true (Nasril mode), skip nulls within the window
 *                           instead of treating them as blocking the calculation.
 */
export function calculateSMA(
  values: (number | null)[],
  window: 7 | 14 | 30,
  allowNullInWindow = false
): (number | null)[] {
  return values.map((_, i) => {
    if (i < window - 1) return null  // Not enough history yet

    const slice = values.slice(i - window + 1, i + 1)
    const defined = slice.filter((v): v is number => v !== null)

    if (!allowNullInWindow && defined.length < window) return null
    if (allowNullInWindow && defined.length === 0) return null

    return defined.reduce((sum, v) => sum + v, 0) / defined.length
  })
}

/**
 * Compute SMA overlays for all sources.
 * - Antam / International: interpolate gaps first, then SMA
 * - Nasril: SMA over non-null values only (allowNullInWindow=true)
 */
export function computeAllSMAs(
  antamJual: (number | null)[],
  antamBeli: (number | null)[],
  international: (number | null)[],
  nasril: (number | null)[],
  windowSize: 7 | 14 | 30
) {
  const interp = {
    antamJual: interpolateGaps(antamJual),
    antamBeli: interpolateGaps(antamBeli),
    international: interpolateGaps(international),
    nasril: interpolateGaps(nasril),
  }

  return {
    antamJual: calculateSMA(interp.antamJual, windowSize),
    antamBeli: calculateSMA(interp.antamBeli, windowSize),
    international: calculateSMA(interp.international, windowSize),
    nasril: calculateSMA(interp.nasril, windowSize),
  }
}
