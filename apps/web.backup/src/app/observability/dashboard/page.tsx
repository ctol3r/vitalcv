'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Clock,
  Database,
  Gauge,
  Server,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

type ServiceStatus = 'healthy' | 'degraded' | 'down' | 'unknown'

type Service = {
  name: string
  status: ServiceStatus
  requestRate: number
  errorRate: number
  avgLatency: number
  p95Latency: number
  url: string
}

type Metric = {
  name: string
  value: number
  change: number
  unit: string
  icon: React.ComponentType<{ className?: string }>
}

type TimeSeriesPoint = {
  timestamp: string
  value: number
}

type Incident = {
  id: string
  service: string
  severity: 'critical' | 'warning' | 'info'
  title: string
  startTime: string
}

const STATUS_COLORS: Record<ServiceStatus, string> = {
  healthy: 'bg-green-500',
  degraded: 'bg-yellow-500',
  down: 'bg-red-500',
  unknown: 'bg-gray-500',
}

const STATUS_LABELS: Record<ServiceStatus, string> = {
  healthy: 'Healthy',
  degraded: 'Degraded',
  down: 'Down',
  unknown: 'Unknown',
}

export default function ObservabilityDashboard() {
  const [metrics, setMetrics] = useState<Metric[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [requestRateData, setRequestRateData] = useState<TimeSeriesPoint[]>([])
  const [errorRateData, setErrorRateData] = useState<TimeSeriesPoint[]>([])
  const [latencyData, setLatencyData] = useState<TimeSeriesPoint[]>([])
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Simulate API call
    const fetchData = async () => {
      setLoading(true)
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Mock data
      setMetrics([
        {
          name: 'Request Rate',
          value: 1250,
          change: 5.2,
          unit: 'req/s',
          icon: Activity,
        },
        {
          name: 'Error Rate',
          value: 0.8,
          change: -12.5,
          unit: '%',
          icon: AlertCircle,
        },
        {
          name: 'Avg Latency',
          value: 145,
          change: -3.1,
          unit: 'ms',
          icon: Clock,
        },
        {
          name: 'Active Incidents',
          value: 2,
          change: 0,
          unit: '',
          icon: AlertTriangle,
        },
      ])

      setServices([
        {
          name: 'issuer-api',
          status: 'healthy',
          requestRate: 450,
          errorRate: 0.2,
          avgLatency: 120,
          p95Latency: 280,
          url: '/observability/service/issuer-api',
        },
        {
          name: 'verifier-api',
          status: 'healthy',
          requestRate: 380,
          errorRate: 0.5,
          avgLatency: 135,
          p95Latency: 310,
          url: '/observability/service/verifier-api',
        },
        {
          name: 'api',
          status: 'degraded',
          requestRate: 320,
          errorRate: 2.1,
          avgLatency: 185,
          p95Latency: 450,
          url: '/observability/service/api',
        },
        {
          name: 'authz',
          status: 'healthy',
          requestRate: 280,
          errorRate: 0.3,
          avgLatency: 95,
          p95Latency: 220,
          url: '/observability/service/authz',
        },
      ])

      // Generate time series data for last 24 hours
      const now = Date.now()
      const data: TimeSeriesPoint[] = []
      for (let i = 23; i >= 0; i--) {
        const timestamp = new Date(now - i * 60 * 60 * 1000).toISOString()
        data.push({
          timestamp: new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          value: Math.floor(Math.random() * 500) + 1000,
        })
      }
      setRequestRateData(data)

      const errorData: TimeSeriesPoint[] = []
      for (let i = 23; i >= 0; i--) {
        const timestamp = new Date(now - i * 60 * 60 * 1000).toISOString()
        errorData.push({
          timestamp: new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          value: Math.random() * 2,
        })
      }
      setErrorRateData(errorData)

      const latData: TimeSeriesPoint[] = []
      for (let i = 23; i >= 0; i--) {
        const timestamp = new Date(now - i * 60 * 60 * 1000).toISOString()
        latData.push({
          timestamp: new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          value: Math.floor(Math.random() * 100) + 100,
        })
      }
      setLatencyData(latData)

      setIncidents([
        {
          id: 'inc-1',
          service: 'api',
          severity: 'critical',
          title: 'High error rate detected',
          startTime: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        },
        {
          id: 'inc-2',
          service: 'authz',
          severity: 'warning',
          title: 'Latency spike detected',
          startTime: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        },
      ])

      setLoading(false)
    }

    fetchData()
    const interval = setInterval(fetchData, 30000) // Refresh every 30s
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="container mx-auto space-y-6 py-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Observability Dashboard</h1>
        <p className="text-muted-foreground">
          Real-time metrics, service health, and incident monitoring across all services
        </p>
      </header>

      {/* Key Metrics */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4 rounded" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-20 mb-2" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))
        ) : (
          metrics.map((metric) => (
            <Card key={metric.name}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{metric.name}</CardTitle>
                <metric.icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <div className="text-2xl font-bold">
                    {metric.value.toLocaleString()}
                    {metric.unit && <span className="ml-1 text-sm font-normal text-muted-foreground">{metric.unit}</span>}
                  </div>
                  {metric.change !== 0 && (
                    <div
                      className={cn(
                        'flex items-center gap-1 text-xs font-medium',
                        metric.change > 0 ? 'text-red-600' : 'text-green-600',
                      )}
                    >
                      {metric.change > 0 ? (
                        <TrendingUp className="h-3 w-3" aria-hidden="true" />
                      ) : (
                        <TrendingDown className="h-3 w-3" aria-hidden="true" />
                      )}
                      {Math.abs(metric.change)}%
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Last 24 hours</p>
              </CardContent>
            </Card>
          ))
        )}
      </section>

      {/* Charts */}
      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Request Rate</CardTitle>
            <CardDescription>Requests per second over the last 24 hours</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={requestRateData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="timestamp" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                  />
                  <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Error Rate</CardTitle>
            <CardDescription>Error percentage over the last 24 hours</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={errorRateData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="timestamp" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                  />
                  <Line type="monotone" dataKey="value" stroke="hsl(var(--destructive))" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Average Latency</CardTitle>
            <CardDescription>Average response time in milliseconds</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={latencyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="timestamp" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                  />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active Incidents</CardTitle>
            <CardDescription>Current incidents requiring attention</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : incidents.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mb-2 opacity-50" />
                <p>No active incidents</p>
              </div>
            ) : (
              <div className="space-y-3">
                {incidents.map((incident) => (
                  <div key={incident.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                    <Badge
                      variant={incident.severity === 'critical' ? 'destructive' : incident.severity === 'warning' ? 'default' : 'secondary'}
                      className="mt-0.5"
                    >
                      {incident.severity}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{incident.title}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <Server className="h-3 w-3" />
                        <span>{incident.service}</span>
                        <span>•</span>
                        <time dateTime={incident.startTime}>
                          {new Date(incident.startTime).toLocaleTimeString()}
                        </time>
                      </div>
                    </div>
                    <Link href={`/observability/incidents/${incident.id}`}>
                      <Button variant="ghost" size="sm">
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                ))}
                <Link href="/observability/incidents">
                  <Button variant="outline" className="w-full">
                    View All Incidents
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Service Health */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Service Health Status</CardTitle>
              <CardDescription>Current status and metrics for each service</CardDescription>
            </div>
            <Link href="/observability/services">
              <Button variant="outline" size="sm">
                View All Services
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {services.map((service) => (
                <Link key={service.name} href={service.url}>
                  <div className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className={cn('h-3 w-3 rounded-full', STATUS_COLORS[service.status])} />
                        <span className="sr-only">{STATUS_LABELS[service.status]}</span>
                      </div>
                      <div>
                        <p className="font-semibold">{service.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {service.requestRate} req/s • {service.errorRate}% errors • {service.avgLatency}ms avg
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-sm font-medium">P95 Latency</p>
                        <p className="text-xs text-muted-foreground">{service.p95Latency}ms</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Links */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Links</CardTitle>
          <CardDescription>Navigate to observability tools</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Link href="/observability/logs">
              <Button variant="outline" className="w-full justify-start gap-2">
                <Database className="h-4 w-4" />
                Log Viewer
              </Button>
            </Link>
            <Link href="/observability/traces">
              <Button variant="outline" className="w-full justify-start gap-2">
                <Activity className="h-4 w-4" />
                Trace Viewer
              </Button>
            </Link>
            <Link href="/observability/metrics">
              <Button variant="outline" className="w-full justify-start gap-2">
                <Gauge className="h-4 w-4" />
                Metrics Explorer
              </Button>
            </Link>
            <Link href="/observability/alerts">
              <Button variant="outline" className="w-full justify-start gap-2">
                <AlertTriangle className="h-4 w-4" />
                Alert Management
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

