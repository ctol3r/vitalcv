'use client'

import { useMemo, useState, useEffect } from 'react'
import { Activity, Filter, AlertCircle, Info, CheckCircle2, Clock, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type EventSource = 'TEFCA' | 'LICENSING_BOARD' | 'BLOCKCHAIN' | 'FHIR'

type EventSeverity = 'info' | 'warning' | 'error' | 'success'

type ExternalEvent = {
  id: string
  timestamp: string
  source: EventSource
  severity: EventSeverity
  type: string
  description: string
  payload?: Record<string, unknown>
}

type ExternalEventViewerProps = {
  autoRefresh?: boolean
  refreshInterval?: number // in milliseconds
}

export function ExternalEventViewer({ autoRefresh = true, refreshInterval = 5000 }: ExternalEventViewerProps) {
  const [events, setEvents] = useState<ExternalEvent[]>(buildMockEvents())
  const [filteredEvents, setFilteredEvents] = useState<ExternalEvent[]>(events)
  const [sourceFilter, setSourceFilter] = useState<EventSource | 'ALL'>('ALL')
  const [severityFilter, setSeverityFilter] = useState<EventSeverity | 'ALL'>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [isLive, setIsLive] = useState(autoRefresh)

  useEffect(() => {
    if (!isLive) return

    const interval = setInterval(() => {
      // Simulate new events arriving
      const newEvent = generateRandomEvent()
      setEvents((prev) => [newEvent, ...prev].slice(0, 100)) // Keep last 100 events
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [isLive, refreshInterval])

  useEffect(() => {
    let filtered = events

    if (sourceFilter !== 'ALL') {
      filtered = filtered.filter((e) => e.source === sourceFilter)
    }

    if (severityFilter !== 'ALL') {
      filtered = filtered.filter((e) => e.severity === severityFilter)
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (e) =>
          e.type.toLowerCase().includes(query) ||
          e.description.toLowerCase().includes(query) ||
          e.source.toLowerCase().includes(query),
      )
    }

    setFilteredEvents(filtered)
  }, [events, sourceFilter, severityFilter, searchQuery])

  const eventCounts = useMemo(() => {
    const counts = {
      total: events.length,
      info: events.filter((e) => e.severity === 'info').length,
      warning: events.filter((e) => e.severity === 'warning').length,
      error: events.filter((e) => e.severity === 'error').length,
      success: events.filter((e) => e.severity === 'success').length,
    }
    return counts
  }, [events])

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" aria-hidden="true" />
              External Event Feed
            </CardTitle>
            <CardDescription>Live feed of events ingested from external systems (FHIR updates, board notices, chain transactions).</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={isLive ? 'default' : 'secondary'} className="flex items-center gap-1">
              <div className={`h-2 w-2 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground'}`} />
              {isLive ? 'Live' : 'Paused'}
            </Badge>
            <Button size="sm" variant="outline" onClick={() => setIsLive(!isLive)}>
              {isLive ? 'Pause' : 'Resume'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid gap-2 md:grid-cols-5">
          <StatBadge label="Total" value={eventCounts.total} />
          <StatBadge label="Info" value={eventCounts.info} variant="info" />
          <StatBadge label="Success" value={eventCounts.success} variant="success" />
          <StatBadge label="Warning" value={eventCounts.warning} variant="warning" />
          <StatBadge label="Error" value={eventCounts.error} variant="error" />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Input
              placeholder="Search events..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
            <Filter className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </div>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as EventSource | 'ALL')}
            className="rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="ALL">All Sources</option>
            <option value="TEFCA">TEFCA</option>
            <option value="LICENSING_BOARD">Licensing Board</option>
            <option value="BLOCKCHAIN">Blockchain</option>
            <option value="FHIR">FHIR</option>
          </select>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as EventSeverity | 'ALL')}
            className="rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="ALL">All Severities</option>
            <option value="info">Info</option>
            <option value="success">Success</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
          </select>
        </div>

        {/* Event Table */}
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEvents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No events match the current filters
                  </TableCell>
                </TableRow>
              ) : (
                filteredEvents.slice(0, 50).map((event) => (
                  <TableRow key={event.id} className="hover:bg-muted/50">
                    <TableCell className="text-muted-foreground text-sm font-mono">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {event.timestamp}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {event.source.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{event.type}</TableCell>
                    <TableCell>
                      <SeverityBadge severity={event.severity} />
                    </TableCell>
                    <TableCell className="max-w-md text-sm">{event.description}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {filteredEvents.length > 50 && (
          <p className="text-sm text-muted-foreground text-center">
            Showing 50 of {filteredEvents.length} events. Use filters to narrow results.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function StatBadge({
  label,
  value,
  variant,
}: {
  label: string
  value: number
  variant?: 'info' | 'success' | 'warning' | 'error'
}) {
  const colorClass =
    variant === 'error'
      ? 'bg-rose-50 border-rose-200 text-rose-800'
      : variant === 'warning'
        ? 'bg-amber-50 border-amber-200 text-amber-800'
        : variant === 'success'
          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
          : variant === 'info'
            ? 'bg-blue-50 border-blue-200 text-blue-800'
            : 'bg-muted'

  return (
    <div className={`rounded-md border p-2 ${colorClass}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  )
}

function SeverityBadge({ severity }: { severity: EventSeverity }) {
  const config = {
    info: { label: 'Info', icon: Info, className: 'bg-blue-100 text-blue-800' },
    success: { label: 'Success', icon: CheckCircle2, className: 'bg-emerald-100 text-emerald-800' },
    warning: { label: 'Warning', icon: AlertCircle, className: 'bg-amber-100 text-amber-800' },
    error: { label: 'Error', icon: XCircle, className: 'bg-rose-100 text-rose-800' },
  }[severity]

  const Icon = config.icon

  return (
    <Badge variant="outline" className={`flex items-center gap-1 w-fit ${config.className}`}>
      {Icon && <Icon className="h-3 w-3" />}
      {config.label}
    </Badge>
  )
}

function buildMockEvents(): ExternalEvent[] {
  const now = new Date()
  const events: ExternalEvent[] = []

  const sources: EventSource[] = ['TEFCA', 'LICENSING_BOARD', 'BLOCKCHAIN', 'FHIR']
  const severities: EventSeverity[] = ['info', 'success', 'warning', 'error']
  const eventTypes = [
    'FHIR Bundle Received',
    'Credential Update',
    'License Verification',
    'Blockchain Transaction',
    'TEFCA Query',
    'Board Notice',
    'Chain Sync',
    'Data Mapping',
  ]

  for (let i = 0; i < 30; i++) {
    const minutesAgo = i * 2
    const timestamp = new Date(now.getTime() - minutesAgo * 60000)
    const source = sources[Math.floor(Math.random() * sources.length)]
    const severity = severities[Math.floor(Math.random() * severities.length)]
    const type = eventTypes[Math.floor(Math.random() * eventTypes.length)]

    events.push({
      id: `event-${i}`,
      timestamp: timestamp.toLocaleTimeString(),
      source,
      severity,
      type,
      description: `${type} from ${source} - ${severity === 'error' ? 'Failed to process' : severity === 'warning' ? 'Requires attention' : 'Processed successfully'}`,
    })
  }

  return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}

function generateRandomEvent(): ExternalEvent {
  const sources: EventSource[] = ['TEFCA', 'LICENSING_BOARD', 'BLOCKCHAIN', 'FHIR']
  const severities: EventSeverity[] = ['info', 'success', 'warning', 'error']
  const eventTypes = [
    'FHIR Bundle Received',
    'Credential Update',
    'License Verification',
    'Blockchain Transaction',
    'TEFCA Query',
    'Board Notice',
    'Chain Sync',
    'Data Mapping',
  ]

  const source = sources[Math.floor(Math.random() * sources.length)]
  const severity = severities[Math.floor(Math.random() * severities.length)]
  const type = eventTypes[Math.floor(Math.random() * eventTypes.length)]

  return {
    id: `event-${Date.now()}`,
    timestamp: new Date().toLocaleTimeString(),
    source,
    severity,
    type,
    description: `${type} from ${source} - ${severity === 'error' ? 'Failed to process' : severity === 'warning' ? 'Requires attention' : 'Processed successfully'}`,
  }
}

