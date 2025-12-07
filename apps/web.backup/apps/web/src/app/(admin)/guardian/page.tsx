'use client';

import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, RefreshCcw, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  'http://localhost:4000';

interface ServiceHealth {
  service: string;
  status: string;
  latency?: number;
  errorRate?: number;
}

interface GuardianAlert {
  id: string;
  type: string;
  severity: string;
  message: string;
  timestamp: Date;
}

interface StabilityScore {
  score: number;
  factors: Record<string, number>;
}

export default function GuardianPage() {
  const [health, setHealth] = useState<ServiceHealth[]>([]);
  const [alerts, setAlerts] = useState<GuardianAlert[]>([]);
  const [stabilityScore, setStabilityScore] = useState<StabilityScore | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGuardianData();
  }, []);

  async function loadGuardianData() {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/guardian`);
      if (response.ok) {
        const data = await response.json();
        const metrics = data.metrics || {};
        if (metrics.heartbeatMap) {
          setHealth(Object.values(metrics.heartbeatMap));
        }
        if (metrics.alerts) {
          setAlerts(metrics.alerts);
        }
        if (metrics.stabilityScore) {
          setStabilityScore(metrics.stabilityScore);
        }
      }
    } catch (error) {
      console.error('Failed to load guardian data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAnchor() {
    try {
      const response = await fetch(`${API_BASE}/api/guardian/anchor`, {
        method: 'POST',
      });
      if (response.ok) {
        const data = await response.json();
        alert(`Anchored! TX: ${data.txHash}`);
      }
    } catch (error) {
      console.error('Failed to anchor:', error);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="space-y-2">
        <Badge variant="secondary">Admin · Stability Guardian</Badge>
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <h1 className="text-3xl font-semibold leading-tight">System Stability Guardian</h1>
            <p className="text-muted-foreground">
              Self-monitoring, self-healing guardian that predicts failures before they happen
            </p>
          </div>
          <div className="ml-auto flex gap-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={loadGuardianData}
              disabled={loading}
            >
              <RefreshCcw className={cn('h-4 w-4', loading && 'animate-spin')} />
              Refresh
            </Button>
            <Button variant="outline" onClick={handleAnchor}>
              Anchor Snapshot
            </Button>
          </div>
        </div>
      </header>

      {stabilityScore && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Stability Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-semibold">{stabilityScore.score}</span>
              <Badge
                variant={
                  stabilityScore.score >= 90
                    ? 'default'
                    : stabilityScore.score >= 70
                      ? 'secondary'
                      : 'destructive'
                }
              >
                {stabilityScore.score >= 90
                  ? 'Excellent'
                  : stabilityScore.score >= 70
                    ? 'Good'
                    : 'Needs Attention'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {alerts.length > 0 && (
        <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-5 w-5" />
              Active Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {alerts.map((alert) => (
                <div key={alert.id} className="rounded-lg border border-amber-300 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-amber-900 dark:text-amber-100">
                        {alert.message}
                      </div>
                      <div className="text-sm text-amber-800 dark:text-amber-200">
                        {new Date(alert.timestamp).toLocaleString()}
                      </div>
                    </div>
                    <Badge
                      variant={
                        alert.severity === 'critical'
                          ? 'destructive'
                          : alert.severity === 'high'
                            ? 'secondary'
                            : 'outline'
                      }
                    >
                      {alert.severity}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {health.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Service Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {health.map((service) => (
                <div
                  key={service.service}
                  className={cn(
                    'rounded-lg border p-3',
                    service.status === 'healthy'
                      ? 'border-green-500'
                      : service.status === 'degraded'
                        ? 'border-amber-500'
                        : 'border-red-500'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{service.service}</div>
                    <Badge
                      variant={
                        service.status === 'healthy'
                          ? 'default'
                          : service.status === 'degraded'
                            ? 'secondary'
                            : 'destructive'
                      }
                    >
                      {service.status}
                    </Badge>
                  </div>
                  {service.latency && (
                    <div className="mt-2 text-sm text-muted-foreground">
                      Latency: {service.latency.toFixed(0)}ms
                    </div>
                  )}
                  {service.errorRate && (
                    <div className="text-sm text-muted-foreground">
                      Error Rate: {(service.errorRate * 100).toFixed(1)}%
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

