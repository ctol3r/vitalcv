'use client';

import { useCallback, useEffect, useState } from 'react';
import { Shield, TrendingUp, RefreshCw, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

interface RiskReliabilityFusion {
  safety?: {
    score: number;
  };
  performance?: {
    score: number;
  };
  credentialQuality?: {
    score: number;
  };
  privilegeHistory?: {
    score: number;
  };
  readiness?: {
    score: number;
  };
  fused?: {
    score: number;
    trajectory: 'improving' | 'stable' | 'declining';
  };
  recommendations?: string[];
}

interface RiskTrajectory {
  current: number;
  projected: number;
  timeframe: string;
  trend: 'improving' | 'stable' | 'declining';
}

export default function RiskFusionPage() {
  const [clinicianId, setClinicianId] = useState('demo-clinician');
  const [fusion, setFusion] = useState<RiskReliabilityFusion | null>(null);
  const [trajectory, setTrajectory] = useState<RiskTrajectory | null>(null);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFusion = useCallback(async () => {
    if (!clinicianId) return;
    setLoading(true);
    setError(null);
    try {
      const [fusionRes, trajectoryRes, recommendationsRes] = await Promise.all([
        fetch(`${API_BASE}/api/risk-fusion/${clinicianId}`),
        fetch(`${API_BASE}/api/risk-fusion/${clinicianId}/trajectory`),
        fetch(`${API_BASE}/api/risk-fusion/${clinicianId}/recommendations`),
      ]);

      if (!fusionRes.ok) throw new Error(`Failed to load fusion (${fusionRes.status})`);
      if (trajectoryRes.ok) {
        const trajData = await trajectoryRes.json();
        setTrajectory(trajData);
      }
      if (recommendationsRes.ok) {
        const recData = await recommendationsRes.json();
        setRecommendations(recData.recommendations || []);
      }

      const fusionData = await fusionRes.json();
      setFusion(fusionData.fusion || fusionData);
    } catch (err) {
      console.error('Failed to fetch risk fusion', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [clinicianId]);

  useEffect(() => {
    fetchFusion();
    const interval = setInterval(fetchFusion, 60_000);
    return () => clearInterval(interval);
  }, [fetchFusion]);

  const fusedScore = fusion?.fused?.score || 0;
  const safetyScore = fusion?.safety?.score || 0;
  const performanceScore = fusion?.performance?.score || 0;
  const credentialScore = fusion?.credentialQuality?.score || 0;

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Risk & Reliability Fusion</h1>
          <p className="text-muted-foreground">
            Combined safety, performance, credential quality, privilege history & readiness score.
          </p>
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Input
            value={clinicianId}
            onChange={(e) => setClinicianId(e.target.value)}
            placeholder="Clinician ID"
            className="md:w-56"
          />
          <Button onClick={fetchFusion} variant="secondary">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
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

      {loading && (
        <div className="text-center py-8">
          <p className="text-muted-foreground">Loading risk fusion...</p>
        </div>
      )}

      {!loading && fusion && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Fused Risk-Reliability Score</CardTitle>
              <CardDescription>Combined multi-layer score (0-100)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl font-bold">{fusedScore}</span>
                    {fusion.fused && (
                      <Badge variant={
                        fusion.fused.trajectory === 'improving' ? 'outline' :
                        fusion.fused.trajectory === 'declining' ? 'destructive' : 'secondary'
                      }>
                        {fusion.fused.trajectory.toUpperCase()}
                      </Badge>
                    )}
                  </div>
                  <Progress value={fusedScore} className="h-3" />
                </div>
                {trajectory && (
                  <div className="pt-4 border-t space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Current</span>
                      <span className="font-semibold">{trajectory.current}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Projected ({trajectory.timeframe})</span>
                      <span className="font-semibold">{trajectory.projected}</span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Safety</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(safetyScore * 100).toFixed(0)}</div>
                <Progress value={safetyScore * 100} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(performanceScore * 100).toFixed(0)}</div>
                <Progress value={performanceScore * 100} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Credential Quality</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(credentialScore * 100).toFixed(0)}</div>
                <Progress value={credentialScore * 100} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Readiness</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {fusion.readiness?.score ? fusion.readiness.score.toFixed(0) : 'N/A'}
                </div>
                {fusion.readiness?.score && (
                  <Progress value={fusion.readiness.score} className="mt-2" />
                )}
              </CardContent>
            </Card>
          </div>

          {recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recommendations</CardTitle>
                <CardDescription>Suggested actions based on fusion analysis</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {recommendations.map((rec, idx) => (
                    <Alert key={idx} variant="default">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>{rec}</AlertTitle>
                    </Alert>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}








