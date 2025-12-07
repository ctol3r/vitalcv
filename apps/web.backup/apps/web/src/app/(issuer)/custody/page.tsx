'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Activity, AlertTriangle, Flame, RefreshCw, ShieldCheck, Download } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type CustodyAction = 'upload' | 'viewed' | 'verified' | 'signed' | 'anchored'

interface CustodyEvent {
  id: string
  clinicianId: string
  documentId: string
  action: CustodyAction
  timestamp: string
  metadata: Record<string, unknown>
}

interface CustodyHeatmapCell {
  date: string
  total: number
  intensity: number
  actions: Record<CustodyAction, number>
}

interface CustodyHeatmapResponse {
  clinicianId: string
  windowDays: number
  documentsTracked: number
  totalEvents: number
  totalsByAction: Record<CustodyAction, number>
  cells: CustodyHeatmapCell[]
  latestEvents: CustodyEvent[]
  generatedAt: string
}

const API_BASE = (process.env.NEXT_PUBLIC_PLATFORM_API ?? '').replace(/\/$/, '')

export default function CustodyHeatmapDashboard() {
  const [clinicianId, setClinicianId] = useState('demo-clinician')
  const [pendingId, setPendingId] = useState('demo-clinician')
  const [data, setData] = useState<CustodyHeatmapResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function loadHeatmap() {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(buildApiPath(`/api/custody/heatmap/${clinicianId}`))
        if (!response.ok) {
          throw new Error(`Request failed with ${response.status}`)
        }
        const payload = (await response.json()) as CustodyHeatmapResponse
        if (!cancelled) {
          setData(payload)
        }
      } catch (err) {
        console.warn('[custody] heatmap fetch failed, using mock', err)
        if (!cancelled) {
          setError('Unable to reach custody API, showing synthetic data.')
          setData(buildMockHeatmap(clinicianId))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }
    void loadHeatmap()
    return () => {
      cancelled = true
    }
  }, [clinicianId])

  const actionSummary = useMemo(() => {
    if (!data) return []
    return Object.entries(data.totalsByAction).map(([action, total]) => ({
      action: action as CustodyAction,
      total,
    }))
  }, [data])

  const downloadHref = useMemo(() => {
    if (!clinicianId) return '#'
    return buildApiPath(`/api/custody/export/${encodeURIComponent(clinicianId)}`)
  }, [clinicianId])

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (pendingId.trim()) {
      setClinicianId(pendingId.trim())
    }
  }

  return (
    <div className="container mx-auto space-y-6 py-8">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Issuer custody</p>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Custody heatmap</h1>
            <p className="text-muted-foreground max-w-2xl">
              Track every custody hop from document ingestion to anchor. Hot spots surface documents that
              need attention before attestations are minted.
            </p>
          </div>
          <form className="flex flex-col gap-2 sm:flex-row sm:items-center" onSubmit={handleSubmit}>
            <Input
              value={pendingId}
              onChange={(event) => setPendingId(event.target.value)}
              placeholder="Clinician ID"
              className="w-full sm:w-56"
              aria-label="Clinician identifier"
            />
            <Button type="submit" disabled={!pendingId.trim() || loading}>
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
              Refresh
            </Button>
          </form>
        </div>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>Heads up</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <section className="grid gap-4 md:grid-cols-4" aria-live="polite">
        <SummaryCard
          title="Total events"
          value={data?.totalEvents ?? 0}
          description="Recorded custody hops"
          icon={<Activity className="h-5 w-5 text-primary" />}
          loading={loading}
        />
        <SummaryCard
          title="Tracked documents"
          value={data?.documentsTracked ?? 0}
          description="Unique document IDs"
          icon={<ShieldCheck className="h-5 w-5 text-emerald-500" />}
          loading={loading}
        />
        <SummaryCard
          title="Hot days"
          value={highlightedDays(data?.cells ?? [])}
          description="Days with 5+ custody hops"
          icon={<Flame className="h-5 w-5 text-orange-500" />}
          loading={loading}
        />
        <SummaryCard
          title="Export ledger"
          value=""
          description="Download JSON ledger snapshot"
          icon={<Download className="h-5 w-5 text-muted-foreground" />}
          loading={false}
          extra={
            <Button asChild variant="secondary" size="sm" className="mt-2 w-full">
              <a href={downloadHref} target="_blank" rel="noreferrer">
                Download
              </a>
            </Button>
          }
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Custody activity</CardTitle>
            <CardDescription>Daily custody density over the last {data?.windowDays ?? 14} days.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading && !data ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <Heatmap cells={data?.cells ?? []} />
            )}
            <HeatmapLegend />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Action mix</CardTitle>
            <CardDescription>Relative proportion of custody actions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading && !data ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              actionSummary.map(({ action, total }) => (
                <div key={action} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <div>
                    <p className="font-medium capitalize">{action}</p>
                    <p className="text-xs text-muted-foreground">{actionCopy(action)}</p>
                  </div>
                  <Badge variant="secondary" className="text-sm">
                    {total}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Latest custody events</CardTitle>
          <CardDescription>Newest hops from stream view.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading && !data ? (
            <Skeleton className="h-32 w-full" />
          ) : data && data.latestEvents?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Document</TableHead>
                  <TableHead>Hash</TableHead>
                  <TableHead>Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.latestEvents.slice(0, 10).map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {event.action}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs text-muted-foreground">{truncate(event.documentId)}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs text-muted-foreground">
                        {truncate((event.metadata?.hash as string) ?? '')}
                      </span>
                    </TableCell>
                    <TableCell>{new Date(event.timestamp).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">No custody events recorded yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function buildApiPath(path: string) {
  if (!API_BASE) return path
  return `${API_BASE}${path}`
}

function SummaryCard({
  title,
  description,
  value,
  icon,
  loading,
  extra,
}: {
  title: string
  description: string
  value: number | string
  icon: ReactNode
  loading: boolean
  extra?: ReactNode
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {icon}
      </CardHeader>
      <CardContent>
        {loading && typeof value === 'number' ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <div className="text-3xl font-semibold">{value || value === 0 ? value : '—'}</div>
        )}
        {extra}
      </CardContent>
    </Card>
  )
}

function Heatmap({ cells }: { cells: CustodyHeatmapCell[] }) {
  if (!cells.length) {
    return <p className="text-sm text-muted-foreground">No custody activity captured yet.</p>
  }

  return (
    <div className="grid grid-cols-7 gap-2">
      {cells.map((cell) => (
        <div key={cell.date} className="flex flex-col items-center gap-1 text-xs">
          <div
            className="h-10 w-full rounded-md border"
            style={{ backgroundColor: heatColor(cell.intensity) }}
            title={`${cell.total} events on ${cell.date}`}
            aria-label={`${cell.total} events on ${cell.date}`}
          />
          <span className="font-mono text-[10px] text-muted-foreground">{cell.date.slice(5)}</span>
        </div>
      ))}
    </div>
  )
}

function HeatmapLegend() {
  return (
    <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
      <span>Low</span>
      {[0.1, 0.3, 0.6, 0.9].map((value) => (
        <div key={`legend-${value}`} className="h-3 w-8 rounded" style={{ backgroundColor: heatColor(value) }} />
      ))}
      <span>High</span>
    </div>
  )
}

function heatColor(intensity: number) {
  if (intensity <= 0) return 'hsl(var(--muted))'
  const clamped = Math.min(Math.max(intensity, 0), 1)
  const hue = 140 - clamped * 60
  const saturation = 70 + clamped * 20
  const lightness = 90 - clamped * 40
  return `hsl(${hue} ${saturation}% ${lightness}%)`
}

function highlightedDays(cells: CustodyHeatmapCell[]): number {
  return cells.filter((cell) => cell.total >= 5).length
}

function truncate(value: string, length = 12) {
  if (!value) return '—'
  if (value.length <= length) return value
  return `${value.slice(0, length / 2)}…${value.slice(-length / 2)}`
}

function actionCopy(action: CustodyAction) {
  switch (action) {
    case 'upload':
      return 'Document uploaded'
    case 'viewed':
      return 'Document accessed'
    case 'verified':
      return 'Signature or PSV verified'
    case 'signed':
      return 'Issuer signed custody hop'
    case 'anchored':
      return 'Snapshot anchored to chain'
    default:
      return ''
  }
}

function buildMockHeatmap(clinicianId: string): CustodyHeatmapResponse {
  const now = new Date()
  const cells: CustodyHeatmapCell[] = []
  for (let day = 13; day >= 0; day -= 1) {
    const cursor = new Date(now)
    cursor.setDate(now.getDate() - day)
    const total = Math.max(0, Math.round(Math.random() * 8 - (day % 3)))
    cells.push({
      date: cursor.toISOString().slice(0, 10),
      total,
      intensity: Math.min(total / 8, 1),
      actions: {
        upload: Math.min(total, Math.floor(total * 0.3)),
        viewed: Math.min(total, Math.floor(total * 0.2)),
        verified: Math.min(total, Math.floor(total * 0.2)),
        signed: Math.min(total, Math.floor(total * 0.2)),
        anchored: Math.min(total, Math.floor(total * 0.1)),
      },
    })
  }

  return {
    clinicianId,
    windowDays: 14,
    documentsTracked: 12,
    totalEvents: cells.reduce((acc, cell) => acc + cell.total, 0),
    totalsByAction: {
      upload: 32,
      viewed: 24,
      verified: 18,
      signed: 20,
      anchored: 12,
    },
    cells,
    latestEvents: cells
      .slice(-5)
      .map((cell, index) => ({
        id: `mock-${index}`,
        clinicianId,
        documentId: `doc-${index}`,
        action: (['upload', 'viewed', 'verified', 'signed', 'anchored'][index % 5] ?? 'upload') as CustodyAction,
        timestamp: `${cell.date}T12:00:00.000Z`,
        metadata: { hash: `0xmock${index}` },
      })),
    generatedAt: new Date().toISOString(),
  }
}

