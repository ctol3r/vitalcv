'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, MailCheck, ShieldCheck, UploadCloud } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import type { DomainCheckResult, IssuerRecord, UploadedSeal } from '@/lib/issuer/types'

interface FormState {
  orgName: string
  npi: string
  jurisdiction: string
  emailDomain: string
  contactName: string
  contactEmail: string
  notes: string
}

const jurisdictions = [
  'CA',
  'WA',
  'NY',
  'TX',
  'NM',
  'FL',
  'Multi-state',
  'Nationwide',
  'IMLC Compact',
] as const

export default function IssuerRegistrationPage() {
  const [form, setForm] = useState<FormState>({
    orgName: '',
    npi: '',
    jurisdiction: jurisdictions[0],
    emailDomain: '',
    contactName: '',
    contactEmail: '',
    notes: '',
  })
  const [seal, setSeal] = useState<UploadedSeal | null>(null)
  const [domainCheck, setDomainCheck] = useState<DomainCheckResult | null>(null)
  const [domainStatus, setDomainStatus] = useState<'idle' | DomainCheckResult['status']>('idle')
  const [isCheckingDomain, setIsCheckingDomain] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [issuerRecord, setIssuerRecord] = useState<IssuerRecord | null>(null)
  const { toast } = useToast()

  const formIsValid = useMemo(() => {
    return Boolean(form.orgName && form.npi.length === 10 && form.emailDomain)
  }, [form.orgName, form.npi.length, form.emailDomain])

  const steps = useMemo(
    () => [
      {
        label: 'Upload issuer seal/logo',
        done: Boolean(seal),
        description: seal ? seal.fileName : 'High-res PNG or SVG',
      },
      {
        label: 'Organization profile',
        done: Boolean(form.orgName && form.npi.length === 10),
        description: form.orgName ? `NPI ${form.npi || '—'}` : 'Legal name + NPI',
      },
      {
        label: 'Verify email domain',
        done: domainStatus === 'verified',
        description:
          domainStatus === 'verified'
            ? 'DMARC + MX matched'
            : domainStatus === 'rejected'
              ? 'Update DNS posture'
              : 'Prove domain control',
      },
      {
        label: 'Anchor registration',
        done: Boolean(issuerRecord),
        description: issuerRecord ? issuerRecord.anchorHash.slice(0, 12) + '…' : 'Chain-backed audit',
      },
    ],
    [seal, form.orgName, form.npi, domainStatus, issuerRecord],
  )

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const previewDataUrl = await readFileAsDataUrl(file)
    setSeal({
      fileName: file.name,
      size: file.size,
      mimeType: file.type,
      previewDataUrl,
    })
  }

  const handleDomainCheck = async () => {
    if (!formIsValid) {
      toast({
        title: 'Add organization details first',
        description: 'Name, NPI, and email domain are required before verification.',
        variant: 'destructive',
      })
      return
    }

    if (domainStatus === 'verified') {
      return
    }

    setIsCheckingDomain(true)
    setDomainStatus('idle')

    try {
      const response = await fetch('/api/issuer/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload('domain-check')),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.error || 'Domain check failed')
      }

      setDomainCheck(data.domainCheck)
      setDomainStatus(data.domainCheck?.status ?? 'pending')
      toast({
        title: 'Domain verification updated',
        description: `Status: ${data.domainCheck?.status ?? 'pending'}`,
      })
    } catch (error) {
      console.error(error)
      toast({
        title: 'Domain verification failed',
        description: error instanceof Error ? error.message : 'Unable to verify domain.',
        variant: 'destructive',
      })
    } finally {
      setIsCheckingDomain(false)
    }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!formIsValid) return
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/issuer/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload('register')),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.error || 'Registration failed')
      }

      setIssuerRecord(data.record)
      setDomainCheck(data.domainCheck)
      setDomainStatus(data.domainCheck?.status ?? 'pending')

      toast({
        title: 'Issuer registered',
        description: `Anchor ${data.record.anchorHash.slice(0, 8)}… created on-chain.`,
      })
    } catch (error) {
      toast({
        title: 'Registration failed',
        description: error instanceof Error ? error.message : 'Unable to create issuer record.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const buildPayload = (intent: 'register' | 'domain-check') => ({
    intent,
    organization: {
      name: form.orgName,
      npi: form.npi,
      jurisdiction: form.jurisdiction,
      contactName: form.contactName,
      contactEmail: form.contactEmail,
    },
    emailDomain: form.emailDomain,
    seal: seal ?? undefined,
  })

  return (
    <div className="container mx-auto space-y-8 py-8">
      <header className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Issuer onboarding</p>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Register issuer organization</h1>
            <p className="text-muted-foreground max-w-3xl">
              Upload your seal, provide regulated identifiers, and verify the sending domain we&apos;ll trust for credential
              emails. The flow anchors an immutable audit event once everything checks out.
            </p>
          </div>
          {issuerRecord ? (
            <Badge className="w-fit" variant="secondary">
              Issuer ID {issuerRecord.id}
            </Badge>
          ) : null}
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <Card>
          <form onSubmit={handleSubmit}>
            <CardHeader>
              <CardTitle>Organization details</CardTitle>
              <CardDescription>Legal identity + domain proof ensures credentials route back to your tenant.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="orgName">Organization name</Label>
                  <Input
                    id="orgName"
                    placeholder="Metro One Health"
                    value={form.orgName}
                    onChange={(event) => setForm((prev) => ({ ...prev, orgName: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="npi">Organization NPI</Label>
                  <Input
                    id="npi"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="1234567890"
                    value={form.npi}
                    onChange={(event) => {
                      const digits = event.target.value.replace(/\D/g, '').slice(0, 10)
                      setForm((prev) => ({ ...prev, npi: digits }))
                    }}
                  />
                  <p className="text-xs text-muted-foreground">10-digit Type 2 NPI</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Jurisdiction</Label>
                  <Select
                    value={form.jurisdiction}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, jurisdiction: value }))}
                  >
                    <SelectTrigger id="jurisdiction">
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {jurisdictions.map((j) => (
                        <SelectItem key={j} value={j}>
                          {j}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emailDomain">Primary email domain</Label>
                  <Input
                    id="emailDomain"
                    placeholder="issuer.example.org"
                    value={form.emailDomain}
                    onChange={(event) => setForm((prev) => ({ ...prev, emailDomain: event.target.value.trim() }))}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="contactName">Primary contact</Label>
                  <Input
                    id="contactName"
                    placeholder="Morgan Patel"
                    value={form.contactName}
                    onChange={(event) => setForm((prev) => ({ ...prev, contactName: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactEmail">Contact email</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    placeholder="morgan@issuer.org"
                    value={form.contactEmail}
                    onChange={(event) => setForm((prev) => ({ ...prev, contactEmail: event.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Registration notes (optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Share risk controls, escalation contacts, or prior issuer IDs."
                  value={form.notes}
                  rows={4}
                  onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Issuer seal / logo</Label>
                <label
                  htmlFor="seal-upload"
                  className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border/70 bg-muted/40 px-4 py-8 text-center transition hover:border-primary"
                >
                  {seal?.previewDataUrl ? (
                    <img
                      src={seal.previewDataUrl}
                      alt="Issuer seal preview"
                      className="h-24 w-24 rounded-full object-cover ring-4 ring-primary/10"
                    />
                  ) : (
                    <UploadCloud className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
                  )}
                  <div>
                    <p className="font-medium text-foreground">Drop PNG/SVG or click to upload</p>
                    <p className="text-sm text-muted-foreground">We embed the seal inside the credential metadata.</p>
                  </div>
                </label>
                <Input id="seal-upload" className="sr-only" type="file" accept="image/png,image/svg+xml" onChange={handleFileChange} />
                {seal ? (
                  <div className="text-xs text-muted-foreground">
                    {seal.fileName} · {(seal.size / 1024).toFixed(1)}KB · {seal.mimeType}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-3 pb-6">
                <Button type="button" variant="secondary" disabled={isCheckingDomain || !formIsValid} onClick={handleDomainCheck}>
                  {isCheckingDomain ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MailCheck className="mr-2 h-4 w-4" />}
                  Verify email domain
                </Button>
                <Button type="submit" disabled={!formIsValid || isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                  Anchor issuer record
                </Button>
                <Badge variant={domainStatus === 'verified' ? 'default' : domainStatus === 'rejected' ? 'destructive' : 'outline'}>
                  Domain status: {domainStatus === 'idle' ? 'not checked' : domainStatus}
                </Badge>
              </div>
            </CardContent>
          </form>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Control plane progress</CardTitle>
              <CardDescription>Each milestone must complete before issuers can mint credentials.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {steps.map((step) => (
                <div
                  key={step.label}
                  className="flex items-start gap-3 rounded-md border bg-muted/40 px-3 py-2 text-sm"
                  aria-live="polite"
                >
                  {step.done ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" aria-hidden="true" />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-500" aria-hidden="true" />
                  )}
                  <div>
                    <p className="font-medium leading-tight">{step.label}</p>
                    <p className="text-muted-foreground">{step.description}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Domain verification</CardTitle>
              <CardDescription>MX + TXT posture summary</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {domainCheck ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">Status</span>
                    <Badge
                      variant={
                        domainCheck.status === 'verified'
                          ? 'default'
                          : domainCheck.status === 'rejected'
                            ? 'destructive'
                            : 'secondary'
                      }
                    >
                      {domainCheck.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">MX records</p>
                    <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                      {domainCheck.mxRecords.map((record) => (
                        <li key={record}>{record}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Evidence</p>
                    <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                      {domainCheck.evidence.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  {domainCheck.issues?.length ? (
                    <div>
                      <p className="font-medium text-foreground">Issues</p>
                      <ul className="mt-1 list-disc pl-5 text-muted-foreground text-red-500">
                        {domainCheck.issues.map((issue) => (
                          <li key={issue}>{issue}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="text-muted-foreground">Run the verification to see MX, SPF, and DMARC status.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Audit anchor</CardTitle>
              <CardDescription>Immutable record once issuer onboarding is accepted.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {issuerRecord ? (
                <>
                  <div>
                    <p className="font-medium text-foreground">Anchor hash</p>
                    <p className="font-mono text-xs text-muted-foreground">{issuerRecord.anchorHash}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Created</span>
                    <span>{new Date(issuerRecord.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Issuer DID</span>
                    <span className="font-mono text-xs">{issuerRecord.issuerDid}</span>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground">Anchor materializes after successful registration.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}

async function readFileAsDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = (event) => reject(event)
    reader.readAsDataURL(file)
  })
}

