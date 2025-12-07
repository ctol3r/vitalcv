'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { AlertTriangle, FileText, Microscope, ShieldCheck } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import type { ClaimEvidenceBundle } from '@/lib/issuer/types'

interface EvidenceResponse {
  evidence: ClaimEvidenceBundle
}

export default function ClaimEvidencePanel() {
  const params = useParams<{ id: string }>()
  const claimId = params?.id
  const [bundle, setBundle] = useState<ClaimEvidenceBundle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!claimId) return
    let cancelled = false
    const fetchEvidence = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/issuer/evidence/${claimId}`)
        const data = (await response.json()) as EvidenceResponse & { error?: string }
        if (!response.ok) {
          throw new Error(data?.error || 'Unable to load evidence bundle.')
        }
        if (!cancelled) {
          setBundle(data.evidence)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load evidence bundle.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }
    fetchEvidence()
    return () => {
      cancelled = true
    }
  }, [claimId])

  if (!claimId) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Missing claim id</CardTitle>
            <CardDescription>Unable to resolve claim context.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto space-y-6 py-8">
      <header>
        <p className="text-sm font-medium text-muted-foreground">Issuer workflow</p>
        <h1 className="text-3xl font-semibold tracking-tight">Review evidence</h1>
        <p className="text-muted-foreground">
          Inspect OCR extractions, license metadata, and source checks before final issuance.
        </p>
      </header>

      {loading ? (
        <Card>
          <CardHeader>
            <CardTitle>Loading evidence...</CardTitle>
            <CardDescription>Pulling OCR artifacts and board checks.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-3 text-sm text-muted-foreground">
            <Button variant="ghost" disabled size="sm">
              <Microscope className="mr-2 h-4 w-4 animate-spin" />
              Evaluating
            </Button>
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader className="flex flex-row items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div>
              <CardTitle className="text-destructive">Evidence unavailable</CardTitle>
              <CardDescription className="text-destructive">{error}</CardDescription>
            </div>
          </CardHeader>
        </Card>
      ) : bundle ? (
        <>
          <Card>
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  License details
                </CardTitle>
                <CardDescription>
                  Jurisdiction {bundle.licenseDetails.jurisdiction} • Expires{' '}
                  {bundle.licenseDetails.expiresOn}
                </CardDescription>
              </div>
              <Badge variant="outline">Template confidence {(bundle.licenseDetails.templateConfidence * 100).toFixed(0)}%</Badge>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <Detail label="License number" value={bundle.licenseDetails.licenseNumber} />
              <Detail label="Status" value={bundle.licenseDetails.status} />
              <Detail label="Generated at" value={new Date(bundle.generatedAt).toLocaleString()} />
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  OCR fields
                </CardTitle>
                <CardDescription>Confidence-weighted extractions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {bundle.ocrFields.map((field) => (
                  <div key={field.label}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{field.label}</span>
                      <span className="text-muted-foreground">
                        {(field.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{field.value}</p>
                    <Progress value={field.confidence * 100} className="mt-1" />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Source checks</CardTitle>
                <CardDescription>Cross-validated registries</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {bundle.sourceChecks.map((check) => (
                  <div key={check.name} className="rounded-md border p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{check.name}</span>
                      <Badge variant={check.status === 'pass' ? 'outline' : 'destructive'}>
                        {check.status}
                      </Badge>
                    </div>
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                      {check.details.map((detail) => (
                        <li key={detail}>{detail}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Fraud indicators</CardTitle>
              <CardDescription>Synthesized heuristics for HITL triage</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              {bundle.fraudIndicators.map((indicator) => (
                <div key={indicator.signal} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{indicator.signal}</p>
                    <Badge
                      variant={indicator.severity === 'high' ? 'destructive' : 'secondary'}
                      className="capitalize"
                    >
                      {indicator.severity}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{indicator.rationale}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-base font-medium">{value}</p>
    </div>
  )
}










