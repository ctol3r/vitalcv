'use client'

import { useEffect, useState } from 'react'
import { Activity, AlertTriangle, CheckCircle, Clock, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface SelfHealingEvent {
  id: string
  type: 'drift_detection' | 'reconciliation' | 'auto_recovery' | 'policy_adjustment'
  timestamp: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  status: 'detected' | 'resolved' | 'in_progress'
  description: string
  narrative?: string
  affectedResources?: string[]
  resolution?: {
    action: string
    timestamp: string
    outcome: string
  }
}

interface DriftDetection {
  id: string
  detectedAt: string
  severity: string
  type: string
  description: string
  status: string
  narrative?: string
}

interface Reconciliation {
  id: string
  startedAt: string
  completedAt?: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  type: string
  description: string
  narrative?: string
  changes?: Array<{
    resource: string
    action: string
    before?: unknown
    after?: unknown
  }>
}

interface AutonomyMetrics {
  totalEvents: number
  resolvedEvents: number
  activeEvents: number
  avgResolutionTime: number
  selfHealingRate: number
}

export default function AutonomyDashboardPage() {
  const [events, setEvents] = useState<SelfHealingEvent[]>([])
  const [driftDetections, setDriftDetections] = useState<DriftDetection[]>([])
  const [reconciliations, setReconciliations] = useState<Reconciliation[]>([])
  const [metrics, setMetrics] = useState<AutonomyMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<SelfHealingEvent | null>(null)

  useEffect(() => {
    loadAutonomyData()
  }, [])

  async function loadAutonomyData() {
    setLoading(true)
    setError(null)
    try {
      // In a real implementation, this would fetch from API endpoints
      const [eventsRes, driftRes, reconRes, metricsRes] = await Promise.all([
        fetch('/api/demo/system/autonomy/events'),
        fetch('/api/demo/system/autonomy/drift'),
        fetch('/api/demo/system/autonomy/reconciliations'),
        fetch('/api/demo/system/autonomy/metrics'),
      ])

      if (!eventsRes.ok || !driftRes.ok || !reconRes.ok || !metricsRes.ok) {
        throw new Error('Failed to load autonomy data')
      }

      const [eventsData, driftData, reconData, metricsData] = await Promise.all([
        eventsRes.json(),
        driftRes.json(),
        reconRes.json(),
        metricsRes.json(),
      ])

      setEvents(eventsData.events || [])
      setDriftDetections(driftData.detections || [])
      setReconciliations(reconData.reconciliations || [])
      setMetrics(metricsData.metrics || null)
    } catch (err: any) {
      setError(err.message ?? 'Unable to load autonomy data')
    } finally {
      setLoading(false)
    }
  }

  function getSeverityColor(severity: string): string {
    switch (severity.toLowerCase()) {
      case 'critical':
        return 'bg-red-100 text-red-800'
      case 'high':
        return 'bg-orange-100 text-orange-800'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800'
      case 'low':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  function getStatusColor(status: string): string {
    switch (status.toLowerCase()) {
      case 'resolved':
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'in_progress':
        return 'bg-blue-100 text-blue-800'
      case 'detected':
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-600">{error}</p>
            <Button onClick={loadAutonomyData} className="mt-4">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Autonomy Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Self-healing events, drift detections, and reconciliations
          </p>
        </div>
        <Button onClick={loadAutonomyData}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Events</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.totalEvents}</div>
              <p className="text-xs text-muted-foreground">
                All time self-healing events
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Resolved</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.resolvedEvents}</div>
              <p className="text-xs text-muted-foreground">
                {metrics.totalEvents > 0
                  ? `${Math.round((metrics.resolvedEvents / metrics.totalEvents) * 100)}% resolution rate`
                  : 'No events'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Events</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.activeEvents}</div>
              <p className="text-xs text-muted-foreground">
                Currently being processed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Self-Healing Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {metrics.selfHealingRate.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">
                Automatic resolution rate
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="events" className="space-y-4">
        <TabsList>
          <TabsTrigger value="events">Self-Healing Events</TabsTrigger>
          <TabsTrigger value="drift">Drift Detections</TabsTrigger>
          <TabsTrigger value="reconciliations">Reconciliations</TabsTrigger>
        </TabsList>

        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Self-Healing Events</CardTitle>
              <CardDescription>
                Automatic detection and resolution of system issues
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>
                        <Badge variant="outline">{event.type}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getSeverityColor(event.severity)}>
                          {event.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(event.status)}>
                          {event.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(event.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell className="max-w-md truncate">
                        {event.description}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedEvent(event)}
                        >
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="drift" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Drift Detections</CardTitle>
              <CardDescription>
                Detected deviations from expected system state
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Detected At</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {driftDetections.map((detection) => (
                    <TableRow key={detection.id}>
                      <TableCell>
                        <Badge variant="outline">{detection.type}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getSeverityColor(detection.severity)}>
                          {detection.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(detection.status)}>
                          {detection.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(detection.detectedAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="max-w-md">{detection.description}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reconciliations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Reconciliations</CardTitle>
              <CardDescription>
                Automatic reconciliation of system state
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Started At</TableHead>
                    <TableHead>Completed At</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reconciliations.map((recon) => (
                    <TableRow key={recon.id}>
                      <TableCell>
                        <Badge variant="outline">{recon.type}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(recon.status)}>
                          {recon.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(recon.startedAt).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {recon.completedAt
                          ? new Date(recon.completedAt).toLocaleString()
                          : '-'}
                      </TableCell>
                      <TableCell className="max-w-md">{recon.description}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {selectedEvent && (
        <Card>
          <CardHeader>
            <CardTitle>Event Details</CardTitle>
            <CardDescription>{selectedEvent.type}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-semibold">Severity</p>
                <Badge className={getSeverityColor(selectedEvent.severity)}>
                  {selectedEvent.severity}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-semibold">Status</p>
                <Badge className={getStatusColor(selectedEvent.status)}>
                  {selectedEvent.status}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-semibold">Timestamp</p>
                <p className="text-sm">
                  {new Date(selectedEvent.timestamp).toLocaleString()}
                </p>
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold mb-2">Description</p>
              <p className="text-sm">{selectedEvent.description}</p>
            </div>

            {selectedEvent.narrative && (
              <div>
                <p className="text-sm font-semibold mb-2">Narrative Summary</p>
                <div className="bg-gray-50 p-4 rounded text-sm whitespace-pre-wrap">
                  {selectedEvent.narrative}
                </div>
              </div>
            )}

            {selectedEvent.resolution && (
              <div>
                <p className="text-sm font-semibold mb-2">Resolution</p>
                <div className="bg-green-50 p-4 rounded space-y-2">
                  <p className="text-sm">
                    <span className="font-semibold">Action:</span> {selectedEvent.resolution.action}
                  </p>
                  <p className="text-sm">
                    <span className="font-semibold">Outcome:</span> {selectedEvent.resolution.outcome}
                  </p>
                  <p className="text-sm text-gray-600">
                    Resolved: {new Date(selectedEvent.resolution.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            )}

            <Button variant="outline" onClick={() => setSelectedEvent(null)}>
              Close
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

