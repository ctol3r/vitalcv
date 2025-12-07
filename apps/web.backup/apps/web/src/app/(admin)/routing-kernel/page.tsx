'use client';

import { useCallback, useState } from 'react';
import { Route, TrendingUp, AlertTriangle, FileDown, CheckCircle, Map } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function RoutingKernelPage() {
  const [region, setRegion] = useState('');
  const [kernel, setKernel] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchKernel = useCallback(async () => {
    if (!region) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/routing-kernel/${region}`);
      if (!response.ok) {
        throw new Error(`Failed to load kernel (${response.status})`);
      }
      const data = await response.json();
      setKernel(data);
    } catch (err) {
      console.error('Failed to fetch kernel', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [region]);

  const buildKernel = useCallback(async () => {
    if (!region) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/routing-kernel/${region}/build`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error(`Failed to build kernel (${response.status})`);
      }
      const data = await response.json();
      setKernel(data);
    } catch (err) {
      console.error('Failed to build kernel', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [region]);

  const anchorSnapshot = useCallback(async () => {
    if (!region) return;
    try {
      const response = await fetch(`${API_BASE}/api/routing-kernel/${region}/anchor`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to anchor snapshot');
      }
      alert('Routing kernel snapshot anchored successfully');
    } catch (err) {
      console.error('Failed to anchor snapshot', err);
      alert('Failed to anchor snapshot');
    }
  }, [region]);

  const exportKernel = useCallback(async () => {
    if (!region) return;
    try {
      const response = await fetch(`${API_BASE}/api/routing-kernel/${region}/export`);
      if (!response.ok) {
        throw new Error('Failed to export kernel');
      }
      const data = await response.json();
      const blob = new Blob([data.pdfData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `routing-kernel-${region}-${Date.now()}.json`;
      a.click();
    } catch (err) {
      console.error('Failed to export kernel', err);
      alert('Failed to export kernel');
    }
  }, [region]);

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dynamic Workforce Routing Kernel</h1>
          <p className="text-muted-foreground">
            Continuously route clinicians toward optimal jobs, roles, regions & shifts
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>View Routing Kernel</CardTitle>
          <CardDescription>Enter a region to view or build routing kernel</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="Region (e.g., us-west-2)"
              className="flex-1"
            />
            <Button onClick={fetchKernel} disabled={!region || loading}>
              View
            </Button>
            <Button onClick={buildKernel} disabled={!region || loading} variant="outline">
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

      {kernel && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Signals Collected</CardTitle>
                <Route className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kernel.signals?.length || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Routing Targets</CardTitle>
                <Map className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kernel.targets?.length || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Drift Detected</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {kernel.drift?.detected ? 'Yes' : 'No'}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Suggestions</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kernel.suggestions?.length || 0}</div>
              </CardContent>
            </Card>
          </div>

          {kernel.constraints && (
            <Card>
              <CardHeader>
                <CardTitle>Constraint Blockers</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span>Legal</span>
                  <Badge variant="destructive">{kernel.constraints.legal?.length || 0}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Credential</span>
                  <Badge variant="destructive">{kernel.constraints.credential?.length || 0}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Compact</span>
                  <Badge variant="destructive">{kernel.constraints.compact?.length || 0}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Privilege</span>
                  <Badge variant="destructive">{kernel.constraints.privilege?.length || 0}</Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {kernel.suggestions && kernel.suggestions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>AI Routing Improvement Suggestions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {kernel.suggestions.map((suggestion: any, idx: number) => (
                  <div key={idx} className="flex items-start justify-between p-3 border rounded">
                    <div>
                      <div className="font-medium">{suggestion.type}</div>
                      <div className="text-sm text-muted-foreground">{suggestion.description}</div>
                    </div>
                    <Badge>Impact: {(suggestion.impact * 100).toFixed(0)}%</Badge>
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
            <Button onClick={exportKernel} variant="outline">
              <FileDown className="mr-2 h-4 w-4" />
              Export PDF
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

