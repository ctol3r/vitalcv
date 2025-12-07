'use client'

import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Activity, AlertTriangle, CheckCircle2, Clock4, Link2, Radio, Server, ShieldAlert } from 'lucide-react'
import { Line, LineChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts'

import type {
  BlockTimeHeatmapCell,
  ChainHealthSnapshot,
  ChainIncident,
  NodeHeartbeat,
} from '@/apps/api/src/chain/health/types'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const chartConfig = {
  blockTimeMs: {
    label: 'Block time (ms)',
    color: 'hsl(var(--chart-1))',
  },
  finalityLag: {
    label: 'Finality lag',
    color: 'hsl(var(--chart-2))',
  },
}

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

export default function ChainHealthDashboard() {
  const [snapshot, setSnapshot] = useState<ChainHealthSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const response = await fetch('/api/chain/health', { cache: 'no-store' })
        if (!response.ok) {
          throw new Error('Chain health API unavailable')
        }
        const payload = (await response.json()) as ChainHealthSnapshot
        if (!cancelled) {
          setSnapshot(payload)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[chain-health] fetch failed', err)
          setError('Unable to load chain telemetry. Showing last known data.')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }
    load()
    const interval = setInterval(load, 30_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  const rollingMetrics = useMemo(() => {
    if (!snapshot?.metrics.rolling?.length) return []
    return [...snapshot.metrics.rolling].sort(
      (a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime(),
    )
  }, [snapshot])

  const latest = snapshot?.metrics.latest ?? null
  const status = deriveStatus(snapshot)
  const avgBlockTimeMs = useMemo(() => {
    if (!snapshot?.metrics.rolling?.length) return 0
    const total = snapshot.metrics.rolling.reduce((acc, metric) => acc + metric.blockTimeMs, 0)
    return Math.round(total / snapshot.metrics.rolling.length)
  }, [snapshot])

  return (
    <div className="space-y-6 p-8">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">Admin &raquo; Chain Observability</p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">Chain health dashboard</h1>
          <Badge variant={status.variant} className="gap-1">
            <Radio className="h-3.5 w-3.5" />
            {status.label}
          </Badge>
          {snapshot?.checkpoint && (
            <Badge variant="outline" className="gap-1 text-xs">
              <Link2 className="h-3 w-3" />
              anchored {new Date(snapshot.checkpoint.timestamp).toLocaleTimeString()}
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground max-w-3xl">
          Live validator telemetry, chain-sync signals, failover posture, and anchoring cadence with anomaly detection.
        </p>
      </header>

      {error && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mr-2 inline h-4 w-4" />
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Block time (ms)" value={latest?.blockTimeMs ?? 0} icon={<Clock4 className="h-4 w-4 text-primary" />} />
        <StatCard label="Finality lag" value={snapshot?.sync.finalityLag ?? 0} decimals icon={<Activity className="h-4 w-4 text-primary" />} />
        <StatCard label="Queue depth" value={latest?.queueDepth ?? 0} icon={<Server className="h-4 w-4 text-primary" />} />
        <StatCard
          label="Finality ratio"
          value={(snapshot?.quorum.finalityRatio ?? 0) * 100}
          suffix="%"
          decimals
          icon={<CheckCircle2 className="h-4 w-4 text-primary" />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Latency & finality</CardTitle>
          <CardDescription>Rolling latency + finality lag samples from telemetry worker.</CardDescription>
        </CardHeader>
        <CardContent className="h-80">
          <ChartContainer config={chartConfig} className="h-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rollingMetrics}>
                <XAxis
                  dataKey="capturedAt"
                  tickFormatter={(value) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <ChartTooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  content={({ active, payload, label }) => (
                    <ChartTooltipContent active={active} payload={payload} label={label} />
                  )}
                />
                <ChartLegend content={<ChartLegendContent />} />
                <Line
                  type="monotone"
                  dataKey="blockTimeMs"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="finalityLag"
                  stroke="hsl(var(--chart-2))"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChainSyncCard snapshot={snapshot} isLoading={isLoading} />
        <FailoverCard mode={snapshot?.failover} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <IncidentList incidents={snapshot?.incidents ?? []} />
        <BlockTimeHeatmap cells={snapshot?.metrics.heatmap ?? []} averageMs={avgBlockTimeMs} />
      </div>

      <HeartbeatTable heartbeats={snapshot?.heartbeats ?? []} />
    </div>
  )
}

function deriveStatus(snapshot: ChainHealthSnapshot | null): { label: string; variant: BadgeVariant } {
  if (!snapshot) return { label: 'Loading', variant: 'secondary' }
  if (snapshot.failover.mode === 'failover' || snapshot.sync.status === 'degraded') {
    return { label: 'Degraded', variant: 'destructive' }
  }
  if (snapshot.failover.mode === 'watch' || snapshot.sync.status === 'syncing') {
    return { label: 'Monitoring', variant: 'outline' }
  }
  return { label: 'Healthy', variant: 'default' }
}

function ChainSyncCard({ snapshot, isLoading }: { snapshot: ChainHealthSnapshot | null; isLoading: boolean }) {
  if (!snapshot) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Chain sync</CardTitle>
          <CardDescription>Waiting for telemetry samples...</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{isLoading ? 'Collecting initial samples.' : 'No samples recorded yet.'}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Chain sync</CardTitle>
        <CardDescription>Validator quorum and backlog estimation.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Head block</p>
            <p className="text-2xl font-semibold">{snapshot.sync.headBlock.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Finalized</p>
            <p className="text-2xl font-semibold">{snapshot.sync.finalizedBlock.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Healthy validators</p>
            <p className="text-2xl font-semibold">
              {snapshot.sync.healthyNodes}/{snapshot.sync.totalNodes || 0}
            </p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Backlog {snapshot.sync.backlogSeconds}s &middot; last updated {new Date(snapshot.sync.lastUpdated).toLocaleTimeString()}
        </p>
      </CardContent>
    </Card>
  )
}

function FailoverCard({ mode }: { mode?: ChainHealthSnapshot['failover'] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Failover strategy</CardTitle>
        <CardDescription>Latency SLO posture and recommended actions.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!mode ? (
          <p className="text-sm text-muted-foreground">Awaiting evaluation.</p>
        ) : (
          <>
            <div className="flex items-center gap-2 text-sm font-medium">
              <ShieldAlert className="h-4 w-4 text-primary" />
              Mode: <span className="capitalize">{mode.mode}</span>
            </div>
            <p className="text-sm text-muted-foreground">{mode.reason}</p>
            {mode.breaches.length > 0 && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                {mode.breaches.map((breach) => (
                  <div key={`${breach.metric}-${breach.value}`}>
                    {breach.metric} &gt; {breach.threshold} ({breach.value})
                  </div>
                ))}
              </div>
            )}
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {mode.actions.map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function IncidentList({ incidents }: { incidents: ChainIncident[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Chain incidents</CardTitle>
        <CardDescription>Detected anomalies in the last telemetry window.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {incidents.length === 0 && <p className="text-sm text-muted-foreground">No incidents detected.</p>}
        {incidents.map((incident) => (
          <div
            key={incident.id}
            className={`rounded-md border p-3 text-sm ${
              incident.severity === 'critical'
                ? 'border-red-200 bg-red-50 text-red-900'
                : incident.severity === 'warn'
                  ? 'border-amber-200 bg-amber-50 text-amber-900'
                  : 'border-slate-200 bg-slate-50 text-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium capitalize">{incident.type.replace('_', ' ')}</span>
              <span className="text-xs">{new Date(incident.occurredAt).toLocaleTimeString()}</span>
            </div>
            <p>{incident.message}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function BlockTimeHeatmap({ cells, averageMs }: { cells: BlockTimeHeatmapCell[]; averageMs: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Block-time heatmap</CardTitle>
        <CardDescription>
          Avg {(averageMs / 1000).toFixed(2)}s &middot; highlights anomalies across the last hour.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {cells.length === 0 ? (
          <p className="text-sm text-muted-foreground">Heatmap will populate as telemetry accumulates.</p>
        ) : (
          <div className="grid grid-cols-6 gap-2">
            {cells.map((cell) => (
              <div
                key={cell.bucketStart}
                className={`rounded-md border p-2 text-center text-xs ${
                  cell.anomaly ? 'border-red-200 bg-red-50 text-red-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900'
                }`}
                title={`Avg ${(cell.avgBlockTimeMs / 1000).toFixed(2)}s across ${cell.samples} samples`}
              >
                <div className="font-semibold">{cell.bucketLabel}</div>
                <div>{(cell.avgBlockTimeMs / 1000).toFixed(2)}s</div>
                {cell.anomaly && <AlertTriangle className="mx-auto mt-1 h-3.5 w-3.5" />}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function HeartbeatTable({ heartbeats }: { heartbeats: NodeHeartbeat[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Validator heartbeats</CardTitle>
        <CardDescription>Latest RPC health checks across configured validators.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Validator</TableHead>
              <TableHead>Latency</TableHead>
              <TableHead>Block</TableHead>
              <TableHead>Finalized</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Peers</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {heartbeats.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  No heartbeat samples yet.
                </TableCell>
              </TableRow>
            )}
            {heartbeats.map((node) => (
              <TableRow key={node.nodeId}>
                <TableCell>
                  <div className="font-medium">{node.label}</div>
                  <div className="text-xs text-muted-foreground">{node.region ?? node.nodeId}</div>
                </TableCell>
                <TableCell>{node.latencyMs} ms</TableCell>
                <TableCell>{node.block.toLocaleString()}</TableCell>
                <TableCell>{node.finalizedBlock.toLocaleString()}</TableCell>
                <TableCell>
                  <Badge variant={node.synced ? 'default' : 'destructive'} className="text-[10px]">
                    {node.synced ? 'synced' : 'degraded'}
                  </Badge>
                </TableCell>
                <TableCell>{node.peers}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

interface StatCardProps {
  label: string
  value: number
  suffix?: string
  decimals?: boolean
  icon: ReactNode
}

function StatCard({ label, value, suffix = '', decimals = false, icon }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {decimals ? value.toFixed(1) : value.toFixed(0)}
          {suffix}
        </div>
      </CardContent>
    </Card>
  )
}
