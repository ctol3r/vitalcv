'use client'

/**
 * Wallet Connect Dialog Component
 *
 * Modal dialog for connecting wallets with state machine:
 * disconnected -> connecting -> connected -> signing
 */

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Wallet, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import type { WalletProvider } from '@/lib/wallet/types'

export type WalletConnectionState = 'disconnected' | 'connecting' | 'connected' | 'signing' | 'error'

export interface WalletConnectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConnect: (provider: WalletProvider) => Promise<void>
  state?: WalletConnectionState
  error?: string | null
  connectedAddress?: string
  ariaLabel?: string
}

export function WalletConnectDialog({
  open,
  onOpenChange,
  onConnect,
  state = 'disconnected',
  error = null,
  connectedAddress,
  ariaLabel = 'Wallet connection dialog',
}: WalletConnectDialogProps) {
  const [selectedProvider, setSelectedProvider] = useState<WalletProvider | null>(null)
  const [internalState, setInternalState] = useState<WalletConnectionState>(state)

  useEffect(() => {
    setInternalState(state)
  }, [state])

  const handleConnect = async (provider: WalletProvider) => {
    setSelectedProvider(provider)
    setInternalState('connecting')

    try {
      await onConnect(provider)
      setInternalState('connected')
    } catch (err) {
      setInternalState('error')
      console.error('Connection failed:', err)
    }
  }

  const handleClose = () => {
    if (internalState !== 'connecting' && internalState !== 'signing') {
      onOpenChange(false)
      // Reset state after close animation
      setTimeout(() => {
        setInternalState('disconnected')
        setSelectedProvider(null)
      }, 200)
    }
  }

  const renderStateIcon = () => {
    switch (internalState) {
      case 'connecting':
      case 'signing':
        return <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />
      case 'connected':
        return <CheckCircle className="h-12 w-12 text-green-600" />
      case 'error':
        return <XCircle className="h-12 w-12 text-red-600" />
      default:
        return <Wallet className="h-12 w-12 text-gray-400" />
    }
  }

  const renderStateMessage = () => {
    switch (internalState) {
      case 'connecting':
        return {
          title: 'Connecting to Wallet',
          description: `Connecting to ${selectedProvider || 'wallet'}... Please check your wallet app for connection request.`,
        }
      case 'signing':
        return {
          title: 'Awaiting Signature',
          description: 'Please sign the message in your wallet to complete authentication.',
        }
      case 'connected':
        return {
          title: 'Connected Successfully',
          description: `Wallet connected: ${connectedAddress ? `${connectedAddress.slice(0, 6)}...${connectedAddress.slice(-4)}` : 'Address connected'}`,
        }
      case 'error':
        return {
          title: 'Connection Failed',
          description: error || 'Failed to connect to wallet. Please try again.',
        }
      default:
        return {
          title: 'Connect Your Wallet',
          description: 'Select a wallet provider to connect and receive credentials.',
        }
    }
  }

  const stateMessage = renderStateMessage()

  return (
    <Dialog open={open} onOpenChange={handleClose} aria-label={ariaLabel}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">{stateMessage.title}</DialogTitle>
          <DialogDescription className="text-center">{stateMessage.description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center space-y-6 py-6">
          <div
            className="flex items-center justify-center"
            role="status"
            aria-live="polite"
            aria-label={`Wallet connection status: ${internalState}`}
          >
            {renderStateIcon()}
          </div>

          {internalState === 'disconnected' && (
            <div className="w-full space-y-3">
              <Button
                onClick={() => handleConnect('metamask')}
                variant="outline"
                className="w-full justify-start gap-3 h-12"
                aria-label="Connect with MetaMask"
              >
                <div className="h-6 w-6 rounded-full bg-orange-500" />
                <span className="font-medium">MetaMask</span>
              </Button>

              <Button
                onClick={() => handleConnect('walletconnect')}
                variant="outline"
                className="w-full justify-start gap-3 h-12"
                disabled
                aria-label="Connect with WalletConnect (coming soon)"
              >
                <div className="h-6 w-6 rounded-full bg-blue-500" />
                <span className="font-medium">WalletConnect</span>
                <span className="ml-auto text-xs text-muted-foreground">Soon</span>
              </Button>

              <Button
                onClick={() => handleConnect('universal-wallet')}
                variant="outline"
                className="w-full justify-start gap-3 h-12"
                disabled
                aria-label="Connect with Universal Wallet (coming soon)"
              >
                <div className="h-6 w-6 rounded-full bg-purple-500" />
                <span className="font-medium">Universal Wallet</span>
                <span className="ml-auto text-xs text-muted-foreground">Soon</span>
              </Button>
            </div>
          )}

          {error && internalState === 'error' && (
            <Alert variant="destructive" className="w-full">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {(internalState === 'connecting' || internalState === 'signing') && (
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">This may take a few moments...</p>
              <p className="text-xs text-muted-foreground">
                Check your wallet app to approve the {internalState === 'signing' ? 'signature' : 'connection'} request
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-col space-y-2">
          {internalState === 'connected' && (
            <Button onClick={handleClose} className="w-full" aria-label="Close dialog">
              Continue
            </Button>
          )}

          {internalState === 'error' && (
            <>
              <Button
                onClick={() => {
                  setInternalState('disconnected')
                  setSelectedProvider(null)
                }}
                className="w-full"
                aria-label="Try connecting again"
              >
                Try Again
              </Button>
              <Button onClick={handleClose} variant="outline" className="w-full" aria-label="Cancel and close dialog">
                Cancel
              </Button>
            </>
          )}

          {internalState === 'disconnected' && (
            <Button onClick={handleClose} variant="ghost" className="w-full" aria-label="Cancel and close dialog">
              Cancel
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
