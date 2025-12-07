'use client';

import { useCallback, useEffect, useState } from 'react';
import { TrendingUp, Users, Clock, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface HiringPulse {
  region: string;
  demand: {
    total: number;
    bySpecialty: Array<{ specialty: string; count: number }>;
  };
  velocity: {
    averageDaysToHire: number;
    bySpecialty: Array<{ specialty: string; days: number }>;
  };
  readiness: {
    averageScore: number;
    readyCount: number;
    totalCount: number;
  };
  bottlenecks: Array<{ type: string; severity: 'low' | 'moderate' | 'high'; count: number }>;
  surgePredictions: Array<{ specialty: string; predictedSurgeDate: string; confidence: number }>;
  atsHealth: {
    averageResponseTime: number;
    successRate: number;
  };
  benchmarking: {
    regionRank: number;
    topPerformers: Array<{ region: string; metric: string; value: number }>;
  };
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function HiringPulsePage() {
  const [pulse, setPulse] = useState<HiringPulse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [region, setRegion] = useState('US');

  const fetchPulse = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/hiring/pulse/${region}`);
      if (!response.ok) {
        throw new Error(`Failed to load hiring pulse (${response.status})`);
      }
      const data = await response.json();
      setPulse(data);
    } catch (err) {
      console.error('Failed to fetch hiring pulse', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [region]);

  useEffect(() => {
    fetchPulse();
    const interval = setInterval(fetchPulse, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [fetchPulse]);

  const getSeverityBadge = (severity: string) => {
    if (severity === 'high') return <Badge variant="destructive">High</Badge>;
    if (severity === 'moderate') return <Badge variant="secondary">Moderate</Badge>;
    return <Badge variant="outline">Low</Badge>;
  };

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">National Hiring Pulse</h1>
          <p className="text-muted-foreground">
            Real-time intelligence dashboard showing demand, hiring velocity, and readiness signals.
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="Region"
            className="md:w-48"
          />
          <Button onClick={fetchPulse} disabled={loading}>
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {pulse && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Demand</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{pulse.demand.total}</div>
                <p className="text-xs text-muted-foreground">Active job postings</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Days to Hire</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{pulse.velocity.averageDaysToHire}</div>
                <p className="text-xs text-muted-foreground">From interest to hire</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Readiness Score</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(pulse.readiness.averageScore * 100).toFixed(0)}%</div>
                <p className="text-xs text-muted-foreground">
                  {pulse.readiness.readyCount} / {pulse.readiness.totalCount} ready
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">ATS Health</CardTitle>
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(pulse.atsHealth.successRate * 100).toFixed(0)}%</div>
                <p className="text-xs text-muted-foreground">
                  {pulse.atsHealth.averageResponseTime.toFixed(1)}s avg response
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Demand by Specialty</CardTitle>
                <CardDescription>Top specialties with highest job demand</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {pulse.demand.bySpecialty.slice(0, 10).map((spec, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-sm">{spec.specialty}</span>
                      <Badge>{spec.count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Hiring Bottlenecks</CardTitle>
                <CardDescription>Employer-side blocks and delays</CardDescription>
              </CardHeader>
              <CardContent>
                {pulse.bottlenecks.length > 0 ? (
                  <div className="space-y-2">
                    {pulse.bottlenecks.map((bottleneck, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 border rounded">
                        <div>
                          <span className="text-sm font-semibold">{bottleneck.type}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {bottleneck.count} occurrences
                          </span>
                        </div>
                        {getSeverityBadge(bottleneck.severity)}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No significant bottlenecks detected.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {pulse.surgePredictions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Surge Predictions</CardTitle>
                <CardDescription>Forecasted hiring spikes by specialty</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {pulse.surgePredictions.map((surge, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 border rounded">
                      <div>
                        <span className="font-semibold">{surge.specialty}</span>
                        <span className="text-sm text-muted-foreground ml-2">
                          Predicted: {new Date(surge.predictedSurgeDate).toLocaleDateString()}
                        </span>
                      </div>
                      <Badge>{(surge.confidence * 100).toFixed(0)}% confidence</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Regional Benchmarking</CardTitle>
              <CardDescription>Performance comparison across regions</CardDescription>
            </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <span className="text-sm">Rank:</span>
                  <Badge variant="outline">{pulse.benchmarking.regionRank}</Badge>
                </div>
                {pulse.benchmarking.topPerformers.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-semibold">Top Performers</p>
                    {pulse.benchmarking.topPerformers.map((performer, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <span>{performer.region}</span>
                        <span className="font-semibold">{performer.metric}: {performer.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
          </Card>
        </>
      )}

      {loading && !pulse && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Loading hiring pulse data...</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

