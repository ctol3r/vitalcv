'use client'

import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { AlertTriangle, Calendar, FileWarning, Shield, TrendingUp } from 'lucide-react'

export type CredentialEvent = {
  id: string
  type: 'renewal' | 'fppe' | 'oppe' | 'payer_cycle' | 'board_cycle'
  credentialName: string
  clinicianCount: number
  startDate: string
  endDate: string
  peakDate: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  department?: string
}

type BurdenCurveProps = {
  data?: CredentialEvent[]
  className?: string
  title?: string
  description?: string
  onEventClick?: (event: CredentialEvent) => void
}

const TYPE_COLORS: Record<CredentialEvent['type'], string> = {
  renewal: 'bg-blue-500',
  fppe: 'bg-purple-500',
  oppe: 'bg-indigo-500',
  payer_cycle: 'bg-amber-500',
  board_cycle: 'bg-rose-500',
}

const TYPE_LABELS: Record<CredentialEvent['type'], string> = {
  renewal: 'Renewal',
  fppe: 'FPPE Cycle',
  oppe: 'OPPE Window',
  payer_cycle: 'Payer Cycle',
  board_cycle: 'Board Cycle',
}

const TYPE_ICONS: Record<CredentialEvent['type'], typeof Calendar> = {
  renewal: Calendar,
  fppe: FileWarning,
  oppe: Shield,
  payer_cycle: TrendingUp,
  board_cycle: AlertTriangle,
}

const SEVERITY_COLORS: Record<CredentialEvent['severity'], string> = {
  critical: 'bg-rose-100 text-rose-900 border-rose-200',
  high: 'bg-amber-100 text-amber-900 border-amber-200',
  medium: 'bg-sky-100 text-sky-900 border-sky-200',
  low: 'bg-slate-100 text-slate-900 border-slate-200',
}

// Mock data - in real app, this would come from props or API
const DEFAULT_DATA: CredentialEvent[] = [
  {
    id: 'event-1',
    type: 'renewal',
    credentialName: 'State Medical License',
    clinicianCount: 24,
    startDate: '2025-12-01',
    endDate: '2025-12-31',
    peakDate: '2025-12-15',
    severity: 'high',
    department: 'ICU',
  },
  {
    id: 'event-2',
    type: 'renewal',
    credentialName: 'DEA Registration',
    clinicianCount: 18,
    startDate: '2025-12-10',
    endDate: '2025-12-30',
    peakDate: '2025-12-20',
    severity: 'critical',
    department: 'ED',
  },
  {
    id: 'event-3',
    type: 'fppe',
    credentialName: 'FPPE Cycle',
    clinicianCount: 15,
    startDate: '2025-12-05',
    endDate: '2026-01-05',
    peakDate: '2025-12-20',
    severity: 'medium',
    department: 'Cath Lab',
  },
  {
    id: 'event-4',
    type: 'oppe',
    credentialName: 'OPPE Window',
    clinicianCount: 32,
    startDate: '2025-12-15',
    endDate: '2026-01-15',
    peakDate: '2026-01-01',
    severity: 'high',
    department: 'Med/Surg',
  },
  {
    id: 'event-5',
    type: 'payer_cycle',
    credentialName: 'Medicare Credentialing',
    clinicianCount: 28,
    startDate: '2026-01-01',
    endDate: '2026-01-31',
    peakDate: '2026-01-15',
    severity: 'medium',
    department: 'Telehealth',
  },
  {
    id: 'event-6',
    type: 'board_cycle',
    credentialName: 'Board Certification Renewal',
    clinicianCount: 12,
    startDate: '2025-12-20',
    endDate: '2026-01-20',
    peakDate: '2026-01-10',
    severity: 'high',
    department: 'Cath Lab',
  },
  {
    id: 'event-7',
    type: 'renewal',
    credentialName: 'Compact License',
    clinicianCount: 16,
    startDate: '2025-12-10',
    endDate: '2026-01-10',
    peakDate: '2025-12-25',
    severity: 'medium',
    department: 'Telehealth',
  },
]

const SVG_WIDTH = 1000
const SVG_HEIGHT = 400
const SVG_PADDING = 60
const CHART_HEIGHT = SVG_HEIGHT - SVG_PADDING * 2

