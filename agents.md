# 🤖 agents.md — AI Agent Instructions

> Gold Price Tracker (InvestManagement)
> Read this file at the START of every session.

---

## Project Overview

A family-facing web app to track gold prices (Antam, International, Nasril) with daily auto-fetch, interactive charts, and an admin panel. Built with Next.js 14, Supabase, and deployed on Vercel.

**Key constraint**: This is a family app — keep UX simple, mobile-first, and non-technical-user-friendly.

---

## Mandatory Pre-Task Checklist

Before writing any code, always:

1. **Read** `architecture.md` — understand the full system design
2. **Read** `PRD.md` — understand features and user stories
3. **Read** `coding_standards.md` — follow all conventions exactly
4. **Check** `.env.example` — know which env vars are needed
5. **Check** current branch: never commit directly to `main`

---

## Project File Map

```
InvestManagement/
├── agents.md            ← You are here
├── Antigravity.md       ← AI-specific shortcuts and context
├── PRD.md               ← Product Requirements Document
├── architecture.md      ← Technical architecture
├── coding_standards.md  ← Code style and conventions
├── .env.example         ← Required environment variables (no values)
├── app/                 ← Next.js App Router pages + API routes
├── components/          ← React components
├── lib/                 ← Utilities, fetchers, calculations
└── data/                ← CSV import files (gitignored if sensitive)
```

---

## Core Business Rules (Never Break These)

| Rule | Detail |
|---|---|
| **Sanity check** | Gold price must be Rp 1,000,000 – Rp 5,000,000 per gram |
| **No crashes on API error** | All fetchers MUST catch errors and log to `fetch_logs` |
| **Timezone** | All timestamps in `Asia/Jakarta` (WIB, UTC+7) |
| **Nasril gaps** | Interpolate linearly so chart lines don't break, but hide points |
| **Antam/Intl gaps** | Interpolate linearly when API was down |
| **Data retention** | Auto-delete records older than 365 days |
| **Auth** | Protect `/admin` and cron endpoints with JWT middleware |

---

## Data Sources

| Source | Method | Fields | Needs Key? |
|---|---|---|---|
| Antam | emas.maulanar.my.id API | price_sell, price_buy | ✅ Yes (configured) |
| International | Yahoo Finance + Frankfurter | price_sell (IDR/gram) | ❌ Free |
| Nasril | Manual form input by admin | price_sell | N/A |

---

## Task Workflow

### When Adding a New Feature
1. Check `PRD.md` to see if feature is already specced
2. Add/update component in `components/`
3. If new API endpoint: add to `app/api/`
4. If new env var needed: update `.env.example`
5. Test: mobile view first, then desktop

### When Fixing a Bug
1. Identify if error should be logged to `fetch_logs` table
2. Never throw unhandled errors — use try/catch + log pattern
3. If it's a UI bug: check mobile breakpoints first

### When Touching Data/DB
1. Never drop tables or delete columns without a migration plan
2. Use `ON CONFLICT (date, source) DO UPDATE` for upserts
3. Always validate: price > 0, date is valid, source is one of ('antam', 'international', 'nasril')

---

## Do Not Do

- ❌ Use `any` TypeScript type — use proper types from `types/` or inline
- ❌ Commit `.env.local` or any actual credentials
- ❌ Install heavy libraries (no lodash, moment.js — use native)
- ❌ Add notifications/email alerts (deferred to later phase)
- ❌ Add multi-user auth (single admin password only)
- ❌ Use `console.log` for errors — use the `logFetchError()` utility

---

## Current Phase Status

Phase 1 and 2 are completed. Currently entering **Phase 3 (Polish)**.
See `architecture.md` → Section 11 (Development Phases) for full phase breakdown.
