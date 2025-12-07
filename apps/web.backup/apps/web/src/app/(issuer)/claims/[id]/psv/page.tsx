'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  ClipboardList,
  Loader2,
  ShieldCheck,
  Sparkles,
  Stethoscope,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import type { IssuerClaim } from '@/lib/issuer/types'

type BoardStatus = 'active' | 'expired' | 'revoked' | 'probation'
type LicenseStatus = 'active' | 'expired' | 'restricted' | 'probation'
type Severity = 'none' | 'low' | 'medium' | 'high'

interface PsvFormState {
  boardLookup: {
    boardName: string
    certificateId: string
    status: BoardStatus
    expiresOn: string
    referenceUrl: string
    notes: string
  }
  licenseLookup: {
    jurisdiction: string
    licenseNumber: string
    status: LicenseStatus
    expiresOn: string
    lastVerified: string
    disciplinaryAction: string
  }
  npdbSnapshot: {
    queryId: string
    lastQueried: string
    alertCount: string
    severity: Severity
    summary: string
    findings: string
  }
  notes: string
  verifiedBy: string
}

const emptyForm: PsvFormState = {
  boardLookup: {
    boardName: '',
    certificateId: '',
    status: 'active',
    expiresOn: '',
    referenceUrl: '',
    notes: '',
  },
  licenseLookup: {
    jurisdiction: '',
    licenseNumber: '',
    status: 'active',
    expiresOn: '',
    lastVerified: '',
    disciplinaryAction: '',
  },
  npdbSnapshot: {
    queryId: '',
    lastQueried: '',
    alertCount: '0',
    severity: 'low',
    summary: '',
    findings: '',
  },
  notes: '',
  verifiedBy: '',
}

