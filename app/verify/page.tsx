"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Loader2, Shield, XCircle, Search, CheckCircle2, RefreshCw } from "lucide-react"
import { CredentialStatusCard } from "@/components/CredentialStatusCard"
import { VerifyResultCard } from "@/components/verifier/VerifyResultCard"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { buildDcqlRequest, generateNonce, validateNonce, mapVerifyStatus, type VerificationResult } from "@/lib/verifier/dcql"
import { extractRequestId } from "@/lib/observability/request-id"

interface LegacyVerificationResult {
  status: "valid" | "revoked" | "unknown"
  credentialId: string
  auditRef?: string
  details?: {
    issuer?: string
    issuedDate?: string
    expiryDate?: string
    reason?: string
    disclosureType?: string
  }
}

export default function VerifyPage() {
  const [credentialId, setCredentialId] = useState("")
  const [nonce, setNonce] = useState("")
  const [audience, setAudience] = useState("vitalcv.com")
  const [privacyMode, setPrivacyMode] = useState<"plain" | "bbs" | "zk">("plain")
  const [loading, setLoading] = useState(false)
  const [statusLoading, setStatusLoading] = useState(false)
  const [legacyResult, setLegacyResult] = useState<LegacyVerificationResult | null>(null)
  const [dcqlResult, setDcqlResult] = useState<VerificationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [requestId, setRequestId] = useState<string | null>(null)
  const { toast } = useToast()

  // Generate cryptographically secure nonce on mount
  useEffect(() => {
    refreshNonce()
  }, [])

  const refreshNonce = () => {
    const newNonce = generateNonce()
    setNonce(newNonce)
  }

  const handleCheckStatus = async () => {
    if (!credentialId.trim()) return

    setStatusLoading(true)
    setError(null)
    setLegacyResult(null)
    setDcqlResult(null)
    setRequestId(null)

    try {
      const response = await fetch(`/api/verifier/credential/${encodeURIComponent(credentialId.trim())}/status`)

      // Extract request ID from response headers
      const reqId = extractRequestId(response)
      if (reqId) setRequestId(reqId)

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Session expired. Please refresh the page and try again.')
        }
        throw new Error(`Status check failed: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()

      const statusResult: LegacyVerificationResult = {
        status: data.status || "unknown",
        credentialId: credentialId.trim(),
        auditRef: data.auditRef,
        details: {
          issuer: data.issuer,
          issuedDate: data.issuedDate,
          expiryDate: data.expiryDate,
          reason: data.reason,
        },
      }

      setLegacyResult(statusResult)

      toast({
        title: "Status Check Complete",
        description: `Credential status: ${statusResult.status}`,
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to check credential status. Please try again."
      setError(errorMessage)

      toast({
        title: "Status Check Failed",
        description: errorMessage,
        variant: "destructive",
      })

      // Track error event
      if (typeof window !== 'undefined' && (window as unknown as { trackEvent?: (name: string, props: unknown) => void }).trackEvent) {
        (window as unknown as { trackEvent: (name: string, props: unknown) => void }).trackEvent('api.error', {
          context: 'status.check',
          error: errorMessage,
        })
      }
    } finally {
      setStatusLoading(false)
    }
  }

  const handleVerifyPresentation = async () => {
    if (!credentialId.trim()) return

    // Validate nonce freshness
    if (!validateNonce(nonce)) {
      setError('Nonce has expired. Please refresh and try again.')
      toast({
        title: 'Nonce Expired',
        description: 'Your verification nonce has expired. Click "Refresh Nonce" to generate a new one.',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    setError(null)
    setLegacyResult(null)
    setDcqlResult(null)
    setRequestId(null)

    try {
      // Build DCQL request
      const dcqlRequest = buildDcqlRequest({
        credentialType: 'MedicalLicense', // Could be derived from credential or made dynamic
        nonce: nonce.trim(),
        audience: audience.trim(),
        requiredFields: ['licenseNumber', 'issuer', 'expiryDate', 'subjectId'],
        purpose: 'Verify medical professional credentials',
      })

      const response = await fetch("/api/verifier/presentation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          credentialId: credentialId.trim(),
          dcqlRequest,
          privacyMode: privacyMode !== "plain",
          disclosureType: privacyMode,
        }),
      })

      // Extract request ID from response headers
      const reqId = extractRequestId(response)
      if (reqId) setRequestId(reqId)

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Session expired. Please refresh the page and try again.')
        }
        if (response.status === 400) {
          const errorData = await response.json().catch(() => ({ message: 'Bad request' }))
          throw new Error(errorData.message || 'Invalid request parameters')
        }
        throw new Error(`Verification failed: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()

      // Map API response to VerificationResult
      const verificationResult = mapVerifyStatus({
        status: data.status || 'unknown',
        credentialId: credentialId.trim(),
        auditRef: data.auditRef,
        reason: data.reason,
        claims: data.claims || {},
      })

      setDcqlResult(verificationResult)

      toast({
        title: verificationResult.status === 'success' ? 'Verification Successful' : 'Verification Complete',
        description: verificationResult.status === 'success'
          ? 'The credential has been verified successfully'
          : 'Verification completed with issues',
      })

      // Track analytics
      if (typeof window !== 'undefined' && (window as unknown as { trackEvent?: (name: string, props: unknown) => void }).trackEvent) {
        (window as unknown as { trackEvent: (name: string, props: unknown) => void }).trackEvent(
          verificationResult.status === 'success' ? 'vp.verified.success' : 'vp.verified.fail',
          {
            credentialId: credentialId.trim(),
            privacyMode,
          }
        )
      }

      // Refresh nonce after successful verification
      refreshNonce()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to verify credential. Please try again."
      setError(errorMessage)

      toast({
        title: "Verification Failed",
        description: errorMessage,
        variant: "destructive",
      })

      // Track error event
      if (typeof window !== 'undefined' && (window as unknown as { trackEvent?: (name: string, props: unknown) => void }).trackEvent) {
        (window as unknown as { trackEvent: (name: string, props: unknown) => void }).trackEvent('vp.verified.fail', {
          error: errorMessage,
        })
      }

      // Increment retry count
      setRetryCount(prev => prev + 1)
    } finally {
      setLoading(false)
    }
  }

  const handleRetry = () => {
    setError(null)
    setRetryCount(0)
    refreshNonce()
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
              Issuer
            </Link>
            <Link href="/analytics" className="text-gray-600 hover:text-blue-600 transition-colors">
              Analytics
            </Link>
            <Link href="/support" className="text-gray-600 hover:text-blue-600 transition-colors">
              Support
            </Link>
            <Link href="/api-docs" className="text-gray-600 hover:text-blue-600 transition-colors">
              API Docs
            </Link>
          </nav>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Verify Credential</h1>
          <p className="text-lg text-gray-600">Enter a credential ID to verify its authenticity and status</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-7xl mx-auto">
          {/* Left Form Section */}
          <div className="space-y-6">
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Credential Verification</CardTitle>
                <CardDescription>Enter the credential details below to perform verification</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="credentialId">Credential ID *</Label>
                  <Input
                    id="credentialId"
                    type="text"
                    placeholder="Enter credential ID (e.g., CRED-12345)"
                    value={credentialId}
                    onChange={(e) => setCredentialId(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <Label htmlFor="nonce">Nonce (Auto-generated)</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={refreshNonce}
                        className="h-6 px-2 text-xs"
                        aria-label="Refresh nonce"
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Refresh
                      </Button>
                    </div>
                    <Input
                      id="nonce"
                      type="text"
                      placeholder="Auto-generated nonce"
                      value={nonce}
                      onChange={(e) => setNonce(e.target.value)}
                      className="font-mono text-sm"
                      readOnly
                    />
                  </div>
                  <div>
                    <Label htmlFor="audience">Audience</Label>
                    <Input
                      id="audience"
                      type="text"
                      value={audience}
                      onChange={(e) => setAudience(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="privacyMode">Privacy Mode</Label>
                  <Select value={privacyMode} onValueChange={(value: "plain" | "bbs" | "zk") => setPrivacyMode(value)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="plain">Plain - Full disclosure</SelectItem>
                      <SelectItem value="bbs">BBS+ - Selective disclosure</SelectItem>
                      <SelectItem value="zk">ZK - Zero-knowledge proof</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <Button
                    onClick={handleCheckStatus}
                    variant="outline"
                    className="flex-1 bg-transparent"
                    disabled={statusLoading || !credentialId.trim()}
                  >
                    {statusLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Checking...
                      </>
                    ) : (
                      <>
                        <Search className="mr-2 h-4 w-4" />
                        Check Status
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={handleVerifyPresentation}
                    className="flex-1"
                    disabled={loading || !credentialId.trim()}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Verify Presentation
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="text-center text-sm text-gray-500">
              <p>
                Try these sample IDs: <code className="bg-gray-100 px-2 py-1 rounded">CRED-12345</code>,
                <code className="bg-gray-100 px-2 py-1 rounded ml-2">CRED-revoked-001</code>,
                <code className="bg-gray-100 px-2 py-1 rounded ml-2">CRED-unknown-999</code>
              </p>
            </div>
          </div>

          {/* Right Result Section */}
          <div className="space-y-6">
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Verification Result</CardTitle>
                <CardDescription>The result of your credential verification will appear here</CardDescription>
              </CardHeader>
              <CardContent>
                {error && (
                  <div className="space-y-4">
                    <Alert variant="destructive">
                      <XCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                    {retryCount > 0 && (
                      <Button onClick={handleRetry} variant="outline" className="w-full gap-2">
                        <RefreshCw className="h-4 w-4" />
                        Try Again
                      </Button>
                    )}
                  </div>
                )}

                {(loading || statusLoading) && !dcqlResult && !legacyResult && (
                  <div className="space-y-4">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-20 w-full" />
                    <div className="flex gap-2">
                      <Skeleton className="h-8 flex-1" />
                      <Skeleton className="h-8 flex-1" />
                    </div>
                  </div>
                )}

                {dcqlResult && (
                  <div className="space-y-4">
                    <VerifyResultCard result={dcqlResult} showClaims={true} requestId={requestId || undefined} />
                  </div>
                )}

                {legacyResult && !dcqlResult && (
                  <div className="space-y-4">
                    <CredentialStatusCard result={legacyResult} />
                    {legacyResult.auditRef && (
                      <div className="flex justify-center">
                        <div className="inline-flex items-center px-3 py-1 rounded-full text-xs bg-gray-100 text-gray-600">
                          Audit ref: {legacyResult.auditRef}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {!dcqlResult && !legacyResult && !loading && !statusLoading && !error && (
                  <div className="text-center py-12 text-gray-500">
                    <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Enter a credential ID and click verify to see results</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
