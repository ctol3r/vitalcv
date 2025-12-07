'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Activity, AlertTriangle, Clock, Filter, Play, RefreshCw, TrendingUp, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { QueueHeatmap } from '@/components/supervisor/QueueHeatmap'
import { SignalMonitor } from '@/components/supervisor/SignalMonitor'
import { DecisionDrawer } from '@/components/supervisor/DecisionDrawer'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type SupervisorRunStatus = 'RUNNING' | 'COMPLETED' | 'FAILED' | 'BLOCKED'
type TaskStatus = 'PLANNED' | 'EXECUTED' | 'BLOCKED' | 'PENDING'

interface SupervisorRun {
  id: string
  startedAt: string
  completedAt?: string | null
  status: SupervisorRunStatus
  tasksPlanned: number
  tasksExecuted: number
  tasksBlocked: number
  nextRunPrediction?: string | null
  metadata?: Record<string, any> | null
}

interface SupervisorTask {
  id: string
  runId: string
  queueType: string
  status: TaskStatus
  scheduledAt: string
  executedAt?: string | null
  blockedReason?: string | null
  decisionMetadata?: {
    rulesTriggered?: string[]
    signalsUsed?: Array<{
      type: string
      severity: string
      value: number
    }>
  } | null
}

type SupervisorResponse = {
  runs: SupervisorRun[]
  tasks: SupervisorTask[]
  nextRunPrediction: string | null
}

const QUEUE_TYPES = ['PSV', 'SAFETY', 'DRIFT', 'FUSION', 'NCI', 'MOBILITY', 'EHR_SYNC'] as const

