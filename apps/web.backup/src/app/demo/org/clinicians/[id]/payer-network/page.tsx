'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Network, RefreshCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

type GraphNodeType = 'clinician' | 'payer' | 'plan' | 'state';

interface GraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  metadata?: Record<string, unknown>;
}

interface GraphEdgeMetadata {
  status?: string;
  panelType?: string;
  effectiveDate?: string;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'enrolled' | 'offers' | 'covers';
  metadata?: GraphEdgeMetadata;
}

interface CoverageGap {
  state: string;
  missingPayers: string[];
  coverageRatio: number;
}

interface GraphSummary {
  totalPayers: number;
  activeEnrollments: number;
  panelFull: number;
  statesCovered: number;
}

interface PayerNetworkGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  warnings: string[];
  coverageGaps: CoverageGap[];
  summary: GraphSummary;
}

const NODE_COLORS: Record<GraphNodeType, string> = {
  clinician: 'fill-sky-600 text-white',
  payer: 'fill-blue-500 text-white',
  plan: 'fill-emerald-500 text-white',
  state: 'fill-slate-500 text-white',
};

const EDGE_COLORS: Record<GraphEdge['type'], string> = {
  enrolled: '#0ea5e9',
  offers: '#10b981',
  covers: '#94a3b8',
};

