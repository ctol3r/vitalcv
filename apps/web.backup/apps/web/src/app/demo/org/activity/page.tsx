'use client'

import { useEffect, useMemo, useState } from 'react'
import { ActivitySquare, AlertTriangle, BellRing, CheckCircle2, Clock3 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type ActivityEvent = {
  id: string
  title: string
  detail: string
  timestamp: string
  type: 'info' | 'compliance'
  status?: 'PASS' | 'WARN' | 'FAIL'
}

export default function OrgActivityStreamPage() {
  const [events, setEvents] = useState<ActivityEvent[]>(() => seedEvents())
  const [srMessage, setSrMessage] = useState('')

  const complianceQueue = useMemo(() => buildComplianceFlash(), [])

  useEffect(() => {
    const timers = complianceQueue.map((entry) =>
      setTimeout(() => {
        setEvents((prev) => [entry.event, ...prev.slice(0, 49)])
        setSrMessage(entry.srMessage)
        setTimeout(() => setSrMessage(''), 2500)
      }, entry.delayMs),
    )
    return () => {
      timers.forEach(clearTimeout)
    }
  }, [complianceQueue])

  return (
    <div className="container mx-auto space-y-6 py-8">
      <header className="space-y-3">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Demo • Org • Activity</p>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <ActivitySquare className="h-7 w-7 text-primary" aria-hidden="true" />
          Activity Stream
        </h1>
        <p className="text-muted-foreground max-w-2xl">
          Live feed of credentialing tasks, committee actions, and compliance alerts. WARN/FAIL signals are injected in real time when CR or TJC statuses flip.
        </p>
      </header>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <div>
            <CardTitle>Latest activity</CardTitle>
            <p className="text-sm text-muted-foreground">Auto-refresh every few seconds; manual refresh not required.</p>
          </div>
          <Badge variant="outline" className="gap-2">
            <Clock3 className="h-4 w-4" aria-hidden="true" />
            Real-time
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {events.map((event) => (
            <article key={event.id} className="rounded-lg border px-4 py-3 flex flex-col gap-1" aria-live={event.type === 'compliance' ? 'polite' : undefined}>
              <div className="flex flex-wrap items-center gap-3">
                <p className="font-semibold">{event.title}</p>
                <StatusPill type={event.type} status={event.status} />
              </div>
              <p className="text-sm text-muted-foreground">{event.detail}</p>
              <p className="text-xs text-muted-foreground">{event.timestamp}</p>
            </article>
          ))}
        </CardContent>
      </Card>

      <span className="sr-only" aria-live="polite">
        {srMessage}
      </span>
    </div>
  )
}

function StatusPill({ type, status }: { type: ActivityEvent['type']; status?: ActivityEvent['status'] }) {
  if (type === 'compliance' && status) {
    if (status === 'FAIL') {
      return (
        <Badge variant="destructive" className="gap-1.5">
          <BellRing className="h-3.5 w-3.5" aria-hidden="true" />
          FAIL
        </Badge>
      )
    }
    if (status === 'WARN') {
      return (
        <Badge variant="outline" className="gap-1.5 border-amber-300 text-amber-900">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
          WARN
        </Badge>
      )
    }
    return (
      <Badge variant="secondary" className="gap-1.5">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
        PASS
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className="gap-1.5">
      <ActivitySquare className="h-3.5 w-3.5" aria-hidden="true" />
      Info
    </Badge>
  )
}

function seedEvents(): ActivityEvent[] {
  const now = new Date()
  return [
    {
      id: 'evt-401',
      title: 'Committee packet submitted',
      detail: 'Dr. Lennox packet frozen and routed to Credentials Committee.',
      timestamp: now.toLocaleTimeString(),
      type: 'info',
    },
    {
      id: 'evt-399',
      title: 'OPPE refresh completed',
      detail: 'Quality scores synced for Cardiology service line.',
      timestamp: new Date(now.getTime() - 3 * 60 * 1000).toLocaleTimeString(),
      type: 'info',
    },
    {
      id: 'evt-397',
      title: 'PSV bundle anchored',
      detail: 'PECOS + CA board verifications hashed • CR1 evidence updated.',
      timestamp: new Date(now.getTime() - 6 * 60 * 1000).toLocaleTimeString(),
      type: 'info',
    },
  ]
}

function buildComplianceFlash(): Array<{ delayMs: number; srMessage: string; event: ActivityEvent }> {
  const now = Date.now()
  return [
    {
      delayMs: 3500,
      srMessage: 'Compliance alert: Dr. Leo Alvarez CR1 flipped to FAIL.',
      event: {
        id: `evt-${now}-fail`,
        title: 'CR1 FAIL • Dr. Leo Alvarez',
        detail: 'License PSV older than 180 days; committee notified.',
        timestamp: new Date().toLocaleTimeString(),
        type: 'compliance',
        status: 'FAIL',
      },
    },
    {
      delayMs: 9000,
      srMessage: 'Compliance warning: FPPE dependency still open for Dr. Maya Lennox.',
      event: {
        id: `evt-${now}-warn`,
        title: 'TJC WARN • Dr. Maya Lennox',
        detail: 'FPPE imaging review awaiting sign-off. Auto reminder sent.',
        timestamp: new Date().toLocaleTimeString(),
        type: 'compliance',
        status: 'WARN',
      },
    },
  ]
}


