/**
 * Wallet Integration Types for VitalCV
 *
 * Type definitions for multi-wallet support including MetaMask,
 * WalletConnect, and custom wallet providers.
 */

export type WalletProvider = 'metamask' | 'walletconnect' | 'universal-wallet'

export interface WalletConnection {
  provider: WalletProvider
  address: string
  did: string
  publicKey: string
  chainId?: number
  connected: boolean
  lastConnected: Date
}

export interface WalletState {
  connection: WalletConnection | null
  isConnecting: boolean
  error: string | null
}

export interface WalletActions {
  connect: (provider: WalletProvider) => Promise<void>
  disconnect: () => Promise<void>
  signMessage: (message: string) => Promise<string>
  switchChain: (chainId: number) => Promise<void>
}

export interface Wallet extends WalletState, WalletActions {}

// MetaMask-specific types
export interface MetaMaskProvider {
  isMetaMask?: boolean
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  on: (event: string, handler: (...args: unknown[]) => void) => void
  removeListener: (event: string, handler: (...args: unknown[]) => void) => void
}

// WalletConnect-specific types
export interface WalletConnectOptions {
  projectId: string
  chains: number[]
  metadata: {
    name: string
    description: string
    url: string
    icons: string[]
  }
}

// Ethereum window extension
declare global {
  interface Window {
    ethereum?: MetaMaskProvider
  }
}

// Chain configuration
export interface ChainConfig {
  chainId: number
  name: string
  rpcUrl: string
  blockExplorer?: string
  nativeCurrency: {
    name: string
    symbol: string
    decimals: number
  }
}

// Common chains
export const CHAINS: Record<string, ChainConfig> = {
  ethereum: {
    chainId: 1,
    name: 'Ethereum Mainnet',
    rpcUrl: 'https://eth.llamarpc.com',
    blockExplorer: 'https://etherscan.io',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
  },
  sepolia: {
    chainId: 11155111,
    name: 'Sepolia Testnet',
    rpcUrl: 'https://rpc.sepolia.org',
    blockExplorer: 'https://sepolia.etherscan.io',
    nativeCurrency: {
      name: 'Sepolia Ether',
      symbol: 'SEP',
      decimals: 18,
    },
  },
  polygon: {
    chainId: 137,
    name: 'Polygon Mainnet',
    rpcUrl: 'https://polygon-rpc.com',
    blockExplorer: 'https://polygonscan.com',
    nativeCurrency: {
      name: 'MATIC',
      symbol: 'MATIC',
      decimals: 18,
    },
  },
}
