'use client';

import { useState, useEffect } from 'react';
import { Network, AlertTriangle, CheckCircle2, RefreshCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  'http://localhost:4000';

export default function RegulatoryGraphPage() {
  const [graph, setGraph] = useState<any>(null);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadGraph() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/regulatory-graph`);
      if (res.ok) {
        const data = await res.json();
        setGraph(data);
      }
    } catch (error) {
      console.error('Failed to load graph:', error);
    } finally {
      setLoading(false);
    }
  }

  async function checkConflicts() {
    try {
      const res = await fetch(`${API_BASE}/api/regulatory-graph/conflicts`);
      if (res.ok) {
        const data = await res.json();
        setConflicts(data);
      }
    } catch (error) {
      console.error('Failed to check conflicts:', error);
    }
  }

  useEffect(() => {
    loadGraph();
    checkConflicts();
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="space-y-2">
        <Badge variant="secondary">Admin · Regulatory Graph</Badge>
        <div>
          <h1 className="text-3xl font-semibold leading-tight">Regulatory Graph Intelligence</h1>
          <p className="text-muted-foreground">
            Graph model of all regulatory bodies, rules, dependencies, compacts & equivalencies
          </p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Regulatory Graph</CardTitle>
          <CardDescription>NCQA, JC, DEA, FSMB, PSYPACT, NLC, IMLC</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button onClick={loadGraph} disabled={loading}>
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" onClick={checkConflicts}>
              <AlertTriangle className="h-4 w-4 mr-2" />
              Check Conflicts
            </Button>
          </div>
          {graph && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Nodes</p>
                <p className="text-2xl font-bold">{graph.graph?.nodes?.length || 0}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Edges</p>
                <p className="text-2xl font-bold">{graph.graph?.edges?.length || 0}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {conflicts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Regulatory Conflicts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {conflicts.map((conflict, i) => (
                <div key={i} className="p-3 bg-yellow-50 rounded-md">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-600" />
                    <div>
                      <p className="font-medium text-yellow-900">{conflict.node1} ↔ {conflict.node2}</p>
                      <p className="text-sm text-yellow-800">{conflict.reason}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

