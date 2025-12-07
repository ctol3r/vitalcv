'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, RefreshCw, Download, Anchor, TrendingUp, TrendingDown } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export default function BehavioralConfidencePage() {
  const [index, setIndex] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orgId, setOrgId] = useState('demo-org-id');

  useEffect(() => {
    loadIndex();
  }, [orgId]);

  const loadIndex = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/behavioral-confidence/${orgId}`);
      if (!res.ok) throw new Error('Failed to load confidence index');
      const data = await res.json();
      setIndex(data.index);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAnchor = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/behavioral-confidence/${orgId}/anchor`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to anchor');
      await loadIndex();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <p>{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Behavioral Confidence Index</h1>
          <p className="text-muted-foreground">
            Score how confident the system should be in an employer's hiring behavior and decision consistency
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadIndex}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleAnchor}>
            <Anchor className="h-4 w-4 mr-2" />
            Anchor
          </Button>
        </div>
      </div>

      {index && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Confidence Index</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-5xl font-bold mb-2">{index.index || 0}/100</div>
              <Progress value={index.index || 0} className="mt-2" />
              <Badge
                className="mt-2"
                variant={
                  index.index >= 80
                    ? 'default'
                    : index.index >= 60
                      ? 'secondary'
                      : 'destructive'
                }
              >
                {index.routing?.confidenceTier || 'medium'}
              </Badge>
            </CardContent>
          </Card>

          {index.riskWeighted && (
            <Card>
              <CardHeader>
                <CardTitle>Risk-Weighted Scores</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Fairness</p>
                    <p className="text-2xl font-bold">{index.riskWeighted.fairness || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Speed</p>
                    <p className="text-2xl font-bold">{index.riskWeighted.speed || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Trust</p>
                    <p className="text-2xl font-bold">{index.riskWeighted.trust || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Outcomes</p>
                    <p className="text-2xl font-bold">{index.riskWeighted.outcomes || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {index.drift && index.drift.detected && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-destructive" />
                  Confidence Drift Detected
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {index.drift.shifts?.map((shift: any, i: number) => (
                    <div key={i} className="flex items-center gap-2">
                      <Badge variant="destructive">{shift.type}</Badge>
                      <span className="text-sm">{shift.date}</span>
                      <span className="text-sm text-muted-foreground">
                        Magnitude: {shift.magnitude}
                      </span>
                    </div>
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

