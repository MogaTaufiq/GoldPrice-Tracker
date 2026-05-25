# 📋 PRD.md — Product Requirements Document

> Gold Price Tracker
> Version: 1.0 | Status: In Progress | Owner: Family

---

## 1. Product Overview

**What**: A private web app for family use to track gold prices from multiple sources over time.

**Why**: Help the family make informed buy/sell decisions based on price trends — not speculation.

**Who**: Family members (viewers) + one admin (Nasril data entry + management).

---

## 2. Users & Roles

| Role | Access | Description |
|---|---|---|
| **Viewer** | Public (no login) | Lihat dashboard, chart, data table |
| **Admin** | Password-protected | Semua viewer access + input/edit/delete Nasril + manual fetch trigger + error log |

---

## 3. Data Sources

### 3.1 Antam
- **Source**: emas.maulanar.my.id API
- **Fields**: Harga Jual (price_sell), Harga Beli (price_buy) in IDR/gram
- **Update**: Daily automatic, 1:00 PM WIB
- **Sanity check**: Rp 1,000,000 – Rp 5,000,000/gram
- **On error**: Log to `fetch_logs`, show last known value with ⚠️ warning

### 3.2 International
- **Source**: Yahoo Finance (USD price) + Frankfurter (USD→IDR rate)
- **Formula**: `(usd_price / 31.1035) × usd_rate`
- **Fields**: price_sell in IDR/gram
- **Update**: Daily automatic, 1:00 PM WIB
- **Sanity check**: Same as Antam
- **On error**: Same as Antam

### 3.3 Nasril
- **Source**: Manual input via Admin panel form
- **Fields**: price_sell in IDR/gram
- **Frequency**: Inconsistent — not every day
- **Timestamp**: Auto-set to Asia/Jakarta timezone
- **Permissions**: Admin can input, edit, delete

---

## 4. Features

### 4.1 Dashboard (Public)

#### Chart
- Line chart with 4 lines: Antam Jual, Antam Beli, International, Nasril
- Date range picker: 7d / 14d / 30d / All-time
- Default range: 30 days
- Moving Average overlays (toggleable): SMA-7, SMA-14, SMA-30
- Antam + International: smooth interpolation across gaps
- Nasril: smooth interpolation across gaps, but dots only show on days with data
- Touch-friendly (mobile pinch/scroll)
- Y-axis: Rp per gram, formatted as "Rp 1,05 jt"

#### Summary Cards (4 cards)
Each card shows one source and contains:
- Today's price (most recent)
- % change vs yesterday
- % change vs 1 month ago
- Trend signal: **Murah / Normal / Mahal** (based on MA-30)

#### Stats Row
- Highest price this period
- Lowest price this period
- Date of high/low

#### Data Table
- Columns: Date | Antam Jual | Antam Beli | International | Nasril | Status
- Status: ✅ OK (all present) / ⚠️ Partial (some missing) / blank (only Nasril missing = normal)
- Sortable by date (default: newest first)
- Horizontal scroll on mobile

### 4.2 Admin Panel (Protected)

#### Nasril Input Form
- Fields: Tanggal (date picker, default today) + Harga (number input, Rp)
- Validation: price > 0, date not in future
- On submit: insert to DB with `created_by='admin'`

#### Edit/Delete
- Click any row in data table → edit modal
- Can edit: Antam Jual, Antam Beli, International, Nasril, Date
- Delete: Soft warning before delete ("Yakin mau hapus?")

#### Manual Fetch Trigger
- "Fetch Sekarang" button
- Triggers the same fetch as cron (Antam + International)
- Shows loading state + result (success/partial/error)

#### Error Log Viewer
- Table of `fetch_logs`: Date | Source | Status | Message | Duration
- Filter by status (success/error/partial)
- Newest first, paginated (20 per page)

---

## 5. Trend Signal Logic

| Signal | Condition | Color |
|---|---|---|
| 🟢 **Murah** | Harga ≤ MA-30 × 0.98 | Green |
| 🟡 **Normal** | MA-30 × 0.98 < Harga < MA-30 × 1.02 | Yellow |
| 🔴 **Mahal** | Harga ≥ MA-30 × 1.02 | Red |

Primary signal source: **Antam Jual** (most relevant for buy decisions).

---

## 6. Automated Systems

### 6.1 Daily Price Fetch (Cron)
- **Time**: 1:00 PM WIB every day (Vercel Cron: `0 6 * * *` UTC)
- **Sources**: Antam + International (Nasril is manual only)
- **Behavior**: Log result regardless of success/failure

### 6.2 Data Cleanup (Monthly Cron)
- **Time**: 1st of each month
- **Action**: Delete `gold_prices` records older than 365 days
- **Action**: Delete `fetch_logs` records older than 90 days

### 6.3 Backup Email (Quarterly Cron)
- **Time**: 1 January, April, July, October at 12:00 WIB
- **Action**: Export all `gold_prices` as CSV → send via Resend email
- **To**: Configured email address in ENV
- **Filename**: `gold_backup_YYYY-MM.csv`

---

## 7. Data Import (Historical)

- Admin can upload CSV with historical data
- Format: `date,antam_jual,antam_beli,international,nasril`
- Empty cells = no data for that source on that date (normal)
- Duplicate dates: upsert (overwrite existing)

---

## 8. Non-Requirements (Out of Scope v1.0)

- ❌ Email price alerts / notifications
- ❌ Multi-user auth (only one admin)
- ❌ Native mobile app
- ❌ Price prediction / ML
- ❌ Portfolio tracking (how much gold owned)
- ❌ Multiple currencies

---

## 9. UX Requirements

- **Mobile-first**: All views must work on 375px viewport
- **Touch-friendly**: Buttons ≥ 44px tap target
- **Chart on mobile**: Touch pan + zoom
- **Table on mobile**: Horizontal scroll with fixed Date column
- **Loading states**: Show skeleton loaders while fetching
- **Error states**: Show friendly message, never blank screen

---

## 10. Last Update Status Badge

Shown in header/dashboard:
- ✅ `"Last update: 12:00 PM"` — if today's fetch was successful
- ⚠️ `"Last update: 11:55 AM (partial)"` — if one source failed
- ❌ `"Last update: Yesterday (error)"` — if today's fetch completely failed
