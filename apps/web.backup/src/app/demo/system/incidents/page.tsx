'use client'

import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  FileText,
  Filter,
  RefreshCw,
  Search,
  TrendingUp,
  Zap,
} from 'lucide-react'

interface Alert {
  id: string
  title: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  source: string
  timestamp: string
  status: 'open' | 'acknowledged' | 'resolved'
  service?: string
}

interface Anomaly {
  id: string
  type: string
  description: string
  detectedAt: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  service: string
  metric: string
  value: number
  threshold: number
}

interface Incident {
  id: string
  title: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  status: 'investigating' | 'identified' | 'mitigating' | 'resolved'
  createdAt: string
  resolvedAt?: string
  timeToAcknowledge?: number
  timeToResolve?: number
  affectedServices: string[]
  alerts: string[]
  anomalies: string[]
  assignee?: string
}

const MOCK_ALERTS: Alert[] = [
  {
    id: 'alert-1',
    title: 'High error rate detected',
    severity: 'high',
    source: 'monitoring',
    timestamp: '2025-11-16T09:15:00Z',
    status: 'open',
    service: 'credential-service',
  },
  {
    id: 'alert-2',
    title: 'Queue depth exceeded threshold',
    severity: 'critical',
    source: 'monitoring',
    timestamp: '2025-11-16T09:10:00Z',
    status: 'acknowledged',
    service: 'lineage-service',
  },
  {
    id: 'alert-3',
    title: 'Latency spike detected',
    severity: 'medium',
    source: 'monitoring',
    timestamp: '2025-11-16T08:45:00Z',
    status: 'resolved',
    service: 'auth-service',
  },
  {
    id: 'alert-4',
    title: 'Database connection pool exhausted',
    severity: 'critical',
    source: 'infrastructure',
    timestamp: '2025-11-16T09:20:00Z',
    status: 'open',
    service: 'finance-service',
  },
]

const MOCK_ANOMALIES: Anomaly[] = [
  {
    id: 'anomaly-1',
    type: 'Error Rate Spike',
    description: 'Error rate increased by 150%',
    detectedAt: '2025-11-16T09:15:00Z',
    severity: 'high',
    service: 'credential-service',
    metric: 'error_rate',
    value: 0.15,
    threshold: 0.05,
  },
  {
    id: 'anomaly-2',
    type: 'Latency Anomaly',
    description: 'P95 latency increased significantly',
    detectedAt: '2025-11-16T09:10:00Z',
    severity: 'critical',
    service: 'lineage-service',
    metric: 'p95_latency',
    value: 450,
    threshold: 200,
  },
  {
    id: 'anomaly-3',
    type: 'Traffic Spike',
    description: 'Unusual traffic pattern detected',
    detectedAt: '2025-11-16T08:30:00Z',
    severity: 'medium',
    service: 'auth-service',
    metric: 'requests_per_second',
    value: 2500,
    threshold: 1500,
  },
]

const MOCK_INCIDENTS: Incident[] = [
  {
    id: 'incident-1',
    title: 'Credential Service Degradation',
    severity: 'high',
    status: 'mitigating',
    createdAt: '2025-11-16T09:15:00Z',
    timeToAcknowledge: 5,
    affectedServices: ['credential-service', 'reputation-service'],
    alerts: ['alert-1'],
    anomalies: ['anomaly-1'],
    assignee: 'john.doe@example.com',
  },
  {
    id: 'incident-2',
    title: 'Lineage Service Outage',
    severity: 'critical',
    status: 'identified',
    createdAt: '2025-11-16T09:10:00Z',
    timeToAcknowledge: 3,
    affectedServices: ['lineage-service'],
    alerts: ['alert-2'],
    anomalies: ['anomaly-2'],
    assignee: 'jane.smith@example.com',
  },
  {
    id: 'incident-3',
    title: 'Auth Service Latency Issue',
    severity: 'medium',
    status: 'resolved',
    createdAt: '2025-11-16T08:30:00Z',
    resolvedAt: '2025-11-16T08:55:00Z',
    timeToAcknowledge: 8,
    timeToResolve: 25,
    affectedServices: ['auth-service'],
    alerts: ['alert-3'],
    anomalies: ['anomaly-3'],
  },
]

