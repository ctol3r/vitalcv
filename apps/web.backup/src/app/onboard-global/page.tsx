'use client'

import React, { useState } from 'react'
import { Card } from '@/components/design/Card'
import { Button } from '@/components/design/Button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/design/Select'
import { Check, ChevronRight, Upload, Shield, Globe, Loader2 } from 'lucide-react'

export default function OnboardGlobalPage() {
  const [step, setStep] = useState(1)
  const [region, setRegion] = useState('')
  const [identifier, setIdentifier] = useState('')
  const [loading, setLoading] = useState(false)
  const [providerData, setProviderData] = useState<any>(null)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [issued, setIssued] = useState(false)

  const regions = [
    { value: 'US', label: 'United States (NPI)', idLabel: 'NPI Number' },
    { value: 'CA', label: 'Canada (CPSO)', idLabel: 'CPSO License Number' },
    { value: 'IN', label: 'India (NMC)', idLabel: 'NMC Registration Number' },
    { value: 'AU', label: 'Australia (AHPRA)', idLabel: 'AHPRA User ID' }
  ]

  const handleLookup = async () => {
    if (!region || !identifier) return

    setLoading(true)
    setError('')
    setProviderData(null)

    try {
      let endpoint = ''
      if (region === 'US') endpoint = `/api/intl/us/${identifier}`
      if (region === 'CA') endpoint = `/api/intl/canada/${identifier}`
      if (region === 'IN') endpoint = `/api/intl/india/${identifier}`
      if (region === 'AU') endpoint = `/api/intl/australia/${identifier}`

      const res = await fetch(endpoint)
      if (!res.ok) throw new Error('Provider not found')

      const data = await res.json()
      setProviderData(data)
      setStep(3)
    } catch (err) {
      setError('Provider not found. Please check the identifier and try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleUpload = () => {
    setUploading(true)
    // Mock upload delay
    setTimeout(() => {
      setUploading(false)
      setStep(4)
    }, 1500)
  }

  const handleIssueVC = () => {
    setLoading(true)
    // Mock issuance
    setTimeout(() => {
      setLoading(false)
      setIssued(true)
    }, 2000)
  }

  const currentRegion = regions.find(r => r.value === region)

  return (
    <div className="min-h-screen bg-gray-50/50 p-8">
      <div className="mx-auto max-w-2xl space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Global Provider Onboarding</h1>
          <p className="text-muted-foreground">
            Verify your medical credentials across international registries and issue a Verifiable Credential.
          </p>
        </div>

        {/* Progress Stepper */}
        <div className="flex items-center justify-between px-2">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full border text-sm font-medium ${
                step >= s ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground'
              }`}>
                {step > s ? <Check className="h-4 w-4" /> : s}
              </div>
              {s < 4 && <div className={`h-0.5 w-12 ${step > s ? 'bg-primary' : 'bg-muted'}`} />}
            </div>
          ))}
        </div>

        <Card className="p-6">
          {step === 1 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">Select Region</h2>
                <p className="text-sm text-muted-foreground">Choose the jurisdiction where you are licensed.</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Region</label>
                <Select value={region} onValueChange={setRegion}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a region..." />
                  </SelectTrigger>
                  <SelectContent>
                    {regions.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                fullWidth
                disabled={!region}
                onClick={() => setStep(2)}
              >
                Continue <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}

          {step === 2 && currentRegion && (
            <div className="space-y-6">
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">Provider Lookup</h2>
                <p className="text-sm text-muted-foreground">
                  Enter your {currentRegion.idLabel} to verify against the {currentRegion.label} registry.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{currentRegion.idLabel}</label>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder={`Enter ${currentRegion.idLabel}`}
                />
              </div>

              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
                <Button
                  className="flex-1"
                  disabled={!identifier || loading}
                  onClick={handleLookup}
                >
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <SearchIcon className="mr-2 h-4 w-4" />}
                  Verify Provider
                </Button>
              </div>
            </div>
          )}

          {step === 3 && providerData && (
            <div className="space-y-6">
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">Document Upload</h2>
                <p className="text-sm text-muted-foreground">
                  Please upload a copy of your license to complete verification.
                </p>
              </div>

              <div className="rounded-lg border bg-muted/50 p-4">
                <h3 className="font-medium">Verified Provider</h3>
                <div className="mt-2 text-sm space-y-1">
                  <p><span className="text-muted-foreground">Name:</span> {providerData.name}</p>
                  <p><span className="text-muted-foreground">ID:</span> {providerData.id}</p>
                  <p><span className="text-muted-foreground">Status:</span> {providerData.active ? 'Active' : 'Inactive'}</p>
                  <p><span className="text-muted-foreground">Region:</span> {providerData.region}</p>
                </div>
              </div>

              <div
                className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-center transition-colors hover:bg-muted/50 cursor-pointer"
                onClick={handleUpload}
              >
                <div className="rounded-full bg-primary/10 p-4">
                  {uploading ? (
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  ) : (
                    <Upload className="h-6 w-6 text-primary" />
                  )}
                </div>
                <div className="text-sm font-medium">
                  {uploading ? 'Uploading...' : 'Click to upload license document'}
                </div>
                <div className="text-xs text-muted-foreground">PDF, JPG or PNG</div>
              </div>

              <Button variant="secondary" onClick={() => setStep(2)}>Back</Button>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6 text-center">
              {!issued ? (
                <>
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                    <Shield className="h-8 w-8 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-xl font-semibold">Ready to Issue</h2>
                    <p className="text-sm text-muted-foreground">
                      All checks passed. You can now issue your Global Provider Verifiable Credential.
                    </p>
                  </div>
                  <Button
                    size="large"
                    fullWidth
                    onClick={handleIssueVC}
                    disabled={loading}
                  >
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Issue Credential
                  </Button>
                </>
              ) : (
                <>
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600">
                    <Check className="h-8 w-8" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-xl font-semibold">Credential Issued!</h2>
                    <p className="text-sm text-muted-foreground">
                      Your global provider credential has been successfully issued to your wallet.
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    fullWidth
                    onClick={() => {
                      setStep(1)
                      setIssued(false)
                      setRegion('')
                      setIdentifier('')
                      setProviderData(null)
                    }}
                  >
                    Issue Another
                  </Button>
                </>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

function SearchIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}














