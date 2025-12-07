'use client';

import { useCallback, useEffect, useState } from 'react';
import { Building2, TrendingUp, AlertTriangle, Shield, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function OrgGravitationPage() {
  const [orgId, setOrgId] = useState('');
  const [gravitation, setGravitation] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGravitation = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/org/gravitation/${orgId}`);
      if (!response.ok) {
        throw new Error(`Failed to load gravitation data (${response.status})`);
      }
      const data = await response.json();
      setGravitation(data.result);
    } catch (err) {
      console.error('Failed to fetch gravitation', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  const analyzeEthicalGravitons = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/org/gravitation/gravitons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          behaviors: [
            { behavior: 'transparency', frequency: 0.8, impact: 0.9 },
            { behavior: 'fairness', frequency: 0.7, impact: 0.85 },
            { behavior: 'compliance', frequency: 0.9, impact: 0.75 },
          ],
        }),
      });
      if (!response.ok) throw new Error('Failed to analyze ethical gravitons');
      const data = await response.json();
      setGravitation((prev: any) => ({ ...prev, gravitons: data.result }));
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
            <Building2 className="h-8 w-8" />
            Organizational Gravitation Dashboard
          </h1>
          <p className="text-muted-foreground">
            Ethical fusion, multi-site governance & safety harmonics
          </p>
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Input
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
            placeholder="Organization ID"
            className="md:w-64"
          />
          <Button onClick={fetchGravitation} variant="secondary" disabled={loading}>
            Analyze
          </Button>
          <Button onClick={analyzeEthicalGravitons} variant="outline" disabled={loading}>
            Ethical Gravitons
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

      {loading && <p className="text-muted-foreground">Analyzing organizational gravitation...</p>}

      {gravitation && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Organization
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold mb-2">{orgId}</div>
              <Badge variant="outline">Active</Badge>
            </CardContent>
          </Card>

          {gravitation.gravitons && gravitation.gravitons.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Ethical Gravitons</CardTitle>
                <CardDescription>{gravitation.gravitons.length} behaviors detected</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {gravitation.gravitons.slice(0, 3).map((graviton: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="text-sm">{graviton.behavior}</span>
                    <Badge variant={graviton.risk === 'high' ? 'destructive' : 'secondary'}>
                      {(graviton.microforce * 100).toFixed(1)}%
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Trust Mass
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold mb-2">
                {gravitation.trustMassRedistribution?.equilibrium
                  ? (gravitation.trustMassRedistribution.equilibrium * 100).toFixed(1)
                  : 'N/A'}%
              </div>
              <Progress
                value={
                  gravitation.trustMassRedistribution?.equilibrium
                    ? gravitation.trustMassRedistribution.equilibrium * 100
                    : 0
                }
                className="h-2"
              />
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Gravity Field Simulator</CardTitle>
          <CardDescription>
            Visualize organizational gravity fields and departmental alignment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-muted rounded-lg flex items-center justify-center">
            <p className="text-muted-foreground">Gravity field visualization coming soon</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

