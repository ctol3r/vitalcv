'use client';

import { useCallback, useEffect, useState } from 'react';
import { TrendingUp, AlertTriangle, Users, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

interface EmployerBehavior {
  hiringPatterns?: {
    rejectionRate: number;
    timeToHire: number;
  };
  fairness?: {
    score: number;
  };
  compliance?: {
    score: number;
  };
  efficiency?: {
    verificationSpeed: number;
  };
}

interface Credibility {
  credibilityScore: number;
  riskLevel: 'low' | 'medium' | 'high';
}

interface Friction {
  bottlenecks: string[];
  avgTimeToHire: number;
  frictionScore: number;
}

export default function EmployerBehaviorPage() {
  const [orgId, setOrgId] = useState('demo-org');
  const [behavior, setBehavior] = useState<EmployerBehavior | null>(null);
  const [credibility, setCredibility] = useState<Credibility | null>(null);
  const [friction, setFriction] = useState<Friction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBehavior = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const [behaviorRes, credibilityRes, frictionRes] = await Promise.all([
        fetch(`${API_BASE}/api/employer-behavior/${orgId}`),
        fetch(`${API_BASE}/api/employer-behavior/${orgId}/credibility`),
        fetch(`${API_BASE}/api/employer-behavior/${orgId}/friction`),
      ]);

      if (!behaviorRes.ok) throw new Error(`Failed to load behavior (${behaviorRes.status})`);
      if (credibilityRes.ok) {
        const credData = await credibilityRes.json();
        setCredibility(credData);
      }
      if (frictionRes.ok) {
        const frictionData = await frictionRes.json();
        setFriction(frictionData);
      }

      const behaviorData = await behaviorRes.json();
      setBehavior(behaviorData.behavior || behaviorData);
    } catch (err) {
      console.error('Failed to fetch employer behavior', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchBehavior();
    const interval = setInterval(fetchBehavior, 60_000);
    return () => clearInterval(interval);
  }, [fetchBehavior]);

  const fairnessScore = behavior?.fairness?.score || 0;
  const complianceScore = behavior?.compliance?.score || 0;
  const credibilityScore = credibility?.credibilityScore || 0;

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Employer Behavior Intelligence</h1>
          <p className="text-muted-foreground">
            Analyze hiring patterns, risk signals, fairness, compliance & efficiency.
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
          <p className="text-muted-foreground">Loading employer behavior...</p>
        </div>
      )}

      {!loading && behavior && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Fairness Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(fairnessScore * 100).toFixed(0)}%</div>
                <Progress value={fairnessScore * 100} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Compliance Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(complianceScore * 100).toFixed(0)}%</div>
                <Progress value={complianceScore * 100} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Credibility</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(credibilityScore * 100).toFixed(0)}%</div>
                {credibility && (
                  <Badge variant={credibility.riskLevel === 'high' ? 'destructive' : credibility.riskLevel === 'medium' ? 'secondary' : 'outline'} className="mt-2">
                    {credibility.riskLevel.toUpperCase()}
                  </Badge>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Time to Hire</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {behavior.hiringPatterns?.timeToHire || 0} days
                </div>
                <p className="text-xs text-muted-foreground mt-1">Average</p>
              </CardContent>
            </Card>
          </div>

          {friction && friction.bottlenecks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Hiring Friction</CardTitle>
                <CardDescription>Bottlenecks detected in hiring process</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium">Friction Score</span>
                    <Badge variant={friction.frictionScore > 0.7 ? 'destructive' : friction.frictionScore > 0.4 ? 'secondary' : 'outline'}>
                      {(friction.frictionScore * 100).toFixed(0)}%
                    </Badge>
                  </div>
                  {friction.bottlenecks.map((bottleneck, idx) => (
                    <Alert key={idx} variant="default">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>{bottleneck.replace('_', ' ')}</AlertTitle>
                    </Alert>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Hiring Patterns</CardTitle>
              <CardDescription>Key metrics and statistics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Rejection Rate</span>
                  <span className="text-sm font-semibold">
                    {((behavior.hiringPatterns?.rejectionRate || 0) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Verification Speed</span>
                  <span className="text-sm font-semibold">
                    {behavior.efficiency?.verificationSpeed || 0}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}








