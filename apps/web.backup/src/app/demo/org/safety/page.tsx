'use client'

import { useMemo, useState } from 'react'
import { PrivilegeStateBadge } from '@/components/privileges/PrivilegeStateBadge'
import { PrivilegeState } from '@/components/privileges/PrivilegeStateBadge'
import { SafetyDrawer, type SafetyDrawerProps } from '@/components/safety/SafetyDrawer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { Radar, ShieldAlert } from 'lucide-react'

type PrivilegeNode = {
  id: string
  label: string
  specialty: string
  state: PrivilegeState
  riskScore: number
  activeSignals: string[]
  drawer: Omit<SafetyDrawerProps, 'open' | 'onOpenChange'>
}

type RiskEdge = {
  id: string
  from: string
  to: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  rationale: string
}

const PRIVILEGE_NODES: PrivilegeNode[] = [
  {
    id: 'telehealth',
    label: 'Telehealth prescribing',
    specialty: 'Virtual care',
    state: 'FULL',
    riskScore: 0.32,
    activeSignals: ['Compact mismatch resolved', 'DEA sync passing'],
    drawer: buildDrawerConfig('Telehealth prescribing', 'FULL', 'Virtual care'),
  },
  {
    id: 'procedural-sedation',
    label: 'Procedural sedation',
    specialty: 'Hospital medicine',
    state: 'RESTRICTED',
    riskScore: 0.78,
    activeSignals: ['2 high-risk airway events', 'Pending simulation lab hours'],
    drawer: buildDrawerConfig('Procedural sedation', 'RESTRICTED', 'Hospital medicine'),
  },
  {
    id: 'cardiac-cath',
    label: 'Cardiac cath lab',
    specialty: 'Cardiology',
    state: 'HOLD',
    riskScore: 0.66,
    activeSignals: ['OPPE volume drop', 'Case review scheduled'],
    drawer: buildDrawerConfig('Cardiac cath lab', 'HOLD', 'Cardiology'),
  },
  {
    id: 'trauma-call',
    label: 'Trauma call team',
    specialty: 'Emergency medicine',
    state: 'SUSPENDED',
    riskScore: 0.92,
    activeSignals: ['Critical FPPE variance', 'Committee escalation'],
    drawer: buildDrawerConfig('Trauma call team', 'SUSPENDED', 'Emergency medicine'),
  },
  {
    id: 'icu-coverage',
    label: 'ICU coverage',
    specialty: 'Critical care',
    state: 'FULL',
    riskScore: 0.44,
    activeSignals: ['Night differential staffing', 'OPPE stable'],
    drawer: buildDrawerConfig('ICU coverage', 'FULL', 'Critical care'),
  },
  {
    id: 'outpatient-surgery',
    label: 'Outpatient surgery',
    specialty: 'Perioperative',
    state: 'RESTRICTED',
    riskScore: 0.57,
    activeSignals: ['EHR drift on implants', 'Packet addendum pending'],
    drawer: buildDrawerConfig('Outpatient surgery', 'RESTRICTED', 'Perioperative'),
  },
]

const RISK_EDGES: RiskEdge[] = [
  {
    id: 'edge-1',
    from: 'procedural-sedation',
    to: 'trauma-call',
    severity: 'critical',
    rationale: 'Shared airway coverage requires aligned restrictions',
  },
  {
    id: 'edge-2',
    from: 'cardiac-cath',
    to: 'icu-coverage',
    severity: 'high',
    rationale: 'Hemodynamic consult dependency flagged by OPPE',
  },
  {
    id: 'edge-3',
    from: 'telehealth',
    to: 'outpatient-surgery',
    severity: 'medium',
    rationale: 'EHR drift surfaced conflicting opioid protocols',
  },
]

const EDGE_COLOR: Record<RiskEdge['severity'], string> = {
  critical: '#fb7185',
  high: '#fbbf24',
  medium: '#38bdf8',
  low: '#34d399',
}

const RADAR_SIZE = 420
const RADAR_CENTER = RADAR_SIZE / 2
const RADAR_RADIUS = RADAR_CENTER - 24

