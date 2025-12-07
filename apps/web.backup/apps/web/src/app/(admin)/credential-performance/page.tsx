'use client';

import { useCallback, useEffect, useState } from 'react';
import { Zap, TrendingUp, Clock, Activity } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface CredentialPerformance {
  issuance: {
    averageMs: number;
    p95Ms: number;
    optimized: boolean;
  };
  verification: {
    averageMs: number;
    cacheHitRate: number;
    pathOptimized: boolean;
  };
  selectiveDisclosure: {
    averageMs: number;
    templatesCached: number;
  };
  cache: {
    warmCredentials: number;
    hitRate: number;
  };
  sync: {
    averageMs: number;
    preFetchEnabled: boolean;
  };
  health: {
    score: number;
    freshness: number;
    accuracy: number;
    performance: number;
  };
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function CredentialPerformancePage() {
  const [performance, setPerformance] = useState<CredentialPerformance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPerformance = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/credentials/performance`);
      if (!response.ok) {
        throw new Error(`Failed to load performance (${response.status})`);
      }
      const data = await response.json();
      setPerformance(data);
    } catch (err) {
      console.error('Failed to fetch performance', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPerformance();
    const interval = setInterval(fetchPerformance, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [fetchPerformance]);

  const formatMs = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Credential Performance</h1>
          <p className="text-muted-foreground">
            Optimizes how fast credentials can be issued, verified, shared, and updated.
          </p>
        </div>
        <Button onClick={fetchPerformance} disabled={loading}>
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {performance && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Health Score</CardTitle>
              <CardDescription>Overall credential health and performance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="text-4xl font-bold">
                  {performance.health.score.toFixed(0)}/100
                </div>
                <Progress value={performance.health.score} className="flex-1" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Freshness</p>
                  <p className="text-lg font-semibold">
                    {(performance.health.freshness * 100).toFixed(0)}%
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Accuracy</p>
                  <p className="text-lg font-semibold">
                    {(performance.health.accuracy * 100).toFixed(0)}%
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Performance</p>
                  <p className="text-lg font-semibold">
                    {(performance.health.performance * 100).toFixed(0)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Issuance Speed
                </CardTitle>
                <CardDescription>Credential issuance performance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Average</span>
                  <span className="font-semibold">{formatMs(performance.issuance.averageMs)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">P95</span>
                  <span className="font-semibold">{formatMs(performance.issuance.p95Ms)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Optimized</span>
                  <Badge variant={performance.issuance.optimized ? 'default' : 'secondary'}>
                    {performance.issuance.optimized ? 'Yes' : 'No'}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Verification Speed
                </CardTitle>
                <CardDescription>Proof chain and verification performance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Average</span>
                  <span className="font-semibold">{formatMs(performance.verification.averageMs)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Cache Hit Rate</span>
                  <span className="font-semibold">
                    {(performance.verification.cacheHitRate * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Path Optimized</span>
                  <Badge variant={performance.verification.pathOptimized ? 'default' : 'secondary'}>
                    {performance.verification.pathOptimized ? 'Yes' : 'No'}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Selective Disclosure
                </CardTitle>
                <CardDescription>SD-JWT template performance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Average</span>
                  <span className="font-semibold">
                    {formatMs(performance.selectiveDisclosure.averageMs)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Templates Cached</span>
                  <Badge>{performance.selectiveDisclosure.templatesCached}</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Cache & Sync
                </CardTitle>
                <CardDescription>Credential cache warming and sync</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Warm Credentials</span>
                  <Badge>{performance.cache.warmCredentials}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Cache Hit Rate</span>
                  <span className="font-semibold">{(performance.cache.hitRate * 100).toFixed(0)}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Sync Average</span>
                  <span className="font-semibold">{formatMs(performance.sync.averageMs)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Pre-fetch Enabled</span>
                  <Badge variant={performance.sync.preFetchEnabled ? 'default' : 'secondary'}>
                    {performance.sync.preFetchEnabled ? 'Yes' : 'No'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {loading && !performance && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Loading performance metrics...</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

