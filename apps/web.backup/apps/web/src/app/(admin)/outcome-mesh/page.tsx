'use client';

import { useCallback, useEffect, useState } from 'react';
import { Target, TrendingUp, Users, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function OutcomeMeshPage() {
  const [orgId, setOrgId] = useState('');
  const [mesh, setMesh] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMesh = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/employer-outcome-mesh/${orgId}`);
      if (!response.ok) {
        throw new Error(`Failed to load outcome mesh (${response.status})`);
      }
      const data = await response.json();
      setMesh(data);
    } catch (err) {
      console.error('Failed to fetch outcome mesh', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Employer Outcome Prediction Mesh</h1>
          <p className="text-muted-foreground">
            Predict outcomes for every potential employer–clinician pairing
          </p>
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Input
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
            placeholder="Organization ID"
            className="md:w-64"
          />
          <Button onClick={fetchMesh} variant="secondary">
            Analyze
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && <p className="text-muted-foreground">Loading outcome mesh...</p>}

      {mesh && mesh.mesh && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Target className="h-4 w-4" />
                Total Pairings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {mesh.mesh.pairings?.length ?? 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Avg Success Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {mesh.summary?.avgSuccessScore
                  ? (mesh.summary.avgSuccessScore * 100).toFixed(1) + '%'
                  : '--'}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Clusters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {mesh.mesh.clusters?.length ?? 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                High Risk
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {mesh.mesh.pairings?.filter((p: any) => p.predictions.successScore < 0.4).length ?? 0}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {mesh && mesh.summary?.topMatches && (
        <Card>
          <CardHeader>
            <CardTitle>Top Matches</CardTitle>
            <CardDescription>Highest success probability pairings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mesh.summary.topMatches.slice(0, 10).map((match: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex-1">
                    <div className="font-medium">Clinician {match.clinicianId.slice(0, 8)}...</div>
                    <div className="text-sm text-muted-foreground">Success Score</div>
                  </div>
                  <Badge variant={match.score > 0.7 ? 'default' : match.score > 0.4 ? 'secondary' : 'destructive'}>
                    {(match.score * 100).toFixed(0)}%
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

