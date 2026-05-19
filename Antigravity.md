# 🪐 Antigravity.md — AI Assistant Context

> This file is specifically for the Antigravity AI assistant.
> Read this at the start of every session on this project.

---

## Quick Project Identity

| Field | Value |
|---|---|
| **Project** | Gold Price Tracker (InvestManagement) |
| **Owner** | Family private use |
| **Stack** | Next.js 14 + Supabase + Vercel + Chart.js |
| **Language** | TypeScript |
| **Styling** | Vanilla CSS (no Tailwind) |
| **Design** | Mobile-first, dark mode preferred, glassmorphism OK |

---

## My Role as Antigravity

- I am the **primary AI developer** for this project
- This is a **greenfield project** — I set up everything from scratch
- I must follow `agents.md`, `coding_standards.md`, and `architecture.md` strictly
- I must always read relevant docs **before** writing any code

---

## Conversation Context

### Answered Clarifications (from initial spec discussion)
| Question | Answer |
|---|---|
| Auth type | Simple password (bcrypt hash in ENV → JWT cookie) |
| CSV import | User will provide historical data CSV; format: `date,antam_jual,antam_beli,international,nasril` |
| Antam API key | Will be provided later (emas.maulanar.my.id — user creating account) |
| Yahoo + Frankfurter | Free APIs, no key needed |
| Data retention | 1 year |
| Backup | Auto CSV email every 3 months via Resend |
| Notifications | Deferred (not in v1.0) |

### Open Items (Pending from User)
1. ✅ **Antam API key** — Provided and configured in `.env.local`
2. ✅ **Historical CSV file** — Imported `harga_emas_lama.csv`
3. ⏳ **Admin password** — user to decide (I will bcrypt hash it)
4. ⏳ **Backup email address** — user to decide
3. ⏳ **Admin password** — user to decide (I will bcrypt hash it)
4. ⏳ **Backup email address** — user to decide

---

## Current Phase: Phase 1 — Foundation

### Completed ✅
- [x] architecture_proposal.md (approved by user)
- [x] agents.md
- [x] PRD.md
- [x] architecture.md
- [x] coding_standards.md
- [x] Antigravity.md
- [x] .env.example
- [x] Next.js 15 project scaffolded (upgraded from 14 for Node v24 compatibility)
- [x] Supabase client setup (`lib/supabase.ts`)
- [x] Auth system (bcrypt + JWT, `lib/auth.ts`)
- [x] Core library files: format.ts, fetch-logger.ts, moving-average.ts, stats.ts
- [x] API routes: /api/prices, /api/auth, /api/cron, /api/fetch, /api/logs
- [x] Middleware: JWT auth guard for /admin and protected API routes
- [x] International price fetcher (Yahoo Finance + Frankfurter)
- [x] Antam fetcher (implemented with emas.maulanar.my.id API)
- [x] Dashboard UI: header, price cards, chart, data table, fetch status bar, Nasril input form
- [x] Login page
- [x] Design system: globals.css with CSS tokens, glass cards, buttons
- [x] vercel.json cron config
- [x] data/supabase_setup.sql migration script
- [x] TypeScript: 0 errors ✅
- [x] Dev server running at http://localhost:3000 ✅
- [x] Create Supabase project and apply schema
- [x] Fill `.env.local` with real Supabase URL + keys
- [x] Import data historis via CSV (scripts/seed-csv.mjs)

### Next Steps — Phase 2 (Admin Panel Polish)
- [ ] Admin panel UI: full edit/delete row modal
- [ ] Admin panel UI: Log viewer for fetch_logs
- [ ] Web UI tool for CSV import (currently script-only)

---

## Design Direction

- **Dark mode** primary (gold price apps look premium in dark)
- **Color palette**:
  - Background: Deep navy/dark slate
  - Surface cards: Slightly lighter, glassmorphism effect
  - Antam Jual line: `#F5A623` (gold)
  - Antam Beli line: `#E67E22` (amber)
  - International line: `#3498DB` (blue)
  - Nasril line: `#2ECC71` (emerald)
  - Accent: Gold `#F5A623`
- **Typography**: Google Fonts — Inter (body), or Outfit (headings)
- **Chart**: Dark background, subtle grid, colored lines, smooth animations
- **Mobile**: Large tap targets, cards stack vertically, table scrolls horizontally

---

## Key Code Patterns to Always Follow

### 1. Error Handling in Fetchers
```ts
// ALWAYS wrap in try/catch → log → return result object
try {
  const data = await fetchSomething()
  await logFetchSuccess(source, duration)
  return { ok: true, data }
} catch (err) {
  await logFetchError(source, String(err), duration)
  return { ok: false, error: String(err) }
}
```

### 2. Supabase Upsert for Prices
```ts
await supabase
  .from('gold_prices')
  .upsert({ date, source, price_sell, ... }, { onConflict: 'date,source' })
```

### 3. Protected API Routes
```ts
const auth = await verifyAdmin(req)
if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
```

### 4. Formatting
```ts
import { formatRupiah, formatPercent } from '@/lib/format'
```

---

## Things to Remember

- ⚠️ **Nasril gaps**: Interpolate Nasril data to ensure unbroken chart lines, but only display points/dots where data actually exists.
- ⚠️ **SMA calc is client-side**, not in SQL
- ⚠️ **Cron time**: All Vercel Cron in UTC — 12:00 WIB = `0 5 * * *` UTC
- ⚠️ **Sanity check**: Always validate `1_000_000 ≤ price ≤ 5_000_000`
- ⚠️ **Trend signal thresholds**: ±2% from MA-30
- ⚠️ **JWT secret** and **Cron secret** must be validated in middleware, never skip

---

## Quick Reference: Data Source Endpoints

| Source | URL | Notes |
|---|---|---|
| Antam | `https://emas.maulanar.my.id/api/...` | Needs API key (Phase 2) |
| Yahoo Finance | `https://query1.finance.yahoo.com/v8/finance/chart/GC=F` | Free, no key |
| Frankfurter | `https://api.frankfurter.app/latest?from=USD&to=IDR` | Free, no key |
