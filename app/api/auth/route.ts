import { NextRequest, NextResponse } from 'next/server'
import { verifyPassword, signAdminToken, COOKIE_NAME } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { password } = body

    if (!password || typeof password !== 'string') {
      return NextResponse.json({ error: 'Password required' }, { status: 400 })
    }

    const isValid = await verifyPassword(password)
    if (!isValid) {
      return NextResponse.json({ error: 'Password salah' }, { status: 401 })
    }

    const token = await signAdminToken()

    const response = NextResponse.json({ ok: true })
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    })

    return response
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE() {
  // Logout: clear cookie
  const response = NextResponse.json({ ok: true })
  response.cookies.set(COOKIE_NAME, '', {
    path: '/',
    maxAge: 0,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })
  return response
}