export function BurdenCurve({
  data = DEFAULT_DATA,
  className,
  title = 'Credential Burden Curve',
  description = 'Shows clustering of renewals, FPPE cycles, OPPE windows, payer cycles; identifies future bottlenecks',
  onEventClick,
}: BurdenCurveProps) {
  const [selectedType, setSelectedType] = useState<CredentialEvent['type'] | 'all'>('all')
  const [selectedTimeframe, setSelectedTimeframe] = useState<'30d' | '60d' | '90d' | '180d'>('90d')

  const timeframeDays: Record<'30d' | '60d' | '90d' | '180d', number> = {
    '30d': 30,
    '60d': 60,
    '90d': 90,
    '180d': 180,
  }

  const filteredData = useMemo(() => {
    const now = new Date()
    const cutoffDate = new Date(now.getTime() + timeframeDays[selectedTimeframe] * 24 * 60 * 60 * 1000)

    return data.filter((event) => {
      const startDate = new Date(event.startDate)
      if (startDate > cutoffDate) return false
      if (selectedType !== 'all' && event.type !== selectedType) return false
      return true
    })
  }, [data, selectedType, selectedTimeframe, timeframeDays])

  // Calculate timeline bounds
  const timelineBounds = useMemo(() => {
    if (filteredData.length === 0) {
      const now = new Date()
      const future = new Date(now.getTime() + timeframeDays[selectedTimeframe] * 24 * 60 * 60 * 1000)
      return { start: now, end: future }
    }

    const dates = filteredData.flatMap((e) => [new Date(e.startDate), new Date(e.endDate)])
    const start = new Date(Math.min(...dates.map((d) => d.getTime())))
    const end = new Date(Math.max(...dates.map((d) => d.getTime())))
    return { start, end }
  }, [filteredData, selectedTimeframe, timeframeDays])

  // Build timeline data points
  const timelineData = useMemo(() => {
    const points: Array<{ date: Date; count: number; events: CredentialEvent[] }> = []
    const dateMap = new Map<string, { count: number; events: CredentialEvent[] }>()

    filteredData.forEach((event) => {
      const start = new Date(event.startDate)
      const end = new Date(event.endDate)
      const peak = new Date(event.peakDate)

      // Add points for start, peak, and end
      ;[start, peak, end].forEach((date) => {
        const key = date.toISOString().split('T')[0]
        if (!dateMap.has(key)) {
          dateMap.set(key, { count: 0, events: [] })
        }
        const entry = dateMap.get(key)!
        if (!entry.events.find((e) => e.id === event.id)) {
          entry.count += event.clinicianCount
          entry.events.push(event)
        }
      })
    })

    dateMap.forEach((value, key) => {
      points.push({ date: new Date(key), count: value.count, events: value.events })
    })

    return points.sort((a, b) => a.date.getTime() - b.date.getTime())
  }, [filteredData])

  // Calculate max count for scaling
  const maxCount = useMemo(() => {
    if (timelineData.length === 0) return 1
    return Math.max(...timelineData.map((p) => p.count), 1)
  }, [timelineData])

  // Build chart path
  const chartPath = useMemo(() => {
    if (timelineData.length === 0) return ''
    const width = SVG_WIDTH - SVG_PADDING * 2
    const timeRange = timelineBounds.end.getTime() - timelineBounds.start.getTime() || 1

    return timelineData
      .map((point, index) => {
        const x = SVG_PADDING + (width * (point.date.getTime() - timelineBounds.start.getTime())) / timeRange
        const y = SVG_PADDING + CHART_HEIGHT * (1 - point.count / maxCount)
        return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
      })
      .join(' ')
  }, [timelineData, timelineBounds, maxCount])

  // Identify bottlenecks (peaks with high counts)
  const bottlenecks = useMemo(() => {
    return timelineData
      .filter((p) => p.count >= maxCount * 0.7)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }, [timelineData, maxCount])

  const totalAffected = filteredData.reduce((sum, e) => sum + e.clinicianCount, 0)
  const criticalCount = filteredData.filter((e) => e.severity === 'critical').length

  return (
    <Card className={cn('h-full', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-amber-600" aria-hidden="true" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mt-4">
          <div className="flex gap-2">
            {(['30d', '60d', '90d', '180d'] as const).map((tf) => (
              <Button
                key={tf}
                variant={selectedTimeframe === tf ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedTimeframe(tf)}
                className="text-xs"
              >
                {tf}
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button
              variant={selectedType === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedType('all')}
              className="text-xs"
            >
              All Types
            </Button>
            {(Object.keys(TYPE_LABELS) as CredentialEvent['type'][]).map((type) => {
              const count = filteredData.filter((e) => e.type === type).length
              return (
                <Button
                  key={type}
                  variant={selectedType === type ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedType(type)}
                  className="text-xs"
                >
                  {TYPE_LABELS[type]} {count > 0 && `(${count})`}
                </Button>
              )
            })}
          </div>
        </div>

        {/* Summary stats */}
        <div className="flex flex-wrap gap-4 text-sm mt-2">
          <div>
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Total Events</span>
            <p className="font-semibold text-lg">{filteredData.length}</p>
          </div>
          <div>
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Affected Clinicians</span>
            <p className="font-semibold text-lg">{totalAffected}</p>
          </div>
          <div>
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Critical Bottlenecks</span>
            <p className="font-semibold text-lg text-rose-600">{bottlenecks.length}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredData.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">No credential events in the selected timeframe.</div>
        ) : (
          <div className="space-y-6">
            {/* Timeline Chart */}
            <div className="overflow-x-auto">
              <svg width={SVG_WIDTH} height={SVG_HEIGHT} className="w-full" viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}>
                {/* Grid lines */}
                {[0, 25, 50, 75, 100].map((percent) => {
                  const y = SVG_PADDING + (CHART_HEIGHT * (100 - percent)) / 100
                  return (
                    <line
                      key={percent}
                      x1={SVG_PADDING}
                      x2={SVG_WIDTH - SVG_PADDING}
                      y1={y}
                      y2={y}
                      stroke="hsl(var(--border))"
                      strokeDasharray="2 4"
                      strokeWidth="1"
                      opacity={0.3}
                      aria-hidden="true"
                    />
                  )
                })}

                {/* Burden curve */}
                <path
                  d={chartPath}
                  fill="none"
                  stroke="hsl(0, 84%, 60%)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Fill area under curve */}
                <path
                  d={`${chartPath} L ${SVG_WIDTH - SVG_PADDING} ${SVG_PADDING + CHART_HEIGHT} L ${SVG_PADDING} ${SVG_PADDING + CHART_HEIGHT} Z`}
                  fill="hsl(0, 84%, 60%)"
                  opacity={0.1}
                />

                {/* Event markers */}
                {filteredData.map((event) => {
                  const peakDate = new Date(event.peakDate)
                  const timeRange = timelineBounds.end.getTime() - timelineBounds.start.getTime() || 1
                  const x = SVG_PADDING + ((SVG_WIDTH - SVG_PADDING * 2) * (peakDate.getTime() - timelineBounds.start.getTime())) / timeRange
                  const peakPoint = timelineData.find((p) => p.date.toISOString().split('T')[0] === peakDate.toISOString().split('T')[0])
                  const y = peakPoint
                    ? SVG_PADDING + CHART_HEIGHT * (1 - peakPoint.count / maxCount)
                    : SVG_PADDING + CHART_HEIGHT

                  return (
                    <g key={event.id}>
                      <circle
                        cx={x}
                        cy={y}
                        r="6"
                        fill={TYPE_COLORS[event.type]}
                        className="cursor-pointer hover:r-8 transition-all"
                        onClick={() => onEventClick?.(event)}
                      />
                      {event.severity === 'critical' && (
                        <circle cx={x} cy={y} r="10" fill="none" stroke="hsl(0, 84%, 60%)" strokeWidth="2" opacity={0.5} />
                      )}
                    </g>
                  )
                })}

                {/* Labels */}
                <text x={SVG_PADDING} y={SVG_PADDING - 10} className="text-xs fill-muted-foreground">
                  Clinicians Affected
                </text>
                <text x={SVG_WIDTH - SVG_PADDING} y={SVG_PADDING + CHART_HEIGHT + 20} textAnchor="end" className="text-xs fill-muted-foreground">
                  Date
                </text>
              </svg>
            </div>

            {/* Event Timeline */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Credential Events Timeline</h3>
              <div className="space-y-2">
                {filteredData.map((event) => {
                  const TypeIcon = TYPE_ICONS[event.type]
                  return (
                    <div
                      key={event.id}
                      className={cn(
                        'p-3 border rounded-lg cursor-pointer transition-all hover:shadow-md',
                        event.severity === 'critical' && 'border-rose-200 bg-rose-50/50',
                        event.severity === 'high' && 'border-amber-200 bg-amber-50/50',
                      )}
                      onClick={() => onEventClick?.(event)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn('p-2 rounded', TYPE_COLORS[event.type], 'bg-opacity-20')}>
                            <TypeIcon className={cn('h-4 w-4', TYPE_COLORS[event.type].replace('bg-', 'text-'))} />
                          </div>
                          <div>
                            <p className="font-semibold">{event.credentialName}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(event.startDate)} - {formatDate(event.endDate)}
                              {event.department && ` • ${event.department}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className={cn('text-xs', SEVERITY_COLORS[event.severity])}>
                            {event.severity}
                          </Badge>
                          <span className="font-semibold text-sm">{event.clinicianCount} clinicians</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Bottleneck Alerts */}
            {bottlenecks.length > 0 && (
              <div className="space-y-2 p-4 border-amber-200 bg-amber-50/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <h3 className="font-semibold text-sm">Identified Bottlenecks</h3>
                </div>
                <div className="space-y-1 text-sm">
                  {bottlenecks.map((bottleneck, idx) => (
                    <p key={idx} className="text-muted-foreground">
                      • {formatDate(bottleneck.date.toISOString())}: {bottleneck.count} clinicians affected
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 text-xs pt-4 border-t">
              <span className="font-semibold text-muted-foreground">Event Types:</span>
              {Object.entries(TYPE_LABELS).map(([type, label]) => (
                <div key={type} className="flex items-center gap-2">
                  <div className={cn('h-3 w-3 rounded', TYPE_COLORS[type as CredentialEvent['type']])} />
                  <span className="text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function formatDate(input: string) {
  const date = new Date(input)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
