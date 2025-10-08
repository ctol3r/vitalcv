/**
 * MetaMask Wallet Provider for VitalCV
 *
 * Utilities for connecting to MetaMask and managing wallet state.
 */

import { WalletConnection, MetaMaskProvider } from '../types'
import { addressToDID, publicKeyToHex } from '../utils'

export class MetaMaskWallet {
  private provider: MetaMaskProvider | null = null

  constructor() {
    if (typeof window !== 'undefined') {
      this.provider = window.ethereum || null
    }
  }

  /**
   * Check if MetaMask is installed
   */
  isInstalled(): boolean {
    return this.provider?.isMetaMask === true
  }

  /**
   * Check if MetaMask is already connected
   */
  async isConnected(): Promise<boolean> {
    if (!this.provider) return false

    try {
      const accounts = (await this.provider.request({
        method: 'eth_accounts',
      })) as string[]
      return accounts.length > 0
    } catch {
      return false
    }
  }

  /**
   * Connect to MetaMask
   */
  async connect(): Promise<WalletConnection> {
    if (!this.isInstalled()) {
      throw new Error('MetaMask is not installed. Please install MetaMask extension.')
    }

    try {
      // Request account access
      const accounts = (await this.provider!.request({
        method: 'eth_requestAccounts',
      })) as string[]

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found. Please unlock MetaMask.')
      }

      const address = accounts[0]

      // Get chain ID
      const chainId = (await this.provider!.request({
        method: 'eth_chainId',
      })) as string

      // Get public key by requesting a signature
      const message = 'VitalCV - Get Public Key'
      const signature = await this.signMessage(message)

      // Derive public key from signature (simplified)
      // In production, use proper ECDSA recovery
      const publicKey = signature.substring(0, 66)

      // Convert address to DID
      const did = addressToDID(address)

      return {
        provider: 'metamask',
        address,
        did,
        publicKey,
        chainId: parseInt(chainId, 16),
        connected: true,
        lastConnected: new Date(),
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('User rejected')) {
          throw new Error('Connection request was rejected')
        }
        throw error
      }
      throw new Error('Failed to connect to MetaMask')
    }
  }

  /**
   * Disconnect from MetaMask
   */
  async disconnect(): Promise<void> {
    // MetaMask doesn't have a disconnect method
    // Just clear local state
    this.provider = null
  }

  /**
   * Sign a message with MetaMask
   */
  async signMessage(message: string): Promise<string> {
    if (!this.provider) {
      throw new Error('MetaMask is not connected')
    }

    try {
      const accounts = (await this.provider.request({
        method: 'eth_accounts',
      })) as string[]

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found')
      }

      // Convert message to hex
      const messageHex = Buffer.from(message, 'utf8').toString('hex')

      // Request signature
      const signature = (await this.provider.request({
        method: 'personal_sign',
        params: [messageHex, accounts[0]],
      })) as string

      return signature
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('User rejected')) {
          throw new Error('Signature request was rejected')
        }
        throw error
      }
      throw new Error('Failed to sign message')
    }
  }

  /**
   * Switch to a different chain
   */
  async switchChain(chainId: number): Promise<void> {
    if (!this.provider) {
      throw new Error('MetaMask is not connected')
    }

    try {
      await this.provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${chainId.toString(16)}` }],
      })
    } catch (error: unknown) {
      // If chain doesn't exist, add it
      if ((error as { code?: number }).code === 4902) {
        throw new Error('Chain not found. Please add the chain to MetaMask first.')
      }
      throw error
    }
  }

  /**
   * Add event listeners
   */
  on(event: string, handler: (...args: unknown[]) => void): void {
    if (!this.provider) return
    this.provider.on(event, handler)
  }

  /**
   * Remove event listeners
   */
  removeListener(event: string, handler: (...args: unknown[]) => void): void {
    if (!this.provider) return
    this.provider.removeListener(event, handler)
  }
}

/**
 * Singleton instance
 */
export const metamask = new MetaMaskWallet()
