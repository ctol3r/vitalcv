'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export default function OnboardingHeatmapPage() {
  const [heatmap, setHeatmap] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock heatmap data - would fetch from API
    setTimeout(() => {
      setHeatmap({
        steps: [
          { name: 'Org Info', completion: 100, avgTime: 8 },
          { name: 'ATS Connect', completion: 75, avgTime: 12 },
          { name: 'Auto-Verify', completion: 50, avgTime: 5 },
          { name: 'Roles Setup', completion: 90, avgTime: 10 },
          { name: 'Safety Check', completion: 100, avgTime: 2 },
        ],
        bottlenecks: [
          { step: 'ATS Connect', severity: 'medium', reason: 'API configuration required' },
        ],
      });
      setLoading(false);
    }, 500);
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Onboarding Progress Heatmap</h1>
        <p className="text-muted-foreground mt-2">Visualize bottlenecks and required steps</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Step Completion Rates</CardTitle>
          <CardDescription>Completion percentage and average time per step</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {heatmap?.steps.map((step: any, idx: number) => (
              <div key={idx} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{step.name}</span>
                  <span>{step.completion}% • {step.avgTime} min avg</span>
                </div>
                <div className="h-4 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${step.completion}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {heatmap?.bottlenecks && heatmap.bottlenecks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Bottlenecks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {heatmap.bottlenecks.map((bottleneck: any, idx: number) => (
                <div key={idx} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{bottleneck.step}</span>
                    <span className="text-sm text-muted-foreground">{bottleneck.severity}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{bottleneck.reason}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

