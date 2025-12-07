'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle,
  Clock,
  FileText,
  Plus,
  User,
  Users,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

type Incident = {
  id: string
  ruleId: string
  ruleName: string
  severity: 'critical' | 'warning' | 'info'
  status: 'open' | 'resolved' | 'acknowledged'
  title: string
  description: string
  startTime: string
  endTime?: string
  duration?: number
  service?: string
  assignedTo?: string
  teamMembers?: string[]
  notes: Array<{ id: string; author: string; timestamp: string; content: string }>
  metrics?: Array<{ name: string; value: number; change: number }>
}

type IncidentEvent = {
  id: string
  incidentId: string
  type: 'created' | 'acknowledged' | 'resolved' | 'note_added' | 'assigned'
  timestamp: string
  actor: string
  description: string
}

export default function IncidentManagementPage() {
  const [loading, setLoading] = useState(true)
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null)
  const [events, setEvents] = useState<IncidentEvent[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [severityFilter, setSeverityFilter] = useState<string>('all')

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      await new Promise((resolve) => setTimeout(resolve, 1000))

      const mockIncidents: Incident[] = [
        {
          id: 'inc-1',
          ruleId: 'rule-1',
          ruleName: 'High Error Rate',
          severity: 'critical',
          status: 'open',
          title: 'Error rate exceeded 5% threshold',
          description: 'The API service has been experiencing elevated error rates for the past 30 minutes.',
          startTime: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          service: 'api',
          assignedTo: 'john.doe@example.com',
          teamMembers: ['jane.smith@example.com', 'bob.jones@example.com'],
          notes: [
            {
              id: 'note-1',
              author: 'john.doe@example.com',
              timestamp: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
              content: 'Investigating root cause. Checking recent deployments.',
            },
            {
              id: 'note-2',
              author: 'jane.smith@example.com',
              timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
              content: 'Found issue in credential verification endpoint. Working on fix.',
            },
          ],
          metrics: [
            { name: 'Error Rate', value: 5.8, change: 3.2 },
            { name: 'Latency P95', value: 450, change: 120 },
            { name: 'Request Rate', value: 1200, change: -50 },
          ],
        },
        {
          id: 'inc-2',
          ruleId: 'rule-2',
          ruleName: 'High Latency',
          severity: 'warning',
          status: 'acknowledged',
          title: 'P95 latency exceeded 500ms',
          description: 'Response times have increased above normal thresholds.',
          startTime: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
          service: 'verifier-api',
          assignedTo: 'alice.brown@example.com',
          teamMembers: ['alice.brown@example.com'],
          notes: [
            {
              id: 'note-3',
              author: 'alice.brown@example.com',
              timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
              content: 'Acknowledged. Investigating database query performance.',
            },
          ],
          metrics: [
            { name: 'Latency P95', value: 520, change: 80 },
            { name: 'Latency P99', value: 850, change: 150 },
          ],
        },
        {
          id: 'inc-3',
          ruleId: 'rule-3',
          ruleName: 'Service Down',
          severity: 'critical',
          status: 'resolved',
          title: 'Service temporarily unavailable',
          description: 'The authz service was down for 5 minutes due to deployment issue.',
          startTime: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() - 3 * 55 * 60 * 1000).toISOString(),
          duration: 5 * 60 * 1000,
          service: 'authz',
          notes: [
            {
              id: 'note-4',
              author: 'bob.jones@example.com',
              timestamp: new Date(Date.now() - 3 * 50 * 60 * 1000).toISOString(),
              content: 'Issue resolved. Rolled back problematic deployment.',
            },
          ],
          metrics: [
            { name: 'Uptime', value: 99.95, change: -0.05 },
          ],
        },
      ]

      setIncidents(mockIncidents)

      // Generate events
      const mockEvents: IncidentEvent[] = []
      mockIncidents.forEach((incident) => {
        mockEvents.push({
          id: `evt-${incident.id}-created`,
          incidentId: incident.id,
          type: 'created',
          timestamp: incident.startTime,
          actor: 'system',
          description: `Incident created: ${incident.title}`,
        })

        if (incident.assignedTo) {
          mockEvents.push({
            id: `evt-${incident.id}-assigned`,
            incidentId: incident.id,
            type: 'assigned',
            timestamp: incident.startTime,
            actor: 'system',
            description: `Assigned to ${incident.assignedTo}`,
          })
        }

        if (incident.status === 'acknowledged') {
          mockEvents.push({
            id: `evt-${incident.id}-acknowledged`,
            incidentId: incident.id,
            type: 'acknowledged',
            timestamp: incident.startTime,
            actor: incident.assignedTo || 'unknown',
            description: 'Incident acknowledged',
          })
        }

        incident.notes.forEach((note) => {
          mockEvents.push({
            id: `evt-${incident.id}-note-${note.id}`,
            incidentId: incident.id,
            type: 'note_added',
            timestamp: note.timestamp,
            actor: note.author,
            description: note.content,
          })
        })

        if (incident.endTime) {
          mockEvents.push({
            id: `evt-${incident.id}-resolved`,
            incidentId: incident.id,
            type: 'resolved',
            timestamp: incident.endTime,
            actor: incident.assignedTo || 'unknown',
            description: 'Incident resolved',
          })
        }
      })

      setEvents(mockEvents)
      setLoading(false)
    }

    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [])

  const updateIncidentStatus = (incidentId: string, status: Incident['status']) => {
    setIncidents((prev) =>
      prev.map((inc) => (inc.id === incidentId ? { ...inc, status } : inc))
    )
  }

  const addNote = (incidentId: string, content: string) => {
    const note = {
      id: `note-${Date.now()}`,
      author: 'current.user@example.com',
      timestamp: new Date().toISOString(),
      content,
    }

    setIncidents((prev) =>
      prev.map((inc) =>
        inc.id === incidentId
          ? {
              ...inc,
              notes: [...inc.notes, note],
            }
          : inc
      )
    )
  }

  const filteredIncidents = incidents.filter((inc) => {
    if (statusFilter !== 'all' && inc.status !== statusFilter) return false
    if (severityFilter !== 'all' && inc.severity !== severityFilter) return false
    return true
  })

  const incidentEvents = selectedIncident
    ? events.filter((evt) => evt.incidentId === selectedIncident.id).sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      )
    : []

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000)
    const hours = Math.floor(minutes / 60)
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`
    }
    return `${minutes}m`
  }

  return (
    <div className="container mx-auto space-y-6 py-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Incident Management</h1>
        <p className="text-muted-foreground">Track and manage incidents from alerts</p>
      </header>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="acknowledged">Acknowledged</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="severity">Severity</Label>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger id="severity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Incidents List */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>
              Incidents ({filteredIncidents.length})
            </CardTitle>
            <CardDescription>Open and resolved incidents</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : filteredIncidents.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No incidents found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredIncidents.map((incident) => (
                  <div
                    key={incident.id}
                    className={cn(
                      'p-4 rounded-lg border cursor-pointer transition-colors',
                      selectedIncident?.id === incident.id
                        ? 'bg-primary/5 border-primary'
                        : 'hover:bg-muted/50'
                    )}
                    onClick={() => setSelectedIncident(incident)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge
                            variant={
                              incident.severity === 'critical'
                                ? 'destructive'
                                : incident.severity === 'warning'
                                  ? 'default'
                                  : 'secondary'
                            }
                          >
                            {incident.severity}
                          </Badge>
                          <Badge
                            variant={
                              incident.status === 'open'
                                ? 'default'
                                : incident.status === 'resolved'
                                  ? 'secondary'
                                  : 'outline'
                            }
                          >
                            {incident.status}
                          </Badge>
                          {incident.service && (
                            <Badge variant="outline">{incident.service}</Badge>
                          )}
                        </div>
                        <h3 className="font-semibold mb-1">{incident.title}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {incident.description}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <time dateTime={incident.startTime}>
                              {new Date(incident.startTime).toLocaleString()}
                            </time>
                          </div>
                          {incident.duration && (
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Duration: {formatDuration(incident.duration)}
                            </div>
                          )}
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Incident Details */}
        <Card>
          <CardHeader>
            <CardTitle>Incident Details</CardTitle>
            <CardDescription>
              {selectedIncident ? 'View and manage incident' : 'Select an incident to view details'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedIncident ? (
              <IncidentDetails
                incident={selectedIncident}
                events={incidentEvents}
                onStatusChange={(status) => updateIncidentStatus(selectedIncident.id, status)}
                onAddNote={(content) => addNote(selectedIncident.id, content)}
              />
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select an incident to view details</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function IncidentDetails({
  incident,
  events,
  onStatusChange,
  onAddNote,
}: {
  incident: Incident
  events: IncidentEvent[]
  onStatusChange: (status: Incident['status']) => void
  onAddNote: (content: string) => void
}) {
  const [noteContent, setNoteContent] = useState('')

  const handleAddNote = () => {
    if (!noteContent.trim()) return
    onAddNote(noteContent)
    setNoteContent('')
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Badge
            variant={
              incident.severity === 'critical'
                ? 'destructive'
                : incident.severity === 'warning'
                  ? 'default'
                  : 'secondary'
            }
          >
            {incident.severity}
          </Badge>
          <Badge
            variant={
              incident.status === 'open'
                ? 'default'
                : incident.status === 'resolved'
                  ? 'secondary'
                  : 'outline'
            }
          >
            {incident.status}
          </Badge>
        </div>
        <h3 className="font-semibold text-lg mb-2">{incident.title}</h3>
        <p className="text-sm text-muted-foreground mb-4">{incident.description}</p>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>Started: {new Date(incident.startTime).toLocaleString()}</span>
          </div>
          {incident.endTime && (
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
              <span>Resolved: {new Date(incident.endTime).toLocaleString()}</span>
            </div>
          )}
          {incident.assignedTo && (
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>Assigned to: {incident.assignedTo}</span>
            </div>
          )}
          {incident.teamMembers && incident.teamMembers.length > 0 && (
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span>Team: {incident.teamMembers.join(', ')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Status Actions */}
      {incident.status !== 'resolved' && (
        <div className="space-y-2">
          <Label>Update Status</Label>
          <div className="flex gap-2">
            {incident.status === 'open' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onStatusChange('acknowledged')}
              >
                Acknowledge
              </Button>
            )}
            <Button
              variant="default"
              size="sm"
              onClick={() => onStatusChange('resolved')}
            >
              Resolve
            </Button>
          </div>
        </div>
      )}

      {/* Metrics */}
      {incident.metrics && incident.metrics.length > 0 && (
        <div>
          <Label className="mb-2">Related Metrics</Label>
          <div className="space-y-2">
            {incident.metrics.map((metric, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 rounded bg-muted/50">
                <span className="text-sm font-medium">{metric.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm">{metric.value}</span>
                  <Badge variant={metric.change > 0 ? 'destructive' : 'default'}>
                    {metric.change > 0 ? '+' : ''}
                    {metric.change}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div>
        <Label className="mb-2">Timeline</Label>
        <div className="space-y-3">
          {events.map((event) => (
            <div key={event.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="h-2 w-2 rounded-full bg-primary" />
                <div className="h-full w-0.5 bg-border mt-1" />
              </div>
              <div className="flex-1 min-w-0 pb-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">{event.actor}</span>
                  <Badge variant="outline" className="text-xs">
                    {event.type}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-1">{event.description}</p>
                <time className="text-xs text-muted-foreground">
                  {new Date(event.timestamp).toLocaleString()}
                </time>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <Label className="mb-2">Notes</Label>
        <div className="space-y-3 mb-4">
          {incident.notes.map((note) => (
            <div key={note.id} className="p-3 rounded bg-muted/50">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">{note.author}</span>
                <time className="text-xs text-muted-foreground">
                  {new Date(note.timestamp).toLocaleString()}
                </time>
              </div>
              <p className="text-sm">{note.content}</p>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <Textarea
            placeholder="Add a note..."
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            rows={3}
          />
          <Button onClick={handleAddNote} size="sm" disabled={!noteContent.trim()}>
            Add Note
          </Button>
        </div>
      </div>
    </div>
  )
}

