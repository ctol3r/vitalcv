'use client'

import { useMemo, useState } from 'react'
import { SentinelAlerts } from '@/components/sentinel/SentinelAlerts'
import { SentinelSignalDrawer, type SentinelSignal } from '@/components/sentinel/SentinelSignalDrawer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { AlertTriangle, TrendingUp, Users, Building2 } from 'lucide-react'

type MicroSignal = {
  id: string
  clinicianId: string
  clinicianName: string
  department: string
  anomalyScore: number
  earlyWarningCount: number
  signal: SentinelSignal
}

const MOCK_MICRO_SIGNALS: MicroSignal[] = [
  {
    id: 'signal-1',
    clinicianId: 'clin-1',
    clinicianName: 'Dr. Sarah Chen',
    department: 'Cardiology',
    anomalyScore: 78,
    earlyWarningCount: 3,
    signal: {
      id: 'signal-1',
      label: 'OPPE drift detected',
      severity: 'high',
      zScore: 2.8,
      anomalyScore: 78,
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      summary: 'Cardiac cath lab volume dropped 23% below baseline with complication rate increase.',
      eventHistory: [
        { id: 'e1', timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), event: 'Volume drop', value: -0.23 },
        { id: 'e2', timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), event: 'Complication spike', value: 0.15 },
      ],
      causalLinks: [
        {
          id: 'link-1',
          type: 'temporal',
          description: 'Volume drop preceded complication increase by 24 hours',
          strength: 0.72,
        },
      ],
    },
  },
  {
    id: 'signal-2',
    clinicianId: 'clin-2',
    clinicianName: 'Dr. Michael Torres',
    department: 'Emergency Medicine',
    anomalyScore: 85,
    earlyWarningCount: 5,
    signal: {
      id: 'signal-2',
      label: 'Complication cluster hint',
      severity: 'critical',
      zScore: 3.4,
      anomalyScore: 85,
      timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      summary: 'Three airway events in 48-hour window, all during night shifts.',
      eventHistory: [
        { id: 'e3', timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), event: 'Airway event #1', value: 1 },
        { id: 'e4', timestamp: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(), event: 'Airway event #2', value: 1 },
        { id: 'e5', timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), event: 'Airway event #3', value: 1 },
      ],
      causalLinks: [
        {
          id: 'link-2',
          type: 'causal',
          description: 'Night shift staffing pattern correlates with events',
          strength: 0.88,
          relatedSignal: 'Staffing telemetry',
        },
      ],
    },
  },
  {
    id: 'signal-3',
    clinicianId: 'clin-3',
    clinicianName: 'Dr. Emily Rodriguez',
    department: 'Surgery',
    anomalyScore: 62,
    earlyWarningCount: 2,
    signal: {
      id: 'signal-3',
      label: 'Risk micro-trend',
      severity: 'medium',
      zScore: 1.9,
      anomalyScore: 62,
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      summary: 'Gradual increase in post-op readmission rate over 14 days.',
      eventHistory: [
        { id: 'e6', timestamp: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), event: 'Readmission baseline', value: 0.08 },
        { id: 'e7', timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), event: 'Readmission increase', value: 0.12 },
      ],
    },
  },
  {
    id: 'signal-4',
    clinicianId: 'clin-4',
    clinicianName: 'Dr. James Park',
    department: 'Internal Medicine',
    anomalyScore: 45,
    earlyWarningCount: 1,
    signal: {
      id: 'signal-4',
      label: 'Enrollment anomaly',
      severity: 'low',
      zScore: 1.2,
      anomalyScore: 45,
      timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      summary: 'Patient enrollment pattern shifted, may indicate workflow change.',
      eventHistory: [
        { id: 'e8', timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), event: 'Enrollment shift', value: -0.15 },
      ],
    },
  },
]

const MOCK_ALERTS = [
  {
    id: 'alert-1',
    clinicianId: 'clin-2',
    clinicianName: 'Dr. Michael Torres',
    department: 'Emergency Medicine',
    signalType: 'complication-cluster' as const,
    severity: 'critical' as const,
    anomalyScore: 85,
    threshold: 75,
    timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    description: 'Three airway events in 48-hour window detected.',
    supervisorAgentNotified: true,
  },
  {
    id: 'alert-2',
    clinicianId: 'clin-1',
    clinicianName: 'Dr. Sarah Chen',
    department: 'Cardiology',
    signalType: 'oppe-drift' as const,
    severity: 'high' as const,
    anomalyScore: 78,
    threshold: 70,
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    description: 'OPPE volume drop with complication increase.',
  },
]

