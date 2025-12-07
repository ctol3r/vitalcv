'use client'

import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  BarChart3,
  ChevronRight,
  Filter,
  Search,
  Shield,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface BiasMetric {
  id: string
  category: string
  metric: string
  value: number
  threshold: number
  status: 'pass' | 'warn' | 'fail'
  trend: 'up' | 'down' | 'stable'
  description: string
}

interface ComplianceCheck {
  id: string
  name: string
  regulation: string
  status: 'compliant' | 'non-compliant' | 'pending'
  lastChecked: string
  details: string
}

interface FlaggedEvent {
  id: string
  type: 'bias' | 'compliance' | 'ethics'
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  description: string
  detectedAt: string
  affectedModel?: string
  affectedActions?: number
  status: 'open' | 'investigating' | 'resolved'
  resolution?: string
}

interface EthicsMetrics {
  totalBiasDetections: number
  complianceRate: number
  flaggedEvents: number
  avgResolutionTime: number
}

export default function EthicsBiasDashboardPage() {
  const [metrics, setMetrics] = useState<EthicsMetrics | null>(null)
  const [biasMetrics, setBiasMetrics] = useState<BiasMetric[]>([])
  const [complianceChecks, setComplianceChecks] = useState<ComplianceCheck[]>([])
  const [flaggedEvents, setFlaggedEvents] = useState<FlaggedEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState<FlaggedEvent | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [severityFilter, setSeverityFilter] = useState<string>('all')

  useEffect(() => {
    loadEthicsData()
  }, [])

  async function loadEthicsData() {
    try {
      const [metricsRes, biasRes, complianceRes, eventsRes] = await Promise.all([
        fetch('/api/demo/system/ethics/metrics'),
        fetch('/api/demo/system/ethics/bias-metrics'),
        fetch('/api/demo/system/ethics/compliance'),
        fetch('/api/demo/system/ethics/flagged-events'),
      ])

      if (metricsRes.ok) {
        const data = await metricsRes.json()
        setMetrics(data.metrics || mockMetrics())
      }
      if (biasRes.ok) {
        const data = await biasRes.json()
        setBiasMetrics(data.metrics || mockBiasMetrics())
      }
      if (complianceRes.ok) {
        const data = await complianceRes.json()
        setComplianceChecks(data.checks || mockComplianceChecks())
      }
      if (eventsRes.ok) {
        const data = await eventsRes.json()
        setFlaggedEvents(data.events || mockFlaggedEvents())
      }
    } catch (err) {
      // Fallback to mock data
      setMetrics(mockMetrics())
      setBiasMetrics(mockBiasMetrics())
      setComplianceChecks(mockComplianceChecks())
      setFlaggedEvents(mockFlaggedEvents())
    } finally {
      setLoading(false)
    }
  }

  const filteredEvents = flaggedEvents.filter((event) => {
    const matchesSearch =
      !searchQuery ||
      event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesSeverity = severityFilter === 'all' || event.severity === severityFilter
    return matchesSearch && matchesSeverity
  })

  function getStatusColor(status: string): string {
    switch (status) {
      case 'pass':
      case 'compliant':
      case 'resolved':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'warn':
      case 'pending':
      case 'investigating':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'fail':
      case 'non-compliant':
      case 'open':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  function getSeverityColor(severity: string): string {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading ethics dashboard...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            Ethics & Bias Dashboard
          </h1>
          <p className="text-gray-600 mt-1">
            Visualize bias detection metrics, compliance checks, and flagged events with drill-down capabilities
          </p>
        </div>
      </div>

      {/* Overview Metrics */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Bias Detections</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.totalBiasDetections}</div>
              <p className="text-xs text-muted-foreground">Total detections this month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Compliance Rate</CardTitle>
              <BarChart3 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.complianceRate.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">Regulatory compliance</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Flagged Events</CardTitle>
              <Shield className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.flaggedEvents}</div>
              <p className="text-xs text-muted-foreground">Requiring review</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Resolution</CardTitle>
              <TrendingDown className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.avgResolutionTime}h</div>
              <p className="text-xs text-muted-foreground">Time to resolution</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="bias" className="space-y-4">
        <TabsList>
          <TabsTrigger value="bias">Bias Metrics</TabsTrigger>
          <TabsTrigger value="compliance">Compliance Checks</TabsTrigger>
          <TabsTrigger value="events">Flagged Events</TabsTrigger>
        </TabsList>

        <TabsContent value="bias" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Bias Detection Metrics</CardTitle>
              <CardDescription>
                Key metrics tracking fairness and bias in autonomous decision-making
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Metric</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Threshold</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Trend</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {biasMetrics.map((metric) => (
                    <TableRow key={metric.id}>
                      <TableCell className="font-medium">{metric.category}</TableCell>
                      <TableCell>{metric.metric}</TableCell>
                      <TableCell>
                        <span className="font-semibold">{metric.value.toFixed(2)}</span>
                      </TableCell>
                      <TableCell>{metric.threshold.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(metric.status)}>
                          {metric.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {metric.trend === 'up' ? (
                          <TrendingUp className="w-4 h-4 text-red-600" />
                        ) : metric.trend === 'down' ? (
                          <TrendingDown className="w-4 h-4 text-green-600" />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compliance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Compliance Checks</CardTitle>
              <CardDescription>
                Regulatory compliance status for autonomous credential actions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Check Name</TableHead>
                    <TableHead>Regulation</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Checked</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {complianceChecks.map((check) => (
                    <TableRow key={check.id}>
                      <TableCell className="font-medium">{check.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{check.regulation}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(check.status)}>
                          {check.status.replace('-', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(check.lastChecked).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="max-w-md truncate">{check.details}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Flagged Events</CardTitle>
                  <CardDescription>
                    Events requiring investigation or resolution
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search events..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 w-64"
                    />
                  </div>
                  <select
                    value={severityFilter}
                    onChange={(e) => setSeverityFilter(e.target.value)}
                    className="rounded-md border bg-background px-3 py-2 text-sm"
                  >
                    <option value="all">All Severities</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Detected</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEvents.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>
                        <Badge variant="outline">{event.type}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getSeverityColor(event.severity)}>
                          {event.severity}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{event.title}</TableCell>
                      <TableCell>
                        {new Date(event.detectedAt).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(event.status)}>
                          {event.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedEvent(event)}
                        >
                          View Details
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredEvents.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                        No events match the current filters
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Event Detail Dialog */}
      {selectedEvent && (
        <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedEvent.title}</DialogTitle>
              <DialogDescription>
                <div className="flex items-center gap-2 mt-2">
                  <Badge className={getSeverityColor(selectedEvent.severity)}>
                    {selectedEvent.severity}
                  </Badge>
                  <Badge variant="outline">{selectedEvent.type}</Badge>
                  <Badge className={getStatusColor(selectedEvent.status)}>
                    {selectedEvent.status}
                  </Badge>
                </div>
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <h4 className="font-semibold mb-2">Description</h4>
                <p className="text-sm text-muted-foreground">{selectedEvent.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-semibold">Detected At</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(selectedEvent.detectedAt).toLocaleString()}
                  </p>
                </div>
                {selectedEvent.affectedModel && (
                  <div>
                    <p className="text-sm font-semibold">Affected Model</p>
                    <p className="text-sm text-muted-foreground">{selectedEvent.affectedModel}</p>
                  </div>
                )}
                {selectedEvent.affectedActions !== undefined && (
                  <div>
                    <p className="text-sm font-semibold">Affected Actions</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedEvent.affectedActions} actions
                    </p>
                  </div>
                )}
              </div>
              {selectedEvent.resolution && (
                <div>
                  <h4 className="font-semibold mb-2">Resolution</h4>
                  <p className="text-sm text-muted-foreground">{selectedEvent.resolution}</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function mockMetrics(): EthicsMetrics {
  return {
    totalBiasDetections: 12,
    complianceRate: 94.5,
    flaggedEvents: 8,
    avgResolutionTime: 18.5,
  }
}

function mockBiasMetrics(): BiasMetric[] {
  return [
    {
      id: 'bm-001',
      category: 'Demographic',
      metric: 'Approval Rate Disparity',
      value: 0.08,
      threshold: 0.1,
      status: 'pass',
      trend: 'down',
      description: 'Difference in approval rates across demographic groups',
    },
    {
      id: 'bm-002',
      category: 'Geographic',
      metric: 'Processing Time Variance',
      value: 0.15,
      threshold: 0.12,
      status: 'warn',
      trend: 'up',
      description: 'Variance in processing times by region',
    },
    {
      id: 'bm-003',
      category: 'Temporal',
      metric: 'Time-of-Day Bias',
      value: 0.05,
      threshold: 0.08,
      status: 'pass',
      trend: 'stable',
      description: 'Bias detection in time-based decisions',
    },
    {
      id: 'bm-004',
      category: 'Experience',
      metric: 'Seniority Preference',
      value: 0.12,
      threshold: 0.1,
      status: 'fail',
      trend: 'up',
      description: 'Preference for senior clinicians detected',
    },
  ]
}

function mockComplianceChecks(): ComplianceCheck[] {
  return [
    {
      id: 'cc-001',
      name: 'HIPAA Compliance',
      regulation: 'HIPAA',
      status: 'compliant',
      lastChecked: new Date().toISOString(),
      details: 'All autonomous actions comply with HIPAA privacy requirements',
    },
    {
      id: 'cc-002',
      name: 'Fair Credit Reporting',
      regulation: 'FCRA',
      status: 'compliant',
      lastChecked: new Date(Date.now() - 86400000).toISOString(),
      details: 'Credential decisions comply with FCRA guidelines',
    },
    {
      id: 'cc-003',
      name: 'State Licensing Rules',
      regulation: 'State',
      status: 'non-compliant',
      lastChecked: new Date(Date.now() - 172800000).toISOString(),
      details: 'Some actions may violate state-specific licensing requirements',
    },
    {
      id: 'cc-004',
      name: 'Joint Commission Standards',
      regulation: 'TJC',
      status: 'pending',
      lastChecked: new Date(Date.now() - 259200000).toISOString(),
      details: 'Compliance check in progress',
    },
  ]
}

function mockFlaggedEvents(): FlaggedEvent[] {
  return [
    {
      id: 'fe-001',
      type: 'bias',
      severity: 'high',
      title: 'Demographic Disparity Detected',
      description:
        'Significant difference in credential approval rates between demographic groups detected',
      detectedAt: new Date(Date.now() - 3600000).toISOString(),
      affectedModel: 'credential-issuance-v2',
      affectedActions: 23,
      status: 'investigating',
    },
    {
      id: 'fe-002',
      type: 'compliance',
      severity: 'critical',
      title: 'State Licensing Violation',
      description: 'Autonomous action may violate state-specific licensing requirements',
      detectedAt: new Date(Date.now() - 7200000).toISOString(),
      affectedActions: 5,
      status: 'open',
    },
    {
      id: 'fe-003',
      type: 'ethics',
      severity: 'medium',
      title: 'Unusual Decision Pattern',
      description: 'Unusual pattern detected in credential decisions requiring review',
      detectedAt: new Date(Date.now() - 10800000).toISOString(),
      affectedModel: 'credential-renewal-v1',
      affectedActions: 12,
      status: 'resolved',
      resolution: 'Pattern reviewed and determined to be within acceptable parameters',
    },
  ]
}

