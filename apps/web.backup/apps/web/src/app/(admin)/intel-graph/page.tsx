'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Download, Network, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export default function IntelGraphPage() {
  const searchParams = useSearchParams();
  const clinicianId = searchParams.get('clinicianId') || 'self';
  const [graph, setGraph] = useState<any>(null);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGraph();
    fetchConflicts();
  }, [clinicianId]);

  const fetchGraph = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/intel-graph/${clinicianId}`);
      if (res.ok) {
        const data = await res.json();
        setGraph(data.graph);
      }
    } catch (error) {
      console.error('Failed to fetch intel graph', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchConflicts = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/intel-graph/${clinicianId}/conflicts`);
      if (res.ok) {
        const data = await res.json();
        setConflicts(data.conflicts || []);
      }
    } catch (error) {
      console.error('Failed to fetch conflicts', error);
    }
  };

  const handleExportJSON = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/intel-graph/${clinicianId}/export/json`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `intel-graph-${clinicianId}-${Date.now()}.json`;
        a.click();
      }
    } catch (error) {
      console.error('Failed to export JSON', error);
    }
  };

  const handleExportPDF = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/intel-graph/${clinicianId}/export/pdf`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `intel-graph-${clinicianId}-${Date.now()}.pdf`;
        a.click();
      }
    } catch (error) {
      console.error('Failed to export PDF', error);
    }
  };

  const handleAnchor = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/intel-graph/${clinicianId}/anchor`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        alert(`Graph anchored! TX Hash: ${data.txHash}`);
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

  const metadata = graph?.metadata || {};
  const nodes = graph?.nodes || [];
  const edges = graph?.edges || [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Credential Intelligence Graph</h1>
          <p className="text-muted-foreground mt-2">
            Unified knowledge graph of credentials, issuers, trust & events
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleExportJSON} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export JSON
          </Button>
          <Button onClick={handleExportPDF} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export PDF
          </Button>
          <Button onClick={handleAnchor}>Anchor Graph</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Nodes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metadata.nodeCount || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Edges</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metadata.edgeCount || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Conflicts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{conflicts.length}</div>
          </CardContent>
        </Card>
      </div>

      {conflicts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Credential Conflicts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {conflicts.map((conflict, idx) => (
                <div key={idx} className="p-3 border rounded-lg">
                  <div className="font-medium">{conflict.type}</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {conflict.description}
                  </div>
                  <div className="flex gap-2 mt-2">
                    {conflict.nodes.map((nodeId: string) => (
                      <Badge key={nodeId} variant="outline">
                        {nodeId}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Graph Overview</CardTitle>
          <CardDescription>Last updated: {metadata.lastUpdated || 'Never'}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h3 className="font-medium mb-2">Node Types</h3>
              <div className="flex flex-wrap gap-2">
                {Array.from(new Set(nodes.map((n: any) => n.type))).map((type: string) => (
                  <Badge key={type}>{type}</Badge>
                ))}
              </div>
            </div>
            <div>
              <h3 className="font-medium mb-2">Sample Nodes</h3>
              <div className="space-y-2">
                {nodes.slice(0, 5).map((node: any) => (
                  <div key={node.id} className="p-2 border rounded text-sm">
                    <div className="font-medium">{node.id}</div>
                    <div className="text-muted-foreground text-xs">{node.type}</div>
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

