/**
 * OIDC4VCI Storage Layer
 *
 * In-memory and Redis-backed storage for offers, tokens, and nonces
 * with TTL support. Feature-flagged for Redis.
 */

import type { StoredOffer, StoredToken, StoredNonce } from './types'

// In-memory fallback storage
const inMemoryStorage = {
  offers: new Map<string, StoredOffer>(),
  tokens: new Map<string, StoredToken>(),
  nonces: new Map<string, StoredNonce>(),
}

// Feature flag for Redis
const REDIS_ENABLED = process.env.ENABLE_REDIS === 'true'
const REDIS_URL = process.env.REDIS_URL

let redisClient: any = null

/**
 * Initialize Redis client if enabled
 */
export async function initRedis() {
  if (!REDIS_ENABLED || !REDIS_URL) {
    console.log('[Storage] Redis disabled, using in-memory storage')
    return
  }

  try {
    // Dynamically import Redis only if enabled
    const { createClient } = await import('redis')
    redisClient = createClient({ url: REDIS_URL })

    redisClient.on('error', (err: Error) => {
      console.error('[Redis] Error:', err)
    })

    await redisClient.connect()
    console.log('[Storage] Redis connected successfully')
  } catch (error) {
    console.error('[Storage] Redis initialization failed, falling back to in-memory:', error)
    redisClient = null
  }
}

/**
 * Store a credential offer
 */
export async function storeOffer(code: string, offer: StoredOffer): Promise<void> {
  const ttlSeconds = Math.floor((offer.expires_at - Date.now()) / 1000)

  if (redisClient) {
    try {
      await redisClient.setEx(`offer:${code}`, ttlSeconds, JSON.stringify(offer))
      return
    } catch (error) {
      console.error('[Storage] Redis storeOffer failed:', error)
    }
  }

  // Fallback to in-memory
  inMemoryStorage.offers.set(code, offer)
  setTimeout(() => inMemoryStorage.offers.delete(code), ttlSeconds * 1000)
}

/**
 * Get a credential offer
 */
export async function getOffer(code: string): Promise<StoredOffer | null> {
  if (redisClient) {
    try {
      const data = await redisClient.get(`offer:${code}`)
      return data ? JSON.parse(data) : null
    } catch (error) {
      console.error('[Storage] Redis getOffer failed:', error)
    }
  }

  // Fallback to in-memory
  const offer = inMemoryStorage.offers.get(code)
  if (!offer) return null

  // Check expiry
  if (Date.now() > offer.expires_at) {
    inMemoryStorage.offers.delete(code)
    return null
  }

  return offer
}

/**
 * Mark offer as redeemed (atomic operation)
 */
export async function redeemOffer(code: string): Promise<boolean> {
  if (redisClient) {
    try {
      const data = await redisClient.get(`offer:${code}`)
      if (!data) return false

      const offer: StoredOffer = JSON.parse(data)
      if (offer.redeemed) return false

      offer.redeemed = true
      const ttlSeconds = Math.floor((offer.expires_at - Date.now()) / 1000)
      if (ttlSeconds > 0) {
        await redisClient.setEx(`offer:${code}`, ttlSeconds, JSON.stringify(offer))
      }
      return true
    } catch (error) {
      console.error('[Storage] Redis redeemOffer failed:', error)
      return false
    }
  }

  // Fallback to in-memory
  const offer = inMemoryStorage.offers.get(code)
  if (!offer || offer.redeemed || Date.now() > offer.expires_at) {
    return false
  }

  offer.redeemed = true
  inMemoryStorage.offers.set(code, offer)
  return true
}

/**
 * Store an access token
 */
export async function storeToken(token: string, data: StoredToken): Promise<void> {
  const ttlSeconds = Math.floor((data.expires_at - Date.now()) / 1000)

  if (redisClient) {
    try {
      await redisClient.setEx(`token:${token}`, ttlSeconds, JSON.stringify(data))
      return
    } catch (error) {
      console.error('[Storage] Redis storeToken failed:', error)
    }
  }

  // Fallback to in-memory
  inMemoryStorage.tokens.set(token, data)
  setTimeout(() => inMemoryStorage.tokens.delete(token), ttlSeconds * 1000)
}

/**
 * Get token data
 */
export async function getToken(token: string): Promise<StoredToken | null> {
  if (redisClient) {
    try {
      const data = await redisClient.get(`token:${token}`)
      return data ? JSON.parse(data) : null
    } catch (error) {
      console.error('[Storage] Redis getToken failed:', error)
    }
  }

  // Fallback to in-memory
  const tokenData = inMemoryStorage.tokens.get(token)
  if (!tokenData) return null

  // Check expiry
  if (Date.now() > tokenData.expires_at) {
    inMemoryStorage.tokens.delete(token)
    return null
  }

  return tokenData
}

/**
 * Store a nonce
 */
export async function storeNonce(nonce: string, data: StoredNonce): Promise<void> {
  const ttlSeconds = Math.floor((data.expires_at - Date.now()) / 1000)

  if (redisClient) {
    try {
      await redisClient.setEx(`nonce:${nonce}`, ttlSeconds, JSON.stringify(data))
      return
    } catch (error) {
      console.error('[Storage] Redis storeNonce failed:', error)
    }
  }

  // Fallback to in-memory
  inMemoryStorage.nonces.set(nonce, data)
  setTimeout(() => inMemoryStorage.nonces.delete(nonce), ttlSeconds * 1000)
}

/**
 * Get nonce data
 */
export async function getNonce(nonce: string): Promise<StoredNonce | null> {
  if (redisClient) {
    try {
      const data = await redisClient.get(`nonce:${nonce}`)
      return data ? JSON.parse(data) : null
    } catch (error) {
      console.error('[Storage] Redis getNonce failed:', error)
    }
  }

  // Fallback to in-memory
  const nonceData = inMemoryStorage.nonces.get(nonce)
  if (!nonceData) return null

  // Check expiry
  if (Date.now() > nonceData.expires_at) {
    inMemoryStorage.nonces.delete(nonce)
    return null
  }

  return nonceData
}

/**
 * Check Redis health
 */
export async function checkRedisHealth(): Promise<boolean> {
  if (!redisClient) return false

  try {
    await redisClient.ping()
    return true
  } catch (error) {
    console.error('[Storage] Redis health check failed:', error)
    return false
  }
}

/**
 * Clear all storage (for testing)
 */
export async function clearAllStorage(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.flushDb()
    } catch (error) {
      console.error('[Storage] Redis clearAllStorage failed:', error)
    }
  }

  inMemoryStorage.offers.clear()
  inMemoryStorage.tokens.clear()
  inMemoryStorage.nonces.clear()
}
