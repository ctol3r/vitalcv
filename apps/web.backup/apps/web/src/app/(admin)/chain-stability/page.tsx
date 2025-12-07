'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, AlertTriangle, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

interface ChainStability {
  validators: Array<{
    id: string;
    status: string;
    healthScore: number;
  }>;
  blockPropagation: {
    average: number;
    p95: number;
  };
  finality: {
    average: number;
    regression: boolean;
  };
  congestion: {
    level: string;
  };
}

export default function ChainStabilityPage() {
  const [stability, setStability] = useState<ChainStability | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStability = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/chain-stability`);
      if (!res.ok) throw new Error(`Failed to load stability (${res.status})`);
      const data = await res.json();
      setStability(data);
    } catch (err) {
      console.error('Failed to fetch chain stability', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStability();
    const interval = setInterval(fetchStability, 30000);
    return () => clearInterval(interval);
  }, [fetchStability]);

  const onlineValidators = stability?.validators.filter((v) => v.status === 'online') || [];
  const healthScore = onlineValidators.length > 0
    ? onlineValidators.reduce((sum, v) => sum + v.healthScore, 0) / onlineValidators.length
    : 0;

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Chain Stability Monitor</h1>
          <p className="text-muted-foreground">
            Real-time monitoring of validator health, block propagation, finality, and network anomalies.
          </p>
        </div>
        <Button onClick={fetchStability} variant="secondary">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
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
          <p className="text-muted-foreground">Loading chain stability...</p>
        </div>
      )}

      {!loading && stability && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Validator Health</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(healthScore * 100).toFixed(0)}%</div>
                <Progress value={healthScore * 100} className="mt-2" />
                <p className="text-sm text-muted-foreground mt-1">
                  {onlineValidators.length} / {stability.validators.length} online
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Block Propagation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stability.blockPropagation.average.toFixed(0)}ms</div>
                <p className="text-sm text-muted-foreground mt-1">
                  P95: {stability.blockPropagation.p95.toFixed(0)}ms
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Finality Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stability.finality.average.toFixed(1)}s</div>
                {stability.finality.regression && (
                  <Badge variant="destructive" className="mt-2">Regression Detected</Badge>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Congestion</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold capitalize">{stability.congestion.level}</div>
                <Badge
                  variant={
                    stability.congestion.level === 'critical' || stability.congestion.level === 'high'
                      ? 'destructive'
                      : 'default'
                  }
                  className="mt-2"
                >
                  {stability.congestion.level}
                </Badge>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Validators</CardTitle>
              <CardDescription>Validator health and status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stability.validators.map((validator, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {validator.status === 'online' ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-red-500" />
                      )}
                      <div>
                        <div className="font-medium">{validator.id}</div>
                        <div className="text-sm text-muted-foreground">
                          Health: {(validator.healthScore * 100).toFixed(0)}%
                        </div>
                      </div>
                    </div>
                    <Badge variant={validator.status === 'online' ? 'default' : 'destructive'}>
                      {validator.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}