export default function PayerNetworkPage({ params }: { params: { id: string } }) {
  const [graph, setGraph] = useState<PayerNetworkGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadGraph() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/demo/org/clinicians/${params.id}/payer-network`,
        {
          headers: { Accept: 'application/json' },
        }
      );

      if (!response.ok) {
        throw new Error(`API responded with ${response.status}`);
      }

      const data = (await response.json()) as PayerNetworkGraph;
      setGraph(data);
    } catch (err) {
      console.warn('Unable to load payer network graph, showing demo data', err);
      setError('Showing demo network until live payer data is wired up.');
      setGraph(buildFallbackGraph(params.id));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadGraph();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const payerRows = useMemo(() => {
    if (!graph) return [];
    const clinicianNode = graph.nodes.find((node) => node.type === 'clinician');
    if (!clinicianNode) return [];
    const payerEdges = graph.edges.filter(
      (edge) => edge.type === 'enrolled' && edge.source === clinicianNode.id
    );

    return payerEdges.map((edge) => {
      const node = graph.nodes.find((n) => n.id === edge.target);
      return {
        id: node?.id ?? edge.target,
        name: node?.label ?? edge.target,
        status: edge.metadata?.status ?? 'UNKNOWN',
        panelType: edge.metadata?.panelType ?? 'OPEN',
        effectiveDate: edge.metadata?.effectiveDate ?? null,
      };
    });
  }, [graph]);

  return (
    <div className="container mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payer Network Coverage</h1>
          <p className="text-muted-foreground">
            Enrollment coverage map for clinician{' '}
            <span className="font-mono text-sm">{params.id}</span>
          </p>
        </div>
        <Button variant="outline" onClick={loadGraph} disabled={loading}>
          <RefreshCcw className="mr-2 h-4 w-4" aria-hidden="true" />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-dashed border-yellow-500/60 bg-yellow-50 p-4 text-sm text-yellow-900">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      <section aria-label="Network overview" className="grid gap-4 lg:grid-cols-4 sm:grid-cols-2">
        {graph ? (
          <>
            <SummaryCard label="Total Payers" value={graph.summary.totalPayers} />
            <SummaryCard label="Active Enrollments" value={graph.summary.activeEnrollments} />
            <SummaryCard label="Panel Full" value={graph.summary.panelFull} />
            <SummaryCard label="States Covered" value={graph.summary.statesCovered} />
          </>
        ) : (
          Array.from({ length: 4 }).map((_, idx) => (
            <Card key={idx} className="animate-pulse">
              <CardHeader>
                <CardDescription className="h-4 w-24 rounded bg-muted" />
                <CardTitle className="mt-2 h-6 w-16 rounded bg-muted" />
              </CardHeader>
            </Card>
          ))
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card aria-live="polite">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Network className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Visual Network Graph
            </CardTitle>
            <CardDescription>Clinician → Payer → Plan → State relationships</CardDescription>
          </CardHeader>
          <CardContent>
            {loading || !graph ? (
              <div className="flex items-center justify-center rounded-md border border-dashed border-muted p-10 text-muted-foreground">
                Rendering network…
              </div>
            ) : (
              <NetworkGraphCanvas graph={graph} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payer Enrollment Status</CardTitle>
            <CardDescription>Panel health by payer</CardDescription>
          </CardHeader>
          <CardContent>
            {loading || !graph ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div key={idx} className="h-12 rounded-md bg-muted" />
                ))}
              </div>
            ) : payerRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payer enrollments on file.</p>
            ) : (
              <div className="space-y-3">
                {payerRows.map((payer) => (
                  <div
                    key={payer.id}
                    className="items-center justify-between rounded-md border p-3 sm:flex"
                  >
                    <div>
                      <p className="font-medium">{payer.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Effective {formatDate(payer.effectiveDate)}
                      </p>
                    </div>
                    <div className="flex gap-2 pt-2 sm:pt-0">
                      <StatusBadge label={payer.status} />
                      <Badge variant="outline">{payer.panelType}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Coverage Warnings</CardTitle>
          <CardDescription>Recommended follow-ups across regions</CardDescription>
        </CardHeader>
        <CardContent>
          {loading || !graph ? (
            <div className="space-y-2">
              <div className="h-10 rounded-md bg-muted" />
              <div className="h-10 rounded-md bg-muted" />
            </div>
          ) : (
            <div className="space-y-4">
              {graph.warnings.length === 0 && graph.coverageGaps.length === 0 ? (
                <p className="text-sm text-muted-foreground">No warnings at this time.</p>
              ) : (
                <>
                  {graph.warnings.map((warning) => (
                    <div
                      key={warning}
                      className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
                    >
                      <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                      {warning}
                    </div>
                  ))}
                  {graph.coverageGaps.length > 0 && (
                    <>
                      <Separator />
                      <div className="space-y-3">
                        {graph.coverageGaps.map((gap) => (
                          <div key={gap.state} className="rounded-md border p-3 text-sm">
                            <p className="font-medium">State {gap.state}</p>
                            <p className="text-muted-foreground">
                              Missing: {gap.missingPayers.join(', ')}
                            </p>
                            <div className="mt-2 h-2 w-full rounded-full bg-muted">
                              <div
                                className="h-2 rounded-full bg-rose-500"
                                style={{ width: `${gap.coverageRatio * 100}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

function StatusBadge({ label }: { label: string }) {
  const normalized = label.toUpperCase();
  if (normalized === 'ENROLLED') {
    return <Badge className="bg-green-600 text-white">Enrolled</Badge>;
  }

  if (normalized === 'PANEL_FULL' || normalized === 'REJECTED') {
    return <Badge className="bg-red-600 text-white">Adverse</Badge>;
  }

  if (normalized === 'REVALIDATION_DUE') {
    return <Badge className="bg-amber-500 text-black">Revalidation Due</Badge>;
  }

  return <Badge variant="secondary">{label}</Badge>;
}

function NetworkGraphCanvas({ graph }: { graph: PayerNetworkGraph }) {
  const width = 620;
  const height = 360;
  const typeOrder: GraphNodeType[] = ['clinician', 'payer', 'plan', 'state'];
  const positions = new Map<string, { x: number; y: number }>();

  for (const type of typeOrder) {
    const nodesOfType = graph.nodes.filter((node) => node.type === type);
    if (!nodesOfType.length) continue;
    const columnIndex = typeOrder.indexOf(type);
    const x = (columnIndex / (typeOrder.length - 1)) * width;
    nodesOfType.forEach((node, index) => {
      const spacing = height / (nodesOfType.length + 1);
      const y = spacing * (index + 1);
      positions.set(node.id, { x, y });
    });
  }

  return (
    <svg
      role="img"
      aria-label="Network graph"
      viewBox={`0 0 ${width} ${height}`}
      className="w-full rounded-md border bg-slate-950/90 p-4 text-white"
    >
      {graph.edges.map((edge) => {
        const source = positions.get(edge.source);
        const target = positions.get(edge.target);
        if (!source || !target) return null;
        return (
          <line
            key={edge.id}
            x1={source.x + 10}
            y1={source.y}
            x2={target.x - 10}
            y2={target.y}
            stroke={EDGE_COLORS[edge.type]}
            strokeWidth={2}
            strokeOpacity={0.6}
          />
        );
      })}

      {graph.nodes.map((node) => {
        const position = positions.get(node.id);
        if (!position) return null;
        return (
          <g key={node.id} transform={`translate(${position.x}, ${position.y})`}>
            <circle r={18} className={NODE_COLORS[node.type]} />
            <text
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-[10px] font-medium"
            >
              {node.label.slice(0, 8)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function formatDate(value?: string | null) {
  if (!value) return 'Not recorded';
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function buildFallbackGraph(clinicianId: string): PayerNetworkGraph {
  return {
    nodes: [
      { id: `clinician:${clinicianId}`, type: 'clinician', label: `Clinician ${clinicianId}` },
      { id: 'payer:demo-uhc', type: 'payer', label: 'UnitedHealthcare' },
      { id: 'plan:demo-uhc:ppo', type: 'plan', label: 'PPO' },
      { id: 'state:CA', type: 'state', label: 'CA' },
      { id: 'state:WA', type: 'state', label: 'WA' },
    ],
    edges: [
      {
        id: 'edge:clinician->uhc',
        source: `clinician:${clinicianId}`,
        target: 'payer:demo-uhc',
        type: 'enrolled',
        metadata: { status: 'ENROLLED', panelType: 'OPEN', effectiveDate: new Date().toISOString() },
      },
      {
        id: 'edge:uhc->plan',
        source: 'payer:demo-uhc',
        target: 'plan:demo-uhc:ppo',
        type: 'offers',
      },
      {
        id: 'edge:plan->ca',
        source: 'plan:demo-uhc:ppo',
        target: 'state:CA',
        type: 'covers',
      },
      {
        id: 'edge:plan->wa',
        source: 'plan:demo-uhc:ppo',
        target: 'state:WA',
        type: 'covers',
      },
    ],
    warnings: ['Missing major payer(s) in CA: Blue Shield of California'],
    coverageGaps: [
      {
        state: 'CA',
        missingPayers: ['Blue Shield of California'],
        coverageRatio: 0.5,
      },
    ],
    summary: {
      totalPayers: 1,
      activeEnrollments: 1,
      panelFull: 0,
      statesCovered: 2,
    },
  };
}

