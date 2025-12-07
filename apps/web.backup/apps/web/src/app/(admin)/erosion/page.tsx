'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function ErosionPage() {
  const [erosion, setErosion] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const region = 'us-west';
    fetch(`${API_BASE}/api/workforce-erosion/${region}`)
      .then((res) => res.json())
      .then((data) => {
        setErosion(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton className="h-64 w-full" />;
  if (!erosion) return <div>No erosion data</div>;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Workforce Erosion & Retention Predictor</CardTitle>
          <CardDescription>Predicting talent erosion, loss risk, and long-term retention</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">Overall Risk</span>
              <span className="text-sm font-bold">{erosion.overallRisk?.toFixed(1) || 0}/100</span>
            </div>
            <Progress value={erosion.overallRisk || 0} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

