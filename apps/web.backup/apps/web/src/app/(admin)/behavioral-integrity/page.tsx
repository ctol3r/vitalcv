'use client';

import { AlertCircle, Anchor, Download, Eye, RefreshCw } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_BASE_URL || '';

interface BehavioralIntegrityLensData {
  orgId: string;
  score: {
    overall: number;
    transparency: number;
    fairness: number;
    compliance: number;
    consistency: number;
    safety: number;
  };
  redFlags: {
    detected: boolean;
    severity: string;
  };
  drift: {
    direction: string;
    prediction: number;
  };
}

export default function BehavioralIntegrityPage() {
  const [orgId, setOrgId] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<BehavioralIntegrityLensData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchLens = async () => {
    if (!orgId.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/behavioral-integrity/${orgId}`);
      if (!res.ok) throw new Error('Failed to fetch integrity lens');
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
            <Eye className="h-8 w-8" />
            Employer Behavioral Integrity Lens
          </h1>
          <p className="text-muted-foreground mt-2">
            A lens showing employer integrity across transparency, fairness, compliance, consistency & safety practices
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Integrity Lens Analysis</CardTitle>
          <CardDescription>Enter an organization ID to view integrity metrics</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Organization ID"
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchLens()}
            />
            <Button onClick={fetchLens} disabled={loading || !orgId.trim()}>
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Overall Score</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="text-3xl font-bold">{data.score.overall}</div>
                      <Progress value={data.score.overall} />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Red Flags</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Badge variant={data.redFlags.detected ? 'destructive' : 'default'}>
                      {data.redFlags.detected ? 'Detected' : 'None'}
                    </Badge>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Drift Direction</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Badge>{data.drift.direction}</Badge>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Score Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {Object.entries(data.score)
                    .filter(([key]) => key !== 'overall')
                    .map(([key, value]) => (
                      <div key={key} className="space-y-2">
                        <div className="flex justify-between">
                          <span className="capitalize">{key}</span>
                          <span className="font-semibold">{value}</span>
                        </div>
                        <Progress value={value} />
                      </div>
                    ))}
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}








