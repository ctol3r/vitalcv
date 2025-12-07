'use client'

import { useMemo, useState } from 'react'
import { SentinelSignalDrawer, type SentinelSignal } from '@/components/sentinel/SentinelSignalDrawer'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { TrendingUp, AlertTriangle, Activity, Users } from 'lucide-react'

type MicrographData = {
  id: string
  label: string
  type: 'oppe-drift' | 'complication-cluster' | 'risk-trend' | 'enrollment-anomaly'
  data: Array<{ date: string; value: number }>
  currentValue: number
  baseline: number
  trend: 'up' | 'down' | 'stable'
  severity: 'critical' | 'high' | 'medium' | 'low'
  signal?: SentinelSignal
}

const MOCK_MICROGRAPHS: MicrographData[] = [
  {
    id: 'graph-1',
    label: 'OPPE drift',
    type: 'oppe-drift',
    data: [
      { date: '2025-11-01', value: 0.85 },
      { date: '2025-11-02', value: 0.82 },
      { date: '2025-11-03', value: 0.78 },
      { date: '2025-11-04', value: 0.75 },
      { date: '2025-11-05', value: 0.72 },
      { date: '2025-11-06', value: 0.68 },
      { date: '2025-11-07', value: 0.65 },
    ],
    currentValue: 0.65,
    baseline: 0.85,
    trend: 'down',
    severity: 'high',
    signal: {
      id: 'oppe-signal',
      label: 'OPPE drift detected',
      severity: 'high',
      zScore: -2.3,
      anomalyScore: 72,
      timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      summary: 'OPPE performance score declining over 7 days, now 23% below baseline.',
      eventHistory: [
        { id: 'e1', timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), event: 'Baseline', value: 0.85 },
        { id: 'e2', timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), event: 'Decline', value: 0.72 },
        { id: 'e3', timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), event: 'Current', value: 0.65 },
      ],
    },
  },
  {
    id: 'graph-2',
    label: 'Complication cluster hints',
    type: 'complication-cluster',
    data: [
      { date: '2025-11-01', value: 0 },
      { date: '2025-11-02', value: 0 },
      { date: '2025-11-03', value: 1 },
      { date: '2025-11-04', value: 0 },
      { date: '2025-11-05', value: 1 },
      { date: '2025-11-06', value: 0 },
      { date: '2025-11-07', value: 1 },
    ],
    currentValue: 1,
    baseline: 0,
    trend: 'up',
    severity: 'critical',
    signal: {
      id: 'complication-signal',
      label: 'Complication cluster detected',
      severity: 'critical',
      zScore: 3.1,
      anomalyScore: 88,
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      summary: 'Three complications in 5-day window, all during procedural sedation cases.',
      eventHistory: [
        { id: 'e4', timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), event: 'Event 1', value: 1 },
        { id: 'e5', timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), event: 'Event 2', value: 1 },
        { id: 'e6', timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), event: 'Event 3', value: 1 },
      ],
      causalLinks: [
        {
          id: 'link-1',
          type: 'temporal',
          description: 'All events occurred during night shift hours',
          strength: 0.85,
        },
      ],
    },
  },
  {
    id: 'graph-3',
    label: 'Risk micro-trends',
    type: 'risk-trend',
    data: [
      { date: '2025-11-01', value: 0.45 },
      { date: '2025-11-02', value: 0.48 },
      { date: '2025-11-03', value: 0.52 },
      { date: '2025-11-04', value: 0.55 },
      { date: '2025-11-05', value: 0.58 },
      { date: '2025-11-06', value: 0.62 },
      { date: '2025-11-07', value: 0.65 },
    ],
    currentValue: 0.65,
    baseline: 0.45,
    trend: 'up',
    severity: 'medium',
    signal: {
      id: 'risk-signal',
      label: 'Risk trend increasing',
      severity: 'medium',
      zScore: 1.8,
      anomalyScore: 58,
      timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      summary: 'Gradual increase in composite risk score over 7 days.',
      eventHistory: [
        { id: 'e7', timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), event: 'Baseline', value: 0.45 },
        { id: 'e8', timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), event: 'Mid-point', value: 0.55 },
        { id: 'e9', timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), event: 'Current', value: 0.65 },
      ],
    },
  },
  {
    id: 'graph-4',
    label: 'Enrollment anomalies',
    type: 'enrollment-anomaly',
    data: [
      { date: '2025-11-01', value: 12 },
      { date: '2025-11-02', value: 11 },
      { date: '2025-11-03', value: 8 },
      { date: '2025-11-04', value: 7 },
      { date: '2025-11-05', value: 6 },
      { date: '2025-11-06', value: 5 },
      { date: '2025-11-07', value: 4 },
    ],
    currentValue: 4,
    baseline: 12,
    trend: 'down',
    severity: 'low',
    signal: {
      id: 'enrollment-signal',
      label: 'Enrollment pattern shift',
      severity: 'low',
      zScore: -1.5,
      anomalyScore: 42,
      timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
      summary: 'Patient enrollment decreased 67% over 7 days, may indicate workflow change.',
      eventHistory: [
        { id: 'e10', timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), event: 'Baseline', value: 12 },
        { id: 'e11', timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), event: 'Decline', value: 7 },
        { id: 'e12', timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), event: 'Current', value: 4 },
      ],
    },
  },
]

