'use client';

import { useCallback, useState } from 'react';
import { Activity, TrendingUp, AlertTriangle, BarChart3, FileDown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function IdentityImpactPage() {
  const [clinicianId, setClinicianId] = useState('');
  const [impact, setImpact] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchImpact = useCallback(async () => {
    if (!clinicianId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/identity-fidelity/${clinicianId}/impact`);
      if (!response.ok) {
        throw new Error(`Failed to load impact data (${response.status})`);
      }
      const data = await response.json();
      setImpact(data);
    } catch (err) {
      console.error('Failed to fetch impact', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [clinicianId]);

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Identity Impact Heatmap</h1>
          <p className="text-muted-foreground">
            Visualize the impact of identity fidelity across systems and stakeholders
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Identity Impact Analysis</CardTitle>
          <CardDescription>Enter a clinician ID to view identity impact metrics</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={clinicianId}
              onChange={(e) => setClinicianId(e.target.value)}
              placeholder="Clinician ID"
              className="flex-1"
            />
            <Button onClick={fetchImpact} disabled={!clinicianId || loading}>
              {loading ? 'Loading...' : 'View Impact'}
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

      {impact && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Impact Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">System Impact</span>
                    <span className="text-xl font-bold">{impact.systemImpact?.toFixed(1) || 0}</span>
                  </div>
                  <Progress value={impact.systemImpact || 0} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Stakeholder Impact</span>
                    <span className="text-xl font-bold">{impact.stakeholderImpact?.toFixed(1) || 0}</span>
                  </div>
                  <Progress value={impact.stakeholderImpact || 0} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Trust Impact</span>
                    <span className="text-xl font-bold">{impact.trustImpact?.toFixed(1) || 0}</span>
                  </div>
                  <Progress value={impact.trustImpact || 0} className="h-2" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Impact Heatmap</CardTitle>
              <CardDescription>Visual representation of identity impact across dimensions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {impact.heatmap && Object.entries(impact.heatmap).map(([key, value]: [string, any]) => (
                  <div key={key} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                      <span className="text-xs font-bold">{value?.toFixed(0) || 0}</span>
                    </div>
                    <div className="h-8 bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 rounded" style={{ opacity: (value || 0) / 100 }} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}








