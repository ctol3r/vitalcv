'use client';

import { useCallback, useEffect, useState } from 'react';
import { Globe2, TrendingUp, AlertTriangle, Users, MapPin } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function WorkforceMetaFlowPage() {
  const [tensorId, setTensorId] = useState('');
  const [metaflow, setMetaflow] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMetaFlow = useCallback(async () => {
    if (!tensorId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/workforce/metaflow/${tensorId}`);
      if (!response.ok) {
        throw new Error(`Failed to load metaflow data (${response.status})`);
      }
      const data = await response.json();
      setMetaflow(data.result);
    } catch (err) {
      console.error('Failed to fetch metaflow', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [tensorId]);

  const analyzeLaborDrift = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/workforce/metaflow/drift`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          regions: [
            { regionId: 'us-west', laborSupply: 1000, laborDemand: 1200, timestamp: new Date().toISOString() },
            { regionId: 'us-east', laborSupply: 1500, laborDemand: 1400, timestamp: new Date().toISOString() },
            { regionId: 'eu-central', laborSupply: 800, laborDemand: 900, timestamp: new Date().toISOString() },
          ],
        }),
      });
      if (!response.ok) throw new Error('Failed to analyze labor drift');
      const data = await response.json();
      setMetaflow((prev: any) => ({ ...prev, drift: data.result }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Globe2 className="h-8 w-8" />
            Workforce Planetary Flow Dashboard
          </h1>
          <p className="text-muted-foreground">
            Routing climate systems & evolutionary labor intelligence
          </p>
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Input
            value={tensorId}
            onChange={(e) => setTensorId(e.target.value)}
            placeholder="Tensor ID"
            className="md:w-64"
          />
          <Button onClick={fetchMetaFlow} variant="secondary" disabled={loading}>
            Analyze
          </Button>
          <Button onClick={analyzeLaborDrift} variant="outline" disabled={loading}>
            Labor Drift
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && <p className="text-muted-foreground">Analyzing workforce meta-flow...</p>}

      {metaflow && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Globe2 className="h-4 w-4" />
                Meta-Flow Tensor
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold mb-2">{tensorId}</div>
              <Badge variant="outline">Active</Badge>
            </CardContent>
          </Card>

          {metaflow.drift && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Labor Drift</CardTitle>
                <CardDescription>
                  {(metaflow.drift.drift * 100).toFixed(1)}% average drift
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {metaflow.drift.regions?.slice(0, 3).map((region: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="text-sm">{region.regionId}</span>
                    <Badge variant={region.direction === 'deficit' ? 'destructive' : 'secondary'}>
                      {region.direction}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Migration System
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold mb-2">
                {metaflow.migrationSystem ? 'Active' : 'Inactive'}
              </div>
              <Progress value={metaflow.migrationSystem ? 100 : 0} className="h-2" />
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Planetary Flow Map</CardTitle>
          <CardDescription>
            Visualize global workforce flows and migration patterns
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-muted rounded-lg flex items-center justify-center">
            <p className="text-muted-foreground">Planetary flow visualization coming soon</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

