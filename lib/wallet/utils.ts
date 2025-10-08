/**
 * Wallet Utility Functions for VitalCV
 */

/**
 * Convert Ethereum address to DID
 *
 * Uses did:ethr method for Ethereum addresses
 *
 * @param address - Ethereum address
 * @returns DID string
 */
export function addressToDID(address: string): string {
  return `did:ethr:${address.toLowerCase()}`
}

/**
 * Convert public key to hex string
 *
 * @param publicKey - Public key bytes or string
 * @returns Hex-encoded public key
 */
export function publicKeyToHex(publicKey: Uint8Array | string): string {
  if (typeof publicKey === 'string') {
    return publicKey.startsWith('0x') ? publicKey.substring(2) : publicKey
  }
  return Array.from(publicKey)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Extract DID method from DID string
 *
 * @param did - DID string
 * @returns DID method (e.g., "ethr", "key", "web")
 */
export function getDIDMethod(did: string): string {
  const parts = did.split(':')
  return parts.length >= 2 ? parts[1] : 'unknown'
}

/**
 * Extract identifier from DID string
 *
 * @param did - DID string
 * @returns Identifier portion
 */
export function getDIDIdentifier(did: string): string {
  const parts = did.split(':')
  return parts.length >= 3 ? parts.slice(2).join(':') : ''
}

/**
 * Validate DID format
 *
 * @param did - DID string
 * @returns True if valid DID format
 */
export function isValidDID(did: string): boolean {
  const didRegex = /^did:[a-z0-9]+:[a-zA-Z0-9._-]+$/
  return didRegex.test(did)
}

/**
 * Validate Ethereum address
 *
 * @param address - Ethereum address
 * @returns True if valid address format
 */
export function isValidEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

/**
 * Shorten address for display
 *
 * @param address - Full address
 * @param startChars - Characters to show at start
 * @param endChars - Characters to show at end
 * @returns Shortened address
 */
export function shortenAddress(
  address: string,
  startChars: number = 6,
  endChars: number = 4
): string {
  if (!address) return ''
  if (address.length <= startChars + endChars) return address
  return `${address.substring(0, startChars)}...${address.substring(address.length - endChars)}`
}

/**
 * Shorten DID for display
 *
 * @param did - Full DID
 * @returns Shortened DID
 */
export function shortenDID(did: string): string {
  const identifier = getDIDIdentifier(did)
  const method = getDIDMethod(did)
  const shortened = shortenAddress(identifier, 8, 6)
  return `did:${method}:${shortened}`
}

/**
 * Format chain ID to hex string
 *
 * @param chainId - Chain ID number
 * @returns Hex-encoded chain ID
 */
export function chainIdToHex(chainId: number): string {
  return `0x${chainId.toString(16)}`
}

/**
 * Parse hex chain ID to number
 *
 * @param chainIdHex - Hex-encoded chain ID
 * @returns Chain ID number
 */
export function hexToChainId(chainIdHex: string): number {
  return parseInt(chainIdHex, 16)
}

/**
 * Get chain name from chain ID
 *
 * @param chainId - Chain ID
 * @returns Chain name or "Unknown Chain"
 */
export function getChainName(chainId: number): string {
  const chains: Record<number, string> = {
    1: 'Ethereum Mainnet',
    11155111: 'Sepolia',
    137: 'Polygon',
    80001: 'Mumbai',
    42161: 'Arbitrum',
    10: 'Optimism',
  }
  return chains[chainId] || `Unknown Chain (${chainId})`
}

/**
 * Store wallet connection in local storage
 *
 * @param connection - Wallet connection data
 */
export function storeWalletConnection(connection: {
  provider: string
  address: string
  did: string
}): void {
  if (typeof window === 'undefined') return
  localStorage.setItem('vitalcv_wallet', JSON.stringify(connection))
}

/**
 * Load wallet connection from local storage
 *
 * @returns Stored wallet connection or null
 */
export function loadWalletConnection(): {
  provider: string
  address: string
  did: string
} | null {
  if (typeof window === 'undefined') return null
  const stored = localStorage.getItem('vitalcv_wallet')
  return stored ? JSON.parse(stored) : null
}

/**
 * Clear wallet connection from local storage
 */
export function clearWalletConnection(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem('vitalcv_wallet')
}
