'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Activity, Anchor, ClipboardCheck, Shield } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import type { AuditEvent } from '@/lib/issuer/types'

export default function IssuerAuditTimeline() {
  const params = useParams<{ id: string }>()
  const issuerId = params?.id
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!issuerId) return
    const fetchEvents = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/issuer/audit/${issuerId}`)
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data?.error || 'Unable to load audit timeline.')
        }
        setEvents(data.events as AuditEvent[])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load timeline.')
      } finally {
        setLoading(false)
      }
    }
    fetchEvents()
  }, [issuerId])

  const resolveIcon = (type: AuditEvent['type']) => {
    switch (type) {
      case 'issuer_registration':
        return Shield
      case 'psv_completed':
        return ClipboardCheck
      case 'credential_issued':
      case 'credential_issued_aries':
        return Anchor
      case 'claim_rejected':
        return Activity
      default:
        return Activity
    }
  }

  return (
    <div className="container mx-auto space-y-6 py-8">
      <header>
        <p className="text-sm text-muted-foreground">Issuer audit</p>
        <h1 className="text-3xl font-semibold tracking-tight">Timeline</h1>
        <p className="text-muted-foreground">Chain anchors and PSV milestones for issuer {issuerId}</p>
      </header>

      {loading ? (
        <Card>
          <CardHeader>
            <CardTitle>Loading events...</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Collecting anchor log</CardContent>
        </Card>
      ) : error ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive">Failed to load timeline</CardTitle>
            <CardDescription className="text-destructive">{error}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Audit events</CardTitle>
            <CardDescription>{events.length} events recorded</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {events.map((event, index) => {
              const Icon = resolveIcon(event.type)
              return (
                <div key={event.id}>
                  <div className="flex items-start gap-3">
                    <Icon className="mt-1 h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{event.summary}</p>
                        <Badge variant="outline">{event.type}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {new Date(event.timestamp).toLocaleString()}
                      </p>
                      {event.metadata ? (
                        <p className="text-xs text-muted-foreground">
                          {JSON.stringify(event.metadata)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  {index < events.length - 1 ? <Separator className="my-3" /> : null}
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

