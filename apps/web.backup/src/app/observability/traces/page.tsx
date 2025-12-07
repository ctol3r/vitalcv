'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Activity,
  ArrowRight,
  Calendar,
  Clock,
  Search,
  Server,
} from 'lucide-react'

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

type Trace = {
  traceId: string
  service: string
  startTime: string
  duration: number
  spanCount: number
  status: 'success' | 'error' | 'warning'
}

export default function TracesPage() {
  const [loading, setLoading] = useState(true)
  const [traces, setTraces] = useState<Trace[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [serviceFilter, setServiceFilter] = useState<string>('all')
  const [correlationId, setCorrelationId] = useState<string>('')

  useEffect(() => {
    const fetchTraces = async () => {
      setLoading(true)
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Generate mock traces
      const mockTraces: Trace[] = []
      const services = ['issuer-api', 'verifier-api', 'api', 'authz']
      const now = Date.now()

      for (let i = 0; i < 100; i++) {
        const service = services[Math.floor(Math.random() * services.length)]
        const duration = Math.floor(Math.random() * 1000) + 100
        const statuses: Trace['status'][] = ['success', 'success', 'success', 'error', 'warning']
        const status = statuses[Math.floor(Math.random() * statuses.length)]

        mockTraces.push({
          traceId: `trace-${Math.random().toString(36).slice(2, 18)}`,
          service,
          startTime: new Date(now - i * 5 * 60 * 1000).toISOString(),
          duration,
          spanCount: Math.floor(Math.random() * 20) + 3,
          status,
        })
      }

      setTraces(mockTraces)
      setLoading(false)
    }

    fetchTraces()

    // Check for correlationId in URL
    const params = new URLSearchParams(window.location.search)
    const correlationIdParam = params.get('correlationId')
    if (correlationIdParam) {
      setCorrelationId(correlationIdParam)
    }
  }, [])

  const filteredTraces = traces.filter((trace) => {
    if (serviceFilter !== 'all' && trace.service !== serviceFilter) return false
    if (searchTerm && !trace.traceId.toLowerCase().includes(searchTerm.toLowerCase())) return false
    if (correlationId && !trace.traceId.toLowerCase().includes(correlationId.toLowerCase())) return false
    return true
  })

  const statusColors: Record<Trace['status'], string> = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    warning: 'bg-yellow-500',
  }

  const statusLabels: Record<Trace['status'], string> = {
    success: 'Success',
    error: 'Error',
    warning: 'Warning',
  }

  const services = Array.from(new Set(traces.map((t) => t.service)))

  return (
    <div className="container mx-auto space-y-6 py-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Trace Viewer</h1>
        <p className="text-muted-foreground">View and search distributed traces</p>
      </header>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter traces by service, correlation ID, or trace ID</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <label htmlFor="search" className="text-sm font-medium">
                Search Trace ID
              </label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search trace ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="service" className="text-sm font-medium">
                Service
              </label>
              <Select value={serviceFilter} onValueChange={setServiceFilter}>
                <SelectTrigger id="service">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Services</SelectItem>
                  {services.map((service) => (
                    <SelectItem key={service} value={service}>
                      {service}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label htmlFor="correlation" className="text-sm font-medium">
                Correlation ID
              </label>
              <Input
                id="correlation"
                placeholder="Correlation ID..."
                value={correlationId}
                onChange={(e) => setCorrelationId(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Traces List */}
      <Card>
        <CardHeader>
          <CardTitle>Traces ({filteredTraces.length})</CardTitle>
          <CardDescription>Click on a trace to view details</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredTraces.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No traces found matching your filters</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Trace ID</TableHead>
                    <TableHead className="w-[150px]">Service</TableHead>
                    <TableHead className="w-[180px]">Start Time</TableHead>
                    <TableHead className="w-[120px]">Duration</TableHead>
                    <TableHead className="w-[100px]">Spans</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTraces.slice(0, 50).map((trace) => (
                    <TableRow key={trace.traceId}>
                      <TableCell>
                        <code className="text-xs font-mono">{trace.traceId.slice(0, 16)}...</code>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{trace.service}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {new Date(trace.startTime).toLocaleString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {trace.duration}ms
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{trace.spanCount}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={cn('text-xs', statusColors[trace.status])}
                        >
                          {statusLabels[trace.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Link href={`/observability/traces/${trace.traceId}`}>
                          <Button variant="ghost" size="sm">
                            View
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
          {!loading && filteredTraces.length > 50 && (
            <div className="mt-4 text-center">
              <p className="text-sm text-muted-foreground">
                Showing 50 of {filteredTraces.length} traces
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

