'use client';

import { useCallback, useEffect, useState } from 'react';
import { TrendingUp, AlertTriangle, RefreshCw, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

interface WorkforceEfficiency {
  inefficiencies: Array<{
    type: string;
    stage: string;
    severity: string;
    impact: number;
  }>;
  employerEfficiency: Array<{
    orgId: string;
    score: number;
  }>;
  clinicianUtilization: Array<{
    clinicianId: string;
    score: number;
  }>;
  bottlenecks: Array<{
    stage: string;
    averageDelay: number;
  }>;
}

export default function EfficiencyPage() {
  const [efficiency, setEfficiency] = useState<WorkforceEfficiency | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEfficiency = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/workforce-efficiency`);
      if (!res.ok) throw new Error(`Failed to load efficiency (${res.status})`);
      const data = await res.json();
      setEfficiency(data);
    } catch (err) {
      console.error('Failed to fetch workforce efficiency', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEfficiency();
    const interval = setInterval(fetchEfficiency, 60000);
    return () => clearInterval(interval);
  }, [fetchEfficiency]);

  const avgEmployerScore = efficiency?.employerEfficiency.length > 0
    ? efficiency.employerEfficiency.reduce((sum, e) => sum + e.score, 0) / efficiency.employerEfficiency.length
    : 0;

  const avgClinicianScore = efficiency?.clinicianUtilization.length > 0
    ? efficiency.clinicianUtilization.reduce((sum, c) => sum + c.score, 0) / efficiency.clinicianUtilization.length
    : 0;

  const criticalInefficiencies = efficiency?.inefficiencies.filter((i) => i.severity === 'critical') || [];

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Workforce Efficiency Intelligence</h1>
          <p className="text-muted-foreground">
            Analyze workforce inefficiencies, identify bottlenecks, predict shortages & optimize clinician utilization.
          </p>
        </div>
        <Button onClick={fetchEfficiency} variant="secondary">
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
          <p className="text-muted-foreground">Loading workforce efficiency...</p>
        </div>
      )}

      {!loading && efficiency && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Avg Employer Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{avgEmployerScore.toFixed(0)}</div>
                <Progress value={avgEmployerScore} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Avg Clinician Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{avgClinicianScore.toFixed(0)}</div>
                <Progress value={avgClinicianScore} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Inefficiencies</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{efficiency.inefficiencies.length}</div>
                <p className="text-sm text-muted-foreground mt-1">
                  {criticalInefficiencies.length} critical
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Bottlenecks</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{efficiency.bottlenecks.length}</div>
                <p className="text-sm text-muted-foreground mt-1">Active bottlenecks</p>
              </CardContent>
            </Card>
          </div>

          {efficiency.bottlenecks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Bottlenecks</CardTitle>
                <CardDescription>Stages causing delays</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {efficiency.bottlenecks.map((bottleneck, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium">{bottleneck.stage}</div>
                        <div className="text-sm text-muted-foreground">
                          Average delay: {bottleneck.averageDelay.toFixed(1)} hours
                        </div>
                      </div>
                      <Badge variant="destructive">Bottleneck</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {criticalInefficiencies.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Critical Inefficiencies</CardTitle>
                <CardDescription>Requires immediate attention</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {criticalInefficiencies.map((ineff, idx) => (
                    <Alert key={idx} variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>{ineff.type} - {ineff.stage}</AlertTitle>
                      <AlertDescription>
                        Impact: {ineff.impact.toFixed(1)} hours
                      </AlertDescription>
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








