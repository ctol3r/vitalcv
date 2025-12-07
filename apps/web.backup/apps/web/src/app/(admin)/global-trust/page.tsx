'use client';

import { useCallback, useEffect, useState } from 'react';
import { Shield, TrendingUp, AlertTriangle, Network } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface TrustNode {
  id: string;
  type: 'issuer' | 'verifier' | 'employer' | 'clinician' | 'regulator';
  score: number;
  metadata?: Record<string, unknown>;
}

interface TrustEdge {
  from: string;
  to: string;
  weight: number;
  type: string;
}

interface TrustGraph {
  nodes: TrustNode[];
  edges: TrustEdge[];
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function GlobalTrustPage() {
  const [graph, setGraph] = useState<TrustGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clusters, setClusters] = useState<{
    highTrust: string[];
    lowTrust: string[];
    anomalies: Array<{ nodeId: string; reason: string }>;
  } | null>(null);

  const fetchTrustGraph = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/trust/global-graph`);
      if (!response.ok) {
        throw new Error(`Failed to load trust graph (${response.status})`);
      }
      const data = await response.json();
      setGraph(data.graph);
      setClusters(data.clusters);
    } catch (err) {
      console.error('Failed to fetch trust graph', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrustGraph();
  }, [fetchTrustGraph]);

  const nodeCounts = graph
    ? graph.nodes.reduce((acc, node) => {
        acc[node.type] = (acc[node.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    : {};

  const avgTrustScore =
    graph && graph.nodes.length > 0
      ? graph.nodes.reduce((sum, node) => sum + node.score, 0) / graph.nodes.length
      : 0;

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Global Trust Intelligence</h1>
          <p className="text-muted-foreground">
            Unified trust scoring across issuers, employers, clinicians, verifiers, and regulators.
          </p>
        </div>
        <Button onClick={fetchTrustGraph} variant="secondary">
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Nodes</CardTitle>
            <Network className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{graph?.nodes.length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Trust Score</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(avgTrustScore * 100).toFixed(1)}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Trust</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clusters?.highTrust.length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Anomalies</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clusters?.anomalies.length || 0}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Node Types</CardTitle>
            <CardDescription>Distribution by entity type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(nodeCounts).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between">
                  <span className="text-sm capitalize">{type}</span>
                  <Badge variant="secondary">{count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Trust Clusters</CardTitle>
            <CardDescription>High and low trust groupings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">High Trust</span>
                  <Badge variant="default">{clusters?.highTrust.length || 0}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  Nodes with trust score ≥ 0.8
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Low Trust</span>
                  <Badge variant="destructive">{clusters?.lowTrust.length || 0}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  Nodes with trust score &lt; 0.3
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {clusters && clusters.anomalies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Anomalies Detected</CardTitle>
            <CardDescription>Trust scoring anomalies requiring attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {clusters.anomalies.map((anomaly, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 border rounded">
                  <div>
                    <span className="text-sm font-medium">{anomaly.nodeId}</span>
                    <div className="text-xs text-muted-foreground">{anomaly.reason}</div>
                  </div>
                  <Badge variant="outline">Anomaly</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {loading && (
        <div className="flex items-center justify-center p-8">
          <div className="text-muted-foreground">Loading trust graph...</div>
        </div>
      )}
    </div>
  );
}








