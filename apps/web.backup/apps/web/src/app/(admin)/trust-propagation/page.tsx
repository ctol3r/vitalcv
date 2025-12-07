'use client';

import { useCallback, useState } from 'react';
import { Network, TrendingUp, AlertTriangle, Activity, FileDown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function TrustPropagationPage() {
  const [orgId, setOrgId] = useState('');
  const [propagation, setPropagation] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPropagation = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/trust-propagation/${orgId}`);
      if (!response.ok) {
        throw new Error(`Failed to load propagation data (${response.status})`);
      }
      const data = await response.json();
      setPropagation(data);
    } catch (err) {
      console.error('Failed to fetch propagation', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  const ingestSignals = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/trust-propagation/${orgId}/ingest`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error(`Failed to ingest signals (${response.status})`);
      }
      const data = await response.json();
      setPropagation(data);
    } catch (err) {
      console.error('Failed to ingest signals', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Trust Propagation Heatfield</h1>
          <p className="text-muted-foreground">
            Monitor how employer behavior propagates trust across regions, clinicians, and systems
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Trust Propagation Monitoring</CardTitle>
          <CardDescription>Enter an organization ID to view trust propagation metrics</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              placeholder="Organization ID"
              className="flex-1"
            />
            <Button onClick={fetchPropagation} disabled={!orgId || loading}>
              {loading ? 'Loading...' : 'View Propagation'}
            </Button>
            <Button onClick={ingestSignals} disabled={!orgId || loading} variant="outline">
              Ingest Signals
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {propagation && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Overall Propagation Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Propagation Score</span>
                  <span className="text-2xl font-bold">{propagation.overallPropagationScore?.toFixed(1) || 0}</span>
                </div>
                <Progress value={propagation.overallPropagationScore || 0} className="h-2" />
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant={propagation.overallPropagationScore >= 80 ? 'default' : propagation.overallPropagationScore >= 60 ? 'secondary' : 'destructive'}>
                    {propagation.overallPropagationScore >= 80 ? 'High' : propagation.overallPropagationScore >= 60 ? 'Medium' : 'Low'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Gravitational Field Strength</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Field Strength</span>
                    <span className="text-xl font-bold">{propagation.gravitationalFieldStrength?.toFixed(1) || 0}</span>
                  </div>
                  <Progress value={propagation.gravitationalFieldStrength || 0} className="h-2" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Propagation Velocity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Velocity</span>
                    <span className="text-xl font-bold">{propagation.propagationVelocity?.toFixed(1) || 0}</span>
                  </div>
                  <Progress value={propagation.propagationVelocity || 0} className="h-2" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Propagation Axes</CardTitle>
              <CardDescription>30-axis trust propagation metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {propagation.axes && Object.entries(propagation.axes).map(([key, value]: [string, any]) => (
                  <div key={key} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                      <span className="text-sm font-bold">{value?.toFixed(1) || 0}</span>
                    </div>
                    <Progress value={value || 0} className="h-1" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {propagation.anomalies && propagation.anomalies.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  Detected Anomalies
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc list-inside space-y-2">
                  {propagation.anomalies.map((anomaly: string, idx: number) => (
                    <li key={idx} className="text-sm text-muted-foreground">{anomaly}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {propagation.recommendations && propagation.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                  Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc list-inside space-y-2">
                  {propagation.recommendations.map((rec: string, idx: number) => (
                    <li key={idx} className="text-sm text-muted-foreground">{rec}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}








