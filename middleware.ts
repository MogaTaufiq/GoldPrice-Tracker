import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? 'fallback-secret-change-me')
const COOKIE_NAME = 'invest_admin_token'

// Routes that require admin authentication
const PROTECTED_PAGES = ['/admin']
// /api/fetch POST is protected but can also be called with CRON_SECRET
const PROTECTED_API = ['/api/import', '/api/prices', '/api/logs']
const PROTECTED_API_WITH_FETCH_EXCEPTION = ['/api/fetch']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Check if this is a protected page
  const isProtectedPage = PROTECTED_PAGES.some(p => pathname.startsWith(p))

  // Check if this is a protected API (write operations, logs)
  const isProtectedAPI = PROTECTED_API.some(p => pathname.startsWith(p)) &&
    ['POST', 'PUT', 'DELETE'].includes(req.method)

  // /api/fetch: open (no auth needed) — only writes gold prices using server-side service_role key
  const isFetchAPI = PROTECTED_API_WITH_FETCH_EXCEPTION.some(p => pathname.startsWith(p))
  if (isFetchAPI) return NextResponse.next()

  // /api/logs is protected for all methods
  const isLogsAPI = pathname.startsWith('/api/logs')

  if (isProtectedPage || isProtectedAPI || isLogsAPI) {
    const token = req.cookies.get(COOKIE_NAME)?.value
    if (!token) {
      if (isProtectedPage) {
        return NextResponse.redirect(new URL('/login', req.url))
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
      await jwtVerify(token, JWT_SECRET)
    } catch {
      if (isProtectedPage) {
        return NextResponse.redirect(new URL('/login', req.url))
      }
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }
  }

  // Protect cron endpoint with CRON_SECRET header
  if (pathname.startsWith('/api/cron') || pathname.startsWith('/api/backup') || pathname.startsWith('/api/cleanup')) {
    const cronSecret = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret')
    if (cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/api/fetch', '/api/import', '/api/logs/:path*', '/api/prices/:path*', '/api/cron', '/api/backup', '/api/cleanup'],
}