export default function OrgSafetyRadarPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const nodesWithPosition = useMemo(() => positionNodes(PRIVILEGE_NODES), [])
  const selectedNode = nodesWithPosition.find((node) => node.id === selectedId)

  return (
    <div className="container mx-auto space-y-8 py-8">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Demo • Org • Safety</p>
        <h1 className="text-3xl font-bold tracking-tight">Privilege safety radar</h1>
        <p className="text-muted-foreground max-w-3xl">
          Radar visualization of privilege vulnerabilities across the system. Each node represents a privilege, and edges
          denote shared risk dependencies with color-coded severity. Summaries are screen-reader friendly with text
          equivalents for every signal.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-[1.75fr_1fr]">
        <Card>
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Radar className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                Org safety radar
              </CardTitle>
              <CardDescription>Real-time dependency view of privilege risk posture.</CardDescription>
            </div>
            {selectedNode && (
              <Button variant="outline" size="sm" onClick={() => setSelectedId(null)}>
                Clear selection
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="h-2 w-6 rounded-full bg-rose-400" aria-hidden="true" />
                Critical dependency
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-6 rounded-full bg-amber-400" aria-hidden="true" />
                High dependency
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-6 rounded-full bg-sky-400" aria-hidden="true" />
                Medium dependency
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-6 rounded-full bg-emerald-400" aria-hidden="true" />
                Low dependency
              </span>
            </div>

            <div className="relative mx-auto max-w-[460px]" role="img" aria-label="Privilege radar highlighting dependency severity">
              <svg width={RADAR_SIZE} height={RADAR_SIZE} className="w-full" aria-hidden="true">
                {[0.35, 0.6, 0.85, 1].map((ratio) => (
                  <circle key={ratio} cx={RADAR_CENTER} cy={RADAR_CENTER} r={RADAR_RADIUS * ratio} fill="none" stroke="#e5e7eb" className="stroke-1" />
                ))}
                {RISK_EDGES.map((edge) => {
                  const from = nodesWithPosition.find((node) => node.id === edge.from)
                  const to = nodesWithPosition.find((node) => node.id === edge.to)
                  if (!from || !to) {
                    return null
                  }
                  return (
                    <line key={edge.id} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={EDGE_COLOR[edge.severity]} strokeWidth={edge.severity === 'critical' ? 3 : 2} strokeDasharray={edge.severity === 'medium' ? '6 4' : undefined} opacity={0.9} />
                  )
                })}
                {nodesWithPosition.map((node) => (
                  <g key={node.id} onClick={() => setSelectedId(node.id)} className="cursor-pointer transition hover:opacity-80 focus:outline-hidden">
                    <circle cx={node.x} cy={node.y} r={selectedId === node.id ? 11 : 9} fill={stateColor(node.state)} stroke="#0f172a" strokeWidth={selectedId === node.id ? 2 : 1} />
                    <text x={node.x} y={node.y - 16} textAnchor="middle" className="fill-slate-700 text-[11px] font-semibold">
                      {node.label}
                    </text>
                    <text x={node.x} y={node.y + 18} textAnchor="middle" className="fill-slate-500 text-[10px]">
                      {node.specialty}
                    </text>
                  </g>
                ))}
              </svg>
              <dl className="sr-only">
                {nodesWithPosition.map((node) => (
                  <div key={node.id}>
                    <dt>{node.label}</dt>
                    <dd>
                      State {node.state}. Risk score {Math.round(node.riskScore * 100)}%. Signals {node.activeSignals.join(', ')}.
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-rose-500" aria-hidden="true" />
              Critical dependencies
            </CardTitle>
            <CardDescription>Edges that require committee oversight.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {RISK_EDGES.map((edge) => (
              <div key={edge.id} className="rounded-lg border bg-muted/40 p-4">
                <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                  <Badge variant="outline" className={cn('text-xs', severityBadge(edge.severity))}>
                    {edge.severity.toUpperCase()}
                  </Badge>
                  <span>{renderEdgeLabel(edge)}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{edge.rationale}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        {nodesWithPosition.map((node) => (
          <Card key={`card-${node.id}`} className={cn(selectedId === node.id && 'ring-2 ring-primary')}>
            <CardHeader className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">{node.label}</CardTitle>
                <PrivilegeStateBadge state={node.state} reason={node.activeSignals[0]} />
              </div>
              <CardDescription>{node.specialty}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="font-semibold">
                Risk score <span className="text-base">{Math.round(node.riskScore * 100)}</span>
              </p>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {node.activeSignals.map((signal) => (
                  <Badge key={signal} variant="outline" className="bg-muted/70">
                    {signal}
                  </Badge>
                ))}
              </div>
              <Button size="sm" variant="ghost" className="gap-2" onClick={() => setSelectedId(node.id)}>
                View safety detail
              </Button>
            </CardContent>
          </Card>
        ))}
      </section>

      <SafetyDrawer
        open={Boolean(selectedNode)}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null)
        }}
        {...(selectedNode?.drawer ?? DEFAULT_DRAWER_CONFIG)}
      />
    </div>
  )
}

function positionNodes(nodes: PrivilegeNode[]) {
  return nodes.map((node, index) => {
    const angle = (index / nodes.length) * Math.PI * 2 - Math.PI / 2
    const radius = RADAR_RADIUS * (0.35 + node.riskScore * 0.65)
    const x = RADAR_CENTER + Math.cos(angle) * radius
    const y = RADAR_CENTER + Math.sin(angle) * radius
    return { ...node, x, y }
  })
}

function stateColor(state: PrivilegeState) {
  switch (state) {
    case 'FULL':
      return '#34d399'
    case 'RESTRICTED':
      return '#fbbf24'
    case 'HOLD':
      return '#94a3b8'
    case 'SUSPENDED':
      return '#fb7185'
    default:
      return '#38bdf8'
  }
}

function severityBadge(severity: RiskEdge['severity']) {
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

function renderEdgeLabel(edge: RiskEdge) {
  const from = PRIVILEGE_NODES.find((node) => node.id === edge.from)?.label ?? edge.from
  const to = PRIVILEGE_NODES.find((node) => node.id === edge.to)?.label ?? edge.to
  return `${from} ↔ ${to}`
}

const DEFAULT_DRAWER_CONFIG: Omit<SafetyDrawerProps, 'open' | 'onOpenChange'> = {
  privilegeName: 'Privilege',
  state: 'FULL',
  stateReason: 'No open items',
  summary: 'No risk items selected.',
  signals: [],
  dependencies: [],
  nextSteps: [],
}

function buildDrawerConfig(privilegeName: string, state: PrivilegeState, specialty: string): Omit<SafetyDrawerProps, 'open' | 'onOpenChange'> {
  return {
    privilegeName,
    clinicianName: 'Committee cohort',
    facility: 'Multisite system',
    state,
    stateReason:
      state === 'FULL'
        ? 'No active blocking signals'
        : state === 'RESTRICTED'
          ? 'Scope is limited to low-risk settings pending remediation'
          : state === 'HOLD'
            ? 'Pending peer review sign-off for recent signal'
            : 'Privilege temporarily suspended while committee evaluates critical event',
    summary: `${privilegeName} is monitored centrally for ${specialty} privileges. This snapshot includes signals, dependencies, and remediation playbook steps.`,
    signals: [
      {
        id: `${privilegeName}-signal-1`,
        label: 'Safety variance',
        severity: state === 'SUSPENDED' ? 'critical' : state === 'HOLD' ? 'high' : 'medium',
        summary: 'Automated rules caught a deviation in the last 14-day OPPE sample.',
        lastNoted: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        weight: 'primary',
        contributingEvidence: ['OPPE trend', 'Simulation checklist'],
      },
      {
        id: `${privilegeName}-signal-2`,
        label: 'Dependency pressure',
        severity: state === 'RESTRICTED' ? 'high' : 'medium',
        summary: 'Shared service dependency reported degraded staffing coverage.',
        lastNoted: new Date(Date.now() - 9 * 60 * 60 * 1000).toISOString(),
        weight: 'supporting',
        contributingEvidence: ['Staffing bot', 'EHR drift monitor'],
      },
    ],
    dependencies: [
      {
        id: `${privilegeName}-dep-1`,
        name: 'Simulation lab sign-off',
        type: 'quality',
        status: state === 'FULL' ? 'healthy' : 'degraded',
        description: 'Tracks whether simulation hours and competencies were refreshed within 90 days.',
      },
      {
        id: `${privilegeName}-dep-2`,
        name: 'Coverage attestations',
        type: 'credentialing',
        status: state === 'SUSPENDED' ? 'offline' : 'healthy',
        description: 'Facility attestations to confirm consistent coverage per privileging scope.',
      },
    ],
    nextSteps: [
      {
        id: `${privilegeName}-step-1`,
        action: 'Review FPPE packet addendum',
        owner: 'Chief of staff',
        status: state === 'SUSPENDED' ? 'blocked' : 'pending',
        due: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: `${privilegeName}-step-2`,
        action: 'Log severity determination in committee queue',
        owner: 'Credentialing director',
        status: 'scheduled',
        due: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
    severityPattern: [
      { label: 'Week 1', severity: 'medium', value: 45 },
      { label: 'Week 2', severity: 'high', value: 72 },
      { label: 'Week 3', severity: state === 'SUSPENDED' ? 'critical' : 'high', value: 88 },
    ],
  }
}