const GRAPH_HEIGHT = 60
const GRAPH_WIDTH = 200
const GRAPH_PADDING = 8

export default function ClinicianSentinelMicrographPage() {
  const [selectedSignal, setSelectedSignal] = useState<SentinelSignal | null>(null)

  return (
    <div className="container mx-auto space-y-8 py-8">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Demo • Clinician • Sentinel</p>
        <h1 className="text-3xl font-bold tracking-tight">Sentinel micrograph</h1>
        <p className="text-muted-foreground max-w-3xl">
          Tiny graphs showing OPPE drift, complication cluster hints, risk micro-trends, and enrollment anomalies.
          Click any graph to view detailed signal information.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {MOCK_MICROGRAPHS.map((micrograph) => {
          const computed = computeGraphData(micrograph.data)
          return (
            <Card
              key={micrograph.id}
              className={cn(
                'cursor-pointer transition-shadow hover:shadow-md',
                micrograph.severity === 'critical' && 'border-rose-300',
                micrograph.severity === 'high' && 'border-amber-300',
                micrograph.severity === 'medium' && 'border-sky-300',
              )}
              onClick={() => micrograph.signal && setSelectedSignal(micrograph.signal)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">{micrograph.label}</CardTitle>
                  <Badge variant="outline" className={cn('text-xs', severityBadge(micrograph.severity))}>
                    {micrograph.severity}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="relative" role="img" aria-label={`${micrograph.label} trend graph`}>
                  <svg width={GRAPH_WIDTH} height={GRAPH_HEIGHT} className="w-full" aria-hidden="true">
                    {/* Baseline line */}
                    <line
                      x1={GRAPH_PADDING}
                      y1={GRAPH_HEIGHT / 2}
                      x2={GRAPH_WIDTH - GRAPH_PADDING}
                      y2={GRAPH_HEIGHT / 2}
                      stroke="hsl(var(--border))"
                      strokeDasharray="2 2"
                      strokeWidth="1"
                      opacity={0.3}
                    />
                    {/* Data line */}
                    <polyline
                      fill="none"
                      stroke={trendColor(micrograph.trend)}
                      strokeWidth="2"
                      points={computed.points}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {/* Data points */}
                    {computed.pointCoords.map((point, idx) => (
                      <circle
                        key={idx}
                        cx={point.x}
                        cy={point.y}
                        r="3"
                        fill={trendColor(micrograph.trend)}
                        stroke="hsl(var(--background))"
                        strokeWidth="1"
                      />
                    ))}
                  </svg>
                  <div className="sr-only">
                    {micrograph.label} graph showing {micrograph.trend} trend. Current value: {micrograph.currentValue}, baseline: {micrograph.baseline}.
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <span className="text-xs text-muted-foreground">Current</span>
                    <p className="font-semibold">{formatValue(micrograph.currentValue, micrograph.type)}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-muted-foreground">Baseline</span>
                    <p className="font-medium">{formatValue(micrograph.baseline, micrograph.type)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <TrendingUp
                    className={cn(
                      'h-3 w-3',
                      micrograph.trend === 'up' ? 'text-rose-500' : micrograph.trend === 'down' ? 'text-emerald-500' : 'text-slate-500',
                    )}
                    aria-hidden="true"
                  />
                  <span>
                    {micrograph.trend === 'up' ? 'Increasing' : micrograph.trend === 'down' ? 'Decreasing' : 'Stable'}
                  </span>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            Signal summary
          </CardTitle>
          <CardDescription>Overview of all active micro-signals</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {MOCK_MICROGRAPHS.map((micrograph) => (
              <div
                key={micrograph.id}
                className="flex items-center justify-between rounded-lg border p-3"
                onClick={() => micrograph.signal && setSelectedSignal(micrograph.signal)}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{micrograph.label}</span>
                    <Badge variant="outline" className={cn('text-xs', severityBadge(micrograph.severity))}>
                      {micrograph.severity}
                    </Badge>
                  </div>
                  {micrograph.signal && (
                    <p className="text-sm text-muted-foreground">{micrograph.signal.summary}</p>
                  )}
                </div>
                {micrograph.signal && (
                  <Badge variant="outline" className="text-xs">
                    Z: {micrograph.signal.zScore.toFixed(1)}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

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

function computeGraphData(data: Array<{ date: string; value: number }>) {
  if (data.length === 0) return { points: '', pointCoords: [] }

  const values = data.map((d) => d.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const width = GRAPH_WIDTH - GRAPH_PADDING * 2
  const height = GRAPH_HEIGHT - GRAPH_PADDING * 2

  const pointCoords = data.map((datum, index) => {
    const x = GRAPH_PADDING + (width * index) / Math.max(data.length - 1, 1)
    const normalized = (datum.value - min) / range
    const y = GRAPH_PADDING + height * (1 - normalized)
    return { x, y }
  })

  const points = pointCoords.map((p) => `${p.x},${p.y}`).join(' ')

  return { points, pointCoords }
}

function trendColor(trend: 'up' | 'down' | 'stable') {
  switch (trend) {
    case 'up':
      return '#fb7185' // rose
    case 'down':
      return '#34d399' // emerald
    default:
      return '#94a3b8' // slate
  }
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

function formatValue(value: number, type: string): string {
  if (type === 'enrollment-anomaly') {
    return value.toString()
  }
  return (value * 100).toFixed(0) + '%'
}

