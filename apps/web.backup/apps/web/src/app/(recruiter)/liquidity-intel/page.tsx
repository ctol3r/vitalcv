'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function LiquidityIntelPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const region = 'US'; // Replace with actual region
    fetch(`${API_BASE}/api/liquidity-intelligence/${region}`)
      .then((res) => res.json())
      .then((data) => {
        setData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load liquidity intelligence', err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Marketplace Liquidity Intelligence</CardTitle>
          <CardDescription>Analyze scarcity, supply-demand mismatch, and role velocity</CardDescription>
        </CardHeader>
        <CardContent>
          {data ? (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Shortages</h3>
                <div className="text-sm text-muted-foreground">
                  {data.intel?.shortages?.length ?? 0} specialties in shortage
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Abundances</h3>
                <div className="text-sm text-muted-foreground">
                  {data.intel?.abundances?.length ?? 0} specialties with abundance
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Velocity Metrics</h3>
                <div className="text-sm text-muted-foreground">
                  Average days to fill: {Object.values(data.intel?.velocity || {}).reduce((a: any, b: any) => a + b, 0) / (Object.keys(data.intel?.velocity || {}).length || 1) || 0} days
                </div>
              </div>
            </div>
          ) : (
            <div>No liquidity intelligence data available</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}








