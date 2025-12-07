'use client';

import { useEffect, useState } from 'react';
import { RefreshCcw, Network, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  'http://localhost:4000';

interface TrustConstellationData {
  nodes: Array<{
    id: string;
    type: string;
    trustScore: number;
  }>;
  clusters: Array<{
    id: string;
    nodes: string[];
    avgTrust: number;
  }>;
  collapseEvents: Array<{
    timestamp: string;
    nodes: string[];
    severity: string;
  }>;
  drift: Array<{
    nodeId: string;
    previousTrust: number;
    currentTrust: number;
    change: number;
  }>;
}

export default function TrustConstellationPage() {
  const [data, setData] = useState<TrustConstellationData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/trust-constellation`);
      if (res.ok) {
        const constellation = await res.json();
        setData(constellation);
      }
    } catch (error) {
      console.error('Failed to load trust constellation:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="space-y-2">
        <Badge variant="secondary">Admin · Trust Constellation</Badge>
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <h1 className="text-3xl font-semibold leading-tight">Workforce Trust Constellation</h1>
            <p className="text-muted-foreground">
              Map of trust relationships across clinicians, employers, issuers, regulators & chains
            </p>
          </div>
          <Button
            variant="outline"
            className="ml-auto gap-2"
            onClick={loadData}
            disabled={loading}
          >
            <RefreshCcw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </header>

      {data && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Total Nodes</CardTitle>
                <CardDescription>Trust nodes in constellation</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold">{data.nodes.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Clusters</CardTitle>
                <CardDescription>Trust clusters identified</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold">{data.clusters.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Collapse Events</CardTitle>
                <CardDescription>Systemic trust collapses</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold">{data.collapseEvents.length}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Trust Clusters</CardTitle>
              <CardDescription>Grouped trust nodes by score</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.clusters.map((cluster, idx) => (
                  <div key={idx} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Network className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold capitalize">{cluster.id.replace('_', ' ')}</span>
                        <Badge variant="outline">{cluster.nodes.length} nodes</Badge>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-semibold">{Math.round(cluster.avgTrust)}%</div>
                        <Progress value={cluster.avgTrust} className="w-24 mt-1" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {data.drift.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Trust Drift</CardTitle>
                <CardDescription>Significant trust shifts over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.drift.map((item, idx) => (
                    <div key={idx} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold">{item.nodeId}</span>
                        <Badge variant={item.change > 0 ? 'default' : 'destructive'}>
                          {item.change > 0 ? '+' : ''}{item.change}%
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {item.previousTrust}% → {item.currentTrust}%
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {data.collapseEvents.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Trust Collapse Events</CardTitle>
                <CardDescription>Systemic trust collapse detection</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.collapseEvents.map((event, idx) => (
                    <div key={idx} className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                        <span className="font-semibold capitalize">{event.severity} Severity</span>
                        <Badge variant="destructive">{event.nodes.length} nodes</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(event.timestamp).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {loading && !data && (
        <div className="flex items-center justify-center py-12">
          <RefreshCcw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

