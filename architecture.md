# 🏗️ architecture.md — Technical Architecture

> Gold Price Tracker | Version 1.0
> Last updated: 2026-05-19

---

## 1. Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Frontend** | Next.js 14 (App Router) | SSR untuk performa, built-in API routes, file-based routing |
| **Styling** | Vanilla CSS + CSS variables | Kontrol penuh, mobile-first, no external CSS framework |
| **Charts** | Chart.js + react-chartjs-2 | Ringan, touch-friendly, mudah custom MA overlay |
| **Backend** | Next.js API Routes | Tidak perlu server terpisah, semua dalam satu project |
| **Database** | Supabase (PostgreSQL) | Free tier, built-in REST API, auto-backup support |
| **Scheduler** | Vercel Cron Jobs | Trigger fetch 12:00 WIB setiap hari |
| **Hosting** | Vercel | Free tier, auto-deploy, terintegrasi Cron |
| **Email** | Resend (free tier) | Email backup CSV setiap 3 bulan |

---

## 2. Database Schema

### Table: `gold_prices`

```sql
CREATE TABLE gold_prices (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date        DATE NOT NULL,
  source      TEXT NOT NULL CHECK (source IN ('antam', 'international', 'nasril')),

  -- Harga dalam Rupiah per gram
  price_sell  NUMERIC(15,2),   -- Antam: harga jual; International: IDR/gram; Nasril: input
  price_buy   NUMERIC(15,2),   -- Antam: harga beli; NULL untuk sumber lain

  -- Metadata International
  usd_rate    NUMERIC(10,2),   -- Rate USD/IDR saat fetch
  usd_price   NUMERIC(10,4),   -- Harga emas USD/troy oz

  -- Audit
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  created_by  TEXT DEFAULT 'system',  -- 'system' atau 'admin'
  notes       TEXT,

  UNIQUE(date, source)
);

CREATE INDEX idx_gold_prices_date   ON gold_prices(date DESC);
CREATE INDEX idx_gold_prices_source ON gold_prices(source);
```

### Table: `fetch_logs`

```sql
CREATE TABLE fetch_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fetched_at   TIMESTAMPTZ DEFAULT NOW(),
  source       TEXT NOT NULL,
  status       TEXT NOT NULL CHECK (status IN ('success', 'error', 'partial')),
  message      TEXT,
  duration_ms  INTEGER,
  triggered_by TEXT DEFAULT 'cron'   -- 'cron' atau 'manual'
);

CREATE INDEX idx_fetch_logs_fetched_at ON fetch_logs(fetched_at DESC);
```

---

## 3. Project Structure

```
InvestManagement/
├── agents.md                     # AI agent instructions
├── Antigravity.md                # AI assistant context
├── PRD.md                        # Product requirements
├── architecture.md               # This file
├── coding_standards.md           # Code style guide
├── .env.example                  # Required env vars (no values)
│
├── app/                          # Next.js App Router
│   ├── (dashboard)/
│   │   ├── page.tsx              # Dashboard utama (public)
│   │   └── layout.tsx
│   ├── admin/
│   │   ├── page.tsx              # Admin panel (protected)
│   │   └── layout.tsx
│   ├── api/
│   │   ├── prices/
│   │   │   ├── route.ts          # GET all prices (filter by range/source)
│   │   │   └── [id]/route.ts     # PUT/DELETE single price record
│   │   ├── fetch/
│   │   │   └── route.ts          # POST manual trigger (admin only)
│   │   ├── cron/
│   │   │   └── route.ts          # GET Vercel Cron endpoint
│   │   ├── backup/
│   │   │   └── route.ts          # GET quarterly backup (Cron)
│   │   ├── cleanup/
│   │   │   └── route.ts          # GET monthly data cleanup (Cron)
│   │   ├── logs/
│   │   │   └── route.ts          # GET fetch_logs (admin only)
│   │   ├── auth/
│   │   │   └── route.ts          # POST login → set JWT cookie
│   │   └── import/
│   │       └── route.ts          # POST CSV import (admin only)
│   ├── globals.css
│   └── layout.tsx
│
├── components/
│   ├── chart/
│   │   ├── GoldChart.tsx         # Line chart utama + MA overlay
│   │   └── ChartControls.tsx     # Toggle MA buttons + date range picker
│   ├── dashboard/
│   │   ├── PriceCard.tsx         # Card: today price + % change + trend signal
│   │   ├── TrendSignal.tsx       # Murah/Normal/Mahal badge
│   │   └── StatsRow.tsx          # High/Low this period
│   ├── table/
│   │   └── PriceTable.tsx        # Sortable, scrollable data table
│   ├── admin/
│   │   ├── NasrilForm.tsx        # Form input harga Nasril
│   │   ├── EditModal.tsx         # Edit/delete row modal
│   │   ├── FetchButton.tsx       # Manual fetch trigger
│   │   └── LogViewer.tsx         # Error log viewer
│   └── ui/
│       ├── StatusBadge.tsx       # ✅/⚠️/❌ status indicators
│       ├── Modal.tsx             # Reusable modal wrapper
│       └── SkeletonCard.tsx      # Loading skeleton
│
├── lib/
│   ├── supabase.ts               # Supabase client (browser + server)
│   ├── auth.ts                   # JWT sign/verify, password hash compare
│   ├── fetchers/
│   │   ├── antam.ts              # Fetch dari emas.maulanar.my.id
│   │   ├── international.ts      # Yahoo Finance + Frankfurter
│   │   └── index.ts              # Orchestrator (run all fetchers)
│   └── calculations/
│       ├── moving-average.ts     # SMA calculator (7/14/30)
│       └── stats.ts              # % change, high/low, trend signal
│
├── middleware.ts                 # Next.js middleware: auth guard for /admin
├── types/
│   └── index.ts                  # Shared TypeScript types
│
├── data/                         # CSV import files
│   └── .gitkeep
│
├── vercel.json                   # Cron job schedule config
├── .env.example                  # Template env vars
└── package.json
```

