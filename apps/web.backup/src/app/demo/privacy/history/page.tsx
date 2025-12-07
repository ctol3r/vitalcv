'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { History, Download, Filter, Calendar, ExternalLink, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type EventType = 'export' | 'import' | 'external-access' | 'share' | 'revoke'
type DateFilter = 'all' | 'today' | 'week' | 'month' | 'year' | 'custom'

interface SharingEvent {
  id: string
  type: EventType
  description: string
  recipient?: string
  scope: string
  date: string
  status: 'completed' | 'failed' | 'pending'
  downloadUrl?: string
  canRevoke: boolean
}

export default function DataSharingHistoryPage() {
  const searchParams = useSearchParams()
  const initialType = searchParams.get('type') as EventType | null

  const [events, setEvents] = useState<SharingEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<EventType | 'all'>(
    initialType && ['export', 'import', 'external-access', 'share', 'revoke'].includes(initialType)
      ? initialType
      : 'all'
  )
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')

  useEffect(() => {
    loadHistory()
  }, [typeFilter, dateFilter, customStartDate, customEndDate])

  async function loadHistory() {
    try {
      const params = new URLSearchParams()
      if (typeFilter !== 'all') params.set('type', typeFilter)
      if (dateFilter !== 'all') params.set('date', dateFilter)
      if (dateFilter === 'custom' && customStartDate) params.set('start', customStartDate)
      if (dateFilter === 'custom' && customEndDate) params.set('end', customEndDate)

      const res = await fetch(`/api/demo/privacy/history?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setEvents(data.events || mockSharingEvents())
      } else {
        setEvents(mockSharingEvents())
      }
    } catch (err) {
      setEvents(mockSharingEvents())
    } finally {
      setLoading(false)
    }
  }

  async function handleRevoke(event: SharingEvent) {
    try {
      const res = await fetch(`/api/demo/privacy/history/${event.id}/revoke`, {
        method: 'POST',
      })

      if (res.ok) {
        setEvents((prev) =>
          prev.map((e) => (e.id === event.id ? { ...e, canRevoke: false, status: 'completed' } : e))
        )
      }
    } catch (err) {
      console.error('Failed to revoke share', err)
    }
  }

  function getEventTypeLabel(type: EventType): string {
    const labels: Record<EventType, string> = {
      export: 'Export',
      import: 'Import',
      'external-access': 'External Access',
      share: 'Share',
      revoke: 'Revoke',
    }
    return labels[type]
  }

  function getEventTypeColor(type: EventType): 'default' | 'secondary' | 'destructive' | 'outline' {
    const colors: Record<EventType, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      export: 'default',
      import: 'secondary',
      'external-access': 'outline',
      share: 'default',
      revoke: 'destructive',
    }
    return colors[type]
  }

  const filteredEvents = events.filter((event) => {
    if (typeFilter !== 'all' && event.type !== typeFilter) return false

    if (dateFilter === 'all') return true
    if (dateFilter === 'custom') {
      if (customStartDate && new Date(event.date) < new Date(customStartDate)) return false
      if (customEndDate && new Date(event.date) > new Date(customEndDate)) return false
      return true
    }

    const eventDate = new Date(event.date)
    const now = new Date()
    const diffMs = now.getTime() - eventDate.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    switch (dateFilter) {
      case 'today':
        return diffDays === 0
      case 'week':
        return diffDays <= 7
      case 'month':
        return diffDays <= 30
      case 'year':
        return diffDays <= 365
      default:
        return true
    }
  })

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading history...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <History className="h-8 w-8 text-primary" />
            Data Sharing History
          </h1>
          <p className="text-gray-600 mt-1">
            Timeline of data sharing events, exports, imports, and external access
          </p>
        </div>
        <Button variant="outline" asChild>
          <a href="/demo/privacy/dashboard">
            <ExternalLink className="w-4 h-4 mr-2" />
            Back to Dashboard
          </a>
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Event Type</Label>
              <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as EventType | 'all')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="export">Exports</SelectItem>
                  <SelectItem value="import">Imports</SelectItem>
                  <SelectItem value="external-access">External Access</SelectItem>
                  <SelectItem value="share">Shares</SelectItem>
                  <SelectItem value="revoke">Revocations</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date Range</Label>
              <Select value={dateFilter} onValueChange={(value) => setDateFilter(value as DateFilter)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">Last 7 Days</SelectItem>
                  <SelectItem value="month">Last 30 Days</SelectItem>
                  <SelectItem value="year">Last Year</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {dateFilter === 'custom' && (
              <div className="space-y-2">
                <Label>Custom Date Range</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    placeholder="Start date"
                  />
                  <span>to</span>
                  <Input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    placeholder="End date"
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Events Table */}
      <Card>
        <CardHeader>
          <CardTitle>Sharing Events</CardTitle>
          <CardDescription>
            {filteredEvents.length} event(s) found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredEvents.length === 0 ? (
            <div className="text-center py-12">
              <History className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No events found matching your filters</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Recipient/Scope</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEvents.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">
                            {new Date(event.date).toLocaleDateString()}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(event.date).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getEventTypeColor(event.type)}>
                        {getEventTypeLabel(event.type)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{event.description}</div>
                      <div className="text-sm text-muted-foreground">{event.scope}</div>
                    </TableCell>
                    <TableCell>
                      {event.recipient ? (
                        <div className="font-medium">{event.recipient}</div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          event.status === 'completed'
                            ? 'default'
                            : event.status === 'pending'
                              ? 'secondary'
                              : 'destructive'
                        }
                      >
                        {event.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {event.downloadUrl && (
                          <Button variant="ghost" size="sm" asChild>
                            <a href={event.downloadUrl} download>
                              <Download className="w-4 h-4" />
                            </a>
                          </Button>
                        )}
                        {event.canRevoke && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRevoke(event)}
                          >
                            <X className="w-4 h-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => {
              setTypeFilter('all')
              setDateFilter('all')
              setCustomStartDate('')
              setCustomEndDate('')
            }}>
              Clear Filters
            </Button>
            <Button variant="outline" asChild>
              <a href="/demo/privacy/history?type=export">View Exports Only</a>
            </Button>
            <Button variant="outline" asChild>
              <a href="/demo/privacy/history?type=share">View Active Shares</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function mockSharingEvents(): SharingEvent[] {
  return [
    {
      id: 'event-1',
      type: 'export',
      description: 'Data export requested',
      scope: 'All data (JSON format)',
      date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'completed',
      downloadUrl: '/api/demo/privacy/download/exp-1',
      canRevoke: false,
    },
    {
      id: 'event-2',
      type: 'share',
      description: 'Shared credentials with Healthcare Organization A',
      recipient: 'Healthcare Organization A',
      scope: 'Credentials only',
      date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'completed',
      canRevoke: true,
    },
    {
      id: 'event-3',
      type: 'external-access',
      description: 'Third-party app accessed data',
      recipient: 'Healthcare Analytics Dashboard',
      scope: 'read:credentials, read:logs',
      date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'completed',
      canRevoke: false,
    },
    {
      id: 'event-4',
      type: 'import',
      description: 'Data imported from external vault',
      scope: '23 records imported',
      date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'completed',
      canRevoke: false,
    },
    {
      id: 'event-5',
      type: 'revoke',
      description: 'Revoked access for Marketing Company D',
      recipient: 'Marketing Company D',
      scope: 'All permissions',
      date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'completed',
      canRevoke: false,
    },
  ]
}

