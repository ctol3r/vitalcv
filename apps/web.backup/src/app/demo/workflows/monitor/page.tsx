'use client'

import { useEffect, useState, useMemo } from 'react'
import { Activity, Clock, Filter, RefreshCw, Search, AlertCircle, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import type { WorkflowExecution, StepStatus } from '@/types/workflow'

type ExecutionStatus = StepStatus | 'all'

interface ExecutionFilters {
  status: ExecutionStatus
  workflowId?: string
  search: string
}

export default function WorkflowMonitorDashboardPage() {
  const [executions, setExecutions] = useState<WorkflowExecution[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedExecution, setSelectedExecution] = useState<WorkflowExecution | null>(null)
  const [filters, setFilters] = useState<ExecutionFilters>({
    status: 'all',
    search: '',
  })

  useEffect(() => {
    loadExecutions()
    const interval = setInterval(loadExecutions, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const loadExecutions = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/demo/workflows/executions')
      if (!response.ok) {
        throw new Error(`Failed to load executions (${response.status})`)
      }
      const data = await response.json()
      setExecutions(data.executions || [])
    } catch (err: any) {
      setError(err.message || 'Unable to load workflow executions')
    } finally {
      setLoading(false)
    }
  }

  const filteredExecutions = useMemo(() => {
    return executions.filter((exec) => {
      if (filters.status !== 'all' && exec.status !== filters.status) return false
      if (filters.workflowId && exec.workflowId !== filters.workflowId) return false
      if (filters.search.trim()) {
        const searchLower = filters.search.toLowerCase()
        const matchesSearch =
          exec.id.toLowerCase().includes(searchLower) ||
          exec.workflowId.toLowerCase().includes(searchLower) ||
          exec.triggerType.toLowerCase().includes(searchLower) ||
          exec.stepExecutions.some((step) => step.stepName.toLowerCase().includes(searchLower))
        if (!matchesSearch) return false
      }
      return true
    })
  }, [executions, filters])

  const metrics = useMemo(() => {
    const total = executions.length
    const running = executions.filter((e) => e.status === 'running').length
    const completed = executions.filter((e) => e.status === 'completed').length
    const failed = executions.filter((e) => e.status === 'failed').length
    const avgDuration = executions
      .filter((e) => e.completedAt && e.startedAt)
      .reduce((sum, e) => {
        const duration = new Date(e.completedAt!).getTime() - new Date(e.startedAt).getTime()
        return sum + duration
      }, 0) / Math.max(completed, 1)

    return {
      total,
      running,
      completed,
      failed,
      avgDuration: avgDuration / 1000, // Convert to seconds
    }
  }, [executions])

  const getStatusBadge = (status: StepStatus) => {
    const variants: Record<StepStatus, { variant: 'default' | 'destructive' | 'secondary' | 'outline'; icon: typeof CheckCircle2 }> = {
      completed: { variant: 'default', icon: CheckCircle2 },
      failed: { variant: 'destructive', icon: XCircle },
      running: { variant: 'secondary', icon: Loader2 },
      pending: { variant: 'outline', icon: Clock },
      skipped: { variant: 'outline', icon: XCircle },
    }
    const config = variants[status] || variants.pending
    const Icon = config.icon
    return (
      <Badge variant={config.variant} className="flex items-center gap-1 w-fit">
        {status === 'running' && <Icon className="h-3 w-3 animate-spin" />}
        {status !== 'running' && <Icon className="h-3 w-3" />}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    )
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${(ms / 60000).toFixed(1)}m`
  }

  return (
    <div className="container mx-auto space-y-6 py-8">
      <header className="space-y-3">
        <p className="text-sm text-muted-foreground">Demo &raquo; Workflows &raquo; Monitor</p>
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Activity className="h-7 w-7 text-primary" aria-hidden="true" />
              Workflow Monitor
            </h1>
            <p className="text-muted-foreground max-w-2xl">
              Monitor workflow executions: view status, duration, triggers, errors, and detailed execution logs.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={loadExecutions}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Executions</CardTitle>
            <Activity className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.total}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Running</CardTitle>
            <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.running}</div>
            <p className="text-xs text-muted-foreground">Currently executing</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.completed}</div>
            <p className="text-xs text-muted-foreground">Successfully finished</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <XCircle className="h-5 w-5 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.failed}</div>
            <p className="text-xs text-muted-foreground">Errors encountered</p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
          <CardDescription>Filter executions by status, workflow, or search</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Status</span>
            <Select
              value={filters.status}
              onValueChange={(value) => setFilters({ ...filters, status: value as ExecutionStatus })}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="running">Running</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="skipped">Skipped</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by execution ID, workflow ID, or step name..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive" role="alert">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Error
            </CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {loading ? (
        <div className="py-16 text-center text-muted-foreground">Loading executions...</div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Recent Executions</CardTitle>
            <CardDescription>
              Showing {filteredExecutions.length} of {executions.length} executions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Execution ID</TableHead>
                  <TableHead>Workflow</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Steps</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExecutions.map((exec) => {
                  const duration = exec.completedAt
                    ? new Date(exec.completedAt).getTime() - new Date(exec.startedAt).getTime()
                    : null
                  return (
                    <TableRow key={exec.id}>
                      <TableCell className="font-mono text-xs">{exec.id.slice(0, 8)}…</TableCell>
                      <TableCell className="font-mono text-xs">{exec.workflowId.slice(0, 8)}…</TableCell>
                      <TableCell>{getStatusBadge(exec.status)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{exec.triggerType}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{new Date(exec.startedAt).toLocaleString()}</TableCell>
                      <TableCell className="text-sm">
                        {duration ? formatDuration(duration) : exec.status === 'running' ? 'Running...' : '—'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {exec.stepExecutions.length} step{exec.stepExecutions.length !== 1 ? 's' : ''}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedExecution(exec)}
                        >
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {filteredExecutions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                      No executions match the current filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {selectedExecution && (
        <Dialog open={!!selectedExecution} onOpenChange={(open) => !open && setSelectedExecution(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Execution Details</DialogTitle>
              <DialogDescription>
                Execution ID: <code className="text-xs bg-muted px-1 py-0.5 rounded">{selectedExecution.id}</code>
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-semibold">Status</Label>
                  <div className="mt-1">{getStatusBadge(selectedExecution.status)}</div>
                </div>
                <div>
                  <Label className="text-sm font-semibold">Trigger Type</Label>
                  <div className="mt-1">
                    <Badge variant="outline">{selectedExecution.triggerType}</Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-semibold">Started At</Label>
                  <p className="text-sm mt-1">{new Date(selectedExecution.startedAt).toLocaleString()}</p>
                </div>
                {selectedExecution.completedAt && (
                  <div>
                    <Label className="text-sm font-semibold">Completed At</Label>
                    <p className="text-sm mt-1">{new Date(selectedExecution.completedAt).toLocaleString()}</p>
                  </div>
                )}
              </div>

              {selectedExecution.error && (
                <Card className="border-destructive">
                  <CardHeader>
                    <CardTitle className="text-destructive text-sm">Error</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-xs overflow-auto">{selectedExecution.error}</pre>
                  </CardContent>
                </Card>
              )}

              <div>
                <Label className="text-sm font-semibold mb-2 block">Step Executions</Label>
                <div className="space-y-2">
                  {selectedExecution.stepExecutions.map((step, index) => (
                    <Card key={step.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline">Step {index + 1}</Badge>
                              <span className="font-semibold">{step.stepName}</span>
                              {getStatusBadge(step.status)}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Started: {new Date(step.startedAt).toLocaleString()}
                            </p>
                            {step.completedAt && (
                              <p className="text-xs text-muted-foreground">
                                Duration: {formatDuration(step.duration || 0)}
                              </p>
                            )}
                            {step.error && (
                              <p className="text-xs text-destructive mt-2">Error: {step.error}</p>
                            )}
                          </div>
                        </div>
                        {step.logs && step.logs.length > 0 && (
                          <details className="mt-2">
                            <summary className="text-xs text-muted-foreground cursor-pointer">View Logs</summary>
                            <pre className="text-xs bg-muted p-2 rounded mt-2 overflow-auto max-h-32">
                              {step.logs.join('\n')}
                            </pre>
                          </details>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
