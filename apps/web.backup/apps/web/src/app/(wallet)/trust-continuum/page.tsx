'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Activity, AlertTriangle, Clock, Zap } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_BASE_URL || '';

interface TrustPoint {
  timestamp: string;
  trust: number;
  confidence: number;
}

interface ShockEvent {
  timestamp: string;
  type: 'collapse' | 'spike';
  magnitude: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  beforeTrust: number;
  afterTrust: number;
}

interface TrustContinuum {
  clinicianId: string;
  timeline: TrustPoint[];
  curvature: {
    type: string;
    coefficient: number;
    trend: string;
  };
  shocks: ShockEvent[];
  acceleration: number;
  momentum: number;
  density: number;
  entropy: number;
  epochs: Array<{
    start: string;
    end: string;
    averageTrust: number;
    trend: string;
  }>;
  influence: Array<{
    actor: string;
    impact: number;
  }>;
}

export default function TrustContinuumPage() {
  const [continuum, setContinuum] = useState<TrustContinuum | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchContinuum() {
      try {
        // In a real app, get clinicianId from session/auth
        const clinicianId = 'demo-clinician-id';
        const response = await fetch(`${API_BASE}/api/trust-continuum/${clinicianId}`);

        if (!response.ok) {
          throw new Error('Failed to fetch trust continuum');
        }

        const data = await response.json();
        setContinuum(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchContinuum();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <p>{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!continuum) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <p>No trust continuum data available</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Prepare chart data
  const chartData = continuum.timeline.map(point => ({
    date: new Date(point.timestamp).toLocaleDateString(),
    trust: point.trust,
    confidence: point.confidence * 100,
  }));

  const currentTrust = continuum.timeline[continuum.timeline.length - 1]?.trust || 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Trust-Time Continuum</h1>
        <p className="text-muted-foreground mt-2">
          Temporal trust modeling across systems, chains, regulators & employers
        </p>
      </div>

      {/* Current Trust Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Current Trust</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentTrust.toFixed(1)}</div>
            <Progress value={currentTrust} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Momentum</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{continuum.momentum.toFixed(1)}</div>
            <div className="flex items-center gap-1 mt-2">
              {continuum.curvature.trend === 'increasing' ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : continuum.curvature.trend === 'decreasing' ? (
                <TrendingDown className="h-4 w-4 text-red-500" />
              ) : (
                <Activity className="h-4 w-4 text-gray-500" />
              )}
              <span className="text-sm text-muted-foreground">{continuum.curvature.trend}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Density</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{continuum.density.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground mt-2">Last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Entropy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(continuum.entropy * 100).toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-2">Randomness in timeline</p>
          </CardContent>
        </Card>
      </div>

      {/* Trust Timeline Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Trust Timeline</CardTitle>
          <CardDescription>Trust evolution over time</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="trust" stroke="#8884d8" strokeWidth={2} name="Trust Score" />
              <Line type="monotone" dataKey="confidence" stroke="#82ca9d" strokeWidth={1} name="Confidence %" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Shock Events */}
      {continuum.shocks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Shock Events</CardTitle>
            <CardDescription>Sudden trust collapses or spikes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {continuum.shocks.map((shock, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {shock.type === 'collapse' ? (
                      <TrendingDown className="h-5 w-5 text-red-500" />
                    ) : (
                      <TrendingUp className="h-5 w-5 text-green-500" />
                    )}
                    <div>
                      <div className="font-medium">
                        {shock.type === 'collapse' ? 'Trust Collapse' : 'Trust Spike'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(shock.timestamp).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={shock.severity === 'critical' ? 'destructive' : 'secondary'}>
                      {shock.severity}
                    </Badge>
                    <span className="text-sm font-medium">
                      {shock.beforeTrust.toFixed(1)} → {shock.afterTrust.toFixed(1)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trust Epochs */}
      {continuum.epochs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Trust Epochs</CardTitle>
            <CardDescription>Time-based trust segmentation</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {continuum.epochs.map((epoch, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">
                      Epoch {idx + 1}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(epoch.start).toLocaleDateString()} - {new Date(epoch.end).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="font-medium">{epoch.averageTrust.toFixed(1)}</div>
                      <div className="text-xs text-muted-foreground">Average Trust</div>
                    </div>
                    <Badge variant={epoch.trend === 'increasing' ? 'default' : 'secondary'}>
                      {epoch.trend}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trust Influence */}
      {continuum.influence.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Trust Influence</CardTitle>
            <CardDescription>Actors influencing trust over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {continuum.influence.map((inf, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-yellow-500" />
                    <span className="font-medium">{inf.actor}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={inf.impact} className="w-32" />
                    <span className="text-sm font-medium w-16 text-right">{inf.impact.toFixed(1)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Curvature Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Curvature Analysis</CardTitle>
          <CardDescription>Trust curve characteristics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Type</div>
              <div className="text-lg font-medium">{continuum.curvature.type}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Coefficient</div>
              <div className="text-lg font-medium">{continuum.curvature.coefficient.toFixed(3)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Acceleration</div>
              <div className="text-lg font-medium">{continuum.acceleration.toFixed(3)}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}








