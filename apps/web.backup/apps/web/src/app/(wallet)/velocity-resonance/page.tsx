'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, RefreshCw, Download, Anchor, TrendingUp, Zap } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export default function VelocityResonancePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clinicianId = 'demo-clinician-id';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/talent-velocity/${clinicianId}`);
      if (!res.ok) throw new Error('Failed to load velocity/resonance');
      const data = await res.json();
      setData(data.data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAnchor = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/talent-velocity/${clinicianId}/anchor`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to anchor');
      await loadData();
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
          <h1 className="text-3xl font-bold">Talent Velocity & Resonance</h1>
          <p className="text-muted-foreground">
            Measure and optimize talent velocity, conversion probability, and resonance across roles & employers
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleAnchor}>
            <Anchor className="h-4 w-4 mr-2" />
            Anchor
          </Button>
        </div>
      </div>

      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Application Velocity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{data.velocity?.application || 0}</div>
                <p className="text-sm text-muted-foreground">per month</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Response Velocity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{data.velocity?.response || 0}</div>
                <p className="text-sm text-muted-foreground">days avg</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Match Velocity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{data.velocity?.match || 0}</div>
                <p className="text-sm text-muted-foreground">per month</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Verification Velocity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{data.velocity?.verification || 0}</div>
                <p className="text-sm text-muted-foreground">days avg</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Conversion Resonance Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-5xl font-bold mb-2">{data.resonance?.score || 0}/100</div>
              <Progress value={data.resonance?.score || 0} className="mt-2" />
            </CardContent>
          </Card>

          {data.matchProbability && (
            <Card>
              <CardHeader>
                <CardTitle>Match Probability Enhancements</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="text-2xl font-bold mb-4">
                    Current: {(data.matchProbability.current * 100).toFixed(0)}%
                  </div>
                  {data.matchProbability.enhancements?.map((enh: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{enh.action}</p>
                        <p className="text-sm text-muted-foreground">
                          +{enh.impact}% improvement
                        </p>
                      </div>
                      <Badge variant={enh.priority === 'high' ? 'destructive' : 'default'}>
                        {enh.priority}
                      </Badge>
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

