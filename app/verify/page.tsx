"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Shield, XCircle } from "lucide-react"
import { CredentialStatusCard } from "@/components/CredentialStatusCard"
import Link from "next/link"

interface VerificationResult {
  status: "valid" | "revoked" | "unknown"
  credentialId: string
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
  const [audience, setAudience] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<VerificationResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!credentialId.trim()) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Mock response based on credential ID
      const mockResult: VerificationResult = credentialId.includes("revoked")
        ? {
            status: "revoked",
            credentialId,
            details: {
              issuer: "California Medical Board",
              issuedDate: "2023-01-15",
              expiryDate: "2025-01-15",
              reason: "License suspended due to administrative review",
              disclosureType: "Full disclosure",
            },
          }
        : credentialId.includes("unknown")
          ? {
              status: "unknown",
              credentialId,
              details: {
                reason: "Credential not found in registry",
              },
            }
          : {
              status: "valid",
              credentialId,
              details: {
                issuer: "California Medical Board",
                issuedDate: "2023-01-15",
                expiryDate: "2025-01-15",
                disclosureType: "Selective disclosure",
              },
            }

      setResult(mockResult)
    } catch (err) {
      setError("Failed to verify credential. Please try again.")
    } finally {
      setLoading(false)
    }
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
            <Link href="/analytics" className="text-gray-600 hover:text-blue-600 transition-colors">
              Analytics
            </Link>
            <Link href="/support" className="text-gray-600 hover:text-blue-600 transition-colors">
              Support
            </Link>
          </nav>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Verify Credential</h1>
            <p className="text-lg text-gray-600">Enter a credential ID to verify its authenticity and status</p>
          </div>

          <Card className="mb-8 bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Credential Verification</CardTitle>
              <CardDescription>Enter the credential details below to perform verification</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleVerify} className="space-y-4">
                <div>
                  <Label htmlFor="credentialId">Credential ID *</Label>
                  <Input
                    id="credentialId"
                    type="text"
                    placeholder="Enter credential ID (e.g., CRED-12345)"
                    value={credentialId}
                    onChange={(e) => setCredentialId(e.target.value)}
                    required
                    className="mt-1"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="nonce">Nonce (Optional)</Label>
                    <Input
                      id="nonce"
                      type="text"
                      placeholder="Security nonce"
                      value={nonce}
                      onChange={(e) => setNonce(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="audience">Audience (Optional)</Label>
                    <Input
                      id="audience"
                      type="text"
                      placeholder="Intended audience"
                      value={audience}
                      onChange={(e) => setAudience(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={loading || !credentialId.trim()}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    "Verify Credential"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {error && (
            <Alert variant="destructive" className="mb-6">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {result && <CredentialStatusCard result={result} />}

          <div className="mt-8 text-center text-sm text-gray-500">
            <p>
              Try these sample IDs: <code className="bg-gray-100 px-2 py-1 rounded">CRED-12345</code>,
              <code className="bg-gray-100 px-2 py-1 rounded ml-2">CRED-revoked-001</code>,
              <code className="bg-gray-100 px-2 py-1 rounded ml-2">CRED-unknown-999</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
