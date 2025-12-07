'use client'

import { useState } from 'react'
import { PrivilegeState, PrivilegeStateBadge } from '@/components/privileges/PrivilegeStateBadge'
import { SafetyDrawer, type SafetyDrawerProps } from '@/components/safety/SafetyDrawer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { ClipboardSignature, FileText, UsersRound } from 'lucide-react'

type CommitteeCase = {
  id: string
  clinician: string
  serviceLine: string
  severity: 'CRITICAL' | 'HIGH'
  rationale: string
  signals: string[]
  lastUpdated: string
  drawer: Omit<SafetyDrawerProps, 'open' | 'onOpenChange'>
}

type PrivilegeQueue = {
  privilege: string
  state: PrivilegeState
  cases: CommitteeCase[]
}

const QUEUE: PrivilegeQueue[] = [
  {
    privilege: 'Trauma call team',
    state: 'SUSPENDED',
    cases: [
      {
        id: 'case-001',
        clinician: 'Dr. Ash Shah',
        serviceLine: 'Emergency medicine',
        severity: 'CRITICAL',
        rationale: 'Critical FPPE variance tied to airway management',
        signals: ['FPPE - Airway failures', 'Event log escalation'],
        lastUpdated: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        drawer: buildCommitteeDrawer('Trauma call team', 'CRITICAL'),
      },
      {
        id: 'case-002',
        clinician: 'Dr. Mei Collins',
        serviceLine: 'Emergency medicine',
        severity: 'HIGH',
        rationale: 'Multiple overlapping trauma alerts triggered staffing pressure',
        signals: ['Staffing telemetry', 'Case overlap variance'],
        lastUpdated: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        drawer: buildCommitteeDrawer('Trauma call team', 'HIGH'),
      },
    ],
  },
  {
    privilege: 'Procedural sedation',
    state: 'RESTRICTED',
    cases: [
      {
        id: 'case-010',
        clinician: 'Dr. Leo Ortega',
        serviceLine: 'Hospital medicine',
        severity: 'HIGH',
        rationale: 'Simulation competency expired and FPPE flagged two airway rescues',
        signals: ['Simulation gap', 'FPPE airway variance'],
        lastUpdated: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
        drawer: buildCommitteeDrawer('Procedural sedation', 'HIGH'),
      },
    ],
  },
  {
    privilege: 'Cardiac cath lab',
    state: 'HOLD',
    cases: [
      {
        id: 'case-020',
        clinician: 'Dr. Priya Rao',
        serviceLine: 'Cardiology',
        severity: 'HIGH',
        rationale: 'OPPE shows 35% volume drop with quality variance',
        signals: ['OPPE deviation', 'Peer review pending'],
        lastUpdated: new Date(Date.now() - 11 * 60 * 60 * 1000).toISOString(),
        drawer: buildCommitteeDrawer('Cardiac cath lab', 'HIGH'),
      },
    ],
  },
]

