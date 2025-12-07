'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Search,
  Filter,
  Download,
  RefreshCw,
  AlertCircle,
  Info,
  XCircle,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SimulationRun } from '@/app/demo/org/simulation/page'

type LogLevel = 'info' | 'warn' | 'error' | 'success'
type LogEntry = {
  id: string
  timestamp: Date
  level: LogLevel
  module: string
  message: string
  fault?: string
  result?: 'success' | 'failure'
  metadata?: Record<string, unknown>
}

interface LogViewerProps {
  run: SimulationRun | null
  runs: SimulationRun[]
  onRunSelect: (run: SimulationRun) => void
}

export function LogViewer({ run, runs, onRunSelect }: LogViewerProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedModule, setSelectedModule] = useState<string>('all')
  const [selectedLevel, setSelectedLevel] = useState<string>('all')
  const [selectedFault, setSelectedFault] = useState<string>('all')
  const [selectedResult, setSelectedResult] = useState<string>('all')
  const [timeRange, setTimeRange] = useState<string>('all')
  const [autoScroll, setAutoScroll] = useState(true)

  // Generate mock logs for the selected run
  const logs = useMemo(() => {
    if (!run) return []

    const mockLogs: LogEntry[] = []
    const modules = run.scenarioId.includes('preset')
      ? ['auth', 'credential']
      : ['enrollment', 'credential', 'privilege']

    // Generate logs based on run status and results
    if (run.status === 'completed' && run.results) {
      Object.entries(run.results.moduleResponses || {}).forEach(([module, response], index) => {
        mockLogs.push({
          id: `log-${index}-start`,
          timestamp: new Date((run.startTime?.getTime() || Date.now()) + index * 100),
          level: 'info',
          module,
          message: `Starting module execution: ${module}`,
        })

        if (response.success) {
          mockLogs.push({
            id: `log-${index}-success`,
            timestamp: new Date((run.startTime?.getTime() || Date.now()) + index * 100 + 50),
            level: 'success',
            module,
            message: `Module ${module} completed successfully`,
            result: 'success',
            metadata: { latency: response.latency },
          })
        } else {
          mockLogs.push({
            id: `log-${index}-error`,
            timestamp: new Date((run.startTime?.getTime() || Date.now()) + index * 100 + 50),
            level: 'error',
            module,
            message: `Module ${module} failed: ${response.errors?.join(', ') || 'Unknown error'}`,
            result: 'failure',
          })
        }
      })

      // Add fault-related logs if faults were configured
      if (run.faultConfig && run.faultConfig.length > 0) {
        run.faultConfig.forEach((fault, index) => {
          mockLogs.push({
            id: `log-fault-${index}`,
            timestamp: new Date((run.startTime?.getTime() || Date.now()) + 500 + index * 100),
            level: fault.severity === 'critical' ? 'error' : 'warn',
            module: fault.targetModule || 'system',
            message: `Fault injected: ${fault.type} (severity: ${fault.severity})`,
            fault: fault.type,
            metadata: { probability: fault.probability },
          })
        })
      }

      // Add event logs
      run.results.events?.forEach((event, index) => {
        mockLogs.push({
          id: `log-event-${index}`,
          timestamp: new Date((run.startTime?.getTime() || Date.now()) + event.timestamp),
          level: 'info',
          module: event.module,
          message: `Event: ${event.type}`,
          metadata: event.data,
        })
      })
    } else if (run.status === 'running') {
      // Generate running logs
      modules.forEach((module, index) => {
        mockLogs.push({
          id: `log-running-${index}`,
          timestamp: new Date((run.startTime?.getTime() || Date.now()) + index * 200),
          level: 'info',
          module,
          message: `Processing module: ${module}...`,
        })
      })
    }

    return mockLogs.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
  }, [run])

  const availableModules = useMemo(() => {
    const modules = new Set<string>()
    logs.forEach((log) => modules.add(log.module))
    return Array.from(modules).sort()
  }, [logs])

  const availableFaults = useMemo(() => {
    const faults = new Set<string>()
    logs.forEach((log) => {
      if (log.fault) faults.add(log.fault)
    })
    return Array.from(faults).sort()
  }, [logs])

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Search filter
      if (searchQuery && !log.message.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false
      }

      // Module filter
      if (selectedModule !== 'all' && log.module !== selectedModule) {
        return false
      }

      // Level filter
      if (selectedLevel !== 'all' && log.level !== selectedLevel) {
        return false
      }

      // Fault filter
      if (selectedFault !== 'all' && log.fault !== selectedFault) {
        return false
      }

      // Result filter
      if (selectedResult !== 'all' && log.result !== selectedResult) {
        return false
      }

      // Time range filter
      if (timeRange !== 'all' && run?.startTime) {
        const now = Date.now()
        const logTime = log.timestamp.getTime()
        const startTime = run.startTime.getTime()
        const rangeMs = {
          '1m': 60 * 1000,
          '5m': 5 * 60 * 1000,
          '15m': 15 * 60 * 1000,
          '1h': 60 * 60 * 1000,
        }[timeRange] || 0

        if (rangeMs > 0 && (now - logTime > rangeMs || logTime < startTime)) {
          return false
        }
      }

      return true
    })
  }, [logs, searchQuery, selectedModule, selectedLevel, selectedFault, selectedResult, timeRange, run])

  const logStats = useMemo(() => {
    return {
      total: logs.length,
      info: logs.filter((l) => l.level === 'info').length,
      warn: logs.filter((l) => l.level === 'warn').length,
      error: logs.filter((l) => l.level === 'error').length,
      success: logs.filter((l) => l.level === 'success').length,
    }
  }, [logs])

  const getLevelIcon = (level: LogLevel) => {
    switch (level) {
      case 'info':
        return Info
      case 'warn':
        return AlertCircle
      case 'error':
        return XCircle
      case 'success':
        return CheckCircle2
      default:
        return Info
    }
  }

  const getLevelColor = (level: LogLevel) => {
    switch (level) {
      case 'info':
        return 'text-blue-600 bg-blue-50 border-blue-200'
      case 'warn':
        return 'text-amber-600 bg-amber-50 border-amber-200'
      case 'error':
        return 'text-rose-600 bg-rose-50 border-rose-200'
      case 'success':
        return 'text-green-600 bg-green-50 border-green-200'
      default:
        return 'text-muted-foreground bg-muted'
    }
  }

  const handleExportLogs = () => {
    const logText = filteredLogs
      .map((log) => {
        return `[${log.timestamp.toISOString()}] [${log.level.toUpperCase()}] [${log.module}] ${log.message}`
      })
      .join('\n')

    const blob = new Blob([logText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `simulation-logs-${run?.id || 'export'}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (!run) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Run Selected</h3>
            <p className="text-sm text-muted-foreground">
              Select a simulation run to view logs
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Log Filters</CardTitle>
          <CardDescription>Filter logs by module, level, fault, result, and time range</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="search">Search</Label>
              <div className="relative mt-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search logs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="module">Module</Label>
              <Select value={selectedModule} onValueChange={setSelectedModule}>
                <SelectTrigger id="module" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Modules</SelectItem>
                  {availableModules.map((module) => (
                    <SelectItem key={module} value={module}>
                      {module}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="level">Level</Label>
              <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                <SelectTrigger id="level" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warn">Warning</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {availableFaults.length > 0 && (
              <div>
                <Label htmlFor="fault">Fault</Label>
                <Select value={selectedFault} onValueChange={setSelectedFault}>
                  <SelectTrigger id="fault" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Faults</SelectItem>
                    {availableFaults.map((fault) => (
                      <SelectItem key={fault} value={fault}>
                        {fault}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label htmlFor="result">Result</Label>
              <Select value={selectedResult} onValueChange={setSelectedResult}>
                <SelectTrigger id="result" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Results</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="failure">Failure</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="timeRange">Time Range</Label>
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger id="timeRange" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="1m">Last 1 minute</SelectItem>
                  <SelectItem value="5m">Last 5 minutes</SelectItem>
                  <SelectItem value="15m">Last 15 minutes</SelectItem>
                  <SelectItem value="1h">Last 1 hour</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <div className="flex items-center gap-2">
              <Checkbox
                id="auto-scroll"
                checked={autoScroll}
                onCheckedChange={(checked) => setAutoScroll(checked === true)}
              />
              <Label htmlFor="auto-scroll" className="text-sm cursor-pointer">
                Auto-scroll to latest
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExportLogs}>
                <Download className="h-4 w-4 mr-2" />
                Export Logs
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Log Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Log Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="text-2xl font-bold">{logStats.total}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Info</p>
              <p className="text-2xl font-bold text-blue-600">{logStats.info}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Warnings</p>
              <p className="text-2xl font-bold text-amber-600">{logStats.warn}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Errors</p>
              <p className="text-2xl font-bold text-rose-600">{logStats.error}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Success</p>
              <p className="text-2xl font-bold text-green-600">{logStats.success}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs Display */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Log Entries</CardTitle>
              <CardDescription>
                Showing {filteredLogs.length} of {logs.length} logs
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {filteredLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No logs match the current filters
              </div>
            ) : (
              filteredLogs.map((log) => {
                const Icon = getLevelIcon(log.level)

                return (
                  <div
                    key={log.id}
                    className={cn(
                      'p-3 border rounded-lg text-sm',
                      getLevelColor(log.level),
                      'transition-colors hover:shadow-sm'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <Icon className="h-4 w-4 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-mono text-xs">
                            {log.timestamp.toLocaleTimeString()}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {log.module}
                          </Badge>
                          {log.fault && (
                            <Badge variant="outline" className="text-xs bg-amber-50">
                              Fault: {log.fault}
                            </Badge>
                          )}
                          {log.result && (
                            <Badge
                              variant={log.result === 'success' ? 'default' : 'destructive'}
                              className="text-xs"
                            >
                              {log.result}
                            </Badge>
                          )}
                        </div>
                        <div className="font-medium">{log.message}</div>
                        {log.metadata && Object.keys(log.metadata).length > 0 && (
                          <div className="mt-2 text-xs opacity-75">
                            <pre className="bg-black/10 p-2 rounded overflow-x-auto">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

