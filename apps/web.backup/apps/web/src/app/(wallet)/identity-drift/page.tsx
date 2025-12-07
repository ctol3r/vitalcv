'use client';

import { useCallback, useState } from 'react';
import { TrendingDown, AlertTriangle, CheckCircle, Activity, FileDown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function IdentityDriftPage() {
  const [clinicianId, setClinicianId] = useState('');
  const [drift, setDrift] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDrift = useCallback(async () => {
    if (!clinicianId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/identity-fidelity/${clinicianId}/drift`);
      if (!response.ok) {
        throw new Error(`Failed to load drift data (${response.status})`);
      }
      const data = await response.json();
      setDrift(data);
    } catch (err) {
      console.error('Failed to fetch drift', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [clinicianId]);

  const ingestSignals = useCallback(async () => {
    if (!clinicianId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/identity-fidelity/${clinicianId}/ingest`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error(`Failed to ingest signals (${response.status})`);
      }
      const data = await response.json();
      setDrift(data);
    } catch (err) {
      console.error('Failed to ingest signals', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [clinicianId]);

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Identity Drift Heatfield</h1>
          <p className="text-muted-foreground">
            Monitor identity fidelity and detect drift across all identity axes
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Identity Fidelity Monitoring</CardTitle>
          <CardDescription>Enter a clinician ID to view identity drift and fidelity metrics</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={clinicianId}
              onChange={(e) => setClinicianId(e.target.value)}
              placeholder="Clinician ID"
              className="flex-1"
            />
            <Button onClick={fetchDrift} disabled={!clinicianId || loading}>
              {loading ? 'Loading...' : 'View Drift'}
            </Button>
            <Button onClick={ingestSignals} disabled={!clinicianId || loading} variant="outline">
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

      {drift && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Overall Fidelity Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Fidelity Score</span>
                  <span className="text-2xl font-bold">{drift.overallScore?.toFixed(1) || 0}</span>
                </div>
                <Progress value={drift.overallScore || 0} className="h-2" />
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant={drift.overallScore >= 80 ? 'default' : drift.overallScore >= 60 ? 'secondary' : 'destructive'}>
                    {drift.overallScore >= 80 ? 'High' : drift.overallScore >= 60 ? 'Medium' : 'Low'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fidelity Axes</CardTitle>
              <CardDescription>30-axis identity fidelity metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {drift.axes && Object.entries(drift.axes).map(([key, value]: [string, any]) => (
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

          {drift.anomalies && drift.anomalies.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  Detected Anomalies
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc list-inside space-y-2">
                  {drift.anomalies.map((anomaly: string, idx: number) => (
                    <li key={idx} className="text-sm text-muted-foreground">{anomaly}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {drift.recommendations && drift.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc list-inside space-y-2">
                  {drift.recommendations.map((rec: string, idx: number) => (
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








