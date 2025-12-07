'use client';

import { useEffect, useState } from 'react';
import { Network, RefreshCcw, TrendingUp, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  'http://localhost:4000';

export default function HealthcareGraphPage() {
  const [graph, setGraph] = useState<any>(null);
  const [partnerships, setPartnerships] = useState<any[]>([]);
  const [benchmarks, setBenchmarks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHealthcareGraph();
  }, []);

  async function loadHealthcareGraph() {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/healthcare-graph`);
      if (response.ok) {
        const data = await response.json();
        setGraph(data);
        setPartnerships(data.metadata?.partnerships || []);
        setBenchmarks(data.metadata?.benchmarks || []);
      }
    } catch (error) {
      console.error('Failed to load healthcare graph:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="space-y-2">
        <Badge variant="secondary">Admin · Healthcare Graph</Badge>
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <h1 className="text-3xl font-semibold leading-tight">Multi-System Healthcare Graph</h1>
            <p className="text-muted-foreground">
              Model relationships between health systems, facilities, committees, regulators, and employers
            </p>
          </div>
          <Button
            variant="outline"
            className="ml-auto gap-2"
            onClick={() => loadHealthcareGraph()}
            disabled={loading}
          >
            <RefreshCcw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </header>

      {graph && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Nodes</CardDescription>
              <CardTitle className="text-2xl">
                {Array.isArray(graph.nodes) ? graph.nodes.length : 0}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Edges</CardDescription>
              <CardTitle className="text-2xl">
                {Array.isArray(graph.edges) ? graph.edges.length : 0}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Graph Status</CardDescription>
              <CardTitle className="text-2xl text-green-600">Active</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {partnerships.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Strategic Partnerships</CardTitle>
            <CardDescription>Potential employer partnerships discovered</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {partnerships.map((partnership, idx) => (
              <div key={idx} className="p-3 rounded border">
                <div className="flex items-center gap-2 mb-1">
                  <Network className="h-4 w-4 text-blue-600" />
                  <span className="font-medium">
                    {partnership.system1} ↔ {partnership.system2}
                  </span>
                  <Badge variant="outline">Potential: {partnership.potential}%</Badge>
                </div>
                {partnership.reasons?.length > 0 && (
                  <ul className="text-sm text-muted-foreground list-disc list-inside">
                    {partnership.reasons.map((reason: string, rIdx: number) => (
                      <li key={rIdx}>{reason}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {benchmarks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Health System Benchmarking</CardTitle>
            <CardDescription>Quality, safety, and scalability comparisons</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {benchmarks.map((benchmark, idx) => (
              <div key={idx} className="p-3 rounded border">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{benchmark.systemId}</span>
                  <Badge variant="outline">Percentile: {benchmark.percentile}%</Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">Quality</p>
                    <p className="font-medium">{benchmark.rankings.quality}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Safety</p>
                    <p className="font-medium">{benchmark.rankings.safety}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Scalability</p>
                    <p className="font-medium">{benchmark.rankings.scalability}</p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}








