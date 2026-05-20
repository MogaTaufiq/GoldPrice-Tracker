import test from 'node:test'
import assert from 'node:assert'
import { SignJWT } from 'jose'

const secret = new TextEncoder().encode('my-super-secret-key-that-is-long-enough')

// This is the exact implementation used in middleware.ts
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

test('verifyJWT - valid, invalid, expired tokens', async () => {
  // Sign a valid token using jose
  const validToken = await new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret)

  // Verify valid token
  assert.strictEqual(await verifyJWT(validToken, secret), true)

  // Verify invalid signature (tampered)
  const tamperedToken = validToken + 'a'
  assert.strictEqual(await verifyJWT(tamperedToken, secret), false)

  // Sign an expired token
  const expiredToken = await new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('-1s') // expired immediately
    .sign(secret)

  // Verify expired token fails
  assert.strictEqual(await verifyJWT(expiredToken, secret), false)

  // Sign a token with an unsupported algorithm (e.g., HS384)
  const badAlgToken = await new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS384' })
    .setIssuedAt()
    .sign(secret)

  // Verify bad alg fails
  assert.strictEqual(await verifyJWT(badAlgToken, secret), false)
})
