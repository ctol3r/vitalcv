'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
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

// Dynamically import force graph to avoid SSR issues
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.API_BASE_URL ||
  '';

interface IdentityLineageGraph {
  nodes: Array<{
    id: string;
    label: string;
    type: 'source' | 'field';
    weight: number;
  }>;
  edges: Array<{
    id: string;
    fromSource: string;
    toField: string;
    fromNodeId: string;
    toNodeId: string;
    weight: number;
    evidence?: string;
  }>;
}

interface IdentityFusionGraphResponse {
  clinicianId: string;
  snapshotId: string;
  generatedAt: string;
  confidence: number;
  payload: {
    lineage: IdentityLineageGraph;
    sourceBreakdown: Record<string, number>;
    reliability: {
      overall: number;
      coverage: number;
      agreement: number;
      recency: number;
      validationDensity: number;
    };
  };
  anchor: {
    txHash: string;
    network: string;
  } | null;
}

export default function IdentityGraphPage() {
  const [data, setData] = useState<IdentityFusionGraphResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedClinicianId, setSelectedClinicianId] = useState<string>('cln_demo');

  const fetchLineage = useCallback(async (clinicianId: string, options?: { refresh?: boolean }) => {
    setLoading(true);
    setError(null);

    try {
      const base =
        API_BASE || (typeof window !== 'undefined' ? window.location.origin : '');
      if (!base) {
        throw new Error('API base URL not configured');
      }
      const url = new URL(
        `${base.replace(/\/$/, '')}/api/identity/fusion/${encodeURIComponent(clinicianId)}`,
      );
      if (options?.refresh) {
        url.searchParams.set('refresh', 'true');
      }
      const res = await fetch(url.toString(), { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`Failed to fetch lineage: ${res.statusText}`);
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedClinicianId) {
      fetchLineage(selectedClinicianId);
    }
  }, [selectedClinicianId, fetchLineage]);

  if (loading && !data) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">Loading identity graph...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive">{error}</p>
            <Button onClick={() => fetchLineage(selectedClinicianId)} className="mt-4">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  // Build graph data
  const graphData = {
    nodes: data.payload.lineage.nodes.map((node) => ({
      id: node.id,
      label: node.label,
      type: node.type,
      weight: node.weight,
    })),
    links: data.payload.lineage.edges.map((edge) => ({
      source: edge.fromNodeId,
      target: edge.toNodeId,
      value: edge.weight,
      label: edge.toField,
    })),
  };

  const sourceTypeColors: Record<string, string> = {
    NPPES: '#3b82f6',
    STATE_BOARD: '#10b981',
    NPDB: '#ef4444',
    AHPRA: '#8b5cf6',
    GMC: '#f97316',
    NMC: '#14b8a6',
    source: '#2563eb',
    field: '#94a3b8',
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Network className="h-8 w-8" />
            Identity Fusion Graph
          </h1>
          <p className="text-muted-foreground mt-1">
            Visualize identity source relationships and lineage
          </p>
        </div>
        <div className="flex items-center gap-4">
          <input
            type="text"
            placeholder="Clinician ID"
            value={selectedClinicianId}
            onChange={(e) => setSelectedClinicianId(e.target.value)}
            className="px-3 py-2 border rounded"
          />
          <Button
            onClick={() => fetchLineage(selectedClinicianId, { refresh: true })}
            disabled={loading}
          >
            <RefreshCcw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Source nodes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.payload.lineage.nodes.filter((node) => node.type === 'source').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Registries and monitors contributing to fusion
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Field nodes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.payload.lineage.nodes.filter((node) => node.type === 'field').length}
            </div>
            <p className="text-xs text-muted-foreground">Identity attributes being traced</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Evidence edges</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.payload.lineage.edges.length}</div>
            <p className="text-xs text-muted-foreground">Source → field evidence links</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Reliability</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(data.payload.reliability.overall * 100).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">Multi-source confidence</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Source breakdown</CardTitle>
          <CardDescription>Relative weight of each registry contributing to fusion</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 text-sm">
            {(() => {
              const entries = Object.entries(data.payload.sourceBreakdown);
              if (!entries.length) {
                return <span className="text-muted-foreground text-xs">No sources recorded.</span>;
              }
              const total = entries.reduce((sum, [, value]) => sum + value, 0) || 1;
              return entries.map(([source, value]) => (
                <Badge key={source} variant="secondary" className="gap-1 text-xs">
                  {source.toUpperCase()} · {Math.round((value / total) * 100)}%
                </Badge>
              ));
            })()}
          </div>
        </CardContent>
      </Card>

      {/* Graph Visualization */}
      <Card>
        <CardHeader>
          <CardTitle>Fusion Graph</CardTitle>
          <CardDescription>
            Interactive visualization of identity source relationships
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[600px] border rounded-lg bg-background">
            {typeof window !== 'undefined' && (
              <ForceGraph2D
                graphData={graphData}
                nodeLabel={(node: any) => `${node.label} • ${node.type}`}
                nodeColor={(node: any) =>
                  node.type === 'source'
                    ? sourceTypeColors[node.label] ?? sourceTypeColors.source
                    : sourceTypeColors.field
                }
                linkColor={() => '#94a3b8'}
                nodeVal={(node: any) => Math.max(4, (node.weight ?? 0.5) * 12)}
                linkWidth={(link: any) => Math.max(1, (link.value ?? 1) * 2)}
                linkDirectionalParticles={2}
                linkDirectionalParticleWidth={2}
                linkDirectionalParticleSpeed={0.005}
                cooldownTicks={100}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Node Details */}
      <Card>
        <CardHeader>
          <CardTitle>Node Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.payload.lineage.nodes.map((node) => (
              <div
                key={node.id}
                className="flex items-center justify-between p-3 border rounded"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{
                      backgroundColor:
                        node.type === 'source'
                          ? sourceTypeColors[node.label] ?? sourceTypeColors.source
                          : sourceTypeColors.field,
                    }}
                  />
                  <div>
                    <div className="font-medium">{node.label}</div>
                    <div className="text-xs text-muted-foreground uppercase">{node.type}</div>
                  </div>
                </div>
                <Badge variant="outline" className="font-mono text-xs">
                  weight {(node.weight ?? 0).toFixed(2)}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

