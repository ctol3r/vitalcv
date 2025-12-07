'use client';

import { useEffect, useState } from 'react';
import { Network, TrendingUp, AlertTriangle, RefreshCcw, Download, Anchor } from 'lucide-react';
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

interface TrustGraph {
  nodes: Array<{ id: string; type: string; score: number }>;
  edges: Array<{ from: string; to: string; trustScore: number; asymmetry?: number }>;
  overallScore: number;
  evolution: Array<{ timestamp: string; event: string; impact: number }>;
}

export default function ClinicianEmployerTrustPage() {
  const [graph, setGraph] = useState<TrustGraph | null>(null);
  const [clinicianId, setClinicianId] = useState('');
  const [loading, setLoading] = useState(false);

  async function loadTrustGraph(id: string) {
    if (!id) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/trust/graph/${id}`);
      if (response.ok) {
        const data = await response.json();
        setGraph(data);
      }
    } catch (error) {
      console.error('Failed to load trust graph:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAnchor(id: string) {
    try {
      const response = await fetch(`${API_BASE}/api/trust/graph/${id}/anchor`, {
        method: 'POST',
      });
      if (response.ok) {
        const data = await response.json();
        alert(`Anchored! TX: ${data.txHash}`);
      }
    } catch (error) {
      console.error('Failed to anchor:', error);
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Clinician-Employer Trust Graph</h1>
          <p className="text-muted-foreground mt-2">
            Living graph of trust relationships between clinicians and employers
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Load Trust Graph</CardTitle>
          <CardDescription>Enter a clinician ID to view their trust graph</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <input
              type="text"
              value={clinicianId}
              onChange={(e) => setClinicianId(e.target.value)}
              placeholder="Clinician ID"
              className="flex-1 px-3 py-2 border rounded-md"
            />
            <Button onClick={() => loadTrustGraph(clinicianId)} disabled={loading}>
              {loading ? <RefreshCcw className="h-4 w-4 animate-spin" /> : 'Load'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {graph && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Overall Trust Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{graph.overallScore.toFixed(2)}</div>
                <div className="text-sm text-muted-foreground mt-1">
                  {graph.overallScore > 0.7 ? 'High' : graph.overallScore > 0.4 ? 'Medium' : 'Low'}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Nodes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{graph.nodes.length}</div>
                <div className="text-sm text-muted-foreground mt-1">Clinicians & Employers</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Edges</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{graph.edges.length}</div>
                <div className="text-sm text-muted-foreground mt-1">Trust Relationships</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Trust Relationships</CardTitle>
                  <CardDescription>Trust scores between clinicians and employers</CardDescription>
                </div>
                <Button onClick={() => handleAnchor(clinicianId)} variant="outline" size="sm">
                  <Anchor className="h-4 w-4 mr-2" />
                  Anchor
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {graph.edges.map((edge, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Network className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{edge.from} → {edge.to}</div>
                        {edge.asymmetry && edge.asymmetry > 0.3 && (
                          <Badge variant="destructive" className="mt-1">
                            Asymmetric: {edge.asymmetry.toFixed(2)}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={edge.trustScore > 0.7 ? 'default' : edge.trustScore > 0.4 ? 'secondary' : 'destructive'}
                      >
                        {edge.trustScore.toFixed(2)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Trust Evolution Timeline</CardTitle>
              <CardDescription>Track trust shifts across career</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {graph.evolution.slice(0, 10).map((event, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-2 border rounded">
                    <TrendingUp
                      className={cn(
                        'h-4 w-4',
                        event.impact > 0 ? 'text-green-500' : 'text-red-500'
                      )}
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium">{event.event}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(event.timestamp).toLocaleString()}
                      </div>
                    </div>
                    <Badge variant={event.impact > 0 ? 'default' : 'destructive'}>
                      {event.impact > 0 ? '+' : ''}{event.impact.toFixed(2)}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

