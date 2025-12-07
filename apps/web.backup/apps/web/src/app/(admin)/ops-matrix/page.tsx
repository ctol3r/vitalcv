'use client';

import { useCallback, useState } from 'react';
import { Building, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function OpsMatrixPage() {
  const [orgId, setOrgId] = useState('');
  const [matrix, setMatrix] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMatrix = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/ops-matrix/${orgId}`);
      if (!response.ok) {
        throw new Error(`Failed to load matrix (${response.status})`);
      }
      const data = await response.json();
      setMatrix(data);
    } catch (err) {
      console.error('Failed to fetch matrix', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  const buildMatrix = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/ops-matrix/${orgId}/build`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error(`Failed to build matrix (${response.status})`);
      }
      const data = await response.json();
      setMatrix(data);
    } catch (err) {
      console.error('Failed to build matrix', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  const anchorSnapshot = useCallback(async () => {
    if (!orgId) return;
    try {
      const response = await fetch(`${API_BASE}/api/ops-matrix/${orgId}/anchor`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to anchor snapshot');
      }
      alert('Ops matrix snapshot anchored successfully');
    } catch (err) {
      console.error('Failed to anchor snapshot', err);
      alert('Failed to anchor snapshot');
    }
  }, [orgId]);

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Employer Operational Intelligence Matrix</h1>
          <p className="text-muted-foreground">
            Map, score and predict the operational behavior & maturity of every employer
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>View Operational Intelligence Matrix</CardTitle>
          <CardDescription>Enter an organization ID to view or build ops matrix</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              placeholder="Organization ID"
              className="flex-1"
            />
            <Button onClick={fetchMatrix} disabled={!orgId || loading}>
              View
            </Button>
            <Button onClick={buildMatrix} disabled={!orgId || loading} variant="outline">
              Build
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

      {matrix && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Operational Maturity Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="text-4xl font-bold">{(matrix.matrix?.score * 100 || 0).toFixed(1)}%</div>
                <div className="flex-1">
                  <Progress value={matrix.matrix?.score * 100 || 0} className="h-2" />
                </div>
                <Badge variant={(matrix.matrix?.score || 0) >= 0.8 ? 'default' : (matrix.matrix?.score || 0) >= 0.6 ? 'secondary' : 'destructive'}>
                  {(matrix.matrix?.score || 0) >= 0.8 ? 'High' : (matrix.matrix?.score || 0) >= 0.6 ? 'Medium' : 'Low'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {matrix.matrix?.dimensions && (
            <Card>
              <CardHeader>
                <CardTitle>Operational Dimensions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(matrix.matrix.dimensions).map(([key, value]: [string, any]) => (
                  <div key={key}>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm capitalize">{key.replace('_', ' ')}</span>
                      <span className="text-sm font-medium">{(value * 100).toFixed(1)}%</span>
                    </div>
                    <Progress value={value * 100} />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {matrix.matrix?.bottlenecks && matrix.matrix.bottlenecks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Bottlenecks</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {matrix.matrix.bottlenecks.map((bottleneck: any, idx: number) => (
                  <div key={idx} className="flex items-start justify-between p-3 border rounded">
                    <div>
                      <div className="font-medium">{bottleneck.type}</div>
                      <div className="text-sm text-muted-foreground">{bottleneck.rootCause}</div>
                    </div>
                    <Badge variant="destructive">Severity: {(bottleneck.severity * 100).toFixed(0)}%</Badge>
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
          </div>
        </>
      )}
    </div>
  );
}

