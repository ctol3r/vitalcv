'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, TrendingUp, RefreshCw, Anchor } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export default function ImpactGridPage() {
  const [grid, setGrid] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const region = 'us-west-2'; // In production, get from context

  useEffect(() => {
    loadGrid();
  }, []);

  const loadGrid = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/performance-impact/${region}`);
      if (!res.ok) throw new Error('Failed to load grid');
      const data = await res.json();
      setGrid(data.grid);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAnchor = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/performance-impact/${region}/anchor`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to anchor');
      await loadGrid();
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
          <h1 className="text-3xl font-bold">Performance Impact Grid</h1>
          <p className="text-muted-foreground">
            Predict how clinician placement impacts system performance and patient access
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadGrid}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleAnchor}>
            <Anchor className="h-4 w-4 mr-2" />
            Anchor
          </Button>
        </div>
      </div>

      {grid?.systemLevelForecast && (
        <Card>
          <CardHeader>
            <CardTitle>System-Level Forecast</CardTitle>
            <CardDescription>Projected performance changes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Patient Access</div>
                <div className="text-2xl font-bold">{grid.systemLevelForecast.patientAccess.projected}</div>
                <div className="text-sm text-green-500">
                  +{grid.systemLevelForecast.patientAccess.improvement}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Staffing Stability</div>
                <div className="text-2xl font-bold">{grid.systemLevelForecast.staffingStability.projected}</div>
                <div className="text-sm text-green-500">
                  +{grid.systemLevelForecast.staffingStability.improvement}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Efficiency</div>
                <div className="text-2xl font-bold">{grid.systemLevelForecast.efficiency.projected}</div>
                <div className="text-sm text-green-500">
                  +{grid.systemLevelForecast.efficiency.improvement}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {grid?.shortageImpact && (
        <Card>
          <CardHeader>
            <CardTitle>Shortage Impact</CardTitle>
            <CardDescription>Impact on shortage reduction</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl font-bold">{grid.shortageImpact.reduced}% reduced</div>
              {grid.shortageImpact.bySpecialty && Object.keys(grid.shortageImpact.bySpecialty).length > 0 && (
                <div className="mt-4 space-y-2">
                  {Object.entries(grid.shortageImpact.bySpecialty).map(([specialty, reduction]: [string, any]) => (
                    <div key={specialty} className="flex items-center justify-between">
                      <span>{specialty}</span>
                      <Badge>{reduction}%</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {grid?.highImpactClinicians && grid.highImpactClinicians.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>High-Impact Clinicians</CardTitle>
            <CardDescription>Clinicians who dramatically improve staffing stability</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {grid.highImpactClinicians.map((clinician: any, idx: number) => (
                <div key={idx} className="p-3 border rounded">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{clinician.clinicianId}</span>
                    <Badge>{clinician.impact}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {clinician.factors.join(', ')}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

