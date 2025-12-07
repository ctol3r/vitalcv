'use client';

import { useCallback, useEffect, useState } from 'react';
import { TrendingUp, AlertTriangle, DollarSign, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

interface EmployerBehaviorEconomics {
  offerElasticity: number;
  hiringThresholds: {
    experience: number;
    boardCert: boolean;
    cme: number;
  };
  responseTime: {
    average: number;
    median: number;
    p95: number;
  };
  offerAcceptanceRate: number;
  frictionCost: number;
  demandElasticity: number;
  riskIndex: number;
}

export default function BehaviorEconPage() {
  const [orgId, setOrgId] = useState('');
  const [behavior, setBehavior] = useState<EmployerBehaviorEconomics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBehavior = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/employer-behavior-economics/${orgId}`);
      if (!res.ok) throw new Error(`Failed to load behavior (${res.status})`);
      const data = await res.json();
      setBehavior(data);
    } catch (err) {
      console.error('Failed to fetch employer behavior economics', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    if (orgId) {
      fetchBehavior();
    }
  }, [orgId, fetchBehavior]);

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Employer Behavioral Economics</h1>
          <p className="text-muted-foreground">
            Predict employer behavior: offers, response times, hiring thresholds, withdrawal patterns.
          </p>
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Input
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
            placeholder="Organization ID"
            className="md:w-56"
          />
          <Button onClick={fetchBehavior} variant="secondary">
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
          <p className="text-muted-foreground">Loading behavioral economics...</p>
        </div>
      )}

      {!loading && behavior && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Offer Elasticity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(behavior.offerElasticity * 100).toFixed(0)}%</div>
                <Progress value={behavior.offerElasticity * 100} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Response Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{behavior.responseTime.average.toFixed(1)}h</div>
                <p className="text-sm text-muted-foreground mt-1">Average</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Acceptance Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(behavior.offerAcceptanceRate * 100).toFixed(0)}%</div>
                <Progress value={behavior.offerAcceptanceRate * 100} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Risk Index</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{behavior.riskIndex.toFixed(0)}</div>
                <Badge variant={behavior.riskIndex > 70 ? 'destructive' : behavior.riskIndex > 40 ? 'default' : 'secondary'} className="mt-2">
                  {behavior.riskIndex > 70 ? 'High' : behavior.riskIndex > 40 ? 'Medium' : 'Low'}
                </Badge>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Hiring Thresholds</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Experience (years)</span>
                    <span className="font-medium">{behavior.hiringThresholds.experience}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Board Certified</span>
                    <Badge variant={behavior.hiringThresholds.boardCert ? 'default' : 'outline'}>
                      {behavior.hiringThresholds.boardCert ? 'Required' : 'Not Required'}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>CME Hours</span>
                    <span className="font-medium">{behavior.hiringThresholds.cme}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Economics Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Friction Cost</span>
                    <span className="font-medium">${behavior.frictionCost.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Demand Elasticity</span>
                    <span className="font-medium">{(behavior.demandElasticity * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>P95 Response Time</span>
                    <span className="font-medium">{behavior.responseTime.p95.toFixed(1)}h</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}








