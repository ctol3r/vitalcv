'use client';

import { useCallback, useState } from 'react';
import { Globe, TrendingUp, FileDown, CheckCircle, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function ComplianceHorizonPage() {
  const [region, setRegion] = useState('');
  const [horizon, setHorizon] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHorizon = useCallback(async () => {
    if (!region) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/compliance-horizon/${region}`);
      if (!response.ok) {
        throw new Error(`Failed to load horizon (${response.status})`);
      }
      const data = await response.json();
      setHorizon(data);
    } catch (err) {
      console.error('Failed to fetch horizon', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [region]);

  const anchorSnapshot = useCallback(async () => {
    if (!region) return;
    try {
      const response = await fetch(`${API_BASE}/api/compliance-horizon/${region}/anchor`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to anchor snapshot');
      }
      alert('Compliance horizon snapshot anchored successfully');
    } catch (err) {
      console.error('Failed to anchor snapshot', err);
      alert('Failed to anchor snapshot');
    }
  }, [region]);

  const exportPack = useCallback(async () => {
    if (!region) return;
    try {
      const response = await fetch(`${API_BASE}/api/compliance-horizon/${region}/export`);
      if (!response.ok) {
        throw new Error('Failed to export pack');
      }
      const data = await response.json();
      const blob = new Blob([data.pdfData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `compliance-horizon-${region}-${Date.now()}.json`;
      a.click();
    } catch (err) {
      console.error('Failed to export pack', err);
      alert('Failed to export pack');
    }
  }, [region]);

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Global Compliance Horizon Forecaster</h1>
          <p className="text-muted-foreground">
            Predict regulatory shifts, rule changes & future compliance burdens across regions
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>View Compliance Horizon</CardTitle>
          <CardDescription>Enter a region to view compliance forecast</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="Region (e.g., us-west-2)"
              className="flex-1"
            />
            <Button onClick={fetchHorizon} disabled={!region || loading}>
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

      {horizon && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Future Compliance Risk Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="text-4xl font-bold">{horizon.horizon?.futureRisk?.toFixed(1) || 0}/100</div>
                <div className="flex-1">
                  <Progress value={horizon.horizon?.futureRisk || 0} className="h-2" />
                </div>
                <Badge variant={(horizon.horizon?.futureRisk || 0) >= 70 ? 'destructive' : (horizon.horizon?.futureRisk || 0) >= 40 ? 'secondary' : 'default'}>
                  {(horizon.horizon?.futureRisk || 0) >= 70 ? 'High' : (horizon.horizon?.futureRisk || 0) >= 40 ? 'Medium' : 'Low'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {horizon.horizon?.predictions && horizon.horizon.predictions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Rule Change Predictions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {horizon.horizon.predictions.map((prediction: any, idx: number) => (
                  <div key={idx} className="flex items-start justify-between p-3 border rounded">
                    <div>
                      <div className="font-medium">{prediction.rule}</div>
                      <div className="text-sm text-muted-foreground">
                        {prediction.timeframe} - {prediction.impact} impact
                      </div>
                    </div>
                    <Badge>{(prediction.probability * 100).toFixed(0)}%</Badge>
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
            <Button onClick={exportPack} variant="outline">
              <FileDown className="mr-2 h-4 w-4" />
              Export Pack
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

