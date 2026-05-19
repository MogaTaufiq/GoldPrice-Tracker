import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import type { AuthPayload } from '@/types'

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? 'fallback-secret-change-me')
const COOKIE_NAME = 'invest_admin_token'
const TOKEN_EXPIRY = '24h'

// ─── Password ────────────────────────────────────────────────

/**
 * Verify an incoming plain-text password against the stored bcrypt hash.
 * The hash is loaded from ENV at runtime (never stored in DB).
 */
export async function verifyPassword(plainPassword: string): Promise<boolean> {
  const hash = process.env.ADMIN_PASSWORD_HASH
  if (!hash) {
    console.error('[auth] ADMIN_PASSWORD_HASH is not set')
    return false
  }
  return bcrypt.compare(plainPassword, hash)
}

// ─── JWT ─────────────────────────────────────────────────────

export async function signAdminToken(): Promise<string> {
  return new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(JWT_SECRET)
}

export async function verifyAdminToken(token: string): Promise<AuthPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as unknown as AuthPayload
  } catch {
    return null
  }
}

// ─── Cookie helpers (Server Components / API Routes) ─────────

export async function getAdminTokenFromCookies(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(COOKIE_NAME)?.value ?? null
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const token = await getAdminTokenFromCookies()
  if (!token) return false
  const payload = await verifyAdminToken(token)
  return payload?.role === 'admin'
}

export { COOKIE_NAME }
