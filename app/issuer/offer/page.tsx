'use client'

/**
 * Issuer Credential Offer Page
 *
 * Generate and display credential offers with QR codes and deep links
 * following the OIDC4VCI (OpenID for Verifiable Credential Issuance) standard.
 */

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Shield, Plus, RefreshCw, Clock } from 'lucide-react'
import Link from 'next/link'
import { QrBlock } from '@/components/credentials/QrBlock'
import { DeepLinkButton } from '@/components/credentials/DeepLinkButton'
import { createOfferUrl, type OfferUrlResult } from '@/lib/credentials/oidc4vci'
import { useToast } from '@/hooks/use-toast'

export default function IssuerOfferPage() {
  const [credentialType, setCredentialType] = useState<string>('')
  const [issuerId, setIssuerId] = useState<string>('vitalcv-issuer-001')
  const [subjectId, setSubjectId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [offer, setOffer] = useState<OfferUrlResult | null>(null)
  const [timeRemaining, setTimeRemaining] = useState<string>('')
  const { toast } = useToast()

  // Update time remaining countdown
  useEffect(() => {
    if (!offer) return

    const interval = setInterval(() => {
      const now = new Date().getTime()
      const expiry = offer.expiresAt.getTime()
      const remaining = expiry - now

      if (remaining <= 0) {
        setTimeRemaining('Expired')
        clearInterval(interval)
        return
      }

      const minutes = Math.floor(remaining / 60000)
      const seconds = Math.floor((remaining % 60000) / 1000)
      setTimeRemaining(`${minutes}m ${seconds}s`)
    }, 1000)

    return () => clearInterval(interval)
  }, [offer])

  const handleGenerateOffer = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Track analytics event
      if (typeof window !== 'undefined' && (window as unknown as { trackEvent?: (name: string, props: unknown) => void }).trackEvent) {
        (window as unknown as { trackEvent: (name: string, props: unknown) => void }).trackEvent('offer.created', {
          credentialType,
          issuerId,
        })
      }

      // Generate the offer URL
      const offerResult = createOfferUrl({
        credentialType,
        issuerId,
        subjectId: subjectId || undefined,
        credentialConfigurationIds: [credentialType],
      })

      setOffer(offerResult)

      toast({
        title: 'Offer Generated',
        description: 'Credential offer created successfully. Share the QR code or link with the holder.',
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate offer'

      toast({
        title: 'Generation Failed',
        description: errorMessage,
        variant: 'destructive',
      })

      // Track error event
      if (typeof window !== 'undefined' && (window as unknown as { trackEvent?: (name: string, props: unknown) => void }).trackEvent) {
        (window as unknown as { trackEvent: (name: string, props: unknown) => void }).trackEvent('api.error', {
          context: 'offer.generate',
          error: errorMessage,
        })
      }
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setOffer(null)
    setTimeRemaining('')
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
          <nav className="hidden md:flex items-center space-x-6">
            <Link href="/issuer" className="text-gray-600 hover:text-blue-600 transition-colors">
              Issue Credentials
            </Link>
            <Link href="/verify" className="text-gray-600 hover:text-blue-600 transition-colors">
              Verify
            </Link>
            <Link href="/analytics" className="text-gray-600 hover:text-blue-600 transition-colors">
              Analytics
            </Link>
          </nav>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Generate Credential Offer</h1>
            <p className="text-lg text-gray-600">
              Create a shareable credential offer using the OIDC4VCI standard
            </p>
          </div>

          {!offer ? (
            /* Generation Form */
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg max-w-2xl mx-auto">
              <CardHeader>
                <CardTitle>Create New Offer</CardTitle>
                <CardDescription>
                  Configure the credential offer details. The holder will be able to claim this credential using their
                  wallet.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleGenerateOffer} className="space-y-4">
                  <div>
                    <Label htmlFor="credentialType">
                      Credential Type <span className="text-red-500">*</span>
                    </Label>
                    <Select value={credentialType} onValueChange={setCredentialType} required>
                      <SelectTrigger className="mt-1" id="credentialType">
                        <SelectValue placeholder="Select credential type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MedicalLicense">Medical License</SelectItem>
                        <SelectItem value="BoardCertification">Board Certification</SelectItem>
                        <SelectItem value="DEARegistration">DEA Registration</SelectItem>
                        <SelectItem value="NursingLicense">Nursing License</SelectItem>
                        <SelectItem value="PharmacyLicense">Pharmacy License</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="issuerId">
                      Issuer ID <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="issuerId"
                      type="text"
                      value={issuerId}
                      onChange={(e) => setIssuerId(e.target.value)}
                      placeholder="e.g., vitalcv-issuer-001"
                      required
                      className="mt-1"
                      aria-describedby="issuer-help"
                    />
                    <p id="issuer-help" className="text-xs text-muted-foreground mt-1">
                      Unique identifier for this issuing authority
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="subjectId">Subject ID (Optional)</Label>
                    <Input
                      id="subjectId"
                      type="text"
                      value={subjectId}
                      onChange={(e) => setSubjectId(e.target.value)}
                      placeholder="e.g., did:example:123 or email@example.com"
                      className="mt-1"
                      aria-describedby="subject-help"
                    />
                    <p id="subject-help" className="text-xs text-muted-foreground mt-1">
                      Identifier for the credential subject (leave empty for generic offer)
                    </p>
                  </div>

                  <Alert>
                    <AlertDescription>
                      <strong>Pre-Authorized Code Flow:</strong> This will generate an offer with a pre-authorized
                      code that allows the holder to claim the credential without additional authentication.
                    </AlertDescription>
                  </Alert>

                  <Button type="submit" className="w-full gap-2" disabled={loading || !credentialType || !issuerId}>
                    {loading ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Generating Offer...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        Generate Offer
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : (
            /* Offer Display */
            <div className="space-y-6">
              {/* Status Alert */}
              <Alert className="max-w-2xl mx-auto">
                <Clock className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between">
                  <span>
                    <strong>Offer Generated:</strong> Valid for 10 minutes
                  </span>
                  <span className="font-mono text-sm font-bold" aria-live="polite" aria-label="Time remaining">
                    {timeRemaining}
                  </span>
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* QR Code */}
                <div>
                  <QrBlock
                    data={offer.qrData}
                    title="Scan to Accept"
                    description="Scan this QR code with your wallet app to receive the credential offer"
                    ariaLabel="QR code containing credential offer for scanning by wallet app"
                  />
                </div>

                {/* Deep Link */}
                <div>
                  <DeepLinkButton
                    deepLink={offer.deepLink}
                    offerUrl={offer.offerUrl}
                    label="Open in Mobile Wallet"
                    description="Use these links to open the offer in a compatible wallet"
                  />
                </div>
              </div>

              {/* Offer Details */}
              <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg max-w-2xl mx-auto">
                <CardHeader>
                  <CardTitle>Offer Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Credential Type:</span>
                    <span className="font-medium">{credentialType}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Pre-Authorized Code:</span>
                    <code className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                      {offer.preAuthorizedCode.substring(0, 20)}...
                    </code>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Expires At:</span>
                    <span className="font-medium">{offer.expiresAt.toLocaleTimeString()}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex justify-center gap-4">
                <Button onClick={handleReset} variant="outline" className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Generate New Offer
                </Button>
                <Link href="/issuer">
                  <Button variant="ghost">Back to Issuer</Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
