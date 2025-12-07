'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, RefreshCw, Download, Anchor, Flame } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export default function ConvergenceHeatfieldPage() {
  const [heatfield, setHeatfield] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadHeatfield();
  }, []);

  const loadHeatfield = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/convergence-heatfield`);
      if (!res.ok) throw new Error('Failed to load heatfield');
      const data = await res.json();
      setHeatfield(data.heatfield);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAnchor = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/convergence-heatfield/anchor`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to anchor');
      await loadHeatfield();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <p>{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Convergence Forecasting Heatfield</h1>
          <p className="text-muted-foreground">
            A heatfield showing convergence trajectories across clinicians and timeframes
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadHeatfield}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleAnchor}>
            <Anchor className="h-4 w-4 mr-2" />
            Anchor
          </Button>
        </div>
      </div>

      {heatfield && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flame className="h-5 w-5" />
              Convergence Heatfield
            </CardTitle>
            <CardDescription>
              Forecasted convergence scores across clinicians and timeframes (30-180 days)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {heatfield.clusters && (
                <div>
                  <div className="text-sm font-medium mb-2">Convergence Clusters</div>
                  <div className="grid grid-cols-4 gap-2">
                    {heatfield.clusters.map((cluster: any, idx: number) => (
                      <Badge key={idx} variant="outline">
                        {cluster.cluster}: {cluster.clinicians?.length || 0}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              <div className="text-sm text-muted-foreground">
                Heatfield visualization would show convergence trajectories across time and clinicians
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}








