'use client';

import { useCallback, useState } from 'react';
import { Link2, AlertTriangle, FileDown, CheckCircle, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function ReconciliationPage() {
  const [clinicianId, setClinicianId] = useState('');
  const [fabric, setFabric] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFabric = useCallback(async () => {
    if (!clinicianId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/reconciliation/${clinicianId}`);
      if (!response.ok) {
        throw new Error(`Failed to load fabric (${response.status})`);
      }
      const data = await response.json();
      setFabric(data);
    } catch (err) {
      console.error('Failed to fetch fabric', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [clinicianId]);

  const anchorSnapshot = useCallback(async () => {
    if (!clinicianId) return;
    try {
      const response = await fetch(`${API_BASE}/api/reconciliation/${clinicianId}/anchor`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to anchor snapshot');
      }
      alert('Reconciliation fabric snapshot anchored successfully');
    } catch (err) {
      console.error('Failed to anchor snapshot', err);
      alert('Failed to anchor snapshot');
    }
  }, [clinicianId]);

  const exportAudit = useCallback(async () => {
    if (!clinicianId) return;
    try {
      const response = await fetch(`${API_BASE}/api/reconciliation/${clinicianId}/export`);
      if (!response.ok) {
        throw new Error('Failed to export audit');
      }
      const data = await response.json();
      const blob = new Blob([data.pdfData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reconciliation-${clinicianId}-${Date.now()}.json`;
      a.click();
    } catch (err) {
      console.error('Failed to export audit', err);
      alert('Failed to export audit');
    }
  }, [clinicianId]);

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Multi-Chain Credential Reconciliation Fabric</h1>
          <p className="text-muted-foreground">
            Reconcile discrepancies between credential data across chains & off-chain systems
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>View Reconciliation Fabric</CardTitle>
          <CardDescription>Enter a clinician ID to view reconciliation status</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={clinicianId}
              onChange={(e) => setClinicianId(e.target.value)}
              placeholder="Clinician ID"
              className="flex-1"
            />
            <Button onClick={fetchFabric} disabled={!clinicianId || loading}>
              View
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {fabric && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Mismatches</CardTitle>
                <Link2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{fabric.fabric?.mismatches?.length || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Clusters</CardTitle>
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{fabric.fabric?.clusters?.length || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Risk Score</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{fabric.fabric?.riskScore?.toFixed(1) || 0}/100</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Executions</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {fabric.fabric?.execution?.filter((e: any) => e.status === 'success').length || 0}
                </div>
              </CardContent>
            </Card>
          </div>

          {fabric.fabric?.sourcePriority && fabric.fabric.sourcePriority.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Data Source Priority</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {fabric.fabric.sourcePriority.map((source: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <div className="font-medium capitalize">{source.source.replace('_', ' ')}</div>
                      <div className="text-sm text-muted-foreground">{source.reason}</div>
                    </div>
                    <Badge variant={source.authoritative ? 'default' : 'secondary'}>
                      Priority {source.priority} {source.authoritative ? '(Authoritative)' : ''}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="flex gap-2">
            <Button onClick={anchorSnapshot} variant="outline">
              <CheckCircle className="mr-2 h-4 w-4" />
              Anchor Snapshot
            </Button>
            <Button onClick={exportAudit} variant="outline">
              <FileDown className="mr-2 h-4 w-4" />
              Export Audit
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