export default function OrgSentinelDashboardPage() {
  const [selectedSignal, setSelectedSignal] = useState<SentinelSignal | null>(null)
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null)

  const departments = useMemo(() => {
    const deptSet = new Set(MOCK_MICRO_SIGNALS.map((s) => s.department))
    return Array.from(deptSet).sort()
  }, [])

  const filteredSignals = useMemo(() => {
    if (!selectedDepartment) return MOCK_MICRO_SIGNALS
    return MOCK_MICRO_SIGNALS.filter((s) => s.department === selectedDepartment)
  }, [selectedDepartment])

  const groupedByDepartment = useMemo(() => {
    const grouped: Record<string, MicroSignal[]> = {}
    filteredSignals.forEach((signal) => {
      if (!grouped[signal.department]) {
        grouped[signal.department] = []
      }
      grouped[signal.department].push(signal)
    })
    return grouped
  }, [filteredSignals])

  const stats = useMemo(() => {
    return {
      totalClinicians: new Set(filteredSignals.map((s) => s.clinicianId)).size,
      totalSignals: filteredSignals.length,
      avgAnomalyScore: Math.round(filteredSignals.reduce((sum, s) => sum + s.anomalyScore, 0) / filteredSignals.length || 0),
      criticalCount: filteredSignals.filter((s) => s.signal.severity === 'critical').length,
    }
  }, [filteredSignals])

  return (
    <div className="container mx-auto space-y-8 py-8">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Demo • Org • Sentinel</p>
        <h1 className="text-3xl font-bold tracking-tight">Early warning dashboard</h1>
        <p className="text-muted-foreground max-w-3xl">
          Real-time view of micro-signals, anomaly scores, and early warnings grouped by clinician and department.
          Screen-reader friendly with comprehensive text descriptions.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total clinicians</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <p className="text-2xl font-bold">{stats.totalClinicians}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Active signals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <p className="text-2xl font-bold">{stats.totalSignals}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Avg anomaly score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <p className="text-2xl font-bold">{stats.avgAnomalyScore}%</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Critical signals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-500" aria-hidden="true" />
              <p className="text-2xl font-bold text-rose-600">{stats.criticalCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant={selectedDepartment === null ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedDepartment(null)}
        >
          All departments
        </Button>
        {departments.map((dept) => (
          <Button
            key={dept}
            variant={selectedDepartment === dept ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedDepartment(dept)}
          >
            {dept}
          </Button>
        ))}
      </div>

      <section className="space-y-6">
        {Object.entries(groupedByDepartment).map(([department, signals]) => (
          <Card key={department}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                {department}
              </CardTitle>
              <CardDescription>{signals.length} active signal{signals.length !== 1 ? 's' : ''}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {signals.map((microSignal) => (
                  <article
                    key={microSignal.id}
                    className="rounded-lg border bg-muted/30 p-4"
                    aria-label={`Signal for ${microSignal.clinicianName} in ${microSignal.department}`}
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold">{microSignal.clinicianName}</h3>
                          <Badge variant="outline" className={cn(severityBadge(microSignal.signal.severity))}>
                            {microSignal.signal.severity.toUpperCase()}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{microSignal.department}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{microSignal.signal.summary}</p>
                        <div className="flex flex-wrap gap-4 text-sm">
                          <div>
                            <span className="text-xs uppercase tracking-wide text-muted-foreground">Anomaly score</span>
                            <p className="font-semibold">{microSignal.anomalyScore}%</p>
                          </div>
                          <div>
                            <span className="text-xs uppercase tracking-wide text-muted-foreground">Z-score</span>
                            <p className="font-semibold">{microSignal.signal.zScore.toFixed(2)}</p>
                          </div>
                          <div>
                            <span className="text-xs uppercase tracking-wide text-muted-foreground">Early warnings</span>
                            <p className="font-semibold">{microSignal.earlyWarningCount}</p>
                          </div>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setSelectedSignal(microSignal.signal)}>
                        View signal detail
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <SentinelAlerts
        alerts={MOCK_ALERTS}
        onAlertClick={(alert) => {
          const signal = MOCK_MICRO_SIGNALS.find((s) => s.clinicianId === alert.clinicianId)?.signal
          if (signal) setSelectedSignal(signal)
        }}
      />

      <SentinelSignalDrawer
        open={Boolean(selectedSignal)}
        onOpenChange={(open) => {
          if (!open) setSelectedSignal(null)
        }}
        signal={selectedSignal}
      />
    </div>
  )
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

