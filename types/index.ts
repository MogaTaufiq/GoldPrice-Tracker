// Shared TypeScript types for InvestManagement

export type GoldSource = 'antam' | 'international' | 'nasril'

export interface GoldPrice {
  id: string
  date: string              // 'YYYY-MM-DD'
  source: GoldSource
  price_sell: number | null // IDR per gram
  price_buy: number | null  // IDR per gram (Antam only)
  usd_rate: number | null   // USD/IDR rate at fetch time (international only)
  usd_price: number | null  // Gold price in USD/troy oz (international only)
  created_at: string
  updated_at: string
  created_by: 'system' | 'admin'
  notes: string | null
}

export interface FetchLog {
  id: string
  fetched_at: string
  source: GoldSource | 'all'
  status: 'success' | 'error' | 'partial'
  message: string | null
  duration_ms: number | null
  triggered_by: 'cron' | 'manual'
}

export interface FetchResult {
  ok: boolean
  source: GoldSource
  price?: Partial<GoldPrice>
  error?: string
}

// Chart data grouped by source
export interface ChartDataset {
  antamJual: (number | null)[]
  antamBeli: (number | null)[]
  international: (number | null)[]
  nasril: (number | null)[]
  labels: string[]          // Date strings 'YYYY-MM-DD'
}

export type DateRange = '7d' | '14d' | '30d' | 'all'

export type MAWindow = 7 | 14 | 30

export interface MAOverlayConfig {
  show7d: boolean
  show14d: boolean
  show30d: boolean
}

// Summary card data for one source
export interface PriceCardData {
  source: GoldSource
  label: string
  latestPrice: number | null
  latestDate: string | null
  changeVsYesterday: number | null  // percentage
  changeVs30d: number | null        // percentage
  trendSignal: 'murah' | 'normal' | 'mahal' | null
  periodHigh: number | null
  periodLow: number | null
}

export interface FetchStatus {
  lastFetchedAt: string | null
  status: 'success' | 'partial' | 'error' | 'never'
  message: string | null
}

// Admin auth
export interface AuthPayload {
  role: 'admin'
  iat: number
  exp: number
}

// CSV import row
export interface CSVImportRow {
  date: string
  antam_jual: string
  antam_beli: string
  international: string
  nasril: string
}
