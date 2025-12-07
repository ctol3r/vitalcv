'use client';

import { useCallback, useEffect, useState } from 'react';
import { Zap, Activity, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

interface VerificationFabric {
  nodes?: {
    id: string;
    region: string;
    latency: number;
  }[];
  cache?: {
    hitRate: number;
  };
  performance?: {
    avgLatency: number;
    throughput: number;
    regions?: Record<string, number>;
  };
}

interface LatencyScore {
  region: string;
  avgLatency: number;
  score: number;
  ranking: number;
}

export default function VerificationFabricPage() {
  const [fabric, setFabric] = useState<VerificationFabric | null>(null);
  const [latencyScores, setLatencyScores] = useState<LatencyScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFabric = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fabricRes = await fetch(`${API_BASE}/api/verif-fabric`);
      if (!fabricRes.ok) throw new Error(`Failed to load fabric (${fabricRes.status})`);

      const fabricData = await fabricRes.json();
      setFabric(fabricData.fabric || fabricData);

      // Fetch latency scores for all regions
      const regions = ['US', 'EU', 'APAC'];
      const scores = await Promise.all(
        regions.map(async (region) => {
          try {
            const res = await fetch(`${API_BASE}/api/verif-fabric/latency/${region}`);
            if (res.ok) return await res.json();
          } catch (e) {
            console.error(`Failed to fetch latency for ${region}`, e);
          }
          return null;
        })
      );
      setLatencyScores(scores.filter((s): s is LatencyScore => s !== null));
    } catch (err) {
      console.error('Failed to fetch verification fabric', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFabric();
    const interval = setInterval(fetchFabric, 30_000);
    return () => clearInterval(interval);
  }, [fetchFabric]);

  const avgLatency = fabric?.performance?.avgLatency || 0;
  const cacheHitRate = fabric?.cache?.hitRate || 0;

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Zero-Latency Verification Fabric</h1>
          <p className="text-muted-foreground">
            Distributed verification mesh with caching, chain proofs & selective disclosure acceleration.
          </p>
        </div>
        <Button onClick={fetchFabric} variant="secondary">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="text-red-500 text-sm">{error}</div>
      )}

      {loading && (
        <div className="text-center py-8">
          <p className="text-muted-foreground">Loading verification fabric...</p>
        </div>
      )}

      {!loading && fabric && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Average Latency</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{avgLatency.toFixed(0)}ms</div>
                <p className="text-xs text-muted-foreground mt-1">Target: &lt;50ms</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Cache Hit Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(cacheHitRate * 100).toFixed(0)}%</div>
                <Progress value={cacheHitRate * 100} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Active Nodes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{fabric.nodes?.length || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">Distributed nodes</p>
              </CardContent>
            </Card>
          </div>

          {fabric.nodes && fabric.nodes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Verification Nodes</CardTitle>
                <CardDescription>Node status and performance by region</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {fabric.nodes.map((node) => (
                    <div key={node.id} className="flex items-center justify-between p-2 border rounded">
                      <div>
                        <div className="font-medium">{node.id}</div>
                        <div className="text-sm text-muted-foreground">{node.region}</div>
                      </div>
                      <Badge variant={node.latency < 50 ? 'outline' : 'secondary'}>
                        {node.latency}ms
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {latencyScores.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Regional Latency Scores</CardTitle>
                <CardDescription>Verification speed performance by region</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {latencyScores.map((score) => (
                    <div key={score.region}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">{score.region}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-muted-foreground">
                            {score.avgLatency}ms
                          </span>
                          <Badge variant="outline">Score: {score.score}</Badge>
                        </div>
                      </div>
                      <Progress value={score.score} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}








