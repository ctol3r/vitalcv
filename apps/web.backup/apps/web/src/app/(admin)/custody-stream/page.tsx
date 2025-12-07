'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Activity,
  AlertTriangle,
  Clock3,
  FileText,
  Link2,
  Shield,
  RefreshCw,
} from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'

type CustodyAction = 'upload' | 'viewed' | 'verified' | 'signed' | 'anchored'

interface CustodyStreamEvent {
  id: string
  clinicianId: string
  documentId: string
  action: CustodyAction
  timestamp: string
  metadata: Record<string, unknown>
}

interface CustodyStreamResponse {
  events: CustodyStreamEvent[]
  count: number
  generatedAt: string
}

const API_BASE = (process.env.NEXT_PUBLIC_PLATFORM_API ?? '').replace(/\/$/, '')

export default function CustodyStreamViewer() {
  const [events, setEvents] = useState<CustodyStreamEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clinicianFilter, setClinicianFilter] = useState('')
  const [documentFilter, setDocumentFilter] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(true)

  const streamStats = useMemo(() => {
    return {
      uploads: events.filter((event) => event.action === 'upload').length,
      anchors: events.filter((event) => event.action === 'anchored').length,
      uniqueDocs: new Set(events.map((event) => event.documentId)).size,
    }
  }, [events])

  useEffect(() => {
    let cancelled = false
    async function loadStream() {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({
          limit: '50',
        })
        if (clinicianFilter.trim()) params.set('clinicianId', clinicianFilter.trim())
        if (documentFilter.trim()) params.set('documentId', documentFilter.trim())
        const response = await fetch(buildApiPath(`/api/custody/stream?${params.toString()}`))
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`)
        }
        const payload = (await response.json()) as CustodyStreamResponse
        if (!cancelled) {
          setEvents(payload.events ?? [])
        }
      } catch (err) {
        console.warn('[custody] stream fetch failed', err)
        if (!cancelled) {
          setError('Unable to stream custody events. Showing last cached entries if available.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadStream()
    if (autoRefresh) {
      const interval = setInterval(loadStream, 15_000)
      return () => {
        cancelled = true
        clearInterval(interval)
      }
    }
    return () => {
      cancelled = true
    }
  }, [clinicianFilter, documentFilter, autoRefresh])

  return (
    <div className="container mx-auto space-y-6 py-8">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Admin · Custody</p>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Custody stream viewer</h1>
            <p className="text-muted-foreground max-w-3xl">
              Observe custody events across issuers in real time. Filters let you isolate a single clinician
              or document hash to debug timeline gaps.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setAutoRefresh((prev) => !prev)}>
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            {autoRefresh ? 'Pause auto refresh' : 'Resume auto refresh'}
          </Button>
        </div>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>Stream paused</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Narrow the stream to a single clinician or document.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="clinician-filter">Clinician ID</Label>
            <Input
              id="clinician-filter"
              value={clinicianFilter}
              onChange={(event) => setClinicianFilter(event.target.value)}
              placeholder="e.g. cln_123"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="document-filter">Document ID</Label>
            <Input
              id="document-filter"
              value={documentFilter}
              onChange={(event) => setDocumentFilter(event.target.value)}
              placeholder="e.g. doc_456"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Switch id="refresh-toggle" checked={autoRefresh} onCheckedChange={setAutoRefresh} />
            <Label htmlFor="refresh-toggle" className="text-sm text-muted-foreground">
              Auto refresh every 15s
            </Label>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-3">
        <MetricTile icon={<Activity className="h-5 w-5 text-primary" />} label="Events in view" value={events.length} />
        <MetricTile icon={<FileText className="h-5 w-5 text-muted-foreground" />} label="Unique documents" value={streamStats.uniqueDocs} />
        <MetricTile icon={<Shield className="h-5 w-5 text-emerald-500" />} label="Anchors" value={streamStats.anchors} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Live custody feed</CardTitle>
          <CardDescription>Newest events show first. Metadata includes hash linkage.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && !events.length ? (
            <Skeleton className="h-48 w-full" />
          ) : events.length ? (
            events.map((event) => (
              <div
                key={event.id}
                className="flex flex-col gap-2 rounded-lg border px-4 py-3 md:flex-row md:items-center md:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize">
                      {event.action}
                    </Badge>
                    <span className="font-mono text-xs text-muted-foreground">{truncate(event.documentId)}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Clinician <span className="font-mono">{truncate(event.clinicianId)}</span>
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                      {new Date(event.timestamp).toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                      {truncate((event.metadata?.hash as string) ?? '')}
                    </span>
                  </div>
                </div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>
                    Prev:{' '}
                    <span className="font-mono">
                      {truncate((event.metadata?.previousHash as string) ?? '—', 16)}
                    </span>
                  </p>
                  <p>
                    Signer:{' '}
                    <span className="font-mono">
                      {truncate((event.metadata?.issuerDid as string) ?? 'system', 16)}
                    </span>
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No custody events captured yet.</p>
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

function truncate(value: string, length = 12) {
  if (!value) return '—'
  if (value.length <= length) return value
  return `${value.slice(0, length / 2)}…${value.slice(-length / 2)}`
}

function MetricTile({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between py-4">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-3xl font-semibold">{value}</p>
        </div>
        {icon}
      </CardContent>
    </Card>
  )
}

