'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { PrivilegeState, PrivilegeStateBadge } from '@/components/privileges/PrivilegeStateBadge'
import { SafetyDrawer, type SafetyDrawerProps } from '@/components/safety/SafetyDrawer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { AlertTriangle, CheckCircle2, Hourglass, Shield } from 'lucide-react'

type ClinicianPrivilege = {
  id: string
  name: string
  facility: string
  coverage: string
  state: PrivilegeState
  lastReviewed: string
  signals: { id: string; label: string; severity: 'critical' | 'high' | 'medium' | 'low' }[]
  drawer: Omit<SafetyDrawerProps, 'open' | 'onOpenChange'>
}

const PRIVILEGES: ClinicianPrivilege[] = [
  {
    id: 'sedation',
    name: 'Procedural sedation',
    facility: 'Main OR • Campus A',
    coverage: 'Inpatient + ASC',
    state: 'RESTRICTED',
    lastReviewed: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    signals: [
      { id: 'signal-1', label: 'Airway FPPE variance', severity: 'critical' },
      { id: 'signal-2', label: 'Simulation gap', severity: 'high' },
    ],
    drawer: buildDrawerForClinician('Procedural sedation', 'RESTRICTED'),
  },
  {
    id: 'telehealth',
    name: 'Telehealth prescribing',
    facility: 'Virtual clinic',
    coverage: 'Multi-state compact',
    state: 'FULL',
    lastReviewed: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    signals: [{ id: 'signal-3', label: 'DEA sync stable', severity: 'low' }],
    drawer: buildDrawerForClinician('Telehealth prescribing', 'FULL'),
  },
  {
    id: 'cardiac',
    name: 'Cardiac cath lab',
    facility: 'Heart Institute',
    coverage: 'Cath lab + CV OR',
    state: 'HOLD',
    lastReviewed: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    signals: [
      { id: 'signal-4', label: 'OPPE volume drop', severity: 'high' },
      { id: 'signal-5', label: 'Committee review scheduled', severity: 'medium' },
    ],
    drawer: buildDrawerForClinician('Cardiac cath lab', 'HOLD'),
  },
  {
    id: 'trauma',
    name: 'Trauma call team',
    facility: 'Level 1 ED',
    coverage: 'Night trauma alerts',
    state: 'SUSPENDED',
    lastReviewed: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    signals: [
      { id: 'signal-6', label: 'Critical FPPE variance', severity: 'critical' },
      { id: 'signal-7', label: 'Event under review', severity: 'high' },
    ],
    drawer: buildDrawerForClinician('Trauma call team', 'SUSPENDED'),
  },
]

