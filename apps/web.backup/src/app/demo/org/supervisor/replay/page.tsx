'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Clock, Play, RefreshCw, Rewind, SkipForward } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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

type ReplayResponse = {
  run: SupervisorRun | null
  tasks: SupervisorTask[]
  timeline: Array<{
    timestamp: string
    event: string
    taskId?: string
    details?: Record<string, any>
  }>
}

export default function SupervisorReplayPage() {
  const searchParams = useSearchParams()
  const runId = searchParams.get('runId')
  const [run, setRun] = useState<SupervisorRun | null>(null)
  const [tasks, setTasks] = useState<SupervisorTask[]>([])
  const [timeline, setTimeline] = useState<ReplayResponse['timeline']>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTask, setSelectedTask] = useState<SupervisorTask | null>(null)
  const [replayPosition, setReplayPosition] = useState<number | null>(null)
  const [isReplaying, setIsReplaying] = useState(false)

  useEffect(() => {
    if (!runId) return

    let cancelled = false
    const controller = new AbortController()

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/demo/org/supervisor/replay?runId=${runId}`, {
          signal: controller.signal,
        })
        if (!response.ok) {
          throw new Error(`Failed to load replay data (${response.status})`)
        }
        const payload = (await response.json()) as ReplayResponse
        if (!cancelled) {
          setRun(payload.run)
          setTasks(payload.tasks)
          setTimeline(payload.timeline)
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message ?? 'Unable to load replay data')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [runId])

  const handleReplay = () => {
    if (timeline.length === 0) return
    setIsReplaying(true)
    setReplayPosition(0)

    let currentPosition = 0
    const interval = setInterval(() => {
      currentPosition++
      setReplayPosition(currentPosition)

      if (currentPosition >= timeline.length) {
        clearInterval(interval)
        setIsReplaying(false)
        setReplayPosition(null)
      }
    }, 1000) // 1 second per event
  }

  const handleReset = () => {
    setIsReplaying(false)
    setReplayPosition(null)
  }

  const visibleTimeline = useMemo(() => {
    if (replayPosition === null) return timeline
    return timeline.slice(0, replayPosition + 1)
  }, [timeline, replayPosition])

  const filteredTasks = useMemo(() => {
    if (!runId) return tasks
    return tasks.filter((task) => task.runId === runId)
  }, [tasks, runId])

  return (
    <div className="container mx-auto space-y-6 py-8">
      <header className="space-y-3">
        <p className="text-sm text-muted-foreground">Demo &raquo; Org &raquo; Supervisor &raquo; Replay Console</p>
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Rewind className="h-7 w-7 text-primary" aria-hidden="true" />
              Supervisor Replay Console
            </h1>
            <p className="text-muted-foreground max-w-2xl">
              Replay supervisor decisions for debugging and testing. Integrates with Timeline and JobReplay for comprehensive analysis.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/demo/org/supervisor">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      {!runId && (
        <Card>
          <CardHeader>
            <CardTitle>Select a Run to Replay</CardTitle>
            <CardDescription>Please provide a runId parameter or select a run from the dashboard.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/demo/org/supervisor">Go to Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {runId && (
        <>
          {run && (
            <Card>
              <CardHeader>
                <CardTitle>Run Details</CardTitle>
                <CardDescription>Run ID: {run.id}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Status</div>
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
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Started</div>
                    <div className="text-sm font-medium">{new Date(run.startedAt).toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Tasks</div>
                    <div className="text-sm font-medium">
                      {run.tasksPlanned} planned, {run.tasksExecuted} executed, {run.tasksBlocked} blocked
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Next Run</div>
                    <div className="text-sm font-medium">
                      {run.nextRunPrediction ? new Date(run.nextRunPrediction).toLocaleString() : 'N/A'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Timeline Replay</CardTitle>
                  <CardDescription>Replay supervisor decisions step by step</CardDescription>
                </div>
                <div className="flex gap-2">
                  {!isReplaying ? (
                    <Button size="sm" onClick={handleReplay} disabled={timeline.length === 0}>
                      <Play className="h-4 w-4 mr-2" />
                      Start Replay
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={handleReset}>
                      <Rewind className="h-4 w-4 mr-2" />
                      Reset
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="py-8 text-center text-sm text-muted-foreground">Loading timeline…</div>
              ) : (
                <div className="space-y-2">
                  {visibleTimeline.map((event, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-4 rounded-lg border bg-muted/20 p-4 text-sm"
                    >
                      <Clock className="h-4 w-4 mt-0.5 text-muted-foreground" />
                      <div className="flex-1">
                        <div className="font-medium">{event.event}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {new Date(event.timestamp).toLocaleString()}
                        </div>
                        {event.taskId && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Task: <span className="font-mono">{event.taskId.slice(0, 8)}…</span>
                          </div>
                        )}
                        {event.details && Object.keys(event.details).length > 0 && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            <details>
                              <summary className="cursor-pointer">Details</summary>
                              <pre className="mt-2 p-2 rounded bg-muted text-xs overflow-x-auto">
                                {JSON.stringify(event.details, null, 2)}
                              </pre>
                            </details>
                          </div>
                        )}
                      </div>
                      {replayPosition !== null && index === replayPosition && (
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                          <span className="text-xs text-muted-foreground">Playing</span>
                        </div>
                      )}
                    </div>
                  ))}
                  {visibleTimeline.length === 0 && (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                      No timeline events available.
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tasks in Run</CardTitle>
              <CardDescription>All tasks scheduled and executed in this supervisor run</CardDescription>
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
                  {filteredTasks.map((task) => (
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
                        <Button size="sm" variant="outline" onClick={() => setSelectedTask(task)}>
                          View Decision
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredTasks.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                        No tasks found for this run.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {error && (
        <Card className="border-destructive" role="alert">
          <CardHeader>
            <CardTitle className="text-destructive">Unable to load replay data</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
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

