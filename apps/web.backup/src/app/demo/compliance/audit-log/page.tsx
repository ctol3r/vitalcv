'use client'

import React, { useMemo, useState } from 'react'
import {
  Search,
  Filter,
  Download,
  FileText,
  Calendar,
  User,
  ShieldAlert,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

type AuditEvent = {
  id: string
  timestamp: string
  entity: string
  entityType: 'user' | 'organization' | 'system'
  actor: string
  action: string
  obligation?: string
  status: 'SUCCESS' | 'FAILURE' | 'WARNING'
  details: string
  ipAddress?: string
  userAgent?: string
}

export default function AuditLogViewerPage() {
  const [search, setSearch] = useState('')
  const [entityFilter, setEntityFilter] = useState('all')
  const [actorFilter, setActorFilter] = useState('all')
  const [obligationFilter, setObligationFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | AuditEvent['status']>('all')
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [srMessage, setSrMessage] = useState('')

  const events = useMemo(() => buildMockAuditEvents(), [])

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const matchesSearch =
        !search ||
        event.entity.toLowerCase().includes(search.toLowerCase()) ||
        event.actor.toLowerCase().includes(search.toLowerCase()) ||
        event.action.toLowerCase().includes(search.toLowerCase()) ||
        event.details.toLowerCase().includes(search.toLowerCase())
      const matchesEntity = entityFilter === 'all' || event.entity === entityFilter
      const matchesActor = actorFilter === 'all' || event.actor === actorFilter
      const matchesObligation = obligationFilter === 'all' || event.obligation === obligationFilter
      const matchesStatus = statusFilter === 'all' || event.status === statusFilter
      const matchesDateFrom = !dateFrom || new Date(event.timestamp) >= new Date(dateFrom)
      const matchesDateTo = !dateTo || new Date(event.timestamp) <= new Date(dateTo)

      return (
        matchesSearch &&
        matchesEntity &&
        matchesActor &&
        matchesObligation &&
        matchesStatus &&
        matchesDateFrom &&
        matchesDateTo
      )
    })
  }, [events, search, entityFilter, actorFilter, obligationFilter, statusFilter, dateFrom, dateTo])

  const entities = useMemo(() => {
    return ['all', ...new Set(events.map((e) => e.entity))]
  }, [events])

  const actors = useMemo(() => {
    return ['all', ...new Set(events.map((e) => e.actor))]
  }, [events])

  const obligations = useMemo(() => {
    return ['all', ...new Set(events.map((e) => e.obligation).filter(Boolean) as string[])]
  }, [events])

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleExport = async (format: 'csv' | 'json') => {
    setSrMessage(`Exporting ${filteredEvents.length} audit events as ${format.toUpperCase()}...`)
    // In a real app, this would trigger a download
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setSrMessage(`${format.toUpperCase()} export complete`)
    setTimeout(() => setSrMessage(''), 3000)
  }

  return (
    <div className="container mx-auto space-y-8 py-8">
      <header className="space-y-4">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Demo • Compliance • Audit Log</p>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <FileText className="h-8 w-8 text-primary" aria-hidden="true" />
              Audit Log Viewer
            </h1>
            <p className="text-muted-foreground max-w-2xl">
              Search and filter audit events by entity, actor, date, and obligation. Export results for compliance reporting.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleExport('csv')}>
              <Download className="h-4 w-4 mr-2" aria-hidden="true" />
              Export CSV
            </Button>
            <Button variant="outline" onClick={() => handleExport('json')}>
              <Download className="h-4 w-4 mr-2" aria-hidden="true" />
              Export JSON
            </Button>
          </div>
        </div>
      </header>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-primary" aria-hidden="true" />
            Filters
          </CardTitle>
          <CardDescription>Refine your audit log search</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search events..."
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Entity</label>
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={entityFilter}
                onChange={(e) => setEntityFilter(e.target.value)}
              >
                {entities.map((entity) => (
                  <option key={entity} value={entity}>
                    {entity === 'all' ? 'All entities' : entity}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Actor</label>
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={actorFilter}
                onChange={(e) => setActorFilter(e.target.value)}
              >
                {actors.map((actor) => (
                  <option key={actor} value={actor}>
                    {actor === 'all' ? 'All actors' : actor}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Obligation</label>
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={obligationFilter}
                onChange={(e) => setObligationFilter(e.target.value)}
              >
                {obligations.map((obligation) => (
                  <option key={obligation} value={obligation}>
                    {obligation === 'all' ? 'All obligations' : obligation}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              >
                <option value="all">All statuses</option>
                <option value="SUCCESS">Success</option>
                <option value="FAILURE">Failure</option>
                <option value="WARNING">Warning</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Date From</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Date To</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full"
              />
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setSearch('')
                setEntityFilter('all')
                setActorFilter('all')
                setObligationFilter('all')
                setStatusFilter('all')
                setDateFrom('')
                setDateTo('')
              }}
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results Summary */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {filteredEvents.length} of {events.length} audit events
        </p>
      </div>

      {/* Audit Events Table */}
      <Card>
        <CardHeader>
          <CardTitle>Audit Events</CardTitle>
          <CardDescription>Click on any row to view detailed information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Obligation</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEvents.map((event) => {
                  const isExpanded = expandedRows.has(event.id)

                  return (
                    <React.Fragment key={event.id}>
                      <TableRow
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleRow(event.id)}
                      >
                        <TableCell>
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" aria-hidden="true" />
                          ) : (
                            <ChevronDown className="h-4 w-4" aria-hidden="true" />
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                            <span className="text-sm">{new Date(event.timestamp).toLocaleString()}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{event.entity}</span>
                            <Badge variant="outline" className="text-xs">
                              {event.entityType}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                            <span>{event.actor}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{event.action}</TableCell>
                        <TableCell>
                          {event.obligation ? (
                            <Link
                              href={`/demo/compliance/obligations/${event.obligation}`}
                              className="text-primary hover:underline flex items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {event.obligation} <ExternalLink className="h-3 w-3" aria-hidden="true" />
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              event.status === 'SUCCESS' && 'border-emerald-300 text-emerald-900',
                              event.status === 'FAILURE' && 'border-rose-300 text-rose-900',
                              event.status === 'WARNING' && 'border-amber-300 text-amber-900',
                            )}
                          >
                            {event.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={7} className="bg-muted/30">
                            <div className="p-4 space-y-3">
                              <div>
                                <h4 className="font-medium mb-2">Event Details</h4>
                                <p className="text-sm text-muted-foreground">{event.details}</p>
                              </div>
                              <div className="grid gap-4 md:grid-cols-2 text-sm">
                                {event.ipAddress && (
                                  <div>
                                    <span className="font-medium">IP Address:</span> {event.ipAddress}
                                  </div>
                                )}
                                {event.userAgent && (
                                  <div>
                                    <span className="font-medium">User Agent:</span>{' '}
                                    <span className="text-muted-foreground">{event.userAgent}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  )
                })}
              </TableBody>
            </Table>
            {filteredEvents.length === 0 && (
              <div className="text-center py-12">
                <ShieldAlert className="h-12 w-12 text-muted-foreground mx-auto mb-4" aria-hidden="true" />
                <p className="text-muted-foreground">No audit events match your filters.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <span className="sr-only" aria-live="polite">
        {srMessage}
      </span>
    </div>
  )
}

function buildMockAuditEvents(): AuditEvent[] {
  return [
    {
      id: 'audit-001',
      timestamp: '2025-11-15T10:30:00Z',
      entity: 'user-123',
      entityType: 'user',
      actor: 'admin@example.com',
      action: 'Data Access Request',
      obligation: 'GDPR-001',
      status: 'SUCCESS',
      details: 'User requested access to their personal data. Request processed successfully.',
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0...',
    },
    {
      id: 'audit-002',
      timestamp: '2025-11-15T09:15:00Z',
      entity: 'org-456',
      entityType: 'organization',
      actor: 'compliance-officer@example.com',
      action: 'Compliance Assessment',
      obligation: 'HIPAA-001',
      status: 'WARNING',
      details: 'HIPAA risk assessment identified 3 areas requiring attention.',
      ipAddress: '192.168.1.101',
    },
    {
      id: 'audit-003',
      timestamp: '2025-11-14T14:20:00Z',
      entity: 'system',
      entityType: 'system',
      actor: 'system',
      action: 'Automated Compliance Check',
      obligation: 'SOC2-001',
      status: 'SUCCESS',
      details: 'Automated SOC 2 compliance check completed. All controls passed.',
    },
    {
      id: 'audit-004',
      timestamp: '2025-11-14T11:45:00Z',
      entity: 'user-789',
      entityType: 'user',
      actor: 'user-789',
      action: 'Data Deletion Request',
      obligation: 'CCPA-001',
      status: 'FAILURE',
      details: 'Data deletion request failed due to active dependencies. Manual review required.',
      ipAddress: '192.168.1.102',
    },
    {
      id: 'audit-005',
      timestamp: '2025-11-13T16:00:00Z',
      entity: 'org-456',
      entityType: 'organization',
      actor: 'external-auditor@audit-firm.com',
      action: 'External Audit Access',
      obligation: 'GDPR-001',
      status: 'SUCCESS',
      details: 'External auditor accessed audit log segment for GDPR compliance review.',
      ipAddress: '203.0.113.50',
    },
  ]
}

