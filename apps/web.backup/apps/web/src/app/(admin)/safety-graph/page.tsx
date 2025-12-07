'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, Download, Network, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface SafetyGraphNode {
  id: string;
  type: string;
  label: string;
  metadata: Record<string, unknown>;
}

interface SafetyGraphEdge {
  from: string;
  to: string;
  type: string;
  weight: number;
}

interface SafetyGraphData {
  nodes: SafetyGraphNode[];
  edges: SafetyGraphEdge[];
  riskScore?: number;
  clusters?: string[][];
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export default function SafetyGraphPage() {
  const searchParams = useSearchParams();
  const clinicianId = searchParams.get('clinicianId') || 'self';
  const [graph, setGraph] = useState<SafetyGraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [anomalies, setAnomalies] = useState<any[]>([]);

  useEffect(() => {
    fetchGraph();
    fetchAnomalies();
  }, [clinicianId]);

  const fetchGraph = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/safety/graph/${clinicianId}`);
      if (res.ok) {
        const data = await res.json();
        setGraph(data);
      }
    } catch (error) {
      console.error('Failed to fetch safety graph', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnomalies = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/safety/graph/${clinicianId}/anomalies`);
      if (res.ok) {
        const data = await res.json();
        setAnomalies(data.anomalies || []);
      }
    } catch (error) {
      console.error('Failed to fetch anomalies', error);
    }
  };

  const handleExport = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/safety/graph/${clinicianId}/export`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `safety-graph-${clinicianId}-${Date.now()}.json`;
        a.click();
      }
    } catch (error) {
      console.error('Failed to export', error);
    }
  };

  const getRiskLevel = (score?: number) => {
    if (!score) return { label: 'Unknown', color: 'gray' };
    if (score >= 0.8) return { label: 'Critical', color: 'red' };
    if (score >= 0.6) return { label: 'High', color: 'orange' };
    if (score >= 0.4) return { label: 'Medium', color: 'yellow' };
    return { label: 'Low', color: 'green' };
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const riskLevel = getRiskLevel(graph?.riskScore);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Provider Safety Graph</h1>
          <p className="text-muted-foreground mt-2">Multi-source safety intelligence visualization</p>
        </div>
        <Button onClick={handleExport} variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export Report
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Risk Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Badge variant={riskLevel.color as any}>{riskLevel.label}</Badge>
              <span className="text-2xl font-bold">
                {graph?.riskScore ? (graph.riskScore * 100).toFixed(1) : 'N/A'}%
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Graph Nodes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{graph?.nodes.length || 0}</div>
            <p className="text-sm text-muted-foreground">Total nodes in graph</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Active Anomalies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{anomalies.length}</div>
            <p className="text-sm text-muted-foreground">Detected anomalies</p>
          </CardContent>
        </Card>
      </div>

      {anomalies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Safety Anomalies
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {anomalies.map((anomaly, idx) => (
                <div key={idx} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <Badge variant={anomaly.severity === 'critical' ? 'destructive' : 'secondary'}>
                      {anomaly.severity}
                    </Badge>
                    <span className="text-sm text-muted-foreground">{anomaly.type}</span>
                  </div>
                  <p className="mt-2 text-sm">{anomaly.message}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="h-5 w-5" />
            Safety Graph Visualization
          </CardTitle>
          <CardDescription>Nodes and edges representing safety signals and correlations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-96 border rounded-lg p-4 bg-muted/50 flex items-center justify-center">
            <p className="text-muted-foreground">
              Graph visualization would be rendered here (using D3.js, Cytoscape, or similar)
            </p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold mb-2">Nodes ({graph?.nodes.length || 0})</h3>
              <div className="space-y-1 text-sm">
                {graph?.nodes.slice(0, 5).map((node) => (
                  <div key={node.id} className="flex items-center gap-2">
                    <Badge variant="outline">{node.type}</Badge>
                    <span>{node.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Edges ({graph?.edges.length || 0})</h3>
              <div className="space-y-1 text-sm">
                {graph?.edges.slice(0, 5).map((edge, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-muted-foreground">{edge.type}</span>
                    <Badge variant="outline">{(edge.weight * 100).toFixed(0)}%</Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

