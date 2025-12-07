'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Download, Network, AlertTriangle, CheckCircle2, Anchor } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export default function MasterCredGraphPage() {
  const searchParams = useSearchParams();
  const clinicianId = searchParams.get('clinicianId') || 'self';
  const [graph, setGraph] = useState<any>(null);
  const [contradictions, setContradictions] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [gravity, setGravity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGraph();
    fetchContradictions();
    fetchSummary();
    fetchGravity();
  }, [clinicianId]);

  const fetchGraph = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/master-cred-graph/${clinicianId}`);
      if (res.ok) {
        const data = await res.json();
        setGraph(data.graph);
      }
    } catch (error) {
      console.error('Failed to fetch master graph', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchContradictions = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/master-cred-graph/${clinicianId}/contradictions`);
      if (res.ok) {
        const data = await res.json();
        setContradictions(data.contradictions || []);
      }
    } catch (error) {
      console.error('Failed to fetch contradictions', error);
    }
  };

  const fetchSummary = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/master-cred-graph/${clinicianId}/summary`);
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary);
      }
    } catch (error) {
      console.error('Failed to fetch summary', error);
    }
  };

  const fetchGravity = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/master-cred-graph/${clinicianId}/gravity`);
      if (res.ok) {
        const data = await res.json();
        setGravity(data.gravity || []);
      }
    } catch (error) {
      console.error('Failed to fetch gravity', error);
    }
  };

  const handleAnchor = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/master-cred-graph/${clinicianId}/anchor`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        alert(`Graph anchored! Digest: ${data.digest}`);
        fetchGraph();
      }
    } catch (error) {
      console.error('Failed to anchor graph', error);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Master Credential Graph</h1>
          <p className="text-muted-foreground mt-2">
            The definitive graph of all clinician credentials, issuers, trust roots, and lineage
          </p>
        </div>
        <Button onClick={handleAnchor}>
          <Anchor className="mr-2 h-4 w-4" />
          Anchor Graph
        </Button>
      </div>

      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Total Credentials</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalCredentials || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Active</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.activeCredentials || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Expired</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.expiredCredentials || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Avg Trust Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.avgTrustScore?.toFixed(1) || 0}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {contradictions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Graph Contradictions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {contradictions.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Badge variant={c.severity === 'high' ? 'destructive' : 'secondary'}>
                    {c.severity}
                  </Badge>
                  <span>{c.type}: {c.nodes.join(', ')}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {gravity.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Credential Gravity (Most Influential)</CardTitle>
            <CardDescription>Nodes most influential in verification</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {gravity.slice(0, 10).map((g, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="font-mono text-sm">{g.nodeId}</span>
                  <Badge>{g.gravity.toFixed(2)}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {graph && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Network className="h-5 w-5" />
              Graph Structure
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-medium mb-2">Nodes: {graph.nodes?.length || 0}</div>
                <div className="text-sm font-medium mb-2">Edges: {graph.edges?.length || 0}</div>
                <div className="text-sm font-medium">Trust Roots: {graph.trustRoots?.length || 0}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}








