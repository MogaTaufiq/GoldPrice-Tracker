import { NextRequest, NextResponse } from 'next/server'

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? 'fallback-secret-change-me')
const COOKIE_NAME = 'invest_admin_token'

// Routes that require admin authentication
const PROTECTED_PAGES = ['/admin']
// /api/fetch POST is protected but can also be called with CRON_SECRET
const PROTECTED_API = ['/api/import', '/api/prices', '/api/logs']
const PROTECTED_API_WITH_FETCH_EXCEPTION = ['/api/fetch']

async function verifyJWT(token: string, secret: Uint8Array): Promise<boolean> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return false
    const [headerB64, payloadB64, signatureB64] = parts

    const base64urlDecode = (str: string) => {
      let base64 = str.replace(/-/g, '+').replace(/_/g, '/')
      while (base64.length % 4) {
        base64 += '='
      }
      return atob(base64)
    }

    // Decode header and verify alg is HS256
    const header = JSON.parse(base64urlDecode(headerB64))
    if (header.alg !== 'HS256') return false

    // Decode payload and verify expiration
    const payload = JSON.parse(base64urlDecode(payloadB64))
    if (payload.exp && Date.now() / 1000 >= payload.exp) {
      return false
    }

    // Import the secret key for HMAC verification
    const key = await crypto.subtle.importKey(
      'raw',
      secret as unknown as ArrayBuffer,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    )

    // Decode signature to binary array
    const sigStr = base64urlDecode(signatureB64)
    const sigBuf = new Uint8Array(sigStr.length)
    for (let i = 0; i < sigStr.length; i++) {
      sigBuf[i] = sigStr.charCodeAt(i)
    }

    // Verify signature
    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`)
    return await crypto.subtle.verify('HMAC', key, sigBuf as unknown as ArrayBuffer, data as unknown as ArrayBuffer)
  } catch {
    return false
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Check if visiting /login and already authenticated
  if (pathname === '/login') {
    const token = req.cookies.get(COOKIE_NAME)?.value
    if (token) {
      const isValid = await verifyJWT(token, JWT_SECRET)
      if (isValid) {
        return NextResponse.redirect(new URL('/admin', req.url))
      }
    }
    return NextResponse.next()
  }

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

    const isValid = await verifyJWT(token, JWT_SECRET)
    if (!isValid) {
      if (isProtectedPage) {
        return NextResponse.redirect(new URL('/login', req.url))
      }
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }
  }

  // Protect cron endpoint with CRON_SECRET header or Vercel scheduled request header
  if (pathname.startsWith('/api/cron') || pathname.startsWith('/api/backup') || pathname.startsWith('/api/cleanup')) {
    const authHeader = req.headers.get('authorization')
    const isBearerSecret = authHeader === `Bearer ${process.env.CRON_SECRET}`
    const cronSecret = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret')
    const isVercelCron = req.headers.get('x-vercel-cron') === 'true' || req.headers.has('x-vercel-cron-job-name')

    if (cronSecret !== process.env.CRON_SECRET && !isVercelCron && !isBearerSecret) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/admin',
    '/admin/:path*',
    '/login',
    '/api/fetch',
    '/api/import',
    '/api/logs/:path*',
    '/api/prices/:path*',
    '/api/cron',
    '/api/backup',
    '/api/cleanup'
  ],
}

