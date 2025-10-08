'use client'

/**
 * Wallet Connection Button Component
 *
 * A button component for connecting/disconnecting wallets.
 */

import { useState } from 'react'
import { useWallet } from '@/lib/wallet/useWallet'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Wallet, LogOut, Copy, Check } from 'lucide-react'
import { shortenAddress } from '@/lib/wallet/utils'

export function WalletButton() {
  const { connection, connect, disconnect, isConnecting, error, authenticateWithDID, isAuthenticated } = useWallet()
  const [copied, setCopied] = useState(false)

  const handleConnect = async (provider: 'metamask' | 'walletconnect' | 'universal-wallet') => {
    try {
      await connect(provider)
      // Automatically authenticate after connection
      await authenticateWithDID()
    } catch (err) {
      console.error('Failed to connect:', err)
    }
  }

  const handleDisconnect = async () => {
    try {
      await disconnect()
    } catch (err) {
      console.error('Failed to disconnect:', err)
    }
  }

  const copyAddress = async () => {
    if (connection?.address) {
      await navigator.clipboard.writeText(connection.address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // If wallet is connected, show account dropdown
  if (connection) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2">
            <Wallet className="h-4 w-4" />
            {shortenAddress(connection.address)}
            {isAuthenticated && <span className="ml-1 text-green-500">✓</span>}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <div className="px-2 py-1.5 text-sm">
            <div className="font-medium">Connected</div>
            <div className="text-xs text-muted-foreground">{connection.provider}</div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={copyAddress}>
            {copied ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" />
                Copy Address
              </>
            )}
          </DropdownMenuItem>
          {!isAuthenticated && (
            <DropdownMenuItem onClick={authenticateWithDID}>
              <Wallet className="mr-2 h-4 w-4" />
              Authenticate with DID
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleDisconnect} className="text-red-600">
            <LogOut className="mr-2 h-4 w-4" />
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  // If wallet is not connected, show connect button
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="default" disabled={isConnecting}>
          <Wallet className="mr-2 h-4 w-4" />
          {isConnecting ? 'Connecting...' : 'Connect Wallet'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={() => handleConnect('metamask')}>
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-orange-500" />
            <span>MetaMask</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleConnect('walletconnect')} disabled>
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-blue-500" />
            <span>WalletConnect</span>
            <span className="ml-auto text-xs text-muted-foreground">Soon</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleConnect('universal-wallet')} disabled>
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-purple-500" />
            <span>Universal Wallet</span>
            <span className="ml-auto text-xs text-muted-foreground">Soon</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
      {error && (
        <div className="mt-2 text-sm text-red-500">
          {error}
        </div>
      )}
    </DropdownMenu>
  )
}
