'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Clock,
  Download,
  ExternalLink,
  FileText,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
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
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

type LogEntry = {
  id: string
  timestamp: string
  level: 'error' | 'warn' | 'info' | 'debug'
  message: string
  service: string
  correlationId: string
  metadata?: Record<string, string>
}

type TimeSeriesPoint = {
  timestamp: string
  latency: number
  errorRate: number
}

export default function ServiceStatusPage() {
  const params = useParams()
  const serviceName = params.serviceName as string
  const [loading, setLoading] = useState(true)
  const [latencyData, setLatencyData] = useState<TimeSeriesPoint[]>([])
  const [errorRateData, setErrorRateData] = useState<TimeSeriesPoint[]>([])
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [logLevelFilter, setLogLevelFilter] = useState<string>('all')
  const [logSearch, setLogSearch] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Generate latency data
      const now = Date.now()
      const latData: TimeSeriesPoint[] = []
      for (let i = 23; i >= 0; i--) {
        const timestamp = new Date(now - i * 60 * 60 * 1000).toISOString()
        latData.push({
          timestamp: new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          latency: Math.floor(Math.random() * 200) + 100,
          errorRate: Math.random() * 2,
        })
      }
      setLatencyData(latData)
      setErrorRateData(latData)

      // Generate mock logs
      const mockLogs: LogEntry[] = []
      const levels: LogEntry['level'][] = ['error', 'warn', 'info', 'debug']
      for (let i = 0; i < 50; i++) {
        const level = levels[Math.floor(Math.random() * levels.length)]
        mockLogs.push({
          id: `log-${i}`,
          timestamp: new Date(now - i * 5 * 60 * 1000).toISOString(),
          level,
          message: `Sample log message for ${serviceName} service - ${level} level`,
          service: serviceName,
          correlationId: `corr-${Math.random().toString(36).slice(2, 10)}`,
          metadata: {
            method: ['GET', 'POST', 'PUT', 'DELETE'][Math.floor(Math.random() * 4)],
            path: '/api/v1/endpoint',
            statusCode: String(Math.floor(Math.random() * 400) + 100),
          },
        })
      }
      setLogs(mockLogs)
      setLoading(false)
    }

    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [serviceName])

  const filteredLogs = logs.filter((log) => {
    if (logLevelFilter !== 'all' && log.level !== logLevelFilter) return false
    if (logSearch && !log.message.toLowerCase().includes(logSearch.toLowerCase()) &&
        !log.correlationId.toLowerCase().includes(logSearch.toLowerCase())) {
      return false
    }
    return true
  })

  const levelColors: Record<LogEntry['level'], string> = {
    error: 'bg-red-500 text-white',
    warn: 'bg-yellow-500 text-white',
    info: 'bg-blue-500 text-white',
    debug: 'bg-gray-500 text-white',
  }

  const exportLogs = () => {
    const csv = [
      ['Timestamp', 'Level', 'Message', 'Service', 'Correlation ID'].join(','),
      ...filteredLogs.map((log) =>
        [
          log.timestamp,
          log.level,
          `"${log.message.replace(/"/g, '""')}"`,
          log.service,
          log.correlationId,
        ].join(',')
      ),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${serviceName}-logs-${new Date().toISOString()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="container mx-auto space-y-6 py-8">
      <header className="space-y-2">
        <div className="flex items-center gap-4">
          <Link href="/observability/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight capitalize">{serviceName}</h1>
            <p className="text-muted-foreground">Service metrics, logs, and traces</p>
          </div>
          <Link href={`/observability/traces?service=${serviceName}`}>
            <Button variant="outline">
              <Activity className="h-4 w-4 mr-2" />
              View Traces
            </Button>
          </Link>
        </div>
      </header>

      {/* Metrics Cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Latency</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {latencyData.length > 0
                    ? Math.round(latencyData.reduce((sum, d) => sum + d.latency, 0) / latencyData.length)
                    : 0}
                  ms
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  <TrendingDown className="h-3 w-3 text-green-600" />
                  5.2% from last hour
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {errorRateData.length > 0
                    ? (errorRateData.reduce((sum, d) => sum + d.errorRate, 0) / errorRateData.length).toFixed(2)
                    : 0}
                  %
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  <TrendingUp className="h-3 w-3 text-red-600" />
                  1.3% from last hour
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Request Rate</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">450 req/s</div>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  <TrendingUp className="h-3 w-3 text-green-600" />
                  12.5% from last hour
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uptime</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">99.95%</div>
                <p className="text-xs text-muted-foreground mt-1">Last 30 days</p>
              </>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Charts */}
      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Latency Over Time</CardTitle>
            <CardDescription>P50, P95, and P99 latency metrics</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={latencyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="timestamp" className="text-xs" />
                  <YAxis className="text-xs" label={{ value: 'ms', angle: -90, position: 'insideLeft' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="latency"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary))"
                    fillOpacity={0.2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Error Rate Over Time</CardTitle>
            <CardDescription>Error percentage by time</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={errorRateData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="timestamp" className="text-xs" />
                  <YAxis className="text-xs" label={{ value: '%', angle: -90, position: 'insideLeft' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                  />
                  <Line type="monotone" dataKey="errorRate" stroke="hsl(var(--destructive))" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Logs */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Recent Logs</CardTitle>
              <CardDescription>Filter and search through service logs</CardDescription>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Search logs..."
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                className="w-full sm:w-64"
              />
              <Select value={logLevelFilter} onValueChange={setLogLevelFilter}>
                <SelectTrigger className="w-full sm:w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="warn">Warning</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="debug">Debug</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={exportLogs}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No logs found matching your filters</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Timestamp</TableHead>
                    <TableHead className="w-[100px]">Level</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead className="w-[180px]">Correlation ID</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.slice(0, 20).map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-xs">
                        {new Date(log.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge className={cn('text-xs', levelColors[log.level])}>{log.level}</Badge>
                      </TableCell>
                      <TableCell className="max-w-md truncate">{log.message}</TableCell>
                      <TableCell>
                        <Link
                          href={`/observability/traces?correlationId=${log.correlationId}`}
                          className="font-mono text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          {log.correlationId.slice(0, 12)}...
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={`/observability/traces/${log.correlationId}`}>
                          <Button variant="ghost" size="sm">
                            View Trace
                            <ArrowRight className="h-3 w-3 ml-1" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {!loading && filteredLogs.length > 20 && (
            <div className="mt-4 text-center">
              <p className="text-sm text-muted-foreground">
                Showing 20 of {filteredLogs.length} logs. <Link href="/observability/logs" className="text-primary hover:underline">View all logs</Link>
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

