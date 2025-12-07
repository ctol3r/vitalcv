'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function EthicalCoherencePage() {
  const [orgId, setOrgId] = useState('');
  const [coherence, setCoherence] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCoherence = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/ethical-coherence/${orgId}/heatfield`);
      if (!response.ok) {
        throw new Error(`Failed to load coherence (${response.status})`);
      }
      const data = await response.json();
      setCoherence(data);
    } catch (err) {
      console.error('Failed to fetch coherence', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ethical Coherence Heatfield</h1>
          <p className="text-muted-foreground">
            Visualize ethical coherence patterns across organizational units
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ethical Coherence Heatfield</CardTitle>
          <CardDescription>Enter an organization ID to view coherence heatfield</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Organization ID"
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchCoherence()}
            />
            <Button onClick={fetchCoherence} disabled={loading || !orgId}>
              {loading ? 'Loading...' : 'View Heatfield'}
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {coherence && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Overall Coherence</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{coherence.overallCoherence?.toFixed(1) || 0}</div>
                    <Progress value={coherence.overallCoherence || 0} className="mt-2" />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Coherence Stability</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{coherence.coherenceStability?.toFixed(1) || 0}</div>
                    <Progress value={coherence.coherenceStability || 0} className="mt-2" />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Cross-Site Coherence</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{coherence.crossSiteCoherence?.toFixed(1) || 0}</div>
                    <Progress value={coherence.crossSiteCoherence || 0} className="mt-2" />
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Coherence Heatfield Map</CardTitle>
                  <CardDescription>Ethical coherence intensity across organizational units</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-2">
                    {coherence.heatfield?.map((unit: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-4 rounded-lg border"
                        style={{
                          backgroundColor: `rgba(34, 197, 94, ${unit.coherence / 100})`,
                        }}
                      >
                        <div className="text-sm font-medium">{unit.name}</div>
                        <div className="text-xs text-muted-foreground">{unit.coherence?.toFixed(1)}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}