export default function CommitteeSafetyQueuePage() {
  const [selectedCase, setSelectedCase] = useState<CommitteeCase | null>(null)

  return (
    <div className="container mx-auto space-y-8 py-8">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Demo • Org • Committee</p>
        <h1 className="text-3xl font-bold tracking-tight">Safety committee queue</h1>
        <p className="text-muted-foreground max-w-3xl">
          CRITICAL and HIGH safety cases grouped by privilege. Each tile summarizes the rationale, active signals, and
          provides a one-click path into the packet generator so the committee can issue determinations faster.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-2">
        {QUEUE.map((entry) => (
          <Card key={entry.privilege}>
            <CardHeader className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <CardTitle className="text-xl">{entry.privilege}</CardTitle>
                <PrivilegeStateBadge state={entry.state} reason={`Queue contains ${entry.cases.length} case(s)`} />
              </div>
              <CardDescription>
                {entry.cases.length} case{entry.cases.length > 1 ? 's' : ''} awaiting committee action for this
                privilege.
              </CardDescription>
              <Button variant="secondary" size="sm" className="w-fit gap-2" onClick={() => setSelectedCase(entry.cases[0])}>
                <FileText className="h-4 w-4" aria-hidden="true" />
                Launch packet generator
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {entry.cases.map((committeeCase) => (
                <article key={committeeCase.id} className="rounded-lg border p-4" aria-live="polite">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                    <Badge variant="outline" className={cn('text-[11px]', severityBadge(committeeCase.severity))}>
                      {committeeCase.severity}
                    </Badge>
                    <span>{committeeCase.clinician}</span>
                    <span className="text-xs text-muted-foreground">Updated {formatRelative(committeeCase.lastUpdated)}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{committeeCase.serviceLine}</p>
                  <p className="mt-2 text-sm">{committeeCase.rationale}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    {committeeCase.signals.map((signal) => (
                      <Badge key={signal} variant="outline" className="bg-muted">
                        {signal}
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" className="gap-2" onClick={() => setSelectedCase(committeeCase)}>
                      <ClipboardSignature className="h-4 w-4" aria-hidden="true" />
                      Review signals
                    </Button>
                    <Button size="sm" variant="ghost">
                      <UsersRound className="h-4 w-4" aria-hidden="true" />
                      Assign reviewer
                    </Button>
                  </div>
                </article>
              ))}
            </CardContent>
          </Card>
        ))}
      </section>

      <SafetyDrawer
        open={Boolean(selectedCase)}
        onOpenChange={(open) => {
          if (!open) setSelectedCase(null)
        }}
        {...(selectedCase?.drawer ?? FALLBACK_DRAWER)}
      />
    </div>
  )
}

function severityBadge(severity: CommitteeCase['severity']) {
  return severity === 'CRITICAL' ? 'bg-rose-50 text-rose-900 border-rose-200' : 'bg-amber-50 text-amber-900 border-amber-200'
}

function formatRelative(date: string) {
  const diffMs = Date.now() - new Date(date).getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

const FALLBACK_DRAWER: Omit<SafetyDrawerProps, 'open' | 'onOpenChange'> = {
  privilegeName: 'Privilege',
  state: 'FULL',
  stateReason: 'No open cases',
  summary: 'No case selected.',
  signals: [],
  dependencies: [],
  nextSteps: [],
}

function buildCommitteeDrawer(privilegeName: string, severity: CommitteeCase['severity']): Omit<SafetyDrawerProps, 'open' | 'onOpenChange'> {
  const state: PrivilegeState = severity === 'CRITICAL' ? 'SUSPENDED' : 'RESTRICTED'
  return {
    privilegeName,
    clinicianName: 'Committee safety queue',
    facility: 'System-wide',
    state,
    stateReason: severity === 'CRITICAL' ? 'Committee auto-suspended pending review' : 'Scope restricted while remediation completes',
    summary: `Committee queue detail for ${privilegeName}. Drawer highlights what drove the ${severity.toLowerCase()} severity.`,
    signals: [
      {
        id: `${privilegeName}-case-signal`,
        label: 'Safety variance',
        severity: severity === 'CRITICAL' ? 'critical' : 'high',
        summary: 'Variance monitor reported performance outside tolerance bands.',
        lastNoted: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        weight: 'primary',
        contributingEvidence: ['FPPE logs', 'Case timeline'],
      },
      {
        id: `${privilegeName}-case-signal-2`,
        label: 'Dependency pressure',
        severity: 'medium',
        summary: 'Downstream privilege dependency requested escalation.',
        lastNoted: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
        weight: 'supporting',
        contributingEvidence: ['Staffing telemetry', 'Packet generator'],
      },
    ],
    dependencies: [
      {
        id: `${privilegeName}-dep-a`,
        name: 'Packet generator',
        type: 'credentialing',
        status: severity === 'CRITICAL' ? 'offline' : 'degraded',
        description: 'Generates the committee packet with latest attachments.',
      },
      {
        id: `${privilegeName}-dep-b`,
        name: 'Peer review',
        type: 'quality',
        status: 'healthy',
        description: 'Signals when peer review commentary is appended.',
      },
    ],
    nextSteps: [
      {
        id: `${privilegeName}-step-a`,
        action: 'Issue committee determination',
        owner: 'Safety committee chair',
        status: severity === 'CRITICAL' ? 'blocked' : 'pending',
        due: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: `${privilegeName}-step-b`,
        action: 'Sync packet to quality inbox',
        owner: 'Credentialing ops',
        status: 'scheduled',
        due: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
    severityPattern: [
      { label: 'Initial', severity: 'medium', value: 45 },
      { label: 'Escalated', severity: severity === 'CRITICAL' ? 'critical' : 'high', value: 90 },
      { label: 'Current', severity: severity === 'CRITICAL' ? 'critical' : 'high', value: 85 },
    ],
  }
}


