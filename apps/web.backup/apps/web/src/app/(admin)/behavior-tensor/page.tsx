'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function BehaviorTensorPage() {
  const [tensor, setTensor] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const orgId = 'default';
    fetch(`${API_BASE}/api/employer-behavior-tensor/${orgId}`)
      .then((res) => res.json())
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton className="h-64 w-full" />;
  if (!tensor) return <div>No behavior tensor data</div>;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Employer Behavioral Forecast Tensor</CardTitle>
          <CardDescription>Deep tensor model predicting employer behavior across fairness, trust, verification, stability & outcomes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {tensor.drift?.predicted && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Behavior Drift Predicted</h3>
              <Badge variant="destructive">
                Predicted Date: {tensor.drift.predictedDate || 'Unknown'}
              </Badge>
            </div>
          )}
          {tensor.anomalies?.hotspots?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Anomaly Hotspots</h3>
              {tensor.anomalies.hotspots.map((h: any, i: number) => (
                <Badge key={i} variant={h.severity === 'high' ? 'destructive' : 'outline'} className="mr-2">
                  {h.location}: {h.description}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}








