'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Globe, RefreshCcw, ShieldCheck, Share2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

type PortabilityConfidence = 'high' | 'medium' | 'low'

type StateSource = {
  type: 'license' | 'compact'
  label: string
  nodeId: string
  expiresAt?: string
}

type PortableOrgSummary = {
  orgId: string
  name: string
  state?: string
  ehrType?: string | null
  privileges: Array<{ id: string; label: string; status?: string }>
}

type PortablePayerSummary = {
  payerId?: string
  name: string
  enrollmentStatus?: string
  planTypes?: string[]
  states?: string[]
}

type PortableStateEntry = {
  state: string
  nodeId: string
  confidence: PortabilityConfidence
  score: number
  via: StateSource[]
  organizations: PortableOrgSummary[]
  payers: PortablePayerSummary[]
}

type GraphNode = {
  id: string
  type: string
  label: string
}

type GraphEdge = {
  id: string
  source: string
  target: string
  type: string
}

type CredentialPortabilityResponse = {
  clinicianId: string
  generatedAt: string
  states: PortableStateEntry[]
  summary: {
    totalStates: number
    highConfidenceStates: number
    organizations: number
    payers: number
    warnings: number
  }
  warnings: string[]
  graph: {
    nodes: GraphNode[]
    edges: GraphEdge[]
  }
}

const CONFIDENCE_BADGES: Record<PortabilityConfidence, { label: string; className: string }> = {
  high: { label: 'High', className: 'bg-emerald-600 text-white' },
  medium: { label: 'Medium', className: 'bg-amber-500 text-black' },
  low: { label: 'Low', className: 'bg-rose-600 text-white' },
}

export default function OrgGraphExplorerPage() {
  const [portability, setPortability] = useState<CredentialPortabilityResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadGraph() {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/demo/org/graph/portability?clinicianId=demo-clinician')
      if (!response.ok) {
        throw new Error(`Graph API responded with ${response.status}`)
      }
      const data = (await response.json()) as CredentialPortabilityResponse
      setPortability(data)
    } catch (err) {
      console.warn('Falling back to mock graph data', err)
      setError('Showing cached mock graph until live graph API is reachable.')
      setPortability(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadGraph()
  }, [])

  const stateCoverage = useMemo(() => portability?.states ?? [], [portability])

  return (
    <div className="container mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-wide text-muted-foreground">Demo • Org • Credential Graph</p>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Share2 className="h-6 w-6 text-primary" aria-hidden="true" />
            Credential Graph Explorer
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            Visualize how licenses, compacts, payer enrollments, and privileges form a portability graph for a clinician.
            Click on an edge to inspect coverage sources and downstream nodes.
          </p>
        </div>
        <Button onClick={loadGraph} variant="outline" disabled={loading}>
          <RefreshCcw className="mr-2 h-4 w-4" aria-hidden="true" />
          Refresh graph
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-dashed border-amber-500/70 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" aria-label="Graph summary">
        <SummaryCard label="Reachable states" value={portability?.summary.totalStates ?? 0} />
        <SummaryCard label="High confidence" value={portability?.summary.highConfidenceStates ?? 0} />
        <SummaryCard label="Active orgs" value={portability?.summary.organizations ?? 0} />
        <SummaryCard label="Active payers" value={portability?.summary.payers ?? 0} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            Portability map
          </CardTitle>
          <CardDescription>Graph traversal from clinician → license/compact → state → org/payer.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-64 items-center justify-center rounded-md border border-dashed border-muted text-muted-foreground">
              Building graph…
            </div>
          ) : portability ? (
            <GraphCanvas graph={portability.graph} />
          ) : (
            <p className="text-sm text-muted-foreground">Graph unavailable.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            State-by-state portability
          </CardTitle>
          <CardDescription>Confidence, coverage sources, and downstream partners per state.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="h-16 rounded-md bg-muted" />
              ))}
            </div>
          ) : stateCoverage.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reachable states yet.</p>
          ) : (
            stateCoverage.map((entry) => (
              <div key={entry.nodeId} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold">State {entry.state}</p>
                    <p className="text-sm text-muted-foreground">
                      {entry.organizations.length} orgs · {entry.payers.length} payers
                    </p>
                  </div>
                  <Badge className={CONFIDENCE_BADGES[entry.confidence].className}>
                    {CONFIDENCE_BADGES[entry.confidence].label}
                  </Badge>
                </div>
                <Separator className="my-3" />
                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Coverage sources</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {entry.via.map((source) => (
                        <Badge key={source.nodeId} variant="outline" className="font-normal">
                          {source.type === 'license' ? 'License' : 'Compact'} · {source.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Organizations</p>
                    <div className="mt-2 space-y-1">
                      {entry.organizations.length === 0 && (
                        <p className="text-sm text-muted-foreground">No privileged orgs on file.</p>
                      )}
                      {entry.organizations.map((org) => (
                        <div key={org.orgId} className="text-sm">
                          <p className="font-medium">{org.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {org.privileges.map((priv) => priv.label).join(', ') || 'Privileges pending'}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  )
}

function GraphCanvas({ graph }: { graph: { nodes: GraphNode[]; edges: GraphEdge[] } }) {
  const width = 640
  const height = 360
  const columnOrder = ['clinician', 'license', 'compact', 'state', 'org', 'payer']
  const positions = new Map<string, { x: number; y: number }>()

  columnOrder.forEach((type, columnIndex) => {
    const nodes = graph.nodes.filter((node) => node.type === type)
    if (!nodes.length) return
    const x = (columnIndex / (columnOrder.length - 1)) * width
    nodes.forEach((node, idx) => {
      const spacing = height / (nodes.length + 1)
      positions.set(node.id, { x, y: spacing * (idx + 1) })
    })
  })

  return (
    <svg
      role="img"
      aria-label="Credential portability graph"
      viewBox={`0 0 ${width} ${height}`}
      className="w-full rounded-md border bg-slate-950/80 p-4 text-white"
    >
      {graph.edges.map((edge) => {
        const source = positions.get(edge.source)
        const target = positions.get(edge.target)
        if (!source || !target) return null
        return (
          <line
            key={edge.id}
            x1={source.x + 12}
            y1={source.y}
            x2={target.x - 12}
            y2={target.y}
            stroke="#38bdf8"
            strokeOpacity={0.6}
            strokeWidth={2}
          />
        )
      })}
      {graph.nodes.map((node) => {
        const position = positions.get(node.id)
        if (!position) return null
        return (
          <g key={node.id} transform={`translate(${position.x}, ${position.y})`}>
            <circle r={18} className="fill-slate-800 stroke-white/60" />
            <text textAnchor="middle" dominantBaseline="middle" className="text-[9px] font-medium">
              {node.label.slice(0, 8)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

