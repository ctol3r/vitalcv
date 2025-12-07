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
  Activity,
  AlertTriangle,
  ArrowRight,
  Database,
  RefreshCw,
  Server,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'

interface ServiceMetric {
  service: string
  region: string
  requestsPerSecond: number
  errorRate: number
  p95Latency: number
  queueDepth: number
  status: 'healthy' | 'degraded' | 'unhealthy'
  anomalies: number
}

interface TrafficDataPoint {
  timestamp: string
  requests: number
  errors: number
}

const MOCK_SERVICES: ServiceMetric[] = [
  {
    service: 'auth-service',
    region: 'us-east-1',
    requestsPerSecond: 1250,
    errorRate: 0.02,
    p95Latency: 45,
    queueDepth: 12,
    status: 'healthy',
    anomalies: 0,
  },
  {
    service: 'credential-service',
    region: 'us-east-1',
    requestsPerSecond: 890,
    errorRate: 0.15,
    p95Latency: 120,
    queueDepth: 245,
    status: 'degraded',
    anomalies: 3,
  },
  {
    service: 'reputation-service',
    region: 'us-west-2',
    requestsPerSecond: 450,
    errorRate: 0.01,
    p95Latency: 32,
    queueDepth: 8,
    status: 'healthy',
    anomalies: 0,
  },
  {
    service: 'finance-service',
    region: 'us-east-1',
    requestsPerSecond: 320,
    errorRate: 0.05,
    p95Latency: 78,
    queueDepth: 45,
    status: 'healthy',
    anomalies: 1,
  },
  {
    service: 'lineage-service',
    region: 'eu-west-1',
    requestsPerSecond: 180,
    errorRate: 0.25,
    p95Latency: 450,
    queueDepth: 1200,
    status: 'unhealthy',
    anomalies: 8,
  },
]

const MOCK_TRAFFIC_DATA: TrafficDataPoint[] = Array.from({ length: 30 }, (_, i) => {
  const timestamp = new Date(Date.now() - (29 - i) * 60000).toISOString()
  return {
    timestamp,
    requests: Math.floor(Math.random() * 2000) + 500,
    errors: Math.floor(Math.random() * 50),
  }
})

const SVG_HEIGHT = 200
const SVG_WIDTH = 800
const SVG_PADDING = 32

