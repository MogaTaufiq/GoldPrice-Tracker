-- ═══════════════════════════════════════════════════════════
-- Gold Price Tracker — Supabase Database Setup
-- Run this in your Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- Table: gold_prices
CREATE TABLE IF NOT EXISTS gold_prices (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date        DATE NOT NULL,
  source      TEXT NOT NULL CHECK (source IN ('antam', 'international', 'nasril')),

  price_sell  NUMERIC(15,2),
  price_buy   NUMERIC(15,2),

  usd_rate    NUMERIC(10,2),
  usd_price   NUMERIC(10,4),

  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  created_by  TEXT DEFAULT 'system' CHECK (created_by IN ('system', 'admin')),
  notes       TEXT,

  UNIQUE(date, source)
);

-- Table: fetch_logs
CREATE TABLE IF NOT EXISTS fetch_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fetched_at   TIMESTAMPTZ DEFAULT NOW(),
  source       TEXT NOT NULL,
  status       TEXT NOT NULL CHECK (status IN ('success', 'error', 'partial')),
  message      TEXT,
  duration_ms  INTEGER,
  triggered_by TEXT DEFAULT 'cron' CHECK (triggered_by IN ('cron', 'manual'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gold_prices_date   ON gold_prices(date DESC);
CREATE INDEX IF NOT EXISTS idx_gold_prices_source ON gold_prices(source);
CREATE INDEX IF NOT EXISTS idx_gold_prices_date_source ON gold_prices(date DESC, source);
CREATE INDEX IF NOT EXISTS idx_fetch_logs_fetched_at ON fetch_logs(fetched_at DESC);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE TRIGGER update_gold_prices_updated_at
  BEFORE UPDATE ON gold_prices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (optional but recommended)
ALTER TABLE gold_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE fetch_logs ENABLE ROW LEVEL SECURITY;

-- Allow anon to read prices (public dashboard)
CREATE POLICY "Public read gold_prices"
  ON gold_prices FOR SELECT
  TO anon
  USING (true);

-- Allow service role full access (server-side API routes)
CREATE POLICY "Service role full access gold_prices"
  ON gold_prices FOR ALL
  TO service_role
  USING (true);

CREATE POLICY "Service role full access fetch_logs"
  ON fetch_logs FOR ALL
  TO service_role
  USING (true);

-- ═══════════════════════════════════════════════════════════
-- SEED DATA (30 days of dummy data for development)
-- Delete this section before production
-- ═══════════════════════════════════════════════════════════

-- Generate 30 days of dummy Antam data
INSERT INTO gold_prices (date, source, price_sell, price_buy, created_by)
SELECT
  CURRENT_DATE - (n || ' days')::INTERVAL,
  'antam',
  1050000 + (random() * 80000 - 40000)::NUMERIC(15,2),
  1020000 + (random() * 80000 - 40000)::NUMERIC(15,2),
  'system'
FROM generate_series(0, 29) AS n
ON CONFLICT (date, source) DO NOTHING;

-- Generate 30 days of dummy International data
INSERT INTO gold_prices (date, source, price_sell, usd_rate, usd_price, created_by)
SELECT
  CURRENT_DATE - (n || ' days')::INTERVAL,
  'international',
  1040000 + (random() * 80000 - 40000)::NUMERIC(15,2),
  16000 + (random() * 200 - 100)::NUMERIC(10,2),
  3350 + (random() * 100 - 50)::NUMERIC(10,4),
  'system'
FROM generate_series(0, 29) AS n
ON CONFLICT (date, source) DO NOTHING;

-- Generate sparse Nasril data (only ~15 of 30 days, to simulate gaps)
INSERT INTO gold_prices (date, source, price_sell, created_by)
SELECT
  CURRENT_DATE - (n || ' days')::INTERVAL,
  'nasril',
  1045000 + (random() * 60000 - 30000)::NUMERIC(15,2),
  'admin'
FROM generate_series(0, 29) AS n
WHERE random() > 0.5  -- ~50% chance of having data
ON CONFLICT (date, source) DO NOTHING;
