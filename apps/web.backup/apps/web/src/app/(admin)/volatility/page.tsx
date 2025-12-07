'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function VolatilityPage() {
  const [volatility, setVolatility] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const region = 'US';
    fetch(`${API_BASE}/api/workforce-volatility/${region}`)
      .then((res) => res.json())
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton className="h-64 w-full" />;
  if (!volatility) return <div>No volatility data</div>;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Workforce Predictive Volatility</CardTitle>
          <CardDescription>Model and predict workforce volatility due to shortages, burnout, compensation shifts & policy changes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">Volatility Index</span>
              <span className="text-sm font-bold">{volatility.volatility?.index?.toFixed(1) || 0}/100</span>
            </div>
            <Progress value={volatility.volatility?.index || 0} />
          </div>
          {volatility.forecasting?.turbulence?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Predicted Turbulence</h3>
              {volatility.forecasting.turbulence.map((t: any, i: number) => (
                <Badge key={i} variant="outline" className="mr-2">
                  {new Date(t.date).toLocaleDateString()}: {t.predictedVolatility?.toFixed(1)}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}








