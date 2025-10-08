import { randomBytes, createHash } from 'crypto'
import { ed25519 } from '@noble/curves/ed25519'
import { sha256 } from '@noble/hashes/sha256'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils'
import jwt from 'jsonwebtoken'
import { prisma } from '@/lib/prisma'

/**
 * DID Authentication Utilities for VitalCV
 *
 * Implements W3C DID authentication using challenge-response flow
 * with Ed25519 signatures.
 */

export interface DIDAuthChallenge {
  challenge: string
  nonce: string
  expiresAt: Date
}

export interface DIDAuthResult {
  valid: boolean
  userId?: string
  did?: string
  error?: string
}

export interface JWTPayload {
  userId: string
  did: string
  type: 'access' | 'refresh'
}

/**
 * Generate a cryptographic challenge for DID authentication
 *
 * @param did - Decentralized Identifier
 * @returns Challenge object with nonce and expiry
 */
export async function generateAuthChallenge(did: string): Promise<DIDAuthChallenge> {
  // Generate random 32-byte challenge
  const challengeBytes = randomBytes(32)
  const challenge = bytesToHex(challengeBytes)

  // Generate unique nonce
  const nonce = randomBytes(16).toString('base64')

  // Set expiry to 5 minutes from now
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000)

  // Find or create user
  let user = await prisma.user.findUnique({ where: { did } })

  if (!user) {
    // Create new user with temporary public key (will be updated on verification)
    user = await prisma.user.create({
      data: {
        did,
        publicKey: '', // Will be set during verification
      },
    })
  }

  // Store challenge in database
  await prisma.authChallenge.create({
    data: {
      userId: user.id,
      challenge,
      nonce,
      expiresAt,
      used: false,
    },
  })

  return { challenge, nonce, expiresAt }
}

/**
 * Create authentication message for signing
 *
 * @param did - Decentralized Identifier
 * @param challenge - Authentication challenge
 * @param nonce - Unique nonce
 * @returns Formatted message string
 */
export function createAuthMessage(did: string, challenge: string, nonce: string): string {
  return `VitalCV Authentication Request

Please sign this message to authenticate your DID.

DID: ${did}
Challenge: ${challenge}
Nonce: ${nonce}
Timestamp: ${new Date().toISOString()}

This signature will be used to verify your identity.`
}

/**
 * Verify DID signature using Ed25519
 *
 * @param message - Original message that was signed
 * @param signature - Hex-encoded signature
 * @param publicKey - Hex-encoded public key
 * @returns True if signature is valid
 */
export function verifyEd25519Signature(
  message: string,
  signature: string,
  publicKey: string
): boolean {
  try {
    // Hash the message
    const messageHash = sha256(new TextEncoder().encode(message))

    // Convert hex strings to bytes
    const signatureBytes = hexToBytes(signature)
    const publicKeyBytes = hexToBytes(publicKey)

    // Verify signature
    return ed25519.verify(signatureBytes, messageHash, publicKeyBytes)
  } catch (error) {
    console.error('Signature verification error:', error)
    return false
  }
}

/**
 * Verify DID authentication response
 *
 * @param did - Decentralized Identifier
 * @param challenge - Challenge string
 * @param signature - Signature of the challenge
 * @param publicKey - Public key for verification
 * @returns Authentication result
 */
export async function verifyDIDAuth(
  did: string,
  challenge: string,
  signature: string,
  publicKey: string
): Promise<DIDAuthResult> {
  try {
    // Find the challenge in database
    const authChallenge = await prisma.authChallenge.findFirst({
      where: {
        challenge,
        used: false,
      },
      include: {
        user: true,
      },
    })

    if (!authChallenge) {
      return { valid: false, error: 'Invalid or expired challenge' }
    }

    // Check if challenge has expired
    if (authChallenge.expiresAt < new Date()) {
      await prisma.authChallenge.update({
        where: { id: authChallenge.id },
        data: { used: true },
      })
      return { valid: false, error: 'Challenge has expired' }
    }

    // Verify the DID matches
    if (authChallenge.user.did !== did) {
      return { valid: false, error: 'DID mismatch' }
    }

    // Create the expected message
    const message = createAuthMessage(did, challenge, authChallenge.nonce)

    // Verify the signature
    const isValidSignature = verifyEd25519Signature(message, signature, publicKey)

    if (!isValidSignature) {
      return { valid: false, error: 'Invalid signature' }
    }

    // Mark challenge as used
    await prisma.authChallenge.update({
      where: { id: authChallenge.id },
      data: { used: true },
    })

    // Update user's public key if not set or changed
    if (authChallenge.user.publicKey !== publicKey) {
      await prisma.user.update({
        where: { id: authChallenge.user.id },
        data: {
          publicKey,
          lastLoginAt: new Date(),
        },
      })
    } else {
      await prisma.user.update({
        where: { id: authChallenge.user.id },
        data: {
          lastLoginAt: new Date(),
        },
      })
    }

    return {
      valid: true,
      userId: authChallenge.user.id,
      did: authChallenge.user.did,
    }
  } catch (error) {
    console.error('DID authentication error:', error)
    return { valid: false, error: 'Authentication failed' }
  }
}