export default function IncidentResponseDashboardPage() {
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [autoRefresh, setAutoRefresh] = useState(true)

  const filteredIncidents = useMemo(() => {
    return MOCK_INCIDENTS.filter((incident) => {
      if (severityFilter !== 'all' && incident.severity !== severityFilter) return false
      if (statusFilter !== 'all' && incident.status !== statusFilter) return false
      return true
    })
  }, [severityFilter, statusFilter])

  const filteredAlerts = useMemo(() => {
    return MOCK_ALERTS.filter((alert) => {
      if (severityFilter !== 'all' && alert.severity !== severityFilter) return false
      if (statusFilter !== 'all' && alert.status !== statusFilter) return false
      return true
    })
  }, [severityFilter, statusFilter])

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-600 bg-red-50 border-red-200'
      case 'high':
        return 'text-orange-600 bg-orange-50 border-orange-200'
      case 'medium':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'low':
        return 'text-blue-600 bg-blue-50 border-blue-200'
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getSeverityBadgeVariant = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'destructive'
      case 'high':
        return 'destructive'
      case 'medium':
        return 'secondary'
      case 'low':
        return 'default'
      default:
        return 'default'
    }
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'resolved':
        return 'default'
      case 'investigating':
      case 'identified':
      case 'mitigating':
        return 'secondary'
      case 'open':
        return 'destructive'
      case 'acknowledged':
        return 'secondary'
      default:
        return 'default'
    }
  }

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h ${mins}m`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const getTimeSince = (dateString: string) => {
    const now = new Date()
    const then = new Date(dateString)
    const diffMinutes = Math.floor((now.getTime() - then.getTime()) / (1000 * 60))
    return formatDuration(diffMinutes)
  }

  const activeIncidents = filteredIncidents.filter(
    (i) => i.status !== 'resolved'
  ).length
  const criticalIncidents = filteredIncidents.filter(
    (i) => i.severity === 'critical' && i.status !== 'resolved'
  ).length
  const avgTimeToResolve = useMemo(() => {
    const resolved = filteredIncidents.filter((i) => i.timeToResolve)
    if (resolved.length === 0) return 0
    return Math.round(
      resolved.reduce((sum, i) => sum + (i.timeToResolve || 0), 0) / resolved.length
    )
  }, [filteredIncidents])

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Incident Response Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Aggregate alerts, anomalies, and incidents with response tracking
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severities</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="acknowledged">Acknowledged</SelectItem>
              <SelectItem value="investigating">Investigating</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => setAutoRefresh(!autoRefresh)}>
            <RefreshCw className={cn('h-4 w-4', autoRefresh && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* Overview Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Incidents</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeIncidents}</div>
            <p className="text-xs text-muted-foreground">Currently being addressed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Incidents</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{criticalIncidents}</div>
            <p className="text-xs text-muted-foreground">Require immediate attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Time to Resolve</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(avgTimeToResolve)}</div>
            <p className="text-xs text-muted-foreground">Based on resolved incidents</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Alerts</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {MOCK_ALERTS.filter((a) => a.status === 'open').length}
            </div>
            <p className="text-xs text-muted-foreground">Unresolved alerts</p>
          </CardContent>
        </Card>
      </div>

      {/* Incidents Table */}
      <Card>
        <CardHeader>
          <CardTitle>Incidents</CardTitle>
          <CardDescription>Track incident response status and resolution times</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="incidents">
            <TabsList>
              <TabsTrigger value="incidents">Incidents</TabsTrigger>
              <TabsTrigger value="alerts">Alerts</TabsTrigger>
              <TabsTrigger value="anomalies">Anomalies</TabsTrigger>
            </TabsList>
            <TabsContent value="incidents" className="mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Affected Services</TableHead>
                    <TableHead>Time to Acknowledge</TableHead>
                    <TableHead>Time to Resolve</TableHead>
                    <TableHead>Assignee</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredIncidents.map((incident) => (
                    <TableRow key={incident.id}>
                      <TableCell className="font-medium">{incident.title}</TableCell>
                      <TableCell>
                        <Badge variant={getSeverityBadgeVariant(incident.severity)}>
                          {incident.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(incident.status)}>
                          {incident.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {incident.affectedServices.map((service) => (
                            <Badge key={service} variant="outline" className="text-xs">
                              {service}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {incident.timeToAcknowledge
                          ? formatDuration(incident.timeToAcknowledge)
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {incident.timeToResolve ? formatDuration(incident.timeToResolve) : '-'}
                      </TableCell>
                      <TableCell>{incident.assignee || '-'}</TableCell>
                      <TableCell>{formatDate(incident.createdAt)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
            <TabsContent value="alerts" className="mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Detected</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAlerts.map((alert) => (
                    <TableRow key={alert.id}>
                      <TableCell className="font-medium">{alert.title}</TableCell>
                      <TableCell>
                        <Badge variant={getSeverityBadgeVariant(alert.severity)}>
                          {alert.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(alert.status)}>
                          {alert.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{alert.service || '-'}</TableCell>
                      <TableCell>{alert.source}</TableCell>
                      <TableCell>{getTimeSince(alert.timestamp)} ago</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
            <TabsContent value="anomalies" className="mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Metric</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Threshold</TableHead>
                    <TableHead>Detected</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {MOCK_ANOMALIES.map((anomaly) => (
                    <TableRow key={anomaly.id}>
                      <TableCell className="font-medium">{anomaly.type}</TableCell>
                      <TableCell>
                        <Badge variant={getSeverityBadgeVariant(anomaly.severity)}>
                          {anomaly.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>{anomaly.service}</TableCell>
                      <TableCell>
                        <code className="text-xs">{anomaly.metric}</code>
                      </TableCell>
                      <TableCell className="font-medium">{anomaly.value}</TableCell>
                      <TableCell>{anomaly.threshold}</TableCell>
                      <TableCell>{getTimeSince(anomaly.detectedAt)} ago</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Incident Details */}
      {filteredIncidents.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredIncidents
            .filter((i) => i.status !== 'resolved')
            .slice(0, 2)
            .map((incident) => (
              <Card key={incident.id} className={cn('border-l-4', getSeverityColor(incident.severity))}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{incident.title}</CardTitle>
                    <Badge variant={getSeverityBadgeVariant(incident.severity)}>
                      {incident.severity}
                    </Badge>
                  </div>
                  <CardDescription>Status: {incident.status}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm font-medium mb-2">Affected Services</p>
                    <div className="flex flex-wrap gap-2">
                      {incident.affectedServices.map((service) => (
                        <Badge key={service} variant="outline">
                          {service}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Time to Acknowledge</p>
                      <p className="font-medium">
                        {incident.timeToAcknowledge
                          ? formatDuration(incident.timeToAcknowledge)
                          : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Created</p>
                      <p className="font-medium">{getTimeSince(incident.createdAt)} ago</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <FileText className="h-4 w-4 mr-2" />
                      View Logs
                    </Button>
                    <Button variant="outline" size="sm">
                      <Search className="h-4 w-4 mr-2" />
                      View Traces
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}
    </div>
  )
}

