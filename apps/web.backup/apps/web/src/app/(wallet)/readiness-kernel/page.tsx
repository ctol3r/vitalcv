'use client';

import { Anchor, Brain, Download, RefreshCw } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_BASE_URL || '';

export default function ReadinessKernelPage() {
  const [clinicianId, setClinicianId] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  const fetchKernel = async () => {
    if (!clinicianId.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/readiness-kernel/${clinicianId}`);
      if (res.ok) setData(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Brain className="h-8 w-8" />
          Readiness Reinforcement Kernel
        </h1>
        <p className="text-muted-foreground mt-2">
          Continuously strengthen readiness, reduce bottlenecks, and accelerate readiness→deployment flow
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Readiness Analysis</CardTitle>
          <CardDescription>Enter clinician ID to analyze readiness</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Clinician ID"
              value={clinicianId}
              onChange={(e) => setClinicianId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchKernel()}
            />
            <Button onClick={fetchKernel} disabled={loading || !clinicianId.trim()}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Analyze
            </Button>
          </div>

          {data && (
            <div className="space-y-4">
              {data.confidence && (
                <Card>
                  <CardHeader>
                    <CardTitle>Confidence Score</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="text-3xl font-bold">{data.confidence.score}/100</div>
                      <Progress value={data.confidence.score} />
                    </div>
                  </CardContent>
                </Card>
              )}

              {data.bottlenecks && data.bottlenecks.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Bottlenecks</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {data.bottlenecks.map((b: any, i: number) => (
                        <div key={i} className="p-2 border rounded">
                          <Badge variant={b.severity === 'critical' ? 'destructive' : 'default'}>{b.severity}</Badge>
                          <div className="mt-1">{b.description}</div>
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

