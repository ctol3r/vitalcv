'use client'

import { useMemo, useState } from 'react'
import { FileText, Search, Calendar, Download, AlertCircle, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type LogSource = 'TEFCA' | 'LICENSING_BOARD' | 'BLOCKCHAIN' | 'FHIR'

type LogLevel = 'info' | 'success' | 'warning' | 'error'

type IntegrationLog = {
  id: string
  timestamp: string
  date: string
  source: LogSource
  level: LogLevel
  operation: string
  request?: {
    method: string
    url: string
    headers?: Record<string, string>
    body?: unknown
  }
  response?: {
    status: number
    statusText: string
    body?: unknown
  }
  error?: {
    message: string
    code?: string
    stack?: string
  }
  duration?: number // in milliseconds
}

type IntegrationLogsProps = {
  connectorId?: string
}

export function IntegrationLogs({ connectorId }: IntegrationLogsProps) {
  const [logs, setLogs] = useState<IntegrationLog[]>(buildMockLogs())
  const [filteredLogs, setFilteredLogs] = useState<IntegrationLog[]>(logs)
  const [selectedLog, setSelectedLog] = useState<IntegrationLog | null>(null)
  const [sourceFilter, setSourceFilter] = useState<LogSource | 'ALL'>('ALL')
  const [levelFilter, setLevelFilter] = useState<LogLevel | 'ALL'>('ALL')
  const [dateFilter, setDateFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  useMemo(() => {
    let filtered = logs

    if (connectorId) {
      // Filter by connector if provided
      filtered = filtered.filter((log) => log.source === connectorId as LogSource)
    }

    if (sourceFilter !== 'ALL') {
      filtered = filtered.filter((log) => log.source === sourceFilter)
    }

    if (levelFilter !== 'ALL') {
      filtered = filtered.filter((log) => log.level === levelFilter)
    }

    if (dateFilter) {
      filtered = filtered.filter((log) => log.date === dateFilter)
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (log) =>
          log.operation.toLowerCase().includes(query) ||
          log.request?.url.toLowerCase().includes(query) ||
          log.error?.message.toLowerCase().includes(query),
      )
    }

    setFilteredLogs(filtered)
  }, [logs, connectorId, sourceFilter, levelFilter, dateFilter, searchQuery])

  const handleExport = () => {
    const csv = [
      ['Timestamp', 'Source', 'Level', 'Operation', 'Status', 'Duration'].join(','),
      ...filteredLogs.map((log) =>
        [
          log.timestamp,
          log.source,
          log.level,
          log.operation,
          log.response?.status || log.error?.code || 'N/A',
          log.duration || 'N/A',
        ].join(','),
      ),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `integration-logs-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const uniqueDates = useMemo(() => {
    return Array.from(new Set(logs.map((log) => log.date))).sort().reverse()
  }, [logs])

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" aria-hidden="true" />
              Integration Logs
            </CardTitle>
            <CardDescription>Detailed logs of connector operations: requests, responses, errors. Search by date and external source.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Input
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </div>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as LogSource | 'ALL')}
            className="rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="ALL">All Sources</option>
            <option value="TEFCA">TEFCA</option>
            <option value="LICENSING_BOARD">Licensing Board</option>
            <option value="BLOCKCHAIN">Blockchain</option>
            <option value="FHIR">FHIR</option>
          </select>
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value as LogLevel | 'ALL')}
            className="rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="ALL">All Levels</option>
            <option value="info">Info</option>
            <option value="success">Success</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
          </select>
          <div className="relative">
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="pl-9"
              placeholder="Filter by date"
            />
            <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </div>
        </div>

        {/* Quick Date Filters */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={dateFilter === '' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDateFilter('')}
          >
            All Dates
          </Button>
          {uniqueDates.slice(0, 5).map((date) => (
            <Button
              key={date}
              variant={dateFilter === date ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDateFilter(date)}
            >
              {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </Button>
          ))}
        </div>

        {/* Logs Table */}
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Operation</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No logs match the current filters
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => (
                  <TableRow key={log.id} className="hover:bg-muted/50">
                    <TableCell className="text-muted-foreground text-sm font-mono">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {log.timestamp}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {log.source.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{log.operation}</TableCell>
                    <TableCell>
                      <LevelBadge level={log.level} />
                    </TableCell>
                    <TableCell>
                      {log.response ? (
                        <Badge
                          variant={log.response.status >= 400 ? 'destructive' : 'default'}
                          className={log.response.status < 400 ? 'bg-emerald-100 text-emerald-800' : ''}
                        >
                          {log.response.status} {log.response.statusText}
                        </Badge>
                      ) : log.error ? (
                        <Badge variant="destructive">Error</Badge>
                      ) : (
                        <Badge variant="secondary">N/A</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {log.duration ? `${log.duration}ms` : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedLog(log)}
                      >
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {filteredLogs.length > 0 && (
          <p className="text-sm text-muted-foreground text-center">
            Showing {filteredLogs.length} log{filteredLogs.length !== 1 ? 's' : ''}
          </p>
        )}
      </CardContent>

      {/* Log Detail Dialog */}
      <Dialog open={Boolean(selectedLog)} onOpenChange={(open) => !open && setSelectedLog(null)}>
        {selectedLog && (
          <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Log Details</DialogTitle>
              <DialogDescription>
                {selectedLog.operation} • {selectedLog.timestamp}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-semibold text-muted-foreground mb-1">Source</p>
                  <Badge variant="outline" className="capitalize">
                    {selectedLog.source.replace('_', ' ')}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-semibold text-muted-foreground mb-1">Level</p>
                  <LevelBadge level={selectedLog.level} />
                </div>
                {selectedLog.duration && (
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground mb-1">Duration</p>
                    <p className="text-sm">{selectedLog.duration}ms</p>
                  </div>
                )}
              </div>

              {selectedLog.request && (
                <div>
                  <p className="text-sm font-semibold text-muted-foreground mb-2">Request</p>
                  <div className="rounded-md border bg-muted/50 p-3 space-y-2">
                    <div>
                      <Badge variant="outline" className="mr-2">{selectedLog.request.method}</Badge>
                      <span className="text-sm font-mono">{selectedLog.request.url}</span>
                    </div>
                    {selectedLog.request.headers && (
                      <details className="text-sm">
                        <summary className="cursor-pointer text-muted-foreground">Headers</summary>
                        <pre className="mt-2 p-2 bg-background rounded text-xs overflow-x-auto">
                          {JSON.stringify(selectedLog.request.headers, null, 2)}
                        </pre>
                      </details>
                    )}
                    {selectedLog.request.body && (
                      <details className="text-sm">
                        <summary className="cursor-pointer text-muted-foreground">Body</summary>
                        <pre className="mt-2 p-2 bg-background rounded text-xs overflow-x-auto">
                          {JSON.stringify(selectedLog.request.body, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              )}

              {selectedLog.response && (
                <div>
                  <p className="text-sm font-semibold text-muted-foreground mb-2">Response</p>
                  <div className="rounded-md border bg-muted/50 p-3 space-y-2">
                    <div>
                      <Badge variant={selectedLog.response.status >= 400 ? 'destructive' : 'default'}>
                        {selectedLog.response.status} {selectedLog.response.statusText}
                      </Badge>
                    </div>
                    {selectedLog.response.body && (
                      <details className="text-sm">
                        <summary className="cursor-pointer text-muted-foreground">Body</summary>
                        <pre className="mt-2 p-2 bg-background rounded text-xs overflow-x-auto">
                          {JSON.stringify(selectedLog.response.body, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              )}

              {selectedLog.error && (
                <div>
                  <p className="text-sm font-semibold text-muted-foreground mb-2">Error</p>
                  <div className="rounded-md border border-rose-200 bg-rose-50 p-3 space-y-2">
                    <p className="text-sm font-semibold text-rose-800">{selectedLog.error.message}</p>
                    {selectedLog.error.code && (
                      <p className="text-xs text-muted-foreground">Code: {selectedLog.error.code}</p>
                    )}
                    {selectedLog.error.stack && (
                      <details className="text-sm">
                        <summary className="cursor-pointer text-muted-foreground">Stack Trace</summary>
                        <pre className="mt-2 p-2 bg-background rounded text-xs overflow-x-auto">
                          {selectedLog.error.stack}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>
    </Card>
  )
}

function LevelBadge({ level }: { level: LogLevel }) {
  const config = {
    info: { label: 'Info', icon: Info, className: 'bg-blue-100 text-blue-800' },
    success: { label: 'Success', icon: CheckCircle2, className: 'bg-emerald-100 text-emerald-800' },
    warning: { label: 'Warning', icon: AlertCircle, className: 'bg-amber-100 text-amber-800' },
    error: { label: 'Error', icon: XCircle, className: 'bg-rose-100 text-rose-800' },
  }[level]

  const Icon = config.icon

  return (
    <Badge variant="outline" className={`flex items-center gap-1 w-fit ${config.className}`}>
      {Icon && <Icon className="h-3 w-3" />}
      {config.label}
    </Badge>
  )
}

function buildMockLogs(): IntegrationLog[] {
  const now = new Date()
  const logs: IntegrationLog[] = []

  const sources: LogSource[] = ['TEFCA', 'LICENSING_BOARD', 'BLOCKCHAIN', 'FHIR']
  const operations = [
    'GET /api/credentials',
    'POST /api/verify',
    'PUT /api/update',
    'DELETE /api/revoke',
    'GET /api/status',
    'POST /api/sync',
  ]

  for (let i = 0; i < 50; i++) {
    const hoursAgo = Math.floor(i / 5)
    const timestamp = new Date(now.getTime() - hoursAgo * 3600000 - (i % 5) * 12 * 60000)
    const source = sources[Math.floor(Math.random() * sources.length)]
    const operation = operations[Math.floor(Math.random() * operations.length)]
    const isError = Math.random() < 0.15
    const isWarning = Math.random() < 0.2 && !isError
    const level: LogLevel = isError ? 'error' : isWarning ? 'warning' : Math.random() < 0.5 ? 'success' : 'info'

    const log: IntegrationLog = {
      id: `log-${i}`,
      timestamp: timestamp.toLocaleTimeString(),
      date: timestamp.toISOString().split('T')[0],
      source,
      level,
      operation,
      request: {
        method: operation.split(' ')[0],
        url: `https://${source.toLowerCase()}.example.com${operation.split(' ')[1]}`,
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ***',
        },
      },
      duration: Math.floor(Math.random() * 500) + 50,
    }

    if (isError) {
      log.error = {
        message: 'Connection timeout',
        code: 'ETIMEDOUT',
        stack: 'Error: Connection timeout\n    at Socket.<anonymous> (...)\n    at ...',
      }
    } else {
      log.response = {
        status: isWarning ? 429 : Math.random() < 0.9 ? 200 : 201,
        statusText: isWarning ? 'Too Many Requests' : 'OK',
        body: { success: true, data: {} },
      }
    }

    logs.push(log)
  }

  return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}

