# 📐 coding_standards.md — Code Style & Conventions

> Gold Price Tracker
> All contributors (human + AI) must follow these standards.

---

## 1. Language & TypeScript

- **TypeScript strict mode**: enabled (`"strict": true` in tsconfig)
- **No `any` type**: Always define explicit types; use `unknown` if unsure
- **Shared types**: Define in `types/index.ts`, import from there
- **Type names**: PascalCase (e.g., `GoldPrice`, `FetchLog`, `DateRange`)

```ts
// ✅ Good
const price: GoldPrice = { date: '2025-01-01', source: 'antam', price_sell: 1050000 }

// ❌ Bad
const price: any = { ... }
```

---

## 2. File & Folder Naming

| Type | Convention | Example |
|---|---|---|
| React components | PascalCase | `GoldChart.tsx`, `PriceCard.tsx` |
| Utility files | kebab-case | `moving-average.ts`, `supabase.ts` |
| API routes | lowercase folder | `app/api/prices/route.ts` |
| CSS files | kebab-case | `price-card.css` |
| Types | kebab-case | `types/index.ts` |

---

## 3. Component Structure

Every component file follows this order:

```tsx
// 1. Imports (React first, then lib, then types, then styles)
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { GoldPrice } from '@/types'
import styles from './price-card.module.css'  // or import './price-card.css'

// 2. Types (local to this file only)
interface Props {
  price: GoldPrice
  className?: string
}

// 3. Component (one default export per file)
export default function PriceCard({ price, className }: Props) {
  // 4. State
  const [isExpanded, setIsExpanded] = useState(false)

  // 5. Derived values / calculations
  const formattedPrice = formatRupiah(price.price_sell)

  // 6. Handlers
  function handleToggle() { setIsExpanded(prev => !prev) }

  // 7. JSX
  return (
    <div className={`price-card ${className ?? ''}`}>
      ...
    </div>
  )
}
```

---

## 4. CSS Conventions

- **No TailwindCSS** — use vanilla CSS with CSS custom properties
- **Global tokens** defined in `app/globals.css` under `:root`
- **Component styles**: co-located CSS file (e.g., `price-card.css`) or CSS modules
- **Mobile-first** media queries: `@media (min-width: 768px)` for desktop

```css
/* ✅ Good — token-based */
.price-card {
  background: var(--color-surface);
  border-radius: var(--radius-md);
  padding: var(--spacing-4);
}

/* ❌ Bad — hardcoded magic numbers */
.price-card {
  background: #1a1a2e;
  border-radius: 12px;
  padding: 16px;
}
```

### CSS Token Names (defined in globals.css)
```css
:root {
  /* Colors */
  --color-bg: ;
  --color-surface: ;
  --color-border: ;
  --color-text-primary: ;
  --color-text-muted: ;
  --color-antam-jual: #F5A623;
  --color-antam-beli: #E67E22;
  --color-international: #3498DB;
  --color-nasril: #2ECC71;
  --color-success: #27AE60;
  --color-warning: #F39C12;
  --color-error: #E74C3C;

  /* Spacing (4px base) */
  --spacing-1: 4px;
  --spacing-2: 8px;
  --spacing-3: 12px;
  --spacing-4: 16px;
  --spacing-6: 24px;
  --spacing-8: 32px;

  /* Typography */
  --font-family: 'Inter', system-ui, sans-serif;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.125rem;
  --font-size-xl: 1.25rem;
  --font-size-2xl: 1.5rem;

  /* Radius */
  --radius-sm: 6px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 24px;
}
```

---

## 5. Error Handling Pattern

**All API fetchers MUST use this pattern:**

```ts
// lib/fetchers/antam.ts
import { logFetchError, logFetchSuccess } from '@/lib/fetch-logger'

export async function fetchAntamPrice(): Promise<FetchResult> {
  const start = Date.now()
  try {
    const res = await fetch(ANTAM_API_URL, { ... })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    
    const data = await res.json()
    const price = parsAntamPrice(data)
    
    // Sanity check
    if (price < 1_000_000 || price > 5_000_000) {
      throw new Error(`Price out of range: ${price}`)
    }
    
    await logFetchSuccess('antam', Date.now() - start)
    return { ok: true, price }
    
  } catch (err) {
    await logFetchError('antam', String(err), Date.now() - start)
    return { ok: false, error: String(err) }
  }
}
```

**Never:**
```ts
// ❌ Never let errors bubble up unhandled
const data = await fetch(url).then(r => r.json())
```

---

## 6. Database Conventions

- **Upserts**: Always use `ON CONFLICT (date, source) DO UPDATE` for price inserts
- **Queries**: Use Supabase client, never raw SQL from API routes (use service role for server)
- **Date format**: `YYYY-MM-DD` string for `date` column (not datetime)
- **Timezone**: Store all timestamps in UTC (Supabase default), display in WIB

```ts
// ✅ Correct upsert pattern
const { error } = await supabase
  .from('gold_prices')
  .upsert({
    date: '2025-01-01',
    source: 'antam',
    price_sell: 1050000,
    price_buy: 1020000,
    created_by: 'system',
  }, { onConflict: 'date,source' })
```

---

## 7. API Route Pattern

```ts
// app/api/prices/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    // 1. Parse params
    const range = req.nextUrl.searchParams.get('range') ?? '30d'
    
    // 2. Query DB
    const { data, error } = await supabase.from('gold_prices').select('*')
    if (error) throw error
    
    // 3. Return
    return NextResponse.json({ data })
    
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  // 1. Auth check for protected endpoints
  const auth = await verifyAdmin(req)
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  
  // ... rest of handler
}
```

---

## 8. Number Formatting

Always use the shared formatter — **never inline**:

```ts
// lib/format.ts
export function formatRupiah(value: number): string {
  if (value >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(2)} jt`
  return `Rp ${value.toLocaleString('id-ID')}`
}

export function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}
```

---

## 9. Imports

Use absolute imports via `@/` alias (configured in tsconfig):

```ts
// ✅ Good
import { supabase } from '@/lib/supabase'
import type { GoldPrice } from '@/types'

// ❌ Bad
import { supabase } from '../../../lib/supabase'
```

---

## 10. Git Conventions

- **Branch naming**: `feat/nasril-form`, `fix/antam-fetch-error`, `chore/update-deps`
- **Commit messages**: `feat: add Nasril input form`, `fix: handle API timeout in antam fetcher`
- **Never commit**: `.env.local`, actual API keys, `node_modules`
- **Never push directly to `main`**: Use PRs (even if solo project — good habit)