export default function ClaimPsvPanel() {
  const params = useParams<{ id: string }>()
  const claimId = params?.id
  const [claim, setClaim] = useState<IssuerClaim | null>(null)
  const [form, setForm] = useState<PsvFormState>(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    if (!claimId) return

    const fetchClaim = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/issuer/claims?claimId=${claimId}`)
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data?.error || 'Unable to load claim')
        }
        setClaim(data.claim)
        setForm(buildFormState(data.claim as IssuerClaim))
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : 'Unable to load claim data.')
      } finally {
        setLoading(false)
      }
    }

    fetchClaim()
  }, [claimId])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!claimId) return
    setSaving(true)

    try {
      const payload = {
        boardLookup: form.boardLookup,
        licenseLookup: form.licenseLookup,
        npdbSnapshot: {
          ...form.npdbSnapshot,
          alertCount: Number(form.npdbSnapshot.alertCount || '0'),
          findings: form.npdbSnapshot.findings
            ? form.npdbSnapshot.findings.split('\n').map((line) => line.trim()).filter(Boolean)
            : [],
        },
        notes: form.notes,
        verifiedBy: form.verifiedBy || 'Issuer analyst',
      }

      const response = await fetch(`/api/issuer/psv/${claimId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || 'Unable to persist PSV')
      }

      setClaim(data.claim)
      setForm(buildFormState(data.claim as IssuerClaim))

      toast({
        title: 'PSV results saved',
        description: 'Claim is now ready for issuance.',
      })
    } catch (submitError) {
      toast({
        title: 'PSV save failed',
        description: submitError instanceof Error ? submitError.message : 'Unable to save PSV at this time.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const statusAlert = useMemo(() => {
    if (!claim) return null
    if (claim.status === 'ready-to-issue') {
      return {
        label: 'Ready to issue',
        icon: <ShieldCheck className="h-4 w-4" />,
        tone: 'success' as const,
      }
    }
    if (claim.status === 'issued') {
      return {
        label: 'Credential issued',
        icon: <ShieldCheck className="h-4 w-4 text-emerald-500" />,
        tone: 'success' as const,
      }
    }
    return {
      label: 'PSV in progress',
      icon: <AlertTriangle className="h-4 w-4" />,
      tone: 'warning' as const,
    }
  }, [claim])

  return (
    <div className="container mx-auto space-y-6 py-8">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link href="/issuer/claims" className="inline-flex items-center text-muted-foreground transition hover:text-foreground">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to claims
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="font-medium">PSV Panel</span>
      </div>
      {claimId && (
        <div className="flex justify-end">
          <Button asChild variant="outline">
            <Link href={`/issuer/claims/${claimId}/templates`} className="gap-2">
              <Sparkles className="h-4 w-4" />
              Use template
            </Link>
          </Button>
        </div>
      )}

      {loading ? (
        <Card>
          <CardHeader>
            <CardTitle>Loading PSV panel...</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive">Failed to load claim</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      ) : claim ? (
        <>
          <Card>
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="flex flex-wrap items-center gap-3 text-2xl">
                  <span>{claim.clinicianName}</span>
                  <Badge variant="outline">{claim.specialty}</Badge>
                  <Badge variant="secondary">NPI {claim.npi}</Badge>
                </CardTitle>
                <CardDescription className="flex flex-wrap gap-3">
                  <span>{claim.facility}</span>
                  <span>•</span>
                  <span>Submitted {new Date(claim.submittedAt).toLocaleString()}</span>
                </CardDescription>
              </div>
              {statusAlert ? (
                <div
                  className={`flex items-center gap-2 rounded-md px-3 py-1 text-sm ${
                    statusAlert.tone === 'success'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  {statusAlert.icon}
                  {statusAlert.label}
                </div>
              ) : null}
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <SummaryField label="License" value={`${claim.autoParsed.license.state} ${claim.autoParsed.license.number}`} />
              <SummaryField label="Board certification" value={`${claim.autoParsed.board.name} #${claim.autoParsed.board.certificateId}`} />
              <SummaryField label="Risk score" value={`${(claim.riskScore * 100).toFixed(0)}%`} />
            </CardContent>
          </Card>

          <Card>
            <form onSubmit={handleSubmit} className="space-y-8">
              <CardHeader>
                <CardTitle>Primary source verification</CardTitle>
                <CardDescription>Document board + license lookups and NPDB attestation.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                <section className="space-y-4">
                  <SectionHeading icon={<ClipboardList className="h-4 w-4" />}>Board lookup</SectionHeading>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Board name">
                      <Input
                        value={form.boardLookup.boardName}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            boardLookup: { ...prev.boardLookup, boardName: event.target.value },
                          }))
                        }
                      />
                    </Field>
                    <Field label="Certificate ID">
                      <Input
                        value={form.boardLookup.certificateId}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            boardLookup: { ...prev.boardLookup, certificateId: event.target.value },
                          }))
                        }
                      />
                    </Field>
                    <Field label="Status">
                      <Select
                        value={form.boardLookup.status}
                        onValueChange={(value: BoardStatus) =>
                          setForm((prev) => ({
                            ...prev,
                            boardLookup: { ...prev.boardLookup, status: value },
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="expired">Expired</SelectItem>
                          <SelectItem value="revoked">Revoked</SelectItem>
                          <SelectItem value="probation">Probation</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Expires on">
                      <Input
                        type="date"
                        value={form.boardLookup.expiresOn}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            boardLookup: { ...prev.boardLookup, expiresOn: event.target.value },
                          }))
                        }
                      />
                    </Field>
                  </div>
                  <Field label="Reference URL">
                    <Input
                      value={form.boardLookup.referenceUrl}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          boardLookup: { ...prev.boardLookup, referenceUrl: event.target.value },
                        }))
                      }
                    />
                  </Field>
                  <Field label="Board notes">
                    <Textarea
                      rows={3}
                      value={form.boardLookup.notes}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          boardLookup: { ...prev.boardLookup, notes: event.target.value },
                        }))
                      }
                    />
                  </Field>
                </section>

                <section className="space-y-4">
                  <SectionHeading icon={<Stethoscope className="h-4 w-4" />}>License lookup</SectionHeading>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Jurisdiction">
                      <Input
                        value={form.licenseLookup.jurisdiction}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            licenseLookup: { ...prev.licenseLookup, jurisdiction: event.target.value },
                          }))
                        }
                      />
                    </Field>
                    <Field label="License number">
                      <Input
                        value={form.licenseLookup.licenseNumber}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            licenseLookup: { ...prev.licenseLookup, licenseNumber: event.target.value },
                          }))
                        }
                      />
                    </Field>
                    <Field label="Status">
                      <Select
                        value={form.licenseLookup.status}
                        onValueChange={(value: LicenseStatus) =>
                          setForm((prev) => ({
                            ...prev,
                            licenseLookup: { ...prev.licenseLookup, status: value },
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="restricted">Restricted</SelectItem>
                          <SelectItem value="probation">Probation</SelectItem>
                          <SelectItem value="expired">Expired</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Expires on">
                      <Input
                        type="date"
                        value={form.licenseLookup.expiresOn}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            licenseLookup: { ...prev.licenseLookup, expiresOn: event.target.value },
                          }))
                        }
                      />
                    </Field>
                    <Field label="Last verified">
                      <Input
                        type="datetime-local"
                        value={form.licenseLookup.lastVerified}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            licenseLookup: { ...prev.licenseLookup, lastVerified: event.target.value },
                          }))
                        }
                      />
                    </Field>
                    <Field label="Disciplinary action">
                      <Input
                        placeholder="e.g. None, Consent order"
                        value={form.licenseLookup.disciplinaryAction}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            licenseLookup: { ...prev.licenseLookup, disciplinaryAction: event.target.value },
                          }))
                        }
                      />
                    </Field>
                  </div>
                </section>

                <section className="space-y-4">
                  <SectionHeading icon={<ShieldCheck className="h-4 w-4" />}>NPDB snapshot</SectionHeading>
                  <div className="grid gap-4 md:grid-cols-3">
                    <Field label="Query ID">
                      <Input
                        value={form.npdbSnapshot.queryId}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            npdbSnapshot: { ...prev.npdbSnapshot, queryId: event.target.value },
                          }))
                        }
                      />
                    </Field>
                    <Field label="Last queried">
                      <Input
                        type="datetime-local"
                        value={form.npdbSnapshot.lastQueried}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            npdbSnapshot: { ...prev.npdbSnapshot, lastQueried: event.target.value },
                          }))
                        }
                      />
                    </Field>
                    <Field label="Alert count">
                      <Input
                        type="number"
                        min={0}
                        value={form.npdbSnapshot.alertCount}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            npdbSnapshot: { ...prev.npdbSnapshot, alertCount: event.target.value },
                          }))
                        }
                      />
                    </Field>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Severity">
                      <Select
                        value={form.npdbSnapshot.severity}
                        onValueChange={(value: Severity) =>
                          setForm((prev) => ({
                            ...prev,
                            npdbSnapshot: { ...prev.npdbSnapshot, severity: value },
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select severity" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Findings (one per line)">
                      <Textarea
                        rows={3}
                        value={form.npdbSnapshot.findings}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            npdbSnapshot: { ...prev.npdbSnapshot, findings: event.target.value },
                          }))
                        }
                      />
                    </Field>
                  </div>
                  <Field label="Summary">
                    <Textarea
                      rows={4}
                      value={form.npdbSnapshot.summary}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          npdbSnapshot: { ...prev.npdbSnapshot, summary: event.target.value },
                        }))
                      }
                    />
                  </Field>
                </section>

                <section className="grid gap-4 md:grid-cols-2">
                  <Field label="Internal notes">
                    <Textarea
                      rows={4}
                      value={form.notes}
                      onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                    />
                  </Field>
                  <Field label="Verified by">
                    <Input
                      value={form.verifiedBy}
                      onChange={(event) => setForm((prev) => ({ ...prev, verifiedBy: event.target.value }))}
                      placeholder="Issuer analyst"
                    />
                  </Field>
                </section>
              </CardContent>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t px-6 py-4">
                <p className="text-sm text-muted-foreground">Saving emits an immutable PSV audit event.</p>
                <div className="flex gap-3">
                  <Button type="submit" disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                    {claim?.status === 'ready-to-issue' ? 'Update PSV record' : 'Save & mark ready'}
                  </Button>
                </div>
              </div>
            </form>
          </Card>
        </>
      ) : null}
    </div>
  )
}

