/**
 * Batch 199 - Task 199.5 - Org Graph UI
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function OrgGraphPage() {
  const [orgId, setOrgId] = useState('');
  const [graph, setGraph] = useState<any>(null);
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleLoadGraph = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/org-graph/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, orgData: {} })
      });
      const data = await res.json();
      setGraph(data);
    } catch (error: any) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDetectAnomalies = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/org-graph/anomalies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId })
      });
      const data = await res.json();
      setAnomalies(data.anomalies || []);
    } catch (error: any) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Organization Graph</h1>
        <p className="text-muted-foreground mt-2">
          Model health system, facility, department, committee, and role relationships
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Org Graph Management</CardTitle>
          <CardDescription>Load and analyze organization structure</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Organization ID</Label>
            <Input
              placeholder="Enter org ID"
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleLoadGraph} disabled={loading}>
              Load Graph
            </Button>
            <Button onClick={handleDetectAnomalies} disabled={loading} variant="outline">
              Detect Anomalies
            </Button>
          </div>
          {graph && (
            <Alert>
              <AlertDescription>
                <p>Nodes: {graph.nodes?.length || 0}</p>
                <p>Edges: {graph.edges?.length || 0}</p>
              </AlertDescription>
            </Alert>
          )}
          {anomalies.length > 0 && (
            <Alert>
              <AlertDescription>
                <p>Anomalies Detected: {anomalies.length}</p>
                <pre className="text-xs mt-2">{JSON.stringify(anomalies, null, 2)}</pre>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

