'use client';

import { useCallback, useState } from 'react';
import { Building2, AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function SystemBehaviorPage() {
  const [orgId, setOrgId] = useState('');
  const [behavior, setBehavior] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBehavior = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/employer-system-behavior/${orgId}`);
      if (!response.ok) {
        throw new Error(`Failed to load behavior (${response.status})`);
      }
      const data = await response.json();
      setBehavior(data.behavior);
    } catch (err) {
      console.error('Failed to fetch behavior', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  const generateBehavior = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/employer-system-behavior`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId }),
      });
      if (!response.ok) throw new Error('Failed to generate behavior map');
      const data = await response.json();
      setBehavior(data.behavior);
    } catch (err) {
      console.error('Failed to generate behavior', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Employer Systemic Behavior Map</h1>
        <p className="text-muted-foreground">
          Map employer behavior as a system — not single actions — across fairness, safety, hiring, and trust
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>System Behavior</CardTitle>
          <CardDescription>Enter an organization ID to analyze systemic behavior</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              placeholder="Organization ID"
              className="flex-1"
            />
            <Button onClick={fetchBehavior} disabled={!orgId || loading}>
              Load
            </Button>
            <Button onClick={generateBehavior} variant="outline" disabled={!orgId || loading}>
              Generate
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading && <p className="text-muted-foreground">Processing...</p>}

          {behavior && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Badge variant={behavior.state === 'stable' ? 'default' : behavior.state === 'fragile' ? 'secondary' : 'destructive'}>
                  {behavior.state.toUpperCase()}
                </Badge>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Risk Score:</span>
                  <span className="text-lg font-bold">{behavior.riskScore.toFixed(1)}/100</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Time to Verify</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{behavior.signals.timeToVerify.toFixed(1)} days</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Denial Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{(behavior.signals.denialPatterns.rate * 100).toFixed(1)}%</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Fairness Score</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{behavior.signals.fairnessScores.overall}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Safety Severity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{behavior.signals.safetyOutcomes.severity}</div>
                  </CardContent>
                </Card>
              </div>

              {behavior.correctionRecommendations.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Correction Recommendations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc list-inside space-y-1">
                      {behavior.correctionRecommendations.map((rec: string, i: number) => (
                        <li key={i} className="text-sm">{rec}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

