'use client'

import {
  Activity,
  Anchor,
  CheckCircle2,
  CircleDot,
  Loader2,
  RefreshCcw,
  ShieldAlert,
  ShieldCheck,
  Users2,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  ''

type WorkflowState = 'draft' | 'requested' | 'partially_signed' | 'fully_signed' | 'revoked'

interface AnchorMetadata {
  txHash: string
  timestamp?: string
  network?: string
}

interface ParticipantSignature {
  issuerDid: string
  signedAt: string
  anchor?: AnchorMetadata | null
  summary?: string
}

interface ActivityEntry {
  id: string
  type: 'draft_created' | 'invite_sent' | 'signatures_requested' | 'partial_signature' | 'fully_signed' | 'revoked'
  actor: string
  timestamp: string
  details?: Record<string, any>
}

interface MultiPartyWorkflowSummary {
  id: string
  baseCredentialId: string
  participantDids: string[]
  status: WorkflowState
  rootHash?: string | null
  createdAt: string
  updatedAt: string
  threadId: string
  signatures: ParticipantSignature[]
  activity: ActivityEntry[]
}

export default function MultiIssuePage() {
  const { toast } = useToast()
  const [workflows, setWorkflows] = useState<MultiPartyWorkflowSummary[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [operation, setOperation] = useState<'idle' | 'sending' | 'refreshing'>('idle')
  const [error, setError] = useState<string | null>(null)

  const selectedWorkflow = useMemo(
    () => workflows.find((wf) => wf.id === selectedId) ?? workflows[0] ?? null,
    [selectedId, workflows],
  )

  const fetchWorkflows = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (!API_BASE) {
        throw new Error('API_BASE not configured')
      }

      const response = await fetch(`${API_BASE}/issuer/multi?limit=5`, {
        cache: 'no-store',
      })

      if (!response.ok) {
        throw new Error('Backend declined request')
      }

      const payload = (await response.json()) as { workflows?: MultiPartyWorkflowSummary[] }
      const rows = normalizeWorkflows(payload.workflows ?? [])
      const nextRows = rows.length ? rows : buildFallbackWorkflows()
      setWorkflows(nextRows)
      setSelectedId(nextRows[0]?.id ?? null)
    } catch (err) {
      console.warn('[multi-issue] falling back to local data', err)
      const fallback = buildFallbackWorkflows()
      setWorkflows(fallback)
      setSelectedId(fallback[0]?.id ?? null)
      setError('Live API unavailable — showing synthetic snapshot.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchWorkflows()
  }, [fetchWorkflows])

  const refreshWorkflow = useCallback(
    async (workflowId: string | null) => {
      if (!workflowId) {
        return
      }
      setOperation('refreshing')
      try {
        if (!API_BASE) {
          throw new Error('API base missing')
        }
        const response = await fetch(`${API_BASE}/issuer/multi/${workflowId}`, { cache: 'no-store' })
        if (!response.ok) {
          throw new Error('Unable to refresh workflow')
        }
        const payload = (await response.json()) as { workflow: MultiPartyWorkflowSummary }
        setWorkflows((prev) => {
          const mapped = prev.map((wf) => (wf.id === workflowId ? normalizeWorkflow(payload.workflow) : wf))
          if (!mapped.some((wf) => wf.id === workflowId)) {
            mapped.unshift(normalizeWorkflow(payload.workflow))
          }
          return mapped
        })
        toast({
          title: 'Workflow refreshed',
          description: `Fetched latest anchors for ${workflowId}.`,
        })
      } catch (err) {
        console.warn('[multi-issue] refresh failed', err)
        toast({
          title: 'Refresh failed',
          description: err instanceof Error ? err.message : 'Unable to reach issuer API.',
          variant: 'destructive',
        })
      } finally {
        setOperation('idle')
      }
    },
    [toast],
  )

  const handleSendInvites = useCallback(async () => {
    if (!selectedWorkflow) return
    setOperation('sending')
    try {
      if (!API_BASE) {
        throw new Error('API base not configured')
      }
      const response = await fetch(`${API_BASE}/issuer/multi/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseCredentialId: selectedWorkflow.baseCredentialId,
          participantDids: selectedWorkflow.participantDids,
          requestedBy: selectedWorkflow.participantDids[0],
          summary: `Co-sign ${selectedWorkflow.baseCredentialId}`,
        }),
      })

      if (!response.ok) {
        throw new Error('Invite dispatch failed')
      }

      const payload = (await response.json()) as { workflow: MultiPartyWorkflowSummary }
      const nextWorkflow = normalizeWorkflow(payload.workflow)
      setWorkflows((prev) => [
        nextWorkflow,
        ...prev.filter((wf) => wf.id !== nextWorkflow.id),
      ])
      setSelectedId(nextWorkflow.id)
      toast({
        title: 'Co-issuer invitations sent',
        description: `Thread ${nextWorkflow.threadId} queued ${nextWorkflow.participantDids.length} invites.`,
      })
    } catch (err) {
      console.warn('[multi-issue] invite fallback', err)
      toast({
        title: 'Invite fallback',
        description: 'API unavailable — marking invites as simulated.',
        variant: 'destructive',
      })
      setWorkflows((prev) =>
        prev.map((wf) =>
          wf.id === selectedWorkflow.id
            ? {
                ...wf,
                status: wf.status === 'draft' ? 'requested' : wf.status,
                activity: appendSyntheticActivity(wf.activity, {
                  type: 'signatures_requested',
                  actor: selectedWorkflow.participantDids[0],
                }),
              }
            : wf,
        ),
      )
    } finally {
      setOperation('idle')
    }
  }, [selectedWorkflow, toast])

  const participantGrid = useMemo(() => {
    if (!selectedWorkflow) return []
    return selectedWorkflow.participantDids.map((did) => {
      const signature = selectedWorkflow.signatures.find((entry) => entry.issuerDid === did)
      return {
        did,
        status: signature ? 'signed' : selectedWorkflow.status === 'revoked' ? 'revoked' : 'pending',
        signedAt: signature?.signedAt,
        anchor: signature?.anchor,
      }
    })
  }, [selectedWorkflow])

  const statusSummary = useMemo(() => {
    if (!selectedWorkflow) {
      return { signed: 0, total: 0, pct: 0 }
    }
    const total = selectedWorkflow.participantDids.length
    const signed = selectedWorkflow.signatures.length
    return {
      signed,
      total,
      pct: total === 0 ? 0 : Math.round((signed / total) * 100),
    }
  }, [selectedWorkflow])

  if (!selectedWorkflow && loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Loading multi-party workflows" />
      </div>
    )
  }

  return (
    <div className="container mx-auto space-y-6 py-8">
      <header className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Multi-party issuance</p>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Coordinate co-issuer signatures</h1>
            <p className="text-muted-foreground max-w-3xl">
              Track invites, partial signatures, and chain anchors for shared credentials. Every step writes to the same proof
              thread so revocations notify the full cohort.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" disabled={operation !== 'idle'} onClick={() => void refreshWorkflow(selectedWorkflow?.id)}>
              {operation === 'refreshing' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
              Refresh activity
            </Button>
            <Button onClick={handleSendInvites} disabled={operation !== 'idle'}>
              {operation === 'sending' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Users2 className="mr-2 h-4 w-4" />}
              Send co-issuer invites
            </Button>
          </div>
        </div>
        {error ? (
          <div className="flex items-center gap-2 rounded-md border border-dashed border-amber-400 bg-amber-50/60 px-3 py-2 text-sm text-amber-900">
            <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        ) : null}
      </header>

      {selectedWorkflow ? (
        <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="text-xl">Workflow {selectedWorkflow.id}</CardTitle>
                  <CardDescription>Base credential {selectedWorkflow.baseCredentialId}</CardDescription>
                </div>
                <Badge variant={statusVariant(selectedWorkflow.status)} className="w-fit text-xs uppercase">
                  {selectedWorkflow.status.replace('-', ' ')}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 md:grid-cols-3">
                <SummaryStat
                  icon={<Users2 className="h-4 w-4" aria-hidden="true" />}
                  label="Participants"
                  value={`${statusSummary.signed}/${statusSummary.total}`}
                  hint={`${statusSummary.pct}% signed`}
                />
                <SummaryStat
                  icon={<ShieldCheck className="h-4 w-4" aria-hidden="true" />}
                  label="Chain root"
                  value={selectedWorkflow.rootHash ? truncate(selectedWorkflow.rootHash, 10) : 'pending'}
                  hint={selectedWorkflow.rootHash ? 'Anchored' : 'Awaiting quorum'}
                />
                <SummaryStat
                  icon={<Activity className="h-4 w-4" aria-hidden="true" />}
                  label="Last update"
                  value={new Date(selectedWorkflow.updatedAt).toLocaleString()}
                  hint={`Thread ${selectedWorkflow.threadId}`}
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CircleDot className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <p className="text-sm font-medium">Participants</p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {participantGrid.map((participant) => (
                    <div key={participant.did} className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-foreground">{participant.did}</p>
                        <Badge variant={participant.status === 'signed' ? 'default' : participant.status === 'revoked' ? 'destructive' : 'outline'}>
                          {participant.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {participant.signedAt ? `Signed ${new Date(participant.signedAt).toLocaleString()}` : 'Awaiting signature'}
                      </p>
                      {participant.anchor?.txHash ? (
                        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <Anchor className="h-3 w-3" aria-hidden="true" />
                          {truncate(participant.anchor.txHash, 12)}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="h-full">
            <CardHeader>
              <CardTitle>Co-issuer activity log</CardTitle>
              <CardDescription>Every partial signature emits an anchor hint.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                {selectedWorkflow.activity.slice().reverse().map((entry) => (
                  <div key={entry.id} className="space-y-1 rounded-md border px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {iconForActivity(entry.type)}
                        <p className="font-medium capitalize">{entry.type.replace('_', ' ')}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">{new Date(entry.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Actor: {entry.actor}</p>
                    {entry.details?.anchor?.txHash ? (
                      <p className="text-xs text-muted-foreground">
                        Anchor {truncate(entry.details.anchor.txHash, 12)}
                        {entry.details.anchor.network ? ` • ${entry.details.anchor.network}` : null}
                      </p>
                    ) : null}
                    {entry.details?.reason ? (
                      <p className="text-xs text-muted-foreground">Reason: {entry.details.reason}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No multi-party workflows yet</CardTitle>
            <CardDescription>Send your first co-issuer invite to start tracking signatures.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleSendInvites} disabled={operation !== 'idle'}>
              Kick off multi-party issuance
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function SummaryStat({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-2xl font-semibold">{value}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

function statusVariant(status: WorkflowState): 'default' | 'secondary' | 'outline' | 'destructive' {
  switch (status) {
    case 'fully_signed':
      return 'default'
    case 'partially_signed':
    case 'requested':
      return 'secondary'
    case 'draft':
      return 'outline'
    case 'revoked':
      return 'destructive'
    default:
      return 'outline'
  }
}

function iconForActivity(type: ActivityEntry['type']) {
  switch (type) {
    case 'partial_signature':
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
    case 'fully_signed':
      return <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
    case 'revoked':
      return <ShieldAlert className="h-4 w-4 text-red-500" aria-hidden="true" />
    default:
      return <Activity className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
  }
}

function truncate(value: string, size: number): string {
  if (!value) return ''
  if (value.length <= size) return value
  return `${value.slice(0, size)}…${value.slice(-4)}`
}

function normalizeWorkflows(rows: MultiPartyWorkflowSummary[]): MultiPartyWorkflowSummary[] {
  return rows.map(normalizeWorkflow)
}

function normalizeWorkflow(row: MultiPartyWorkflowSummary): MultiPartyWorkflowSummary {
  return {
    ...row,
    activity: Array.isArray(row.activity) ? row.activity : row.activity ?? [],
    signatures: Array.isArray(row.signatures) ? row.signatures : [],
  }
}

function buildFallbackWorkflows(): MultiPartyWorkflowSummary[] {
  const now = new Date()
  const base: MultiPartyWorkflowSummary = {
    id: 'mpc-fallback',
    baseCredentialId: 'VC-CLINICIAN-12345',
    participantDids: ['did:web:hospital.alpha', 'did:web:clinic.beta', 'did:web:qa.gamma'],
    status: 'partially_signed',
    rootHash: '0x9b1f3a6cfa0be2d4e5fbc765edd901aa',
    createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24).toISOString(),
    updatedAt: now.toISOString(),
    threadId: 'multi-party:mpc-fallback',
    signatures: [
      {
        issuerDid: 'did:web:hospital.alpha',
        signedAt: new Date(now.getTime() - 1000 * 60 * 45).toISOString(),
        anchor: {
          txHash: '0xabcd93f0fedc',
          timestamp: new Date(now.getTime() - 1000 * 60 * 45).toISOString(),
          network: 'pilot-l2',
        },
        summary: 'Clinical credential review complete',
      },
    ],
    activity: [
      {
        id: 'act-1',
        type: 'draft_created',
        actor: 'did:web:hospital.alpha',
        timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 24).toISOString(),
        details: {
          participantCount: 3,
        },
      },
      {
        id: 'act-2',
        type: 'signatures_requested',
        actor: 'did:web:hospital.alpha',
        timestamp: new Date(now.getTime() - 1000 * 60 * 90).toISOString(),
        details: {
          summary: 'Compact credential issuance',
        },
      },
      {
        id: 'act-3',
        type: 'partial_signature',
        actor: 'did:web:hospital.alpha',
        timestamp: new Date(now.getTime() - 1000 * 60 * 45).toISOString(),
        details: {
          anchor: {
            txHash: '0xabcd93f0fedc',
            network: 'pilot-l2',
          },
        },
      },
    ],
  }

  return [base]
}

function appendSyntheticActivity(entries: ActivityEntry[], addition: Partial<ActivityEntry>): ActivityEntry[] {
  const next: ActivityEntry = {
    id: addition.id ?? globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2),
    type: addition.type ?? 'invite_sent',
    actor: addition.actor ?? 'system',
    timestamp: addition.timestamp ?? new Date().toISOString(),
    details: addition.details ?? {},
  } as ActivityEntry
  return [...entries, next]
}