export default function SupervisorDashboardPage() {
  const [runs, setRuns] = useState<SupervisorRun[]>([])
  const [tasks, setTasks] = useState<SupervisorTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<SupervisorRunStatus | 'ALL'>('ALL')
  const [selectedTask, setSelectedTask] = useState<SupervisorTask | null>(null)

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch('/api/demo/org/supervisor', { signal: controller.signal })
        if (!response.ok) {
          throw new Error(`Failed to load supervisor data (${response.status})`)
        }
        const payload = (await response.json()) as SupervisorResponse
        if (!cancelled) {
          setRuns(payload.runs)
          setTasks(payload.tasks)
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message ?? 'Unable to load supervisor data')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()
    const interval = setInterval(load, 30000) // Refresh every 30 seconds
    return () => {
      cancelled = true
      controller.abort()
      clearInterval(interval)
    }
  }, [])

  const filteredRuns = useMemo(() => {
    return runs.filter((run) => {
      if (statusFilter !== 'ALL' && run.status !== statusFilter) return false
      if (search.trim().length > 0) {
        const target = `${run.id} ${run.status}`.toLowerCase()
        if (!target.includes(search.trim().toLowerCase())) return false
      }
      return true
    })
  }, [runs, statusFilter, search])

  const metrics = useMemo(() => {
    const plannedTasks = tasks.filter((t) => t.status === 'PLANNED').length
    const executedTasks = tasks.filter((t) => t.status === 'EXECUTED').length
    const blockedTasks = tasks.filter((t) => t.status === 'BLOCKED').length
    const runningRuns = runs.filter((r) => r.status === 'RUNNING').length

    return {
      totalRuns: runs.length,
      runningRuns,
      plannedTasks,
      executedTasks,
      blockedTasks,
    }
  }, [runs, tasks])

  const handleTaskClick = (task: SupervisorTask) => {
    setSelectedTask(task)
  }

  return (
    <div className="container mx-auto space-y-6 py-8">
      <header className="space-y-3">
        <p className="text-sm text-muted-foreground">Demo &raquo; Org &raquo; Supervisor Dashboard</p>
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Activity className="h-7 w-7 text-primary" aria-hidden="true" />
              Supervisor Dashboard
            </h1>
            <p className="text-muted-foreground max-w-2xl">
              Org-level AI Ops Console: Monitor supervisor runs, planned tasks, executed tasks, blocked tasks, and next-run predictions. SR-friendly interface for operational oversight.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button size="sm" asChild>
              <Link href="/demo/org/supervisor/replay">
                <Play className="h-4 w-4 mr-2" />
                Replay Console
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" aria-live="polite">
        <SummaryCard
          label="Total Runs"
          value={metrics.totalRuns.toString()}
          description="All supervisor runs"
          icon={Activity}
          tone="info"
        />
        <SummaryCard
          label="Running"
          value={metrics.runningRuns.toString()}
          description="Active supervisor runs"
          icon={Clock}
          tone="info"
        />
        <SummaryCard
          label="Planned Tasks"
          value={metrics.plannedTasks.toString()}
          description="Tasks scheduled for execution"
          icon={TrendingUp}
          tone="info"
        />
        <SummaryCard
          label="Blocked Tasks"
          value={metrics.blockedTasks.toString()}
          description="Tasks blocked by dependencies"
          icon={XCircle}
          tone="danger"
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <QueueHeatmap queueTypes={QUEUE_TYPES} />
        <SignalMonitor />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
          <CardDescription>Filter supervisor runs by status or search by ID</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Status</span>
            <div className="flex gap-2">
              {(['ALL', 'RUNNING', 'COMPLETED', 'FAILED', 'BLOCKED'] as const).map((filter) => (
                <Button
                  key={filter}
                  size="sm"
                  variant={statusFilter === filter ? 'default' : 'outline'}
                  onClick={() => setStatusFilter(filter)}
                  aria-pressed={statusFilter === filter}
                >
                  {filter}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex-1">
            <Input
              placeholder="Search by run ID or status"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive" role="alert">
          <CardHeader>
            <CardTitle className="text-destructive">Unable to load supervisor data</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {loading ? (
        <div className="py-16 text-center text-muted-foreground">Loading supervisor data…</div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Supervisor Runs</CardTitle>
              <CardDescription>
                Showing {filteredRuns.length} of {runs.length} runs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Run ID</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Planned</TableHead>
                    <TableHead>Executed</TableHead>
                    <TableHead>Blocked</TableHead>
                    <TableHead>Next Run</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRuns.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell className="font-mono text-xs">{run.id.slice(0, 8)}…</TableCell>
                      <TableCell className="text-sm">{new Date(run.startedAt).toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            run.status === 'COMPLETED'
                              ? 'default'
                              : run.status === 'FAILED'
                                ? 'destructive'
                                : run.status === 'BLOCKED'
                                  ? 'secondary'
                                  : 'outline'
                          }
                        >
                          {run.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{run.tasksPlanned}</TableCell>
                      <TableCell>{run.tasksExecuted}</TableCell>
                      <TableCell>{run.tasksBlocked}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {run.nextRunPrediction ? new Date(run.nextRunPrediction).toLocaleString() : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/demo/org/supervisor/replay?runId=${run.id}`}>View</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredRuns.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                        No supervisor runs match the current filters.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Tasks</CardTitle>
              <CardDescription>Tasks from recent supervisor runs</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task ID</TableHead>
                    <TableHead>Queue Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Scheduled</TableHead>
                    <TableHead>Executed</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.slice(0, 20).map((task) => (
                    <TableRow key={task.id}>
                      <TableCell className="font-mono text-xs">{task.id.slice(0, 8)}…</TableCell>
                      <TableCell>
                        <Badge variant="outline">{task.queueType}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            task.status === 'EXECUTED'
                              ? 'default'
                              : task.status === 'BLOCKED'
                                ? 'destructive'
                                : 'secondary'
                          }
                        >
                          {task.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{new Date(task.scheduledAt).toLocaleString()}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {task.executedAt ? new Date(task.executedAt).toLocaleString() : '—'}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleTaskClick(task)}
                        >
                          View Decision
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {tasks.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                        No tasks available.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {selectedTask && (
        <DecisionDrawer
          open={!!selectedTask}
          onOpenChange={(open) => !open && setSelectedTask(null)}
          task={selectedTask}
        />
      )}
    </div>
  )
}

type SummaryCardProps = {
  label: string
  value: string
  description: string
  icon: typeof Activity
  tone?: 'danger' | 'info' | 'success'
}

function SummaryCard({ label, value, description, icon: Icon, tone = 'info' }: SummaryCardProps) {
  const toneClass =
    tone === 'danger'
      ? 'text-destructive'
      : tone === 'success'
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-muted-foreground'
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <Icon className={`h-5 w-5 ${toneClass}`} aria-hidden="true" />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}