export default function SystemHealthDashboardPage() {
  const [timeFilter, setTimeFilter] = useState<string>('1h')
  const [regionFilter, setRegionFilter] = useState<string>('all')
  const [autoRefresh, setAutoRefresh] = useState(true)

  const filteredServices = useMemo(() => {
    if (regionFilter === 'all') return MOCK_SERVICES
    return MOCK_SERVICES.filter((s) => s.region === regionFilter)
  }, [regionFilter])

  const overallHealth = useMemo(() => {
    const healthy = filteredServices.filter((s) => s.status === 'healthy').length
    const degraded = filteredServices.filter((s) => s.status === 'degraded').length
    const unhealthy = filteredServices.filter((s) => s.status === 'unhealthy').length
    const total = filteredServices.length

    return {
      healthy,
      degraded,
      unhealthy,
      total,
      healthPercentage: (healthy / total) * 100,
    }
  }, [filteredServices])

  const totalAnomalies = useMemo(() => {
    return filteredServices.reduce((sum, s) => sum + s.anomalies, 0)
  }, [filteredServices])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-50 border-green-200'
      case 'degraded':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'unhealthy':
        return 'text-red-600 bg-red-50 border-red-200'
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'default'
      case 'degraded':
        return 'secondary'
      case 'unhealthy':
        return 'destructive'
      default:
        return 'default'
    }
  }

  // Calculate traffic chart data
  const trafficChartData = useMemo(() => {
    const allRequests = MOCK_TRAFFIC_DATA.map((d) => d.requests)
    const allErrors = MOCK_TRAFFIC_DATA.map((d) => d.errors)
    const minRequests = Math.min(...allRequests)
    const maxRequests = Math.max(...allRequests)
    const maxErrors = Math.max(...allErrors)
    const range = maxRequests - minRequests || 1

    const width = SVG_WIDTH - SVG_PADDING * 2
    const height = SVG_HEIGHT - SVG_PADDING * 2

    const requestPoints = MOCK_TRAFFIC_DATA.map((datum, index) => {
      const x = SVG_PADDING + (width * index) / Math.max(MOCK_TRAFFIC_DATA.length - 1, 1)
      const y = SVG_PADDING + height * (1 - (datum.requests - minRequests) / range)
      return { x, y, datum }
    })

    const errorPoints = MOCK_TRAFFIC_DATA.map((datum, index) => {
      const x = SVG_PADDING + (width * index) / Math.max(MOCK_TRAFFIC_DATA.length - 1, 1)
      const y = SVG_PADDING + height * (1 - (datum.errors / maxErrors))
      return { x, y, datum }
    })

    const requestPath = requestPoints.map((p) => `${p.x},${p.y}`).join(' ')
    const errorPath = errorPoints.map((p) => `${p.x},${p.y}`).join(' ')

    return { requestPoints, errorPoints, requestPath, errorPath, minRequests, maxRequests }
  }, [])

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">System Health Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Live metrics, error rates, queue depths, and traffic per service/region
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={timeFilter} onValueChange={setTimeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Time period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="15m">Last 15 minutes</SelectItem>
              <SelectItem value="1h">Last hour</SelectItem>
              <SelectItem value="6h">Last 6 hours</SelectItem>
              <SelectItem value="24h">Last 24 hours</SelectItem>
            </SelectContent>
          </Select>
          <Select value={regionFilter} onValueChange={setRegionFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Region" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Regions</SelectItem>
              <SelectItem value="us-east-1">US East (N. Virginia)</SelectItem>
              <SelectItem value="us-west-2">US West (Oregon)</SelectItem>
              <SelectItem value="eu-west-1">EU West (Ireland)</SelectItem>
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
            <CardTitle className="text-sm font-medium">Services Healthy</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overallHealth.healthy}/{overallHealth.total}
            </div>
            <p className="text-xs text-muted-foreground">
              {overallHealth.healthPercentage.toFixed(0)}% healthy
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Anomalies</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAnomalies}</div>
            <p className="text-xs text-muted-foreground">Detected in last hour</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Traffic</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {filteredServices.reduce((sum, s) => sum + s.requestsPerSecond, 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Requests per second</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Error Rate</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(
                (filteredServices.reduce((sum, s) => sum + s.errorRate, 0) / filteredServices.length) *
                100
              ).toFixed(2)}
              %
            </div>
            <p className="text-xs text-muted-foreground">Across all services</p>
          </CardContent>
        </Card>
      </div>

      {/* Traffic Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Traffic Overview</CardTitle>
          <CardDescription>Requests and errors over time</CardDescription>
        </CardHeader>
        <CardContent>
          <svg viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} className="w-full overflow-visible">
            <defs>
              <linearGradient id="traffic-gradient" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
              </linearGradient>
            </defs>

            {/* Grid lines */}
            {[0, 25, 50, 75, 100].map((value) => {
              const y = SVG_PADDING + ((SVG_HEIGHT - SVG_PADDING * 2) * (100 - value)) / 100
              return (
                <line
                  key={value}
                  x1={SVG_PADDING}
                  x2={SVG_WIDTH - SVG_PADDING}
                  y1={y}
                  y2={y}
                  stroke="hsl(var(--muted))"
                  strokeDasharray="2 2"
                  strokeWidth="1"
                  opacity={0.3}
                  aria-hidden="true"
                />
              )
            })}

            {/* Request line */}
            <polyline
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="2.5"
              points={trafficChartData.requestPath}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polygon
              points={`${trafficChartData.requestPath} ${SVG_WIDTH - SVG_PADDING},${SVG_HEIGHT - SVG_PADDING} ${SVG_PADDING},${SVG_HEIGHT - SVG_PADDING}`}
              fill="url(#traffic-gradient)"
              opacity={0.15}
            />

            {/* Error line */}
            <polyline
              fill="none"
              stroke="hsl(var(--destructive))"
              strokeWidth="2"
              points={trafficChartData.errorPath}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Data points */}
            {trafficChartData.requestPoints.map(({ x, y, datum }, index) => (
              <circle
                key={index}
                cx={x}
                cy={y}
                r={3}
                fill="hsl(var(--primary))"
                stroke="hsl(var(--background))"
                strokeWidth="1.5"
              >
                <title>
                  Requests: {datum.requests}, Errors: {datum.errors} ({new Date(datum.timestamp).toLocaleTimeString()})
                </title>
              </circle>
            ))}
          </svg>
        </CardContent>
      </Card>

      {/* Service Metrics Table */}
      <Card>
        <CardHeader>
          <CardTitle>Service Metrics</CardTitle>
          <CardDescription>Detailed metrics per service and region</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>RPS</TableHead>
                    <TableHead>Error Rate</TableHead>
                    <TableHead>P95 Latency</TableHead>
                    <TableHead>Queue Depth</TableHead>
                    <TableHead>Anomalies</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredServices.map((service) => (
                    <TableRow key={`${service.service}-${service.region}`}>
                      <TableCell className="font-medium">{service.service}</TableCell>
                      <TableCell>{service.region}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(service.status)}>
                          {service.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{service.requestsPerSecond.toLocaleString()}</TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            'font-medium',
                            service.errorRate > 0.1 ? 'text-red-600' : 'text-green-600'
                          )}
                        >
                          {(service.errorRate * 100).toFixed(2)}%
                        </span>
                      </TableCell>
                      <TableCell>{service.p95Latency}ms</TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            'font-medium',
                            service.queueDepth > 100 ? 'text-red-600' : 'text-green-600'
                          )}
                        >
                          {service.queueDepth}
                        </span>
                      </TableCell>
                      <TableCell>
                        {service.anomalies > 0 ? (
                          <Badge variant="destructive">{service.anomalies}</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
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
            <TabsContent value="details" className="mt-4">
              <div className="space-y-4">
                {filteredServices.map((service) => (
                  <Card key={`${service.service}-${service.region}`} className={cn('border-l-4', getStatusColor(service.status))}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg">{service.service}</CardTitle>
                          <CardDescription>{service.region}</CardDescription>
                        </div>
                        <Badge variant={getStatusBadgeVariant(service.status)}>
                          {service.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Requests/sec</p>
                          <p className="text-2xl font-bold">{service.requestsPerSecond.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Error Rate</p>
                          <p className="text-2xl font-bold">{(service.errorRate * 100).toFixed(2)}%</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">P95 Latency</p>
                          <p className="text-2xl font-bold">{service.p95Latency}ms</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Queue Depth</p>
                          <p className="text-2xl font-bold">{service.queueDepth}</p>
                        </div>
                      </div>
                      {service.anomalies > 0 && (
                        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-yellow-600" />
                            <p className="text-sm font-medium text-yellow-800">
                              {service.anomalies} anomaly{service.anomalies > 1 ? 'ies' : ''} detected
                            </p>
                          </div>
                        </div>
                      )}
                      <div className="mt-4 flex gap-2">
                        <Button variant="outline" size="sm">
                          View Traces
                        </Button>
                        <Button variant="outline" size="sm">
                          View Logs
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

