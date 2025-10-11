'use client'

/**
 * Wallet Accept Credential Page
 *
 * Allows users to scan/parse credential offers and accept them into their wallet.
 * Implements the wallet side of the OIDC4VCI flow.
 */

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Shield, CheckCircle, AlertTriangle, Wallet as WalletIcon } from 'lucide-react'
import Link from 'next/link'
import { parseOfferUrl, validatePreAuthCode, type CredentialOffer } from '@/lib/credentials/oidc4vci'
import { WalletConnectDialog, type WalletConnectionState } from '@/components/wallet/WalletConnectDialog'
import { useWallet } from '@/lib/wallet/useWallet'
import { useToast } from '@/hooks/use-toast'

type AcceptanceState = 'parsing' | 'ready' | 'accepting' | 'accepted' | 'error'

function AcceptPageContent() {
  const searchParams = useSearchParams()
  const { connection, connect, isConnecting } = useWallet()
  const { toast } = useToast()

  const [offer, setOffer] = useState<CredentialOffer | null>(null)
  const [acceptanceState, setAcceptanceState] = useState<AcceptanceState>('parsing')
  const [walletDialogOpen, setWalletDialogOpen] = useState(false)
  const [walletState, setWalletState] = useState<WalletConnectionState>('disconnected')
  const [error, setError] = useState<string | null>(null)
  const [credentialId, setCredentialId] = useState<string | null>(null)

  // Parse offer from URL on mount
  useEffect(() => {
    const offerParam = searchParams.get('offer')

    if (!offerParam) {
      setError('No credential offer found in URL')
      setAcceptanceState('error')
      return
    }

    try {
      // Reconstruct the full offer URL
      const offerUrl = `openid-credential-offer://?credential_offer=${offerParam}`
      const parsedOffer = parseOfferUrl(offerUrl)

      if (!parsedOffer) {
        throw new Error('Invalid offer format')
      }

      // Validate pre-auth code
      const preAuthCode = parsedOffer.grants['urn:ietf:params:oauth:grant-type:pre-authorized_code']['pre-authorized_code']
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // Assume 10 min expiry

      const validation = validatePreAuthCode(preAuthCode, expiresAt)
      if (!validation.valid) {
        throw new Error(validation.error || 'Invalid or expired offer')
      }

      setOffer(parsedOffer)
      setAcceptanceState('ready')

      // Track scan event
      if (typeof window !== 'undefined' && (window as unknown as { trackEvent?: (name: string, props: unknown) => void }).trackEvent) {
        (window as unknown as { trackEvent: (name: string, props: unknown) => void }).trackEvent('offer.scanned', {
          credentialType: parsedOffer.credential_configuration_ids[0],
        })
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to parse credential offer'
      setError(errorMessage)
      setAcceptanceState('error')
    }
  }, [searchParams])

  const handleAccept = async () => {
    if (!offer) return

    // Check if wallet is connected
    if (!connection) {
      setWalletDialogOpen(true)
      return
    }

    setAcceptanceState('accepting')
    setWalletState('signing')

    try {
      const preAuthCode = offer.grants['urn:ietf:params:oauth:grant-type:pre-authorized_code']['pre-authorized_code']

      // Call API to accept the credential
      const response = await fetch('/api/credentials/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offer,
          preAuthorizedCode: preAuthCode,
          walletAddress: connection.address,
          walletDid: connection.did,
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to accept credential: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      setCredentialId(data.credentialId)
      setAcceptanceState('accepted')
      setWalletState('connected')

      toast({
        title: 'Credential Accepted',
        description: 'The credential has been successfully added to your wallet',
      })

      // Track success event
      if (typeof window !== 'undefined' && (window as unknown as { trackEvent?: (name: string, props: unknown) => void }).trackEvent) {
        (window as unknown as { trackEvent: (name: string, props: unknown) => void }).trackEvent('vp.verified.success', {
          credentialId: data.credentialId,
        })
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to accept credential'
      setError(errorMessage)
      setAcceptanceState('error')
      setWalletState('error')

      toast({
        title: 'Acceptance Failed',
        description: errorMessage,
        variant: 'destructive',
      })

      // Track error event
      if (typeof window !== 'undefined' && (window as unknown as { trackEvent?: (name: string, props: unknown) => void }).trackEvent) {
        (window as unknown as { trackEvent: (name: string, props: unknown) => void }).trackEvent('vp.verified.fail', {
          error: errorMessage,
        })
      }
    }
  }

  const handleWalletConnect = async (provider: 'metamask' | 'walletconnect' | 'universal-wallet') => {
    setWalletState('connecting')
    try {
      await connect(provider)
      setWalletState('connected')
      setWalletDialogOpen(false)

      // After wallet connects, automatically proceed to accept
      setTimeout(() => handleAccept(), 500)
    } catch (err) {
      setWalletState('error')
      setError(err instanceof Error ? err.message : 'Failed to connect wallet')
    }
  }

  if (acceptanceState === 'parsing') {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto space-y-4">
          <Skeleton className="h-12 w-3/4 mx-auto" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <Shield className="h-8 w-8 text-blue-600" />
            <span className="text-2xl font-bold text-gray-900">VitalCV</span>
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          {acceptanceState === 'accepted' ? (
            /* Success State */
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader className="text-center">
                <div className="flex justify-center mb-4">
                  <CheckCircle className="h-16 w-16 text-green-600" />
                </div>
                <CardTitle className="text-2xl">Credential Accepted!</CardTitle>
                <CardDescription>The credential has been successfully added to your wallet</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {credentialId && (
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Credential ID</p>
                    <code className="text-xs font-mono break-all">{credentialId}</code>
                  </div>
                )}
                <div className="flex flex-col sm:flex-row gap-3">
                  <Link href="/dashboard" className="flex-1">
                    <Button className="w-full">View in Dashboard</Button>
                  </Link>
                  <Link href="/" className="flex-1">
                    <Button variant="outline" className="w-full">
                      Go Home
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ) : acceptanceState === 'error' ? (
            /* Error State */
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader className="text-center">
                <div className="flex justify-center mb-4">
                  <AlertTriangle className="h-16 w-16 text-red-600" />
                </div>
                <CardTitle className="text-2xl">Unable to Accept Credential</CardTitle>
                <CardDescription>{error || 'An error occurred while processing the credential offer'}</CardDescription>
              </CardHeader>
              <CardContent>
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
                <div className="mt-6 flex flex-col sm:flex-row gap-3">
                  <Button onClick={() => window.location.reload()} className="flex-1">
                    Try Again
                  </Button>
                  <Link href="/" className="flex-1">
                    <Button variant="outline" className="w-full">
                      Go Home
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ) : (
            /* Ready / Accepting State */
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader className="text-center">
                <div className="flex justify-center mb-4">
                  <WalletIcon className="h-16 w-16 text-blue-600" />
                </div>
                <CardTitle className="text-2xl">Accept Credential Offer</CardTitle>
                <CardDescription>Review the credential details below and accept to add it to your wallet</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {offer && (
                  <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Issuer</p>
                      <p className="text-base font-semibold">{offer.credential_issuer}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Credential Type</p>
                      <p className="text-base font-semibold">{offer.credential_configuration_ids.join(', ')}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Authorization</p>
                      <p className="text-xs font-mono bg-white px-2 py-1 rounded border">
                        Pre-authorized code flow
                      </p>
                    </div>
                  </div>
                )}

                {connection && (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Wallet Connected:</strong> {connection.address.slice(0, 6)}...{connection.address.slice(-4)}
                    </AlertDescription>
                  </Alert>
                )}

                <Button
                  onClick={handleAccept}
                  disabled={acceptanceState === 'accepting' || isConnecting}
                  className="w-full"
                  size="lg"
                >
                  {acceptanceState === 'accepting' ? 'Accepting Credential...' : 'Accept Credential'}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  By accepting this credential, you agree to store it securely in your wallet
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Wallet Connect Dialog */}
      <WalletConnectDialog
        open={walletDialogOpen}
        onOpenChange={setWalletDialogOpen}
        onConnect={handleWalletConnect}
        state={walletState}
        error={error}
        connectedAddress={connection?.address}
      />
    </div>
  )
}

export default function WalletAcceptPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto space-y-4">
          <Skeleton className="h-12 w-3/4 mx-auto" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    }>
      <AcceptPageContent />
    </Suspense>
  )
}
