'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, AlertCircle, BarChart3, Map } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function ConversionPage() {
  const [loading, setLoading] = useState(true);
  const [region] = useState('US-West'); // In production, get from auth
  const [kernel, setKernel] = useState<any>(null);
  const [bottlenecks, setBottlenecks] = useState<any[]>([]);
  const [heatmap, setHeatmap] = useState<Record<string, number>>({});

  useEffect(() => {
    loadConversion();
  }, [region]);

  async function loadConversion() {
    try {
      setLoading(true);
      const [kernelRes, bottlenecksRes, heatmapRes] = await Promise.all([
        fetch(`${API_BASE}/api/conversion/${region}`),
        fetch(`${API_BASE}/api/conversion/${region}/bottlenecks`),
        fetch(`${API_BASE}/api/conversion/${region}/heatmap`),
      ]);

      const kernelData = await kernelRes.json();
      if (kernelData.success) {
        setKernel(kernelData.kernel);
      }

      const bottlenecksData = await bottlenecksRes.json();
      if (bottlenecksData.success) {
        setBottlenecks(bottlenecksData.bottlenecks || []);
      }

      const heatmapData = await heatmapRes.json();
      if (heatmapData.success) {
        setHeatmap(heatmapData.heatmap || {});
      }
    } catch (error) {
      console.error('Failed to load conversion:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Talent Liquidity & Conversion</h1>
        <p className="text-muted-foreground mt-2">
          Model how talent flows convert into hires, shifts, placements & long-term retention
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Conversion Metrics
            </CardTitle>
            <CardDescription>Liquidity, conversion rate, bottlenecks</CardDescription>
          </CardHeader>
          <CardContent>
            {kernel && kernel.metrics && (
              <>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-muted-foreground">Liquidity</span>
                      <span className="text-sm font-medium">{kernel.metrics.liquidity.toFixed(0)}</span>
                    </div>
                    <Progress value={kernel.metrics.liquidity} />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-muted-foreground">Conversion Rate</span>
                      <span className="text-sm font-medium">{kernel.metrics.conversionRate.toFixed(1)}%</span>
                    </div>
                    <Progress value={kernel.metrics.conversionRate} />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-muted-foreground">Bottleneck Score</span>
                      <span className="text-sm font-medium">{kernel.metrics.bottleneckScore.toFixed(0)}</span>
                    </div>
                    <Progress value={kernel.metrics.bottleneckScore} />
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Conversion Bottlenecks
            </CardTitle>
            <CardDescription>Where talent flow collapses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {bottlenecks.length > 0 ? (
                bottlenecks.map((bottleneck, i) => (
                  <div key={i} className="p-2 border rounded">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{bottleneck.stage}</span>
                      <Badge
                        variant={bottleneck.severity === 'high' ? 'destructive' : 'default'}
                      >
                        {bottleneck.severity}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Conversion: {(bottleneck.conversionRate * 100).toFixed(1)}% (threshold: {(bottleneck.threshold * 100).toFixed(1)}%)
                    </div>
                  </div>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">No bottlenecks detected</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Map className="h-5 w-5" />
              Conversion Heatmap
            </CardTitle>
            <CardDescription>Region-wide conversion performance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(heatmap)
                .slice(0, 5)
                .map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between p-2 border rounded">
                    <span className="text-sm">{key.replace(/-/g, ' ')}</span>
                    <div className="flex items-center gap-2">
                      <Progress value={value * 100} className="w-24" />
                      <span className="text-sm font-medium">{(value * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Conversion Uplift
            </CardTitle>
            <CardDescription>Interventions to improve conversions</CardDescription>
          </CardHeader>
          <CardContent>
            {kernel && kernel.uplift && kernel.uplift.length > 0 ? (
              <div className="space-y-2">
                {kernel.uplift.map((intervention: any, i: number) => (
                  <div key={i} className="p-2 border rounded">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{intervention.intervention}</span>
                      <Badge variant={intervention.effort === 'high' ? 'destructive' : 'default'}>
                        {intervention.effort}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Expected uplift: +{intervention.expectedUplift}% • Timeline: {intervention.timeline}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">No uplift interventions available</span>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