/**
 * Generate JWT access token
 *
 * @param userId - User ID
 * @param did - Decentralized Identifier
 * @returns JWT token string
 */
export function generateAccessToken(userId: string, did: string): string {
  const secret = process.env.JWT_SECRET || 'development-secret-change-in-production'
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d'

  const payload: JWTPayload = {
    userId,
    did,
    type: 'access',
  }

  return jwt.sign(payload, secret, { expiresIn })
}

/**
 * Generate JWT refresh token
 *
 * @param userId - User ID
 * @param did - Decentralized Identifier
 * @returns JWT token string
 */
export function generateRefreshToken(userId: string, did: string): string {
  const secret = process.env.JWT_SECRET || 'development-secret-change-in-production'
  const expiresIn = process.env.REFRESH_TOKEN_EXPIRES_IN || '30d'

  const payload: JWTPayload = {
    userId,
    did,
    type: 'refresh',
  }

  return jwt.sign(payload, secret, { expiresIn })
}

/**
 * Verify JWT token
 *
 * @param token - JWT token string
 * @returns Decoded payload or null if invalid
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const secret = process.env.JWT_SECRET || 'development-secret-change-in-production'
    const decoded = jwt.verify(token, secret) as JWTPayload
    return decoded
  } catch (error) {
    console.error('Token verification error:', error)
    return null
  }
}

/**
 * Create session in database
 *
 * @param userId - User ID
 * @param accessToken - Access token
 * @param refreshToken - Refresh token
 * @param request - HTTP request for metadata
 * @returns Session ID
 */
export async function createSession(
  userId: string,
  accessToken: string,
  refreshToken: string,
  request?: Request
): Promise<string> {
  // Get IP address and user agent from request
  const ipAddress = request?.headers.get('x-forwarded-for') || request?.headers.get('x-real-ip')
  const userAgent = request?.headers.get('user-agent')

  // Calculate expiry (7 days for access, 30 days for refresh)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  const session = await prisma.session.create({
    data: {
      userId,
      token: accessToken,
      refreshToken,
      expiresAt,
      ipAddress: ipAddress || undefined,
      userAgent: userAgent || undefined,
    },
  })

  return session.id
}

/**
 * Invalidate session
 *
 * @param token - Access token or refresh token
 */
export async function invalidateSession(token: string): Promise<void> {
  await prisma.session.deleteMany({
    where: {
      OR: [{ token }, { refreshToken: token }],
    },
  })
}

/**
 * Refresh access token
 *
 * @param refreshToken - Refresh token
 * @returns New access and refresh tokens, or null if invalid
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<{ accessToken: string; refreshToken: string } | null> {
  try {
    // Verify refresh token
    const payload = verifyToken(refreshToken)
    if (!payload || payload.type !== 'refresh') {
      return null
    }

    // Find session
    const session = await prisma.session.findFirst({
      where: { refreshToken },
      include: { user: true },
    })

    if (!session) {
      return null
    }

    // Check if session has expired
    if (session.expiresAt < new Date()) {
      await prisma.session.delete({ where: { id: session.id } })
      return null
    }

    // Generate new tokens
    const newAccessToken = generateAccessToken(session.user.id, session.user.did)
    const newRefreshToken = generateRefreshToken(session.user.id, session.user.did)

    // Update session
    await prisma.session.update({
      where: { id: session.id },
      data: {
        token: newAccessToken,
        refreshToken: newRefreshToken,
        lastActive: new Date(),
      },
    })

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    }
  } catch (error) {
    console.error('Token refresh error:', error)
    return null
  }
}

/**
 * Clean up expired challenges
 * Should be run periodically (e.g., via cron job)
 */
export async function cleanupExpiredChallenges(): Promise<number> {
  const result = await prisma.authChallenge.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  })
  return result.count
}

/**
 * Clean up expired sessions
 * Should be run periodically (e.g., via cron job)
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  })
  return result.count
}
