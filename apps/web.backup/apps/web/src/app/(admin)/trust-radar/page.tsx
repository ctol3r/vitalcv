'use client';

import { AlertCircle, Anchor, Download, Radar, RefreshCw } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_BASE_URL || '';

interface TrustRadarData {
  orgId: string;
  currentTrust: number;
  volatility: { score: number; trend: string };
  negativeSpikes: Array<{ detected: boolean; dropPercentage: number; severity: string }>;
  reinforcement: { suggestions: Array<{ action: string; priority: string; expectedImpact: string }> };
}

export default function TrustRadarPage() {
  const [orgId, setOrgId] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<TrustRadarData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchRadar = async () => {
    if (!orgId.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/trust-radar/${orgId}`);
      if (!res.ok) throw new Error('Failed to fetch trust radar');
      setData(await res.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Radar className="h-8 w-8" />
            Employer Dynamic Trust Radar
          </h1>
          <p className="text-muted-foreground mt-2">
            Monitor employer trust changes in real-time based on verification speed, fairness, and safety signals
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Trust Radar Analysis</CardTitle>
          <CardDescription>Enter an organization ID to view trust metrics</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Organization ID"
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchRadar()}
            />
            <Button onClick={fetchRadar} disabled={loading || !orgId.trim()}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Analyze
            </Button>
          </div>

          {error && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-md flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {loading && !data && <Skeleton className="h-64 w-full" />}

          {data && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Current Trust</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="text-3xl font-bold">{data.currentTrust}</div>
                      <Progress value={data.currentTrust} />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Volatility</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="text-3xl font-bold">{data.volatility.score}</div>
                      <Badge>{data.volatility.trend}</Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {data.reinforcement.suggestions.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Reinforcement Suggestions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {data.reinforcement.suggestions.map((s, i) => (
                        <div key={i} className="p-3 border rounded">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold">{s.action}</span>
                            <Badge variant={s.priority === 'critical' ? 'destructive' : 'default'}>
                              {s.priority}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">{s.expectedImpact}</div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

