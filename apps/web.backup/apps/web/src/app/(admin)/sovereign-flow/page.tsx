'use client';

import { AlertCircle, Anchor, Download, Network, RefreshCw } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_BASE_URL || '';

interface SovereignTrustFlowData {
  overallFlow: number;
  directions: Array<{ fromChain: string; toChain: string; flow: string; strength: number }>;
  forecast: {
    confidence: number;
  };
  anomalies: Array<{ detected: boolean; severity: string }>;
}

export default function SovereignFlowPage() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SovereignTrustFlowData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchFlow = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/sovereign-trust-flow`);
      if (!res.ok) throw new Error('Failed to fetch trust flow matrix');
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
            <Network className="h-8 w-8" />
            Multi-Chain Sovereign Trust Flow Matrix
          </h1>
          <p className="text-muted-foreground mt-2">
            A matrix modeling how trust sovereignty flows between chains
          </p>
        </div>
        <Button onClick={fetchFlow} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Trust Flow Matrix</CardTitle>
          <CardDescription>View trust flow between chains</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
                    <CardTitle className="text-lg">Overall Flow</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="text-3xl font-bold">{data.overallFlow}</div>
                      <Progress value={data.overallFlow} />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Forecast Confidence</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="text-3xl font-bold">{data.forecast.confidence}%</div>
                      <Progress value={data.forecast.confidence} />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Trust Flow Directions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {data.directions.map((dir, i) => (
                      <div key={i} className="p-3 border rounded">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">
                            {dir.fromChain} → {dir.toChain}
                          </span>
                          <div className="flex items-center gap-2">
                            <Badge>{dir.flow}</Badge>
                            <Progress value={dir.strength} className="w-24" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {data.anomalies.filter((a) => a.detected).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Anomalies</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {data.anomalies
                        .filter((a) => a.detected)
                        .map((anomaly, i) => (
                          <Badge key={i} variant="destructive">
                            Severity: {anomaly.severity}
                          </Badge>
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








