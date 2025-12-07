'use client';

import { useCallback, useEffect, useState } from 'react';
import { Network, TrendingUp, Users, MapPin } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface WorkforceGraphData {
  nodes: Array<{ id: string; type: string; label: string; metadata: Record<string, unknown> }>;
  edges: Array<{ source: string; target: string; type: string; weight: number }>;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function WorkforceGraphPage() {
  const [graphData, setGraphData] = useState<WorkforceGraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [specialty, setSpecialty] = useState('');
  const [region, setRegion] = useState('');

  const fetchGraph = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (specialty) params.append('specialty', specialty);
      if (region) params.append('region', region);

      const response = await fetch(`${API_BASE}/api/workforce/graph?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Failed to load workforce graph (${response.status})`);
      }
      const data = await response.json();
      setGraphData(data);
    } catch (err) {
      console.error('Failed to fetch workforce graph', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [specialty, region]);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  const nodeCounts = graphData
    ? graphData.nodes.reduce((acc, node) => {
        acc[node.type] = (acc[node.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    : {};

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Workforce Graph</h1>
          <p className="text-muted-foreground">
            National graph of clinicians, specialties, credentials, privileges, and shortages.
          </p>
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Input
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
            placeholder="Filter by specialty"
            className="md:w-56"
          />
          <Input
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="Filter by region"
            className="md:w-56"
          />
          <Button onClick={fetchGraph} variant="secondary">
            Refresh
          </Button>
        </div>
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
            <div className="text-2xl font-bold">{graphData?.nodes.length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Edges</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{graphData?.edges.length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clinicians</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{nodeCounts.clinician || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Regions</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{nodeCounts.region || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Graph Visualization</CardTitle>
          <CardDescription>
            Interactive network visualization of workforce relationships
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-96">
              <p className="text-muted-foreground">Loading graph data...</p>
            </div>
          ) : graphData ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h3 className="font-semibold mb-2">Node Types</h3>
                  <div className="space-y-1">
                    {Object.entries(nodeCounts).map(([type, count]) => (
                      <div key={type} className="flex items-center justify-between">
                        <Badge variant="outline">{type}</Badge>
                        <span className="text-sm text-muted-foreground">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Edge Types</h3>
                  <div className="space-y-1">
                    {Array.from(
                      new Set(graphData.edges.map((e) => e.type))
                    ).map((type) => (
                      <div key={type} className="flex items-center justify-between">
                        <Badge variant="secondary">{type}</Badge>
                        <span className="text-sm text-muted-foreground">
                          {graphData.edges.filter((e) => e.type === type).length}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="border rounded-lg p-4 bg-muted/50">
                <p className="text-sm text-muted-foreground">
                  Graph visualization component would be rendered here.
                  Connect to a graph library like D3.js, Cytoscape, or vis.js for interactive visualization.
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No graph data available.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

