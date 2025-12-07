'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock3, LockKeyhole, ShieldCheck } from 'lucide-react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type PacketStatus = 'DRAFT' | 'FROZEN' | 'SUBMITTED'

type AuditEntry = {
  id: string
  action: string
  detail: string
  timestamp: string
}

export default function SubmitCommitteePacketPage({ params }: { params: { clinicianId: string } }) {
  const [status, setStatus] = useState<PacketStatus>('DRAFT')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [srMessage, setSrMessage] = useState('')
  const [auditTrail, setAuditTrail] = useState<AuditEntry[]>(() => buildSeedAuditLog(params.clinicianId))

  const workflowSteps = useMemo(
    () => [
      {
        id: 'review',
        label: 'Final review',
        detail: 'Confirm all identity, licensure, and payer evidence.',
        icon: <Clock3 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />,
        state: status === 'DRAFT' ? 'ACTIVE' : 'DONE',
      },
      {
        id: 'freeze',
        label: 'Freeze packet',
        detail: 'Lock evidence bundle and create immutable hash.',
        icon: <LockKeyhole className="h-4 w-4 text-muted-foreground" aria-hidden="true" />,
        state: status === 'FROZEN' ? 'ACTIVE' : status === 'SUBMITTED' ? 'DONE' : 'PENDING',
      },
      {
        id: 'submit',
        label: 'Submit to committee',
        detail: 'Generate audit event and notify credentialing committee.',
        icon: <ShieldCheck className="h-4 w-4 text-muted-foreground" aria-hidden="true" />,
        state: status === 'SUBMITTED' ? 'DONE' : 'PENDING',
      },
    ],
    [status],
  )

  const badgeVariant: 'default' | 'secondary' | 'outline' = status === 'SUBMITTED' ? 'secondary' : status === 'FROZEN' ? 'outline' : 'default'

  const handleConfirmSubmit = async () => {
    setIsDialogOpen(false)
    setIsSubmitting(true)
    setSrMessage('Freezing committee packet')

    await wait(900)
    setStatus('FROZEN')
    setAuditTrail((previous) => [
      {
        id: `audit-${Date.now()}-freeze`,
        action: 'Packet frozen',
        detail: 'Immutable hash generated and stored in audit ledger.',
        timestamp: new Date().toISOString(),
      },
      ...previous,
    ])

    setSrMessage('Packet frozen. Submitting to committee.')
    await wait(900)
    setStatus('SUBMITTED')
    setAuditTrail((previous) => [
      {
        id: `audit-${Date.now()}`,
        action: 'Packet submitted',
        detail: 'Committee review event dispatched with SUBMITTED status.',
        timestamp: new Date().toISOString(),
      },
      ...previous,
    ])
    setSrMessage('Packet submitted to committee.')
    setIsSubmitting(false)
    setTimeout(() => setSrMessage(''), 3500)
  }

  return (
    <div className="container mx-auto space-y-8 py-8">
      <header className="space-y-4">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Demo • Org • Committee Workflow</p>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <h1 className="text-3xl font-bold">Submit to Committee</h1>
            <p className="max-w-2xl text-muted-foreground">
              This workflow freezes the packet, records an audit event, and transitions the status to SUBMITTED so the committee can launch deliberations.
            </p>
            <div className="flex gap-2">
              <Badge variant={badgeVariant} className="text-sm">
                Status: {status}
              </Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href={`/demo/org/committee/${params.clinicianId}`}>Back to packet</Link>
            </Button>
            <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button disabled={status === 'SUBMITTED'} aria-live="assertive">
                  {status === 'SUBMITTED' ? 'Submitted' : 'Submit to committee'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Freeze and submit packet?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will lock evidence, create a packet hash, and emit a committee audit event. The packet cannot be edited once submitted.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleConfirmSubmit} disabled={isSubmitting}>
                    Confirm submit
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Workflow steps</CardTitle>
            <CardDescription>Every step includes an SR-friendly status change announcement.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {workflowSteps.map((step) => (
              <div key={step.id} className="flex items-start gap-3 rounded-lg border px-3 py-3">
                <div className="mt-1">{step.icon}</div>
                <div>
                  <p className="font-semibold flex items-center gap-2">
                    {step.label}
                    {step.state === 'DONE' && <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />}
                    {step.state === 'ACTIVE' && <span className="text-xs text-primary">In progress</span>}
                  </p>
                  <p className="text-sm text-muted-foreground">{step.detail}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Audit log</CardTitle>
            <CardDescription>Newest events appear first and include machine timestamps.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {auditTrail.map((entry) => (
              <div key={entry.id} className="rounded-lg border px-4 py-3">
                <p className="font-semibold">{entry.action}</p>
                <p className="text-sm text-muted-foreground">{entry.detail}</p>
                <p className="text-xs text-muted-foreground">Recorded {new Date(entry.timestamp).toLocaleString()}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Safety checklist</CardTitle>
          <CardDescription>Freeze verifies checksum + evidence, submit posts audit signal.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          {[
            { label: 'Evidence bundle hash', value: status !== 'DRAFT' ? '✅ Locked' : 'Pending', icon: <LockKeyhole className="h-5 w-5 text-primary" aria-hidden="true" /> },
            { label: 'Audit event', value: status === 'SUBMITTED' ? '✅ Emitted' : 'Pending', icon: <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" /> },
            { label: 'Committee notified', value: status === 'SUBMITTED' ? '✅ Confirmed' : 'Queued', icon: <AlertTriangle className="h-5 w-5 text-primary" aria-hidden="true" /> },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border bg-muted/30 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                {item.icon}
                {item.label}
              </p>
              <p className="text-xl font-semibold">{item.value}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <span className="sr-only" aria-live="assertive">
        {srMessage}
      </span>
    </div>
  )
}

function buildSeedAuditLog(clinicianId: string): AuditEntry[] {
  const now = new Date()
  const earlier = new Date(now)
  earlier.setHours(now.getHours() - 2)

  return [
    {
      id: 'audit-initial',
      action: 'Packet compiled',
      detail: `Draft packet generated for clinician ${clinicianId}.`,
      timestamp: earlier.toISOString(),
    },
    {
      id: 'audit-review',
      action: 'Reviewer signed off',
      detail: 'Primary reviewer confirmed identity + licensure sections.',
      timestamp: now.toISOString(),
    },
  ]
}

function wait(duration: number) {
  return new Promise((resolve) => setTimeout(resolve, duration))
}


