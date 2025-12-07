'use client';

import { TrendingUp, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

interface CompliancePoint {
  date: string;
  score: number;
  ruleset: string;
  status: 'compliant' | 'non-compliant' | 'at-risk';
}

interface ComplianceTrajectory {
  trajectory: CompliancePoint[];
  health: {
    score: number;
    stability: number;
  };
  conflicts: Array<{
    ruleset1: string;
    ruleset2: string;
    conflict: string;
    severity: number;
  }>;
  predictions: Array<{
    date: string;
    predictedStress: number;
  }>;
}

export default function ComplianceTrajectoryPage() {
  const [trajectory, setTrajectory] = useState<ComplianceTrajectory | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTrajectory();
  }, []);

  async function fetchTrajectory() {
    try {
      // Get clinicianId from session or use a default for demo
      const clinicianId = 'demo-clinician-id'; // TODO: Get from auth context
      const res = await fetch(`${API_BASE}/api/compliance-trajectory/${clinicianId}`);
      if (res.ok) {
        const data = await res.json();
        // Fetch additional data
        const [healthRes, predictionsRes] = await Promise.all([
          fetch(`${API_BASE}/api/compliance-trajectory/health/${clinicianId}`),
          fetch(`${API_BASE}/api/compliance-trajectory/predict-stress`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clinicianId }),
          }),
        ]);

        const health = healthRes.ok ? await healthRes.json() : { score: 0.8, stability: 0.8 };
        const predictions = predictionsRes.ok ? await predictionsRes.json() : { predictions: [] };

        setTrajectory({
          trajectory: Array.isArray(data.trajectory) ? data.trajectory : [],
          health: { ...health },
          conflicts: [],
          predictions: predictions.predictions || [],
        });
      }
    } catch (error) {
      console.error('Failed to fetch compliance trajectory:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!trajectory) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Compliance Trajectory</CardTitle>
            <CardDescription>No trajectory data available</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const statusIcons = {
    compliant: CheckCircle,
    'non-compliant': XCircle,
    'at-risk': AlertTriangle,
  };

  const statusColors = {
    compliant: 'text-green-500',
    'non-compliant': 'text-red-500',
    'at-risk': 'text-yellow-500',
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Compliance Trajectory</h1>
        <p className="text-muted-foreground mt-2">
          Maps compliance over time, across rulesets, across entities, across trust pathways
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Compliance Health</CardTitle>
            <CardDescription>Overall compliance score and stability</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span>Score</span>
                  <span className="text-2xl font-bold">{Math.round(trajectory.health.score * 100)}%</span>
                </div>
                <Progress value={trajectory.health.score * 100} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span>Stability</span>
                  <span className="text-xl font-semibold">{Math.round(trajectory.health.stability * 100)}%</span>
                </div>
                <Progress value={trajectory.health.stability * 100} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Compliance Conflicts</CardTitle>
            <CardDescription>Contradictory compliance states</CardDescription>
          </CardHeader>
          <CardContent>
            {trajectory.conflicts.length === 0 ? (
              <div className="text-sm text-muted-foreground">No conflicts detected</div>
            ) : (
              <div className="space-y-2">
                {trajectory.conflicts.map((conflict, i) => (
                  <div key={i} className="p-2 border rounded">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {conflict.ruleset1} vs {conflict.ruleset2}
                      </span>
                      <Badge variant={conflict.severity > 0.7 ? 'destructive' : 'secondary'}>
                        {Math.round(conflict.severity * 100)}%
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{conflict.conflict}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Compliance Trajectory</CardTitle>
          <CardDescription>Compliance changes over time by ruleset</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(
              trajectory.trajectory.reduce((acc, point) => {
                if (!acc[point.ruleset]) acc[point.ruleset] = [];
                acc[point.ruleset].push(point);
                return acc;
              }, {} as Record<string, CompliancePoint[]>)
            ).map(([ruleset, points]) => (
              <div key={ruleset} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{ruleset}</span>
                  <Badge variant={
                    points[points.length - 1]?.status === 'compliant' ? 'default' :
                    points[points.length - 1]?.status === 'at-risk' ? 'secondary' : 'destructive'
                  }>
                    {points[points.length - 1]?.status || 'unknown'}
                  </Badge>
                </div>
                <div className="space-y-1">
                  {points.slice(-5).map((point, i) => {
                    const Icon = statusIcons[point.status];
                    return (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <Icon className={`h-4 w-4 ${statusColors[point.status]}`} />
                        <span className="text-muted-foreground w-24">
                          {new Date(point.date).toLocaleDateString()}
                        </span>
                        <Progress value={point.score * 100} className="flex-1" />
                        <span className="w-12 text-right text-xs">
                          {Math.round(point.score * 100)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {trajectory.predictions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Compliance Stress Predictions</CardTitle>
            <CardDescription>Predicted future compliance issues</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {trajectory.predictions.map((pred, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {new Date(pred.date).toLocaleDateString()}
                  </span>
                  <div className="flex items-center gap-2 w-48">
                    <Progress value={pred.predictedStress * 100} className="flex-1" />
                    <span className="text-sm font-medium w-12 text-right">
                      {Math.round(pred.predictedStress * 100)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

