/**
 * Task 475.26 - Integrity intelligence heatfield
 * Visual heatmap of employer integrity across dimensions
 */

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

interface HeatfieldData {
  regions: Record<string, number>;
  dimensions: Record<string, number>;
  updatedAt: string;
}

export default function IntegrityHeatfieldPage() {
  const [heatfieldData, setHeatfieldData] = useState<HeatfieldData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch heatfield data
    const orgId = 'demo-org-id';

    fetch(`${API_BASE}/api/employer/integrity-heatfield/${orgId}`)
      .then(res => res.json())
      .then(data => {
        setHeatfieldData(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  const getHeatColor = (value: number) => {
    if (value >= 0.8) return 'bg-green-500';
    if (value >= 0.6) return 'bg-yellow-500';
    if (value >= 0.4) return 'bg-orange-500';
    return 'bg-red-500';
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Integrity Heatfield</h1>
        <p>Loading heatfield data...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Integrity Intelligence Heatfield</h1>
        <p className="text-muted-foreground">
          Visual heatmap of employer integrity across regions and dimensions
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Integrity Heatmap</CardTitle>
          <CardDescription>Darker green = higher integrity, Red = risk areas</CardDescription>
        </CardHeader>
        <CardContent>
          {heatfieldData ? (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(heatfieldData.dimensions || {}).map(([dimension, value]) => (
                  <div key={dimension} className="border rounded p-2">
                    <div className="text-xs font-semibold mb-1">{dimension}</div>
                    <div className={`h-8 rounded ${getHeatColor(value as number)}`} style={{ opacity: value as number }} />
                    <div className="text-xs text-muted-foreground mt-1">{(value as number * 100).toFixed(0)}%</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              No heatfield data available
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

