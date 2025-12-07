'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCcw, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function StaffGraphPage() {
  const [loading, setLoading] = useState(true);
  const [graph, setGraph] = useState<any>(null);
  const [clinicianId] = useState('demo_clinician_123');

  useEffect(() => {
    loadGraph();
  }, []);

  async function loadGraph() {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/staff-graph/${clinicianId}`);
      if (res.ok) {
        const data = await res.json();
        setGraph(data);
      }
    } catch (error) {
      console.error('Failed to load staff graph:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Universal Staff Credentials Graph</h1>
          <p className="text-muted-foreground mt-2">
            Master graph of ALL credentials, roles, privileges, training, safety & readiness
          </p>
        </div>
        <Button variant="outline" onClick={loadGraph} disabled={loading}>
          <RefreshCcw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {graph && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Graph Nodes</CardTitle>
                <CardDescription>Total credential nodes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{graph.nodes?.length || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Conflicts</CardTitle>
                <CardDescription>Detected contradictions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-500">{graph.conflicts?.length || 0}</div>
                {graph.conflicts && graph.conflicts.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {graph.conflicts.slice(0, 3).map((c: any, i: number) => (
                      <div key={i} className="text-sm text-muted-foreground">
                        {c.reason}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>High-Risk Nodes</CardTitle>
                <CardDescription>Safety-critical anomalies</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-500">{graph.highRiskNodes?.length || 0}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Readiness Overlay</CardTitle>
              <CardDescription>Color-coded readiness status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-green-500" />
                  <span>Green: {Object.values(graph.readinessOverlay || {}).filter((v: any) => v === 'green').length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-yellow-500" />
                  <span>Yellow: {Object.values(graph.readinessOverlay || {}).filter((v: any) => v === 'yellow').length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-red-500" />
                  <span>Red: {Object.values(graph.readinessOverlay || {}).filter((v: any) => v === 'red').length}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {graph.lineage && graph.lineage.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Credential Lineage</CardTitle>
                <CardDescription>Chronological credential evolution</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {graph.lineage.slice(0, 5).map((l: any, i: number) => (
                    <div key={i} className="p-3 border rounded">
                      <div className="font-medium">{l.node}</div>
                      <div className="text-sm text-muted-foreground">
                        {l.evolution?.length || 0} evolution steps
                      </div>
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

