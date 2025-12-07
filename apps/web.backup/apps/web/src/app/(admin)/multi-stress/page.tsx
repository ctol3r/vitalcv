'use client';

import { AlertCircle, Anchor, Download, Activity, RefreshCw } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_BASE_URL || '';

interface WorkforceMultiStressData {
  region: string;
  overallStress: number;
  vectors: Array<{ type: string; value: number; trend: string }>;
  surge: {
    predicted: boolean;
    severity: string;
  };
  anomalies: {
    detected: boolean;
    severity: string;
  };
}

export default function MultiStressPage() {
  const [region, setRegion] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<WorkforceMultiStressData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStress = async () => {
    if (!region.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/workforce-multi-stress/${region}`);
      if (!res.ok) throw new Error('Failed to fetch multi-stress data');
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
            <Activity className="h-8 w-8" />
            Workforce Multi-Vector Stress Engine
          </h1>
          <p className="text-muted-foreground mt-2">
            Model workforce stress across multiple vectors: shortages, burnout, instability, regulatory pressure & skill mismatch
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Multi-Stress Analysis</CardTitle>
          <CardDescription>Enter a region to view stress metrics</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Region (e.g., US-West, US-East)"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchStress()}
            />
            <Button onClick={fetchStress} disabled={loading || !region.trim()}>
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
                    <CardTitle className="text-lg">Overall Stress</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="text-3xl font-bold">{data.overallStress}</div>
                      <Progress value={data.overallStress} />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Surge Predicted</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Badge variant={data.surge.predicted ? 'destructive' : 'default'}>
                      {data.surge.predicted ? 'Yes' : 'No'}
                    </Badge>
                    {data.surge.predicted && (
                      <div className="text-sm text-muted-foreground mt-2">Severity: {data.surge.severity}</div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Anomalies</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Badge variant={data.anomalies.detected ? 'destructive' : 'default'}>
                      {data.anomalies.detected ? 'Detected' : 'None'}
                    </Badge>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Stress Vectors</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {data.vectors.map((vector, i) => (
                    <div key={i} className="space-y-2">
                      <div className="flex justify-between">
                        <span className="capitalize">{vector.type.replace(/_/g, ' ')}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{vector.value}</span>
                          <Badge variant="outline">{vector.trend}</Badge>
                        </div>
                      </div>
                      <Progress value={vector.value} />
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








