'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Activity, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

type QueueType = 'PSV' | 'SAFETY' | 'DRIFT' | 'FUSION' | 'NCI' | 'MOBILITY' | 'EHR_SYNC'

interface QueueLoad {
  queueType: QueueType
  pending: number
  running: number
  completed: number
  failed: number
  avgLatencyMs: number | null
}

type QueueHeatmapProps = {
  queueTypes: readonly QueueType[]
}

type QueueResponse = {
  queues: QueueLoad[]
}

const QUEUE_COLORS: Record<QueueType, string> = {
  PSV: 'bg-blue-500',
  SAFETY: 'bg-rose-500',
  DRIFT: 'bg-amber-500',
  FUSION: 'bg-purple-500',
  NCI: 'bg-emerald-500',
  MOBILITY: 'bg-sky-500',
  EHR_SYNC: 'bg-indigo-500',
}

const QUEUE_LABELS: Record<QueueType, string> = {
  PSV: 'PSV',
  SAFETY: 'SAFETY',
  DRIFT: 'DRIFT',
  FUSION: 'FUSION',
  NCI: 'NCI',
  MOBILITY: 'MOBILITY',
  EHR_SYNC: 'EHR_SYNC',
}

function getIntensity(total: number): string {
  if (total === 0) return 'opacity-20'
  if (total < 10) return 'opacity-40'
  if (total < 50) return 'opacity-60'
  if (total < 100) return 'opacity-80'
  return 'opacity-100'
}

function getHeatmapColor(total: number, queueType: QueueType): string {
  const baseColor = QUEUE_COLORS[queueType]
  const intensity = getIntensity(total)
  return cn(baseColor, intensity)
}

export function QueueHeatmap({ queueTypes }: QueueHeatmapProps) {
  const [queues, setQueues] = useState<QueueLoad[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch('/api/demo/org/supervisor/queues', { signal: controller.signal })
        if (!response.ok) {
          throw new Error(`Failed to load queue data (${response.status})`)
        }
        const payload = (await response.json()) as QueueResponse
        if (!cancelled) {
          setQueues(payload.queues)
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message ?? 'Unable to load queue data')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()
    const interval = setInterval(load, 15000) // Refresh every 15 seconds
    return () => {
      cancelled = true
      controller.abort()
      clearInterval(interval)
    }
  }, [])

  const queueMap = queues.reduce(
    (acc, queue) => {
      acc[queue.queueType] = queue
      return acc
    },
    {} as Record<QueueType, QueueLoad>
  )

  const maxTotal = Math.max(
    ...queueTypes.map((type) => {
      const queue = queueMap[type]
      if (!queue) return 0
      return queue.pending + queue.running + queue.completed + queue.failed
    }),
    1
  )

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Queue Heatmap
            </CardTitle>
            <CardDescription>Visual heatmap of queue loads across all queue types</CardDescription>
          </div>
          <RefreshCw className={cn('h-4 w-4 text-muted-foreground', loading && 'animate-spin')} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading queue data…</div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {queueTypes.map((queueType) => {
                const queue = queueMap[queueType]
                if (!queue) {
                  return (
                    <div key={queueType} className="rounded-lg border bg-muted/20 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-sm">{QUEUE_LABELS[queueType]}</span>
                        <Badge variant="outline" className="text-xs">No data</Badge>
                      </div>
                    </div>
                  )
                }

                const total = queue.pending + queue.running + queue.completed + queue.failed
                const percentage = maxTotal > 0 ? (total / maxTotal) * 100 : 0

                return (
                  <div key={queueType} className="rounded-lg border bg-muted/20 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">{QUEUE_LABELS[queueType]}</span>
                      <Badge variant="outline" className="text-xs">
                        {total} total
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Pending</span>
                        <span className="font-medium">{queue.pending}</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn('h-full transition-all', getHeatmapColor(queue.pending, queueType))}
                          style={{ width: `${Math.min(100, (queue.pending / maxTotal) * 100)}%` }}
                          aria-label={`${queue.pending} pending jobs`}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Running</span>
                        <span className="font-medium">{queue.running}</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn('h-full transition-all', getHeatmapColor(queue.running, queueType))}
                          style={{ width: `${Math.min(100, (queue.running / maxTotal) * 100)}%` }}
                          aria-label={`${queue.running} running jobs`}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Completed: </span>
                        <span className="font-medium text-emerald-600">{queue.completed}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Failed: </span>
                        <span className="font-medium text-rose-600">{queue.failed}</span>
                      </div>
                    </div>

                    {queue.avgLatencyMs !== null && (
                      <div className="text-xs text-muted-foreground">
                        Avg latency: {Math.round(queue.avgLatencyMs)}ms
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
              <p className="font-semibold mb-1">Legend:</p>
              <p>Color intensity indicates queue load. Darker = higher load. Each queue shows pending, running, completed, and failed job counts.</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

