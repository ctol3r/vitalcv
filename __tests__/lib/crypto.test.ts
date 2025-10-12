/**
 * Cryptographic Functions Tests
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import {
  generateKeyPair,
  exportKeyPair,
  exportPublicKeyJWK,
  resolveDid,
  getIssuerKeyPair,
  clearKeyCache,
  type KeyAlgorithm,
} from '@/lib/crypto/keys'
import { signJWT, verifyJWT, decodeJWT, signCredentialJWT, signProofJWT, verifyProofJWT } from '@/lib/crypto/jwt'

describe('Cryptographic Key Generation', () => {
  afterEach(() => {
    clearKeyCache()
  })

  describe('Key Pair Generation', () => {
    const algorithms: KeyAlgorithm[] = ['ES256', 'ES256K', 'EdDSA']

    for (const alg of algorithms) {
      it(`should generate ${alg} key pair`, () => {
        const keyPair = generateKeyPair(alg)

        expect(keyPair.algorithm).toBe(alg)
        expect(keyPair.publicKey).toBeTruthy()
        expect(keyPair.privateKey).toBeTruthy()
        expect(keyPair.kid).toBeTruthy()
        expect(keyPair.kid.length).toBe(16)
        expect(keyPair.did).toMatch(/^did:key:z/)
      })

      it(`should generate unique ${alg} key pairs`, () => {
        const keyPair1 = generateKeyPair(alg)
        const keyPair2 = generateKeyPair(alg)

        expect(keyPair1.kid).not.toBe(keyPair2.kid)
        expect(keyPair1.did).not.toBe(keyPair2.did)
      })
    }
  })

  describe('Key Export', () => {
    it('should export key pair to PEM format', () => {
      const keyPair = generateKeyPair('ES256')
      const exported = exportKeyPair(keyPair)

      expect(exported.privateKeyPem).toContain('BEGIN PRIVATE KEY')
      expect(exported.privateKeyPem).toContain('END PRIVATE KEY')
      expect(exported.publicKeyPem).toContain('BEGIN PUBLIC KEY')
      expect(exported.publicKeyPem).toContain('END PUBLIC KEY')
      expect(exported.privateKeyBase64).toBeTruthy()
      expect(exported.publicKeyBase64).toBeTruthy()
    })

    it('should export public key to JWK format', () => {
      const keyPair = generateKeyPair('ES256')
      const jwk = exportPublicKeyJWK(keyPair)

      expect(jwk.kty).toBe('EC')
      expect(jwk.crv).toBe('P-256')
      expect(jwk.x).toBeTruthy()
      expect(jwk.y).toBeTruthy()
      expect(jwk.kid).toBe(keyPair.kid)
      expect(jwk.alg).toBe('ES256')
      expect(jwk.use).toBe('sig')
      expect(jwk.d).toBeUndefined() // Should not export private key
    })

    it('should export EdDSA public key to JWK', () => {
      const keyPair = generateKeyPair('EdDSA')
      const jwk = exportPublicKeyJWK(keyPair)

      expect(jwk.kty).toBe('OKP')
      expect(jwk.crv).toBe('Ed25519')
      expect(jwk.x).toBeTruthy()
      expect(jwk.kid).toBe(keyPair.kid)
      expect(jwk.alg).toBe('EdDSA')
    })
  })

  describe('DID Resolution', () => {
    it('should resolve issuer DID:key', () => {
      clearKeyCache()
      const keyPair = getIssuerKeyPair() // Cache it
      const jwk = resolveDid(keyPair.did)

      expect(jwk).toBeTruthy()
      expect(jwk?.kid).toBe(keyPair.kid)
      expect(jwk?.alg).toBe(keyPair.algorithm)
      expect(jwk?.x).toBeTruthy()
    })

    it('should return null for uncached DID', () => {
      clearKeyCache()
      const tempKeyPair = generateKeyPair('ES256')
      const jwk = resolveDid(tempKeyPair.did)

      // Should return null since it's not cached
      expect(jwk).toBeNull()
    })

    it('should return null for invalid DID', () => {
      const jwk = resolveDid('did:invalid:123')
      expect(jwk).toBeNull()
    })

    it('should return null for malformed DID:key', () => {
      const jwk = resolveDid('did:key:invalid')
      expect(jwk).toBeNull()
    })

    it('should resolve DID after caching', () => {
      clearKeyCache()
      const keyPair = getIssuerKeyPair()

      // First resolution should work (cached)
      const jwk1 = resolveDid(keyPair.did)
      expect(jwk1).toBeTruthy()

      // Second resolution should also work
      const jwk2 = resolveDid(keyPair.did)
      expect(jwk2).toBeTruthy()
      expect(jwk1?.kid).toBe(jwk2?.kid)
    })
  })

  describe('Issuer Key Pair Singleton', () => {
    it('should return same key pair on multiple calls', () => {
      const keyPair1 = getIssuerKeyPair()
      const keyPair2 = getIssuerKeyPair()

      expect(keyPair1.kid).toBe(keyPair2.kid)
      expect(keyPair1.did).toBe(keyPair2.did)
    })

    it('should generate new key pair after cache clear', () => {
      const keyPair1 = getIssuerKeyPair()
      clearKeyCache()
      const keyPair2 = getIssuerKeyPair()

      expect(keyPair1.kid).not.toBe(keyPair2.kid)
      expect(keyPair1.did).not.toBe(keyPair2.did)
    })
  })
})

describe('JWT Signing and Verification', () => {
  afterEach(() => {
    clearKeyCache()
  })

  describe('JWT Signing', () => {
    it('should sign JWT with ES256', async () => {
      const keyPair = generateKeyPair('ES256')
      const payload = { sub: '1234567890', name: 'Test User', iat: Date.now() / 1000 }

      const jwt = await signJWT(payload, keyPair)

      expect(jwt).toBeTruthy()
      expect(jwt.split('.')).toHaveLength(3)
    })

    it('should include correct header in JWT', async () => {
      const keyPair = generateKeyPair('ES256')
      const payload = { sub: 'test' }

      const jwt = await signJWT(payload, keyPair)
      const decoded = decodeJWT(jwt)

      expect(decoded.header?.alg).toBe('ES256')
      expect(decoded.header?.typ).toBe('JWT')
      expect(decoded.header?.kid).toBe(keyPair.kid)
    })

    it('should encode payload correctly', async () => {
      const keyPair = generateKeyPair('ES256')
      const payload = { sub: 'test', name: 'Test User', admin: true }

      const jwt = await signJWT(payload, keyPair)
      const decoded = decodeJWT(jwt)

      expect(decoded.payload?.sub).toBe('test')
      expect(decoded.payload?.name).toBe('Test User')
      expect(decoded.payload?.admin).toBe(true)
    })

    it('should sign with EdDSA', async () => {
      const keyPair = generateKeyPair('EdDSA')
      const payload = { sub: 'test' }

      const jwt = await signJWT(payload, keyPair)
      const decoded = decodeJWT(jwt)

      expect(decoded.header?.alg).toBe('EdDSA')
      expect(jwt.split('.')).toHaveLength(3)
    })
  })

  describe('JWT Verification', () => {
    it('should verify valid JWT', async () => {
      const keyPair = generateKeyPair('ES256')
      const payload = { sub: 'test', iat: Math.floor(Date.now() / 1000) }

      const jwt = await signJWT(payload, keyPair)
      const result = await verifyJWT(jwt, keyPair)

      expect(result.valid).toBe(true)
      expect(result.payload?.sub).toBe('test')
      expect(result.error).toBeUndefined()
    })

    it('should reject tampered JWT', async () => {
      const keyPair = generateKeyPair('ES256')
      const payload = { sub: 'test' }

      const jwt = await signJWT(payload, keyPair)
      const parts = jwt.split('.')
      // Tamper with payload
      const tamperedPayload = Buffer.from(JSON.stringify({ sub: 'hacker' })).toString('base64url')
      const tamperedJwt = `${parts[0]}.${tamperedPayload}.${parts[2]}`

      const result = await verifyJWT(tamperedJwt, keyPair)

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Invalid signature')
    })

    it('should reject expired JWT', async () => {
      const keyPair = generateKeyPair('ES256')
      const payload = {
        sub: 'test',
        iat: Math.floor(Date.now() / 1000) - 3600,
        exp: Math.floor(Date.now() / 1000) - 1800, // Expired 30 minutes ago
      }

      const jwt = await signJWT(payload, keyPair)
      const result = await verifyJWT(jwt, keyPair)

      expect(result.valid).toBe(false)
      expect(result.error).toBe('JWT expired')
    })

    it('should reject JWT before nbf', async () => {
      const keyPair = generateKeyPair('ES256')
      const payload = {
        sub: 'test',
        iat: Math.floor(Date.now() / 1000),
        nbf: Math.floor(Date.now() / 1000) + 3600, // Not valid for 1 hour
      }

      const jwt = await signJWT(payload, keyPair)
      const result = await verifyJWT(jwt, keyPair)

      expect(result.valid).toBe(false)
      expect(result.error).toBe('JWT not yet valid')
    })

    it('should verify with EdDSA', async () => {
      const keyPair = generateKeyPair('EdDSA')
      const payload = { sub: 'test', iat: Math.floor(Date.now() / 1000) }

      const jwt = await signJWT(payload, keyPair)
      const result = await verifyJWT(jwt, keyPair)

      expect(result.valid).toBe(true)
    })
  })

  describe('JWT Decoding', () => {
    it('should decode JWT without verification', async () => {
      const keyPair = generateKeyPair('ES256')
      const payload = { sub: 'test', name: 'Test User' }

      const jwt = await signJWT(payload, keyPair)
      const decoded = decodeJWT(jwt)

      expect(decoded.header?.alg).toBe('ES256')
      expect(decoded.payload?.sub).toBe('test')
      expect(decoded.payload?.name).toBe('Test User')
      expect(decoded.error).toBeUndefined()
    })

    it('should handle malformed JWT', () => {
      const decoded = decodeJWT('invalid.jwt')

      expect(decoded.header).toBeUndefined()
      expect(decoded.payload).toBeUndefined()
      expect(decoded.error).toBeTruthy()
    })
  })

  describe('Credential JWT Signing', () => {
    it('should sign credential JWT', async () => {
      clearKeyCache()
      const credential = {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiableCredential', 'TestCredential'],
        issuer: 'did:key:test',
        credentialSubject: {
          id: 'did:example:subject',
          name: 'Test Subject',
        },
      }

      const jwt = await signCredentialJWT({
        credential,
        issuerId: 'did:key:test',
        subjectId: 'did:example:subject',
        expiresIn: 3600,
      })

      expect(jwt).toBeTruthy()
      expect(jwt.split('.')).toHaveLength(3)

      const decoded = decodeJWT(jwt)
      expect(decoded.payload?.vc).toEqual(credential)
      expect(decoded.payload?.iss).toBe('did:key:test')
      expect(decoded.payload?.sub).toBe('did:example:subject')
      expect(decoded.payload?.exp).toBeTruthy()
      expect(decoded.payload?.jti).toBeTruthy()
    })
  })

  describe('Proof JWT', () => {
    it('should sign proof JWT', async () => {
      clearKeyCache()
      const jwt = await signProofJWT({
        nonce: 'test-nonce-123',
        audience: 'https://issuer.example.com',
        holder: 'did:example:holder',
      })

      const decoded = decodeJWT(jwt)
      expect(decoded.payload?.nonce).toBe('test-nonce-123')
      expect(decoded.payload?.aud).toBe('https://issuer.example.com')
      expect(decoded.payload?.iss).toBe('did:example:holder')
      expect(decoded.payload?.exp).toBeTruthy()
    })

    it('should verify proof JWT', async () => {
      clearKeyCache()
      const nonce = 'test-nonce-456'
      const audience = 'https://issuer.example.com'
      const holder = 'did:example:holder'

      const jwt = await signProofJWT({ nonce, audience, holder })

      const result = await verifyProofJWT({
        jwt,
        expectedNonce: nonce,
        expectedAudience: audience,
      })

      expect(result.valid).toBe(true)
      expect(result.holder).toBe(holder)
      expect(result.error).toBeUndefined()
    })

    it('should reject proof JWT with wrong nonce', async () => {
      clearKeyCache()
      const jwt = await signProofJWT({
        nonce: 'test-nonce-789',
        audience: 'https://issuer.example.com',
        holder: 'did:example:holder',
      })

      const result = await verifyProofJWT({
        jwt,
        expectedNonce: 'wrong-nonce',
        expectedAudience: 'https://issuer.example.com',
      })

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Invalid nonce')
    })

    it('should reject proof JWT with wrong audience', async () => {
      clearKeyCache()
      const nonce = 'test-nonce-abc'
      const jwt = await signProofJWT({
        nonce,
        audience: 'https://issuer.example.com',
        holder: 'did:example:holder',
      })

      const result = await verifyProofJWT({
        jwt,
        expectedNonce: nonce,
        expectedAudience: 'https://wrong-issuer.com',
      })

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Invalid audience')
    })
  })
})