---

## 4. API Routes Reference

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/prices` | Public | Fetch prices with `?range=30d&sources=antam,nasril` |
| PUT | `/api/prices/[id]` | Admin | Update a price record |
| DELETE | `/api/prices/[id]` | Admin | Delete a price record |
| POST | `/api/prices` | Admin | Insert new Nasril price |
| POST | `/api/fetch` | Admin | Manually trigger price fetch |
| GET | `/api/cron` | Cron Secret | Daily auto-fetch (called by Vercel) |
| GET | `/api/backup` | Cron Secret | Quarterly CSV backup + email |
| GET | `/api/cleanup` | Cron Secret | Monthly data retention cleanup |
| GET | `/api/logs` | Admin | Fetch error/audit logs |
| POST | `/api/auth` | Public | Login with admin password |
| POST | `/api/import` | Admin | Upload historical CSV |

---

## 5. Data Flow

### Daily Auto-Fetch
```
Vercel Cron 12:00 WIB
  └── GET /api/cron (validates CRON_SECRET header)
        ├── lib/fetchers/index.ts → runAllFetchers()
        │     ├── antam.ts     → fetch + sanity check → upsert gold_prices
        │     └── international.ts → fetch + convert + sanity check → upsert
        └── Log result to fetch_logs (status, duration, message)
```

### Chart Data
```
Frontend mount
  └── GET /api/prices?range=30d
        └── Supabase query: SELECT * FROM gold_prices WHERE date >= (today - 30d)
              ├── Group by source in JS
              ├── Calculate SMA-7/14/30 in lib/calculations/moving-average.ts
              └── Pass to GoldChart.tsx → Chart.js render
```

---

## 6. Authentication

**Strategy**: Stateless JWT in httpOnly cookie.

```
Login flow:
  POST /api/auth { password }
    → bcrypt.compare(password, ADMIN_PASSWORD_HASH)
    → if match: sign JWT (24h) → Set-Cookie: token=JWT; HttpOnly; SameSite=Lax
    → middleware.ts checks cookie on all /admin/* routes
```

No database table for users — single admin, password stored as bcrypt hash in ENV.

---

## 7. Moving Average Calculation

```
SMA(N, date) = average of price_sell for the N days ending on date (inclusive)
```

- Calculated **client-side** (in JS, not SQL) for toggle flexibility
- Gap handling:
  - Antam/International/Nasril: use linear interpolation to fill gaps before MA calc and rendering.
  - Nasril dots only render on days with actual data.
- If fewer than N days of data exist, that MA point is `null` (not rendered)

---

## 8. Trend Signal

```
"Murah"  ← price_sell ≤ SMA(30) × 0.98
"Normal" ← SMA(30) × 0.98 < price_sell < SMA(30) × 1.02
"Mahal"  ← price_sell ≥ SMA(30) × 1.02
```

---

## 9. Cron Schedule (vercel.json)

All times in UTC. WIB = UTC+7.

| Job | UTC Schedule | WIB Time |
|---|---|---|
| Daily price fetch | `0 6 * * *` | 13:00 WIB daily |
| Monthly cleanup | `0 5 1 * *` | 12:00 WIB, 1st of month |
| Quarterly backup | `0 5 1 1,4,7,10 *` | 12:00 WIB, Jan/Apr/Jul/Oct 1st |

---

## 10. Environment Variables

See `.env.example` for full list. Key vars:

| Var | Description |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase access (never expose to client) |
| `NEXT_PUBLIC_SUPABASE_*` | Client-safe Supabase credentials |
| `ADMIN_PASSWORD_HASH` | bcrypt hash of admin password |
| `JWT_SECRET` | Random string to sign JWT tokens |
| `ANTAM_API_KEY` | API key for emas.maulanar.my.id (add in Phase 2) |
| `CRON_SECRET` | Header secret to verify Vercel Cron requests |
| `RESEND_API_KEY` | For quarterly backup emails |
| `BACKUP_EMAIL_TO` | Destination email for backup |

---

## 11. Development Phases

### Phase 1 — Foundation (✅ Completed)
- [x] Create markdown docs: agents.md, PRD.md, architecture.md, coding_standards.md, Antigravity.md, .env.example
- [x] Setup Next.js project + Supabase
- [x] Database schema + seed data dummy
- [x] Basic dashboard UI (chart + cards)
- [x] Fetcher: International (Yahoo + Frankfurter) — tidak butuh API key

### Phase 2 — Core Features (✅ Completed)
- [x] Fetcher: Antam (menggunakan emas.maulanar.my.id API)
- [x] Admin panel: Nasril input (terintegrasi di dashboard)
- [x] Cron job setup (vercel.json)
- [x] CSV import tool (via script `scripts/seed-csv.mjs`)

### Phase 3 — Polish
- [ ] Moving averages + toggle UI
- [ ] Trend signal logic + display
- [ ] Error log viewer
- [ ] Backup email system (Resend)

### Phase 4 — Deploy
- [ ] Deploy ke Vercel
- [ ] Setup semua env vars di Vercel dashboard
- [ ] Test cron job (manual trigger)
- [ ] Import data historis via CSV