export default function ClinicianSafetyPage() {
  const [selected, setSelected] = useState<string | null>(null)
  const selectedPrivilege = PRIVILEGES.find((item) => item.id === selected)

  const statusCounts = useMemo(() => {
    return PRIVILEGES.reduce(
      (acc, privilege) => {
        acc[privilege.state] = (acc[privilege.state] ?? 0) + 1
        return acc
      },
      {} as Record<PrivilegeState, number>,
    )
  }, [])

  return (
    <div className="container mx-auto space-y-8 py-8">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Demo • Clinician • Safety</p>
        <h1 className="text-3xl font-bold tracking-tight">Privilege safety status</h1>
        <p className="text-muted-foreground max-w-3xl">
          Instant view of which privileges are stable, restricted, or under review for a clinician. Each badge surfaces
          the “why” from safety signals, and the drawer shows dependencies plus next steps without leaving the panel.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Snapshot</CardTitle>
          <CardDescription>Counts update automatically as safety signals roll in.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SnapshotTile
            icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" aria-hidden="true" />}
            label="Full privileges"
            value={statusCounts.FULL ?? 0}
          />
          <SnapshotTile
            icon={<AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden="true" />}
            label="Restricted"
            value={statusCounts.RESTRICTED ?? 0}
          />
          <SnapshotTile
            icon={<Hourglass className="h-5 w-5 text-slate-500" aria-hidden="true" />}
            label="Hold"
            value={statusCounts.HOLD ?? 0}
          />
          <SnapshotTile
            icon={<Shield className="h-5 w-5 text-rose-500" aria-hidden="true" />}
            label="Suspended"
            value={statusCounts.SUSPENDED ?? 0}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Privilege safety feed</CardTitle>
          <CardDescription>Screen-reader friendly list of privileges and the signals shaping status.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="divide-y rounded-xl border">
            {PRIVILEGES.map((privilege) => (
              <article key={privilege.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-base font-semibold">{privilege.name}</h3>
                    <PrivilegeStateBadge state={privilege.state} reason={describeSignals(privilege.signals)} />
                    <span className="text-xs text-muted-foreground">Reviewed {formatRelative(privilege.lastReviewed)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{privilege.facility}</p>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Coverage: {privilege.coverage}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {privilege.signals.map((signal) => (
                      <Badge key={signal.id} variant="outline" className={cn('text-xs', severityBadge(signal.severity))}>
                        {signal.label}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Button variant="outline" size="sm" onClick={() => setSelected(privilege.id)}>
                    View detail
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </CardContent>
      </Card>

      <SafetyDrawer
        open={Boolean(selectedPrivilege)}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
        {...(selectedPrivilege?.drawer ?? FALLBACK_DRAWER)}
      />
    </div>
  )
}

function SnapshotTile({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-3 text-3xl font-bold">{value}</p>
    </div>
  )
}

function describeSignals(signals: ClinicianPrivilege['signals']) {
  return signals.map((signal) => signal.label).join(', ')
}

function severityBadge(severity: 'critical' | 'high' | 'medium' | 'low') {
  switch (severity) {
    case 'critical':
      return 'bg-rose-50 text-rose-900 border-rose-200'
    case 'high':
      return 'bg-amber-50 text-amber-900 border-amber-200'
    case 'medium':
      return 'bg-sky-50 text-sky-900 border-sky-200'
    default:
      return 'bg-emerald-50 text-emerald-900 border-emerald-200'
  }
}

function formatRelative(date: string) {
  const diffMs = Date.now() - new Date(date).getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

const FALLBACK_DRAWER: Omit<SafetyDrawerProps, 'open' | 'onOpenChange'> = {
  privilegeName: 'Privilege',
  state: 'FULL',
  stateReason: 'No blocking signals.',
  summary: 'Safety drawer placeholder.',
  signals: [],
  dependencies: [],
  nextSteps: [],
}

function buildDrawerForClinician(privilegeName: string, state: PrivilegeState): Omit<SafetyDrawerProps, 'open' | 'onOpenChange'> {
  return {
    privilegeName,
    clinicianName: 'Dr. AI Demo',
    facility: 'Integrated health system',
    state,
    stateReason:
      state === 'FULL'
        ? 'All metrics within thresholds'
        : state === 'RESTRICTED'
          ? 'Committee limited scope after airway signal'
          : state === 'HOLD'
            ? 'Pending OPPE remediation review'
            : 'Privilege suspended while critical event is investigated',
    summary: `Drawer shows signals leading to the ${state.toLowerCase()} status so leaders can act.`,
    signals: [
      {
        id: `${privilegeName}-signal-1`,
        label: 'OPPE variance',
        severity: state === 'SUSPENDED' ? 'critical' : 'high',
        summary: 'Variance engine flagged outcomes outside control limits.',
        lastNoted: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
        weight: 'primary',
        contributingEvidence: ['OPPE bot', 'Committee notes'],
      },
      {
        id: `${privilegeName}-signal-2`,
        label: 'Dependency warning',
        severity: 'medium',
        summary: 'Linked privilege dependency reported degraded staffing coverage.',
        lastNoted: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
        weight: 'supporting',
        contributingEvidence: ['Staffing telemetry'],
      },
    ],
    dependencies: [
      {
        id: `${privilegeName}-dep-1`,
        name: 'FPPE checklist',
        type: 'quality',
        status: state === 'FULL' ? 'healthy' : 'degraded',
        description: 'Simulated cases and peer reviews recorded in last 30 days.',
      },
      {
        id: `${privilegeName}-dep-2`,
        name: 'Coverage attestation',
        type: 'credentialing',
        status: state === 'SUSPENDED' ? 'offline' : 'healthy',
        description: 'Medical staff attestation for coverage requirements.',
      },
    ],
    nextSteps: [
      {
        id: `${privilegeName}-step-1`,
        action: 'Upload mitigation evidence',
        owner: 'Service line leader',
        status: state === 'SUSPENDED' ? 'blocked' : 'pending',
        due: new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: `${privilegeName}-step-2`,
        action: 'Document severity determination',
        owner: 'Committee coordinator',
        status: 'scheduled',
        due: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
    severityPattern: [
      { label: '7d', severity: 'medium', value: 40 },
      { label: '72h', severity: state === 'SUSPENDED' ? 'critical' : 'high', value: 80 },
      { label: '24h', severity: state === 'FULL' ? 'low' : 'high', value: 60 },
    ],
  }
}


