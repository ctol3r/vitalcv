'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface DriftEventDetail {
  id: string
  summary: string
  recommendation?: string | null
  severity: 'CRITICAL' | 'WARNING' | 'INFO'
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'DISMISSED'
  metadata?: Record<string, any> | null
  payload?: Record<string, any> | null
  category: string
  lastDetectedAt: string
}

type DriftDetailResponse = { event: DriftEventDetail }

const severityBadge: Record<string, string> = {
  CRITICAL: 'destructive',
  WARNING: 'secondary',
  INFO: 'outline',
}

export default function DriftEventDetailPage() {
  const params = useParams<{ eventId: string }>()
  const router = useRouter()
  const [event, setEvent] = useState<DriftEventDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [resolutionType, setResolutionType] = useState('ACKNOWLEDGED')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    async function load() {
      try {
        const response = await fetch(`/api/demo/org/drift/${params.eventId}`, { signal: controller.signal })
        if (!response.ok) throw new Error('Failed to load drift event')
        const payload = (await response.json()) as DriftDetailResponse
        if (!cancelled) {
          setEvent(payload.event)
          setResolutionType(payload.event.status === 'RESOLVED' ? payload.event.metadata?.resolutionType ?? 'ACKNOWLEDGED' : 'ACKNOWLEDGED')
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message ?? 'Unable to load drift event')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [params.eventId])

  const mitigation = useMemo(() => {
    return (event?.metadata as Record<string, unknown> | null)?.mitigation as Record<string, unknown> | undefined
  }, [event])

  const handleResolve = async () => {
    if (!event) return
    setSubmitting(true)
    setToast(null)
    try {
      const response = await fetch(`/api/demo/org/drift/${event.id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolutionType, notes }),
      })
      if (!response.ok) throw new Error('Resolution failed')
      const payload = (await response.json()) as DriftDetailResponse
      setEvent(payload.event)
      setToast('Resolution recorded and timeline updated.')
      setTimeout(() => setToast(null), 5000)
    } catch (err: any) {
      setToast(err.message ?? 'Failed to resolve drift event')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto py-16 text-center text-muted-foreground">
        Loading drift event…
      </div>
    )
  }

  if (error || !event) {
    return (
      <div className="container mx-auto py-16 text-center">
        <p className="text-destructive">{error ?? 'Drift event not found'}</p>
        <Button variant="outline" className="mt-4" onClick={() => router.back()}>
          Go back
        </Button>
      </div>
    )
  }

  return (
    <div className="container mx-auto space-y-6 py-8">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/demo/org/drift" className="inline-flex items-center gap-2 hover:underline">
          <ArrowLeft className="h-4 w-4" />
          Back to Drift Center
        </Link>
      </div>

      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Badge variant={severityBadge[event.severity]}>{event.severity}</Badge>
          <Badge variant={event.status === 'OPEN' ? 'destructive' : 'secondary'}>{event.status}</Badge>
        </div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <AlertTriangle className="h-7 w-7 text-primary" aria-hidden="true" />
          {event.summary}
        </h1>
        <p className="text-muted-foreground max-w-2xl">{event.recommendation ?? 'No recommendation recorded for this event.'}</p>
      </header>

      {toast && (
        <Card aria-live="polite">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              {toast}
            </CardTitle>
          </CardHeader>
        </Card>
      )}

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Resolution workflow</CardTitle>
            <CardDescription>Document the remediation that was taken for this drift signal.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="resolution">Resolution type</Label>
              <Select value={resolutionType} onValueChange={setResolutionType}>
                <SelectTrigger id="resolution" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACKNOWLEDGED">Acknowledge and monitor</SelectItem>
                  <SelectItem value="PRIVILEGE_HOLD">Privilege hold applied</SelectItem>
                  <SelectItem value="FPPE_RESTART">FPPE restarted</SelectItem>
                  <SelectItem value="PAYER_REEVALUATION">Payer eligibility rerun</SelectItem>
                  <SelectItem value="DISMISSED">False positive / dismissed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="notes">Resolution notes</Label>
              <Textarea
                id="notes"
                className="mt-1"
                rows={4}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Provide reviewer notes or include ticket references."
              />
            </div>
            <Button onClick={handleResolve} disabled={submitting} className="w-full md:w-auto">
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Mark as resolved
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Impact</CardTitle>
            <CardDescription>Risk + timeline impact from this drift signal.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="font-semibold">Risk factor</p>
              <p className="text-muted-foreground">
                {event.category === 'PRIVILEGE' ? 'Privilege drift' : event.category === 'PAYER' ? 'Payer drift' : 'Access drift'}
              </p>
            </div>
            <div>
              <p className="font-semibold">Last detected</p>
              <p className="text-muted-foreground">{new Date(event.lastDetectedAt).toLocaleString()}</p>
            </div>
            <div>
              <p className="font-semibold">Automations</p>
              {Array.isArray((mitigation as any)?.actions) ? (
                <ul className="list-disc list-inside text-muted-foreground">
                  {(mitigation as any).actions.map((action: string) => (
                    <li key={action}>{action.replace('_', ' ')}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">No automated mitigation recorded.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Mitigation log</CardTitle>
            <CardDescription>Automatically captured actions executed by the orchestrator.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {mitigation ? (
              <div className="rounded-md border p-3 space-y-2">
                <p className="font-semibold capitalize">{(mitigation.type as string | undefined) ?? 'mitigation'}</p>
                <pre className="text-xs bg-muted rounded-md p-3 overflow-x-auto">{JSON.stringify(mitigation, null, 2)}</pre>
              </div>
            ) : (
              <p className="text-muted-foreground">No mitigation payload stored.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Timeline note</CardTitle>
            <CardDescription>Every drift signal writes to the credential timeline.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span>ChronoTimeline entry created when this drift was detected.</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span>Resolving the drift will emit a DRIFT_RESOLVED event.</span>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

