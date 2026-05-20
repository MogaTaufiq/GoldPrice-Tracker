import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ 
    hash: process.env.ADMIN_PASSWORD_HASH ?? 'NOT SET',
    typeofHash: typeof process.env.ADMIN_PASSWORD_HASH,
    allEnvKeys: Object.keys(process.env).filter(k => k.includes('PASSWORD') || k.includes('ADMIN'))
  })
}
