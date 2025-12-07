'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  RefreshCw,
  Activity,
  Radio,
  ArrowUpRight,
  Zap,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false })

const API_BASE = (process.env.NEXT_PUBLIC_PLATFORM_API ?? '').replace(/\/$/, '')

type RiskGraphSnapshot = {
  clinicianId: string
  nodes: Array<{
    id: string
    label: string
    severity: number
    category: string
    centrality?: number
    lastSignal?: string
    details?: Record<string, any>
  }>
  edges: Array<{
    id: string
    fromSignal: string
    toSignal: string
    weight: number
    active?: boolean
  }>
  metrics: {
    compositeRiskScore: number
    updatedAt: string
    centrality: Record<string, number>
    propagationPaths: string[][]
    focusSignal?: string
  }
  propagation?: {
    source: string
    severity: number
    updates: Array<{ signal: string; severity: number; weight: number }>
  }
}

interface PageProps {
  params: { clinicianId: string }
}

export default function RiskGraphPage({ params }: PageProps) {
  const { toast } = useToast()
  const [snapshot, setSnapshot] = useState<RiskGraphSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedNode, setSelectedNode] = useState<RiskGraphSnapshot['nodes'][number] | null>(null)
  const [pulse, setPulse] = useState(0)

  useEffect(() => {
    void loadSnapshot()
  }, [params.clinicianId])

  useEffect(() => {
    const timer = setInterval(() => {
      setPulse((value) => (value + 1) % 1000)
    }, 1200)
    return () => clearInterval(timer)
  }, [])

  async function loadSnapshot(anchor = true) {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(
        buildApiUrl(
          `/api/recruiter/risk-graph/${params.clinicianId}?anchor=${anchor ? 'true' : 'false'}`,
        ),
      )
      if (!response.ok) throw new Error(`Graph API failed (${response.status})`)
      const data = (await response.json()) as RiskGraphSnapshot
      setSnapshot(data)
      setSelectedNode(data.nodes[0] ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load risk graph')
    } finally {
      setLoading(false)
    }
  }

  async function propagate(signal: string) {
    try {
      const response = await fetch(
        buildApiUrl(`/api/recruiter/risk-graph/${params.clinicianId}/propagate`),
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            signal,
            severity: 0.85,
          }),
        },
      )
      if (!response.ok) throw new Error(`Propagation failed (${response.status})`)
      const data = (await response.json()) as RiskGraphSnapshot
      setSnapshot(data)
      toast({
        title: 'Risk propagated',
        description: `Signal ${signal} boosted downstream correlations.`,
      })
    } catch (err) {
      toast({
        title: 'Propagation failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  const graphData = useMemo(() => {
    if (!snapshot) return { nodes: [], links: [] }
    return {
      nodes: snapshot.nodes.map((node) => ({
        id: node.id,
        name: node.label,
        severity: node.severity,
        category: node.category,
        centrality: node.centrality ?? 0,
      })),
      links: snapshot.edges.map((edge) => ({
        source: edge.fromSignal,
        target: edge.toSignal,
        weight: edge.weight,
        active: edge.active,
      })),
    }
  }, [snapshot])

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-wide text-muted-foreground">Risk EKG</p>
          <h1 className="text-3xl font-bold">Credential risk graph</h1>
          <p className="text-muted-foreground max-w-2xl">
            Visualize how sanctions, fraud, NPDB, and readiness signals influence each other. Pulsing
            edges show active propagation paths impacting composite risk.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => loadSnapshot(false)} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button
            variant="secondary"
            onClick={() => propagate('sanctions')}
            disabled={loading}
          >
            <Zap className="mr-2 h-4 w-4" />
            Trigger propagation
          </Button>
        </div>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Risk graph unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard
          title="Composite risk"
          description="Weighted combination of all signals"
          value={
            snapshot ? `${(snapshot.metrics.compositeRiskScore * 100).toFixed(1)}%` : '—'
          }
          badge={snapshot ? classifySeverity(snapshot.metrics.compositeRiskScore) : undefined}
        />
        <MetricCard
          title="Dominant signal"
          description="Highest-severity node"
          value={
            snapshot
              ? snapshot.nodes
                  .slice()
                  .sort((a, b) => b.severity - a.severity)[0]
                  ?.label ?? '—'
              : '—'
          }
        />
        <MetricCard
          title="Propagation paths"
          description="High severity cascades"
          value={snapshot ? snapshot.metrics.propagationPaths.length : 0}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card className="h-[70vh]">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Graph view</CardTitle>
              <CardDescription>
                Node color reflects severity, pulsing edges show live propagation
              </CardDescription>
            </div>
            {snapshot && (
              <Badge variant="outline">
                Updated {new Date(snapshot.metrics.updatedAt).toLocaleString()}
              </Badge>
            )}
          </CardHeader>
          <CardContent className="h-full">
            {loading ? (
              <Skeleton className="h-full w-full" />
            ) : snapshot ? (
              <ForceGraph2D
                graphData={graphData}
                nodeLabel="name"
                nodeAutoColorBy="category"
                nodeCanvasObject={(node: any, ctx, scale) => {
                  const radius = 6 + node.severity * 6
                  ctx.beginPath()
                  ctx.arc(node.x!, node.y!, radius, 0, 2 * Math.PI, false)
                  ctx.fillStyle = severityColor(node.severity)
                  ctx.fill()
                  const fontSize = 14 / scale
                  if (fontSize > 4) {
                    ctx.font = `${fontSize}px Inter`
                    ctx.fillStyle = '#111827'
                    ctx.fillText(node.name, node.x! + radius + 2, node.y! + 4)
                  }
                }}
                linkColor={(link: any) =>
                  link.active
                    ? `rgba(239,68,68,${0.4 + 0.3 * Math.sin(pulse / 50)})`
                    : 'rgba(148,163,184,0.4)'
                }
                linkWidth={(link: any) => (link.active ? 3 : 1 + link.weight)}
                linkDirectionalArrowLength={4}
                linkDirectionalArrowRelPos={1}
                onNodeClick={(node: any) =>
                  setSelectedNode(snapshot.nodes.find((entry) => entry.id === node.id) ?? null)
                }
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                No graph data yet — run the risk engine for this clinician.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="h-[70vh] overflow-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              Signal details
            </CardTitle>
            <CardDescription>Inspect node severity, centrality and metadata.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedNode ? (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-semibold">{selectedNode.label}</p>
                    <p className="text-xs text-muted-foreground">
                      Last signal{' '}
                      {selectedNode.lastSignal
                        ? new Date(selectedNode.lastSignal).toLocaleString()
                        : 'n/a'}
                    </p>
                  </div>
                  <Badge>{(selectedNode.severity * 100).toFixed(1)}%</Badge>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span>Centrality</span>
                    <strong>{((selectedNode.centrality ?? 0) * 100).toFixed(0)}%</strong>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                    {selectedNode.details ? JSON.stringify(selectedNode.details) : 'No metadata'}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Select a node to inspect details.</p>
            )}
            <hr className="my-2" />
            <CardTitle className="text-base">Propagation paths</CardTitle>
            <div className="space-y-2 text-xs">
              {snapshot?.metrics.propagationPaths?.length ? (
                snapshot.metrics.propagationPaths.slice(0, 6).map((path, index) => (
                  <div key={`path-${index}`} className="flex items-center gap-1 text-muted-foreground">
                    {path.map((node, idx) => (
                      <span key={`${node}-${idx}`} className="flex items-center gap-1">
                        {idx > 0 && <ArrowUpRight className="h-3 w-3 text-muted-foreground" />}
                        <Badge variant="outline" className="font-mono">
                          {node}
                        </Badge>
                      </span>
                    ))}
                  </div>
                ))
              ) : (
                <p>No cascades detected.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

function MetricCard({
  title,
  description,
  value,
  badge,
}: {
  title: string
  description: string
  value: string | number
  badge?: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between">
        <span className="text-2xl font-semibold">{value}</span>
        {badge && (
          <Badge variant="outline" className="text-xs uppercase">
            {badge}
          </Badge>
        )}
      </CardContent>
    </Card>
  )
}

function classifySeverity(score: number) {
  if (score >= 0.75) return 'High'
  if (score >= 0.5) return 'Medium'
  return 'Low'
}

function severityColor(score: number) {
  if (score >= 0.75) return '#ef4444'
  if (score >= 0.5) return '#f97316'
  if (score >= 0.3) return '#facc15'
  return '#22c55e'
}

function buildApiUrl(path: string) {
  if (!API_BASE) return path
  return `${API_BASE}${path}`
}










