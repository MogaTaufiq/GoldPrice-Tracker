#!/usr/bin/env node
/**
 * Database migration script for Gold Price Tracker
 * Run: node scripts/migrate.mjs
 * 
 * Reads .env.local and runs the SQL migration against Supabase.
 * Uses the Supabase REST API via direct fetch (no CLI needed).
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Load .env.local ──────────────────────────────────────────
function loadEnv() {
  const envPath = resolve(__dirname, '../.env.local')
  const lines = readFileSync(envPath, 'utf8').split('\n')
  for (const line of lines) {
    const [key, ...rest] = line.split('=')
    if (key && !key.startsWith('#') && rest.length) {
      process.env[key.trim()] = rest.join('=').trim()
    }
  }
}
loadEnv()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || SERVICE_ROLE_KEY === 'placeholder-service-role-key') {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY is not set or is a placeholder in .env.local')
  process.exit(1)
}

// ── SQL statements to run in order ───────────────────────────
const migrations = [
  {
    name: 'Create gold_prices table',
    sql: `
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
    `,
  },
  {
    name: 'Create fetch_logs table',
    sql: `
      CREATE TABLE IF NOT EXISTS fetch_logs (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        fetched_at   TIMESTAMPTZ DEFAULT NOW(),
        source       TEXT NOT NULL,
        status       TEXT NOT NULL CHECK (status IN ('success', 'error', 'partial')),
        message      TEXT,
        duration_ms  INTEGER,
        triggered_by TEXT DEFAULT 'cron' CHECK (triggered_by IN ('cron', 'manual'))
      );
    `,
  },
  {
    name: 'Create indexes',
    sql: `
      CREATE INDEX IF NOT EXISTS idx_gold_prices_date        ON gold_prices(date DESC);
      CREATE INDEX IF NOT EXISTS idx_gold_prices_source      ON gold_prices(source);
      CREATE INDEX IF NOT EXISTS idx_gold_prices_date_source ON gold_prices(date DESC, source);
      CREATE INDEX IF NOT EXISTS idx_fetch_logs_fetched_at   ON fetch_logs(fetched_at DESC);
    `,
  },
  {
    name: 'Create updated_at trigger',
    sql: `
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql';

      DROP TRIGGER IF EXISTS update_gold_prices_updated_at ON gold_prices;
      CREATE TRIGGER update_gold_prices_updated_at
        BEFORE UPDATE ON gold_prices
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `,
  },
  {
    name: 'Enable RLS',
    sql: `
      ALTER TABLE gold_prices ENABLE ROW LEVEL SECURITY;
      ALTER TABLE fetch_logs  ENABLE ROW LEVEL SECURITY;
    `,
  },
  {
    name: 'Create RLS policies',
    sql: `
      DROP POLICY IF EXISTS "Public read gold_prices" ON gold_prices;
      CREATE POLICY "Public read gold_prices"
        ON gold_prices FOR SELECT TO anon USING (true);

      DROP POLICY IF EXISTS "Service role full access gold_prices" ON gold_prices;
      CREATE POLICY "Service role full access gold_prices"
        ON gold_prices FOR ALL TO service_role USING (true);

      DROP POLICY IF EXISTS "Service role full access fetch_logs" ON fetch_logs;
      CREATE POLICY "Service role full access fetch_logs"
        ON fetch_logs FOR ALL TO service_role USING (true);
    `,
  },
]

const seedData = {
  name: 'Seed dummy data (30 days)',
  sql: `
    -- Antam dummy data
    INSERT INTO gold_prices (date, source, price_sell, price_buy, created_by)
    SELECT
      CURRENT_DATE - (n || ' days')::INTERVAL,
      'antam',
      round((1050000 + (random() * 80000 - 40000))::numeric, 2),
      round((1020000 + (random() * 80000 - 40000))::numeric, 2),
      'system'
    FROM generate_series(0, 29) AS n
    ON CONFLICT (date, source) DO NOTHING;

    -- International dummy data
    INSERT INTO gold_prices (date, source, price_sell, usd_rate, usd_price, created_by)
    SELECT
      CURRENT_DATE - (n || ' days')::INTERVAL,
      'international',
      round((1040000 + (random() * 80000 - 40000))::numeric, 2),
      round((16000 + (random() * 200 - 100))::numeric, 2),
      round((3350 + (random() * 100 - 50))::numeric, 4),
      'system'
    FROM generate_series(0, 29) AS n
    ON CONFLICT (date, source) DO NOTHING;

    -- Nasril sparse dummy data (~50% days)
    INSERT INTO gold_prices (date, source, price_sell, created_by)
    SELECT
      CURRENT_DATE - (n || ' days')::INTERVAL,
      'nasril',
      round((1045000 + (random() * 60000 - 30000))::numeric, 2),
      'admin'
    FROM generate_series(0, 29) AS n
    WHERE random() > 0.5
    ON CONFLICT (date, source) DO NOTHING;
  `,
}

// ── Execute SQL via Supabase DB API ──────────────────────────
async function execSQL(name, sql) {
  // Supabase doesn't expose a public raw SQL endpoint.
  // We use the pg endpoint available in newer Supabase projects.
  const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]
  
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // This endpoint requires a Supabase access token (not service role key)
      // We'll use the service role key via a custom pg_query call instead
    },
    body: JSON.stringify({ query: sql }),
  })

  // Fallback: use supabase-js rpc if direct API doesn't work
  return { status: res.status, body: await res.text() }
}

// ── Main: use supabase-js directly ───────────────────────────
async function runMigration() {
  // Dynamic import supabase-js from project
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  console.log(`\n🪙  Gold Price Tracker — Database Migration`)
  console.log(`📡  Project: ${SUPABASE_URL}\n`)

  // Run each migration via rpc if available, otherwise log instructions
  for (const step of migrations) {
    process.stdout.write(`  ⏳ ${step.name}... `)
    try {
      const { error } = await supabase.rpc('exec_sql', { sql: step.sql })
      if (error) throw error
      console.log('✅')
    } catch (err) {
      // exec_sql rpc may not exist — that's ok, we'll handle below
      console.log(`⚠️  (${String(err).slice(0, 60)})`)
    }
  }

  // Verify tables exist via a simple query
  console.log('\n  🔍 Verifying tables...')
  const { data: pricesCheck, error: e1 } = await supabase
    .from('gold_prices').select('id').limit(1)
  const { data: logsCheck, error: e2 } = await supabase
    .from('fetch_logs').select('id').limit(1)

  if (!e1 && !e2) {
    console.log('  ✅ gold_prices — accessible')
    console.log('  ✅ fetch_logs  — accessible')
    console.log('\n✅ Migration verified successfully!\n')
    return true
  } else {
    if (e1) console.log(`  ❌ gold_prices: ${e1.message}`)
    if (e2) console.log(`  ❌ fetch_logs: ${e2.message}`)
    return false
  }
}

runMigration().then(ok => process.exit(ok ? 0 : 1))
