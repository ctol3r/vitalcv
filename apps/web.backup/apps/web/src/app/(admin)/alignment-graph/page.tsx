'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, AlertTriangle, TrendingUp, Users, Network } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function AlignmentGraphPage() {
  const [region, setRegion] = useState('US');
  const [graph, setGraph] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGraph = useCallback(async () => {
    if (!region) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/workforce-alignment/${region}`);
      if (!response.ok) {
        throw new Error(`Failed to load alignment graph (${response.status})`);
      }
      const data = await response.json();
      setGraph(data);
    } catch (err) {
      console.error('Failed to fetch alignment graph', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [region]);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Workforce Alignment Graph</h1>
          <p className="text-muted-foreground">
            Connects workforce supply, demand, readiness, specialties & employer needs
          </p>
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Input
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="Region (e.g., US)"
            className="md:w-56"
          />
          <Button onClick={fetchGraph} variant="secondary">
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && <p className="text-muted-foreground">Loading alignment graph...</p>}

      {graph && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Network className="h-4 w-4" />
                Supply-Demand Ratio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {(graph.alignment?.supplyDemandRatio ?? 0).toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Readiness Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {((graph.alignment?.readinessScore ?? 0) * 100).toFixed(0)}%
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Nodes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {graph.graph?.nodes?.length ?? 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Edges
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {graph.graph?.edges?.length ?? 0}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {graph && graph.graph?.nodes && (
        <Card>
          <CardHeader>
            <CardTitle>Graph Structure</CardTitle>
            <CardDescription>Workforce alignment network visualization</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Specialty Alignment</h3>
                <div className="grid gap-2 md:grid-cols-2">
                  {Object.entries(graph.alignment?.specialtyFit || {}).map(([specialty, fit]: [string, any]) => (
                    <div key={specialty} className="flex items-center justify-between p-2 border rounded">
                      <span className="text-sm">{specialty}</span>
                      <Badge variant={fit > 0.7 ? 'default' : fit > 0.4 ? 'secondary' : 'destructive'}>
                        {(fit * 100).toFixed(0)}%
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

