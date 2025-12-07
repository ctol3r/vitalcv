'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  XCircle,
  Activity,
  Target,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SimulationRun, SimulationResults } from '@/app/demo/org/simulation/page'

interface ResultExplorerProps {
  runs: SimulationRun[]
  currentRun: SimulationRun | null
  onRunSelect: (run: SimulationRun) => void
}

export function ResultExplorer({ runs, currentRun, onRunSelect }: ResultExplorerProps) {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(
    currentRun?.id || (runs.length > 0 ? runs[0].id : null)
  )
  const [viewMode, setViewMode] = useState<'metrics' | 'timeline' | 'comparison'>('metrics')

  const selectedRun = useMemo(() => {
    return runs.find((r) => r.id === selectedRunId) || currentRun
  }, [runs, selectedRunId, currentRun])

  const completedRuns = useMemo(() => {
    return runs.filter((r) => r.status === 'completed' && r.results)
  }, [runs])

  const handleRunSelect = (runId: string) => {
    setSelectedRunId(runId)
    const run = runs.find((r) => r.id === runId)
    if (run) {
      onRunSelect(run)
    }
  }

  if (completedRuns.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Results Available</h3>
            <p className="text-sm text-muted-foreground">
              Run a simulation to see results here
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Run Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Select Simulation Run</CardTitle>
          <CardDescription>Choose a completed run to view detailed results</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Select value={selectedRunId || ''} onValueChange={handleRunSelect}>
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Select a run" />
              </SelectTrigger>
              <SelectContent>
                {completedRuns.map((run) => (
                  <SelectItem key={run.id} value={run.id}>
                    <div className="flex items-center gap-2">
                      <span>{run.scenarioName}</span>
                      <Badge variant="outline" className="text-xs">
                        {run.startTime?.toLocaleTimeString()}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedRun && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>
                  Duration:{' '}
                  {selectedRun.startTime && selectedRun.endTime
                    ? `${Math.round(
                        (selectedRun.endTime.getTime() - selectedRun.startTime.getTime()) / 1000
                      )}s`
                    : 'N/A'}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results Display */}
      {selectedRun && selectedRun.results && (
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
          <TabsList>
            <TabsTrigger value="metrics">Metrics</TabsTrigger>
            <TabsTrigger value="timeline">Event Timeline</TabsTrigger>
            <TabsTrigger value="comparison">Baseline Comparison</TabsTrigger>
          </TabsList>

          <TabsContent value="metrics" className="space-y-4">
            <MetricsView results={selectedRun.results} />
          </TabsContent>

          <TabsContent value="timeline" className="space-y-4">
            <TimelineView results={selectedRun.results} />
          </TabsContent>

          <TabsContent value="comparison" className="space-y-4">
            <ComparisonView results={selectedRun.results} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

function MetricsView({ results }: { results: SimulationResults }) {
  const metrics = Object.entries(results.metrics || {})

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Key Metrics</CardTitle>
          <CardDescription>Performance metrics from the simulation run</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {metrics.map(([key, value]) => (
              <div key={key} className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground mb-1 capitalize">
                  {key.replace(/_/g, ' ')}
                </div>
                <div className="text-2xl font-bold">
                  {typeof value === 'number' ? value.toFixed(2) : value}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Module Responses</CardTitle>
          <CardDescription>Success rates and latency by module</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(results.moduleResponses || {}).map(([module, response]) => (
              <div key={module} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-semibold">{module}</div>
                  <div className="flex items-center gap-2">
                    {response.success ? (
                      <Badge className="bg-green-50 text-green-900 border-green-200">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Success
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <XCircle className="h-3 w-3 mr-1" />
                        Failed
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Latency:</span>
                    <span className="ml-2 font-medium">{response.latency.toFixed(0)}ms</span>
                  </div>
                  {response.errors && response.errors.length > 0 && (
                    <div>
                      <span className="text-muted-foreground">Errors:</span>
                      <span className="ml-2 font-medium text-destructive">
                        {response.errors.length}
                      </span>
                    </div>
                  )}
                </div>
                {response.errors && response.errors.length > 0 && (
                  <div className="mt-2 text-xs text-destructive">
                    {response.errors.join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Simple Chart Visualization */}
      <Card>
        <CardHeader>
          <CardTitle>Latency Distribution</CardTitle>
          <CardDescription>Response times across modules</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(results.moduleResponses || {}).map(([module, response]) => {
              const maxLatency = Math.max(
                ...Object.values(results.moduleResponses || {}).map((r) => r.latency),
                1000
              )
              const widthPercent = (response.latency / maxLatency) * 100

              return (
                <div key={module}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{module}</span>
                    <span className="text-sm text-muted-foreground">
                      {response.latency.toFixed(0)}ms
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full transition-all',
                        response.latency < maxLatency * 0.3
                          ? 'bg-green-500'
                          : response.latency < maxLatency * 0.7
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                      )}
                      style={{ width: `${widthPercent}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function TimelineView({ results }: { results: SimulationResults }) {
  const sortedEvents = useMemo(() => {
    return [...(results.events || [])].sort((a, b) => a.timestamp - b.timestamp)
  }, [results.events])

  const maxTimestamp = useMemo(() => {
    return Math.max(...sortedEvents.map((e) => e.timestamp), 1)
  }, [sortedEvents])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Event Timeline</CardTitle>
        <CardDescription>Chronological view of all events during the simulation</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {sortedEvents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No events recorded
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-muted" />

              {/* Events */}
              <div className="space-y-6">
                {sortedEvents.map((event, index) => {
                  const positionPercent = (event.timestamp / maxTimestamp) * 100

                  return (
                    <div key={event.id} className="relative pl-12">
                      {/* Timeline dot */}
                      <div className="absolute left-0 top-2 h-3 w-3 rounded-full bg-primary border-2 border-background" />

                      {/* Event card */}
                      <div className="p-4 border rounded-lg bg-background">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="font-semibold">{event.type}</div>
                            <div className="text-sm text-muted-foreground mt-1">
                              Module: {event.module}
                            </div>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {event.timestamp}ms
                          </div>
                        </div>
                        {event.data && Object.keys(event.data).length > 0 && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            <pre className="bg-muted p-2 rounded overflow-x-auto">
                              {JSON.stringify(event.data, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function ComparisonView({ results }: { results: SimulationResults }) {
  const comparisons = results.baselineComparison || {}

  if (Object.keys(comparisons).length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Baseline Comparison</h3>
            <p className="text-sm text-muted-foreground">
              Baseline comparison data is not available for this run
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Baseline Comparison</CardTitle>
        <CardDescription>Compare simulation results against baseline expectations</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {Object.entries(comparisons).map(([metric, comparison]) => {
            const differencePercent =
              comparison.baseline !== 0
                ? ((comparison.difference / comparison.baseline) * 100).toFixed(1)
                : '0'
            const isImprovement = comparison.difference > 0

            return (
              <div key={metric} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <div className="font-semibold capitalize">{metric.replace(/_/g, ' ')}</div>
                  <div className="flex items-center gap-2">
                    {isImprovement ? (
                      <Badge className="bg-green-50 text-green-900 border-green-200">
                        <TrendingUp className="h-3 w-3 mr-1" />
                        Improved
                      </Badge>
                    ) : (
                      <Badge className="bg-rose-50 text-rose-900 border-rose-200">
                        <TrendingDown className="h-3 w-3 mr-1" />
                        Degraded
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Baseline</div>
                    <div className="text-xl font-bold">{comparison.baseline.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Actual</div>
                    <div className="text-xl font-bold">{comparison.actual.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Difference</div>
                    <div
                      className={cn(
                        'text-xl font-bold',
                        isImprovement ? 'text-green-600' : 'text-rose-600'
                      )}
                    >
                      {comparison.difference > 0 ? '+' : ''}
                      {comparison.difference.toFixed(2)} ({differencePercent}%)
                    </div>
                  </div>
                </div>

                {/* Comparison bar */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Baseline</span>
                    <span>Actual</span>
                  </div>
                  <div className="h-4 bg-muted rounded-full overflow-hidden flex">
                    <div
                      className="bg-slate-400"
                      style={{
                        width: `${Math.min((comparison.baseline / Math.max(comparison.baseline, comparison.actual)) * 100, 100)}%`,
                      }}
                    />
                    <div
                      className={cn(
                        'transition-all',
                        isImprovement ? 'bg-green-500' : 'bg-rose-500'
                      )}
                      style={{
                        width: `${Math.abs((comparison.difference / Math.max(comparison.baseline, comparison.actual)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

