/**
 * Workforce Heatmap Page
 * Phase 2: Provider Heatmap & Coverage Visualization
 */

'use client';

import { WorkforceHeatmapView } from '@/components/workforce/WorkforceHeatmapView';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Unit } from '@/lib/workforce/models';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';

export default function WorkforceHeatmapPage() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const loadUnits = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/workforce/units`);
        if (!response.ok) throw new Error('Failed to fetch units');
        const data = await response.json();
        setUnits(data.units || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load units');
      } finally {
        setLoading(false);
      }
    };

    void loadUnits();
  }, []);

  const handleUnitClick = (unitId: string) => {
    router.push(`/workforce/unit/${unitId}`);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Workforce Heatmap</h1>
        <p className="text-muted-foreground mt-1">
          Hospital-wide, trust-weighted map of clinician readiness
        </p>
      </div>

      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-[600px] w-full" />
        </div>
      )}

      {error && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && (
        <WorkforceHeatmapView units={units} onUnitClick={handleUnitClick} />
      )}
    </div>
  );
}








