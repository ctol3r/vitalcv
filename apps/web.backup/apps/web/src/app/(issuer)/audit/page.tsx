'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { ClipboardList, Copy, Loader2, ShieldCheck, Stethoscope } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import type { AuditEvent } from '@/lib/issuer/types'

export default function IssuerAuditLog() {
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch('/api/issuer/audit')
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data?.error || 'Unable to load audit log')
        }
        setEvents(data.events ?? [])
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : 'Unable to load audit log.')
      } finally {
        setLoading(false)
      }
    }

    fetchEvents()
  }, [])

  const stats = useMemo(() => {
    return {
      total: events.length,
      psv: events.filter((evt) => evt.type === 'psv_completed').length,
      issued: events.filter((evt) => evt.type === 'credential_issued').length,
      registrationAnchors: events.filter((evt) => evt.type === 'issuer_registration').length,
    }
  }, [events])

  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      toast({ title: 'Copied', description: 'Hash copied to clipboard.' })
    } catch (copyError) {
      toast({
        title: 'Copy failed',
        description: copyError instanceof Error ? copyError.message : 'Unable to copy hash.',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="container mx-auto space-y-6 py-8">
      <header className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Issuer audit</p>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Anchor events</h1>
            <p className="text-muted-foreground max-w-2xl">
              Immutable ledger of issuer registration, PSV submissions, and credential issuance anchored with tx hashes.
            </p>
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-4" aria-live="polite">
        <SummaryCard title="Total events" value={stats.total} icon={<ClipboardList className="h-5 w-5" />} />
        <SummaryCard title="PSV recorded" value={stats.psv} icon={<Stethoscope className="h-5 w-5" />} />
        <SummaryCard title="Credentials issued" value={stats.issued} icon={<ShieldCheck className="h-5 w-5" />} />
        <SummaryCard
          title="Issuer anchors"
          value={stats.registrationAnchors}
          icon={<ShieldCheck className="h-5 w-5 text-emerald-500" />}
        />
      </section>

      {error ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive">Unable to load events</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Audit log</CardTitle>
            <CardDescription>Latest anchors, newest first.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <LoadingTable />
            ) : events.length === 0 ? (
              <p className="text-sm text-muted-foreground">No audit events recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event</TableHead>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Claim</TableHead>
                      <TableHead>Tx hash</TableHead>
                      <TableHead>Type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.map((event) => (
                      <TableRow key={`${event.id}-${event.timestamp}`}>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium text-foreground">{event.summary}</div>
                            <div className="text-xs font-mono text-muted-foreground">{event.id}</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(event.timestamp).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {event.claimId ? (
                            <Button asChild variant="link" size="sm" className="px-0 text-sm">
                              <Link href={`/issuer/claims/${event.claimId}/psv`}>{event.claimId}</Link>
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="font-mono text-xs text-foreground">{truncateHash(event.txHash)}</code>
                            <Button variant="ghost" size="icon" onClick={() => handleCopy(event.txHash)} aria-label="Copy hash">
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {humanizeType(event.type)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function SummaryCard({ title, value, icon }: { title: string; value: number; icon: ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardDescription>{title}</CardDescription>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  )
}

function LoadingTable() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={`audit-${index}`} className="h-12 w-full" />
      ))}
    </div>
  )
}

function truncateHash(hash: string) {
  if (hash.length <= 16) return hash
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`
}

function humanizeType(type: AuditEvent['type']) {
  switch (type) {
    case 'psv_completed':
      return 'PSV completed'
    case 'credential_issued':
      return 'Credential issued'
    case 'issuer_registration':
      return 'Issuer registered'
    default:
      return 'Claim ingested'
  }
}