function SectionHeading({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
      {icon}
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      {children}
    </div>
  )
}

function SummaryField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/40 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}

function buildFormState(claim: IssuerClaim): PsvFormState {
  const dateOnly = (value: string) => (value ? value.slice(0, 10) : '')
  const toDateTime = (value?: string) => (value ? value.slice(0, 16) : '')

  return {
    boardLookup: {
      boardName: claim.psv?.boardLookup.boardName ?? claim.autoParsed.board.name ?? '',
      certificateId: claim.psv?.boardLookup.certificateId ?? claim.autoParsed.board.certificateId ?? '',
      status: claim.psv?.boardLookup.status ?? 'active',
      expiresOn: dateOnly(claim.psv?.boardLookup.expiresOn ?? claim.autoParsed.board.expiresOn),
      referenceUrl: claim.psv?.boardLookup.referenceUrl ?? '',
      notes: claim.psv?.boardLookup.notes ?? '',
    },
    licenseLookup: {
      jurisdiction: claim.psv?.licenseLookup.jurisdiction ?? claim.autoParsed.license.state ?? '',
      licenseNumber: claim.psv?.licenseLookup.licenseNumber ?? claim.autoParsed.license.number ?? '',
      status: claim.psv?.licenseLookup.status ?? 'active',
      expiresOn: dateOnly(claim.psv?.licenseLookup.expiresOn ?? claim.autoParsed.license.expiresOn),
      lastVerified: toDateTime(claim.psv?.licenseLookup.lastVerified ?? new Date().toISOString()),
      disciplinaryAction: claim.psv?.licenseLookup.disciplinaryAction ?? '',
    },
    npdbSnapshot: {
      queryId: claim.psv?.npdbSnapshot.queryId ?? `NPDB-${claim.id}`,
      lastQueried: toDateTime(claim.psv?.npdbSnapshot.lastQueried ?? new Date().toISOString()),
      alertCount: String(claim.psv?.npdbSnapshot.alertCount ?? 0),
      severity: claim.psv?.npdbSnapshot.severity ?? 'low',
      summary: claim.psv?.npdbSnapshot.summary ?? 'No adverse actions reported.',
      findings: claim.psv?.npdbSnapshot.findings?.join('\n') ?? '',
    },
    notes: claim.psv?.notes ?? '',
    verifiedBy: claim.psv?.verifiedBy ?? '',
  }
}

