'use client'

/**
 * useWallet Hook for VitalCV
 *
 * React hook for managing wallet connections and authentication.
 */

import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { WalletProvider, WalletConnection, Wallet } from './types'
import { metamask } from './providers/metamask'
import {
  storeWalletConnection,
  loadWalletConnection,
  clearWalletConnection,
} from './utils'

interface WalletContextType extends Wallet {
  authenticateWithDID: () => Promise<void>
  isAuthenticated: boolean
}

const WalletContext = createContext<WalletContextType | null>(null)

/**
 * Wallet Provider Component
 *
 * Wrap your app with this component to enable wallet functionality.
 *
 * @example
 * <WalletProvider>
 *   <App />
 * </WalletProvider>
 */
export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [connection, setConnection] = useState<WalletConnection | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load saved connection on mount
  useEffect(() => {
    const savedConnection = loadWalletConnection()
    if (savedConnection) {
      // Attempt to reconnect
      connect(savedConnection.provider as WalletProvider).catch(() => {
        // If reconnection fails, clear saved connection
        clearWalletConnection()
      })
    }
  }, [])

  // Listen for account changes
  useEffect(() => {
    if (connection?.provider === 'metamask') {
      const handleAccountsChanged = (accounts: unknown) => {
        if (Array.isArray(accounts) && accounts.length === 0) {
          disconnect()
        } else if (Array.isArray(accounts) && accounts[0] !== connection.address) {
          // Account changed, reconnect
          connect('metamask')
        }
      }

      const handleChainChanged = () => {
        // Reload page on chain change (recommended by MetaMask)
        window.location.reload()
      }

      metamask.on('accountsChanged', handleAccountsChanged)
      metamask.on('chainChanged', handleChainChanged)

      return () => {
        metamask.removeListener('accountsChanged', handleAccountsChanged)
        metamask.removeListener('chainChanged', handleChainChanged)
      }
    }
  }, [connection])

  /**
   * Connect to a wallet provider
   */
  const connect = useCallback(async (provider: WalletProvider) => {
    setIsConnecting(true)
    setError(null)

    try {
      let connectionData: WalletConnection

      switch (provider) {
        case 'metamask':
          connectionData = await metamask.connect()
          break
        case 'walletconnect':
          throw new Error('WalletConnect not yet implemented')
        case 'universal-wallet':
          throw new Error('Universal Wallet not yet implemented')
        default:
          throw new Error(`Unknown wallet provider: ${provider}`)
      }

      setConnection(connectionData)
      storeWalletConnection({
        provider: connectionData.provider,
        address: connectionData.address,
        did: connectionData.did,
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect wallet'
      setError(errorMessage)
      throw err
    } finally {
      setIsConnecting(false)
    }
  }, [])

  /**
   * Disconnect from wallet
   */
  const disconnect = useCallback(async () => {
    if (connection?.provider === 'metamask') {
      await metamask.disconnect()
    }

    setConnection(null)
    setIsAuthenticated(false)
    clearWalletConnection()
  }, [connection])

  /**
   * Sign a message with the connected wallet
   */
  const signMessage = useCallback(
    async (message: string): Promise<string> => {
      if (!connection) {
        throw new Error('No wallet connected')
      }

      switch (connection.provider) {
        case 'metamask':
          return await metamask.signMessage(message)
        default:
          throw new Error(`Signing not implemented for ${connection.provider}`)
      }
    },
    [connection]
  )

  /**
   * Switch to a different blockchain
   */
  const switchChain = useCallback(
    async (chainId: number) => {
      if (!connection) {
        throw new Error('No wallet connected')
      }

      switch (connection.provider) {
        case 'metamask':
          await metamask.switchChain(chainId)
          // Update connection with new chain ID
          setConnection((prev) => (prev ? { ...prev, chainId } : null))
          break
        default:
          throw new Error(`Chain switching not implemented for ${connection.provider}`)
      }
    },
    [connection]
  )

  /**
   * Authenticate with DID (VitalCV backend)
   */
  const authenticateWithDID = useCallback(async () => {
    if (!connection) {
      throw new Error('No wallet connected')
    }

    try {
      // 1. Request challenge from backend
      const challengeResponse = await fetch('/api/auth/did/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ did: connection.did }),
      })

      if (!challengeResponse.ok) {
        throw new Error('Failed to get authentication challenge')
      }

      const { message } = await challengeResponse.json()

      // 2. Sign the challenge
      const signature = await signMessage(message)

      // 3. Submit signature for verification
      const verifyResponse = await fetch('/api/auth/did/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          did: connection.did,
          challenge: message,
          signature,
          publicKey: connection.publicKey,
        }),
      })

      if (!verifyResponse.ok) {
        throw new Error('Authentication failed')
      }

      const { accessToken } = await verifyResponse.json()

      // Store token in memory or cookie (cookie is handled by server)
      setIsAuthenticated(true)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Authentication failed'
      setError(errorMessage)
      throw err
    }
  }, [connection, signMessage])

  const value: WalletContextType = {
    connection,
    isConnecting,
    error,
    connect,
    disconnect,
    signMessage,
    switchChain,
    authenticateWithDID,
    isAuthenticated,
  }

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}

/**
 * useWallet Hook
 *
 * Access wallet functionality in any component.
 *
 * @example
 * const { connection, connect, disconnect, signMessage } = useWallet()
 *
 * // Connect to MetaMask
 * await connect('metamask')
 *
 * // Sign a message
 * const signature = await signMessage('Hello, VitalCV!')
 *
 * // Disconnect
 * await disconnect()
 */
export function useWallet(): WalletContextType {
  const context = useContext(WalletContext)
  if (!context) {
    throw new Error('useWallet must be used within WalletProvider')
  }
  return context
}
