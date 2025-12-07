'use client'

import { useEffect, useMemo, useState } from 'react'
import { RefreshCw, Compass, GraduationCap, AlertTriangle } from 'lucide-react'

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
import { Separator } from '@/components/ui/separator'

const API_BASE = (process.env.NEXT_PUBLIC_PLATFORM_API ?? '').replace(/\/$/, '')
const DEMO_CLINICIAN = 'demo-78123'

interface SkillGraphNode {
  nodeId: string
  name: string
  category: 'specialty' | 'certification' | 'procedure'
  strength: number
  metadata?: Record<string, any>
}

interface SkillGraphResponse {
  graph: {
    clinicianId: string
    nodes: SkillGraphNode[]
    summary: {
      strengths: string[]
      gaps: string[]
      recommendedTraining: string[]
    }
  }
}

export default function SkillsExplorerPage() {
  const [graph, setGraph] = useState<SkillGraphResponse['graph'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void loadGraph()
  }, [])

  async function loadGraph() {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(buildApiUrl(`/api/skills/graph/${DEMO_CLINICIAN}`))
      if (!response.ok) {
        throw new Error(`Skill graph API responded with ${response.status}`)
      }
      const data = (await response.json()) as SkillGraphResponse
      setGraph(data.graph)
    } catch (err) {
      console.warn('Skill graph API failed, using mock data', err)
      setGraph(buildMockGraph())
      setError('Live skill graph unavailable — showing cached workload.')
    } finally {
      setLoading(false)
    }
  }

  const groupedNodes = useMemo(() => {
    if (!graph) return { specialties: [], certifications: [], procedures: [] }
    return {
      specialties: graph.nodes.filter((node) => node.category === 'specialty'),
      certifications: graph.nodes.filter((node) => node.category === 'certification'),
      procedures: graph.nodes.filter((node) => node.category === 'procedure'),
    }
  }, [graph])

  return (
    <div className="container mx-auto max-w-5xl space-y-6 py-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-wide text-muted-foreground">Wallet</p>
          <h1 className="text-3xl font-bold">Skills Explorer</h1>
          <p className="text-muted-foreground max-w-2xl">
            Visualize procedures, certifications, and specialties powering your credential
            wallet. Use this view to share verifiable training coverage or spot competency gaps.
          </p>
        </div>
        <Button variant="outline" onClick={loadGraph} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </header>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-amber-500/50 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Compass className="h-5 w-5 text-muted-foreground" />
              Strengths
            </CardTitle>
            <CardDescription>Top signals from procedure volume + credentials.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading || !graph ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <div className="space-y-3">
                {graph.summary.strengths.map((item) => (
                  <div
                    key={item}
                    className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                  >
                    <span>{item}</span>
                    <Badge variant="secondary">Focus</Badge>
                  </div>
                ))}
                {graph.summary.strengths.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No standout skills yet — ingest procedure volumes to populate this card.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-muted-foreground" />
              Gaps & training
            </CardTitle>
            <CardDescription>Gaps derived from canonical skill definitions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading || !graph ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Skill gaps
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {graph.summary.gaps.length === 0 && (
                      <Badge variant="secondary">No gaps flagged</Badge>
                    )}
                    {graph.summary.gaps.map((gap) => (
                      <Badge key={gap} variant="outline">
                        {gap}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Separator />
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Recommended training
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {graph.summary.recommendedTraining.length === 0 && (
                      <li>Fully compliant with tracked training programs.</li>
                    )}
                    {graph.summary.recommendedTraining.map((training) => (
                      <li key={training}>{training}</li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Skill inventory</CardTitle>
          <CardDescription>
            Verifiable specialties, certifications, and procedure volume.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading || !graph ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <div className="grid gap-6 md:grid-cols-3">
              <SkillColumn title="Specialty" nodes={groupedNodes.specialties} />
              <SkillColumn title="Certifications" nodes={groupedNodes.certifications} />
              <SkillColumn title="Procedures" nodes={groupedNodes.procedures} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function SkillColumn({ title, nodes }: { title: string; nodes: SkillGraphNode[] }) {
  return (
    <div>
      <p className="text-sm font-semibold">{title}</p>
      <div className="mt-3 space-y-2">
        {nodes.length === 0 && (
          <p className="text-sm text-muted-foreground">No entries.</p>
        )}
        {nodes.map((node) => (
          <div
            key={node.nodeId}
            className="rounded-lg border px-3 py-2 text-sm shadow-sm transition hover:bg-muted/40"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">{node.name}</span>
              <Badge variant="outline">{(node.strength * 100).toFixed(0)}%</Badge>
            </div>
            {node.metadata?.count && (
              <p className="text-xs text-muted-foreground">
                {node.metadata.count} cases last period
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function buildApiUrl(path: string) {
  if (!API_BASE) return path
  return `${API_BASE}${path}`
}

function buildMockGraph(): SkillGraphResponse['graph'] {
  const now = new Date()
  return {
    clinicianId: DEMO_CLINICIAN,
    nodes: [
      {
        nodeId: 'specialty:cardiology',
        name: 'Interventional Cardiology',
        category: 'specialty',
        strength: 0.95,
        metadata: { yearsExperience: 11, compactEligible: true },
      },
      {
        nodeId: 'cert:abim',
        name: 'ABIM Board',
        category: 'certification',
        strength: 0.88,
        metadata: { expiresAt: new Date(now.getFullYear() + 1, 5, 1).toISOString() },
      },
      {
        nodeId: 'procedure:tavr',
        name: 'TAVR',
        category: 'procedure',
        strength: 0.92,
        metadata: { count: 62 },
      },
      {
        nodeId: 'procedure:structural',
        name: 'Structural Heart Cath',
        category: 'procedure',
        strength: 0.78,
        metadata: { count: 44 },
      },
    ],
    summary: {
      strengths: ['TAVR', 'Structural Heart Cath'],
      gaps: ['Impella Support'],
      recommendedTraining: ['Radiation Safety Refresher', 'Impella Proficiency'],
    },
  }
}

