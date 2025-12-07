'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  FileText,
  Loader2,
  Network,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import type { IssuerClaim } from '@/lib/issuer/types'

type ClaimStatus = IssuerClaim['status']

const statusCopy: Record<
  ClaimStatus,
  {
    label: string
    variant: 'default' | 'secondary' | 'outline' | 'destructive'
    icon: ReactNode
  }
> = {
  pending: {
    label: 'Awaiting triage',
    variant: 'outline',
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
  },
  'psv-in-progress': {
    label: 'PSV in progress',
    variant: 'secondary',
    icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
  },
  'ready-to-issue': {
    label: 'Ready to issue',
    variant: 'default',
    icon: <ShieldCheck className="h-3.5 w-3.5" />,
  },
  issued: {
    label: 'Credential issued',
    variant: 'default',
    icon: <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />,
  },
  rejected: {
    label: 'Rejected',
    variant: 'destructive',
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
  },
}

export default function IssuerClaimsQueue() {
  const [claims, setClaims] = useState<IssuerClaim[]>([])
  const [loading, setLoading] = useState(true)
  const [issueLoading, setIssueLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    const fetchClaims = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch('/api/issuer/claims')
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data?.error || 'Unable to load claims')
        }
        setClaims(data.claims ?? [])
      } catch (fetchError) {
        console.error(fetchError)
        setError(fetchError instanceof Error ? fetchError.message : 'Unable to load claims right now.')
      } finally {
        setLoading(false)
      }
    }

    fetchClaims()
  }, [])

  const metrics = useMemo(() => {
    const pending = claims.filter((claim) => claim.status === 'pending').length
    const ready = claims.filter((claim) => claim.status === 'ready-to-issue').length
    const issued = claims.filter((claim) => claim.status === 'issued').length
    const docs = claims.reduce((sum, claim) => sum + claim.docs.length, 0)
    return { pending, ready, issued, docs }
  }, [claims])

  const handleIssue = async (claimId: string) => {
    setIssueLoading(claimId)
    try {
      const response = await fetch(`/api/issuer/issue/${claimId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: 'clinical-core-v1' }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || 'Issuance failed')
      }

      setClaims((prev) =>
        prev.map((claim) =>
          claim.id === claimId
            ? {
                ...claim,
                status: 'issued',
                issuedCredential: {
                  credentialId: data.credentialId,
                  issuedAt: data.anchoredAt,
                  txHash: data.txHash,
                },
              }
            : claim,
        ),
      )

      toast({
        title: 'Credential issued',
        description: `Anchored tx ${data.txHash.slice(0, 10)}…`,
      })
    } catch (issueError) {
      toast({
        title: 'Issuance failed',
        description: issueError instanceof Error ? issueError.message : 'Unable to issue credential.',
        variant: 'destructive',
      })
    } finally {
      setIssueLoading(null)
    }
  }

  return (
    <div className="container mx-auto space-y-8 py-8">
      <header className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Issuer operations</p>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Claims ready for primary source verification</h1>
            <p className="text-muted-foreground max-w-3xl">
              Review inbound evidence bundles, confirm PSV, and trigger issuance when board + license checks are clean.
            </p>
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-4" aria-live="polite">
        <SummaryCard title="Pending" value={metrics.pending} description="Awaiting analyst triage" />
        <SummaryCard title="Ready to issue" value={metrics.ready} description="PSV complete with clean NPDB" />
        <SummaryCard title="Issued" value={metrics.issued} description="Anchored last 24h" />
        <SummaryCard title="Clinician docs" value={metrics.docs} description="Evidence packets parsed" />
      </section>

      {error ? (
        <div className="flex items-center gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <p>{error}</p>
        </div>
      ) : null}

      <section className="space-y-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, index) => <LoadingCard key={`skeleton-${index}`} />)
        ) : claims.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No pending claims</CardTitle>
              <CardDescription>Clinician submissions will appear here in real time.</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          claims.map((claim) => (
            <Card key={claim.id}>
              <CardHeader className="gap-4 md:flex md:items-center md:justify-between">
                <div>
                  <CardTitle className="flex flex-wrap items-center gap-3">
                    <span>{claim.clinicianName}</span>
                    <Badge variant="outline">{claim.specialty}</Badge>
                    <Badge variant="secondary">{claim.facility}</Badge>
                  </CardTitle>
                  <CardDescription className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                    <span>NPI {claim.npi}</span>
                    <span>Submitted {new Date(claim.submittedAt).toLocaleString()}</span>
                    <span>Priority {claim.priority}</span>
                  </CardDescription>
                </div>
                <div className="flex flex-col items-start gap-2 md:items-end">
                  <Badge variant={statusCopy[claim.status].variant} className="flex items-center gap-1 text-xs font-semibold uppercase">
                    {statusCopy[claim.status].icon}
                    {statusCopy[claim.status].label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">Risk score {(claim.riskScore * 100).toFixed(0)}%</span>
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <AutoField
                    label="NPI identity"
                    value={claim.autoParsed.npi}
                    meta="Matched to PECOS + CAQH"
                  />
                  <AutoField
                    label={`License (${claim.autoParsed.license.state})`}
                    value={claim.autoParsed.license.number}
                    meta={`Expires ${claim.autoParsed.license.expiresOn}`}
                  />
                  <AutoField
                    label="Board certification"
                    value={`${claim.autoParsed.board.name} #${claim.autoParsed.board.certificateId}`}
                    meta={`Status ${claim.autoParsed.board.status}`}
                  />
                </div>

                <section>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-muted-foreground">Clinician documents</h3>
                    <Badge variant="outline">{claim.docs.length}</Badge>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {claim.docs.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3 text-sm"
                        aria-label={`${doc.type} document ${doc.name}`}
                      >
                        <FileText className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        <div>
                          <p className="font-medium text-foreground">{doc.name}</p>
                          <p className="text-xs text-muted-foreground flex flex-wrap gap-2">
                            <span>{doc.type}</span>
                            <span>•</span>
                            <span>Source {doc.source}</span>
                            <span>•</span>
                            <span>{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                          </p>
                          {doc.extractedFields?.length ? (
                            <p className="text-xs text-emerald-700">Parsed: {doc.extractedFields.join(', ')}</p>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-lg border bg-muted/30 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-muted-foreground">Primary source verification</h3>
                    {claim.psv ? (
                      <Badge variant="default">Verified by {claim.psv.verifiedBy}</Badge>
                    ) : (
                      <Badge variant="outline">Pending</Badge>
                    )}
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-3 text-sm">
                    <PsvChip
                      label="Board lookup"
                      value={claim.psv?.boardLookup.boardName ?? 'Board directory pending'}
                      meta={claim.psv ? claim.psv.boardLookup.status : 'Awaiting lookup'}
                    />
                    <PsvChip
                      label="License lookup"
                      value={claim.psv?.licenseLookup.jurisdiction ?? 'State license not validated'}
                      meta={claim.psv ? claim.psv.licenseLookup.status : 'Pending'}
                    />
                    <PsvChip
                      label="NPDB snapshot"
                      value={claim.psv ? `${claim.psv.npdbSnapshot.alertCount} alerts` : 'No query yet'}
                      meta={claim.psv ? `Queried ${new Date(claim.psv.npdbSnapshot.lastQueried).toLocaleDateString()}` : 'Start NPDB query'}
                    />
                  </div>
                  {claim.issuedCredential ? (
                    <div className="mt-3 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-xs font-mono">
                      txHash {claim.issuedCredential.txHash}
                    </div>
                  ) : null}
                </section>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-muted-foreground">
                    Last updated {new Date(claim.lastUpdated).toLocaleString()}
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/issuer/claims/${claim.id}/psv`} className="flex items-center gap-1">
                        <Stethoscope className="h-3.5 w-3.5" />
                        Primary source panel
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/issuer/claims/${claim.id}/evidence`} className="flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5" />
                      Review evidence
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/issuer/claims/${claim.id}/sign`} className="flex items-center gap-1">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Signature method
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/issuer/claims/${claim.id}/issue`} className="flex items-center gap-1">
                      <Network className="h-3.5 w-3.5" />
                      ACA-Py issuance
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                  <Button
                      size="sm"
                      disabled={claim.status !== 'ready-to-issue' || issueLoading === claim.id}
                      onClick={() => handleIssue(claim.id)}
                    >
                      {issueLoading === claim.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <ShieldCheck className="mr-2 h-4 w-4" />
                      )}
                      Issue credential
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </section>
    </div>
  )
}

function SummaryCard({ title, value, description }: { title: string; value: number; description: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}

function AutoField({ label, value, meta }: { label: string; value: string; meta: string }) {
  return (
    <div className="rounded-lg border bg-white/70 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-lg font-medium text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{meta}</p>
    </div>
  )
}

function PsvChip({ label, value, meta }: { label: string; value: string; meta: string }) {
  return (
    <div className="rounded-md border bg-white/60 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-medium text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{meta}</p>
    </div>
  )
}

function LoadingCard() {
  return (
    <Card>
      <CardHeader className="space-y-2">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-64" />
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </CardContent>
    </Card>
  )
}

