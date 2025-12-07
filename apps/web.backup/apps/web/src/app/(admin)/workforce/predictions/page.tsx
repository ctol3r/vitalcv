/**
 * Workforce Predictions Page
 * Phase 4: Workforce Forecasting & Predictions
 */

'use client';

import { WorkforcePredictionsView } from '@/components/workforce/WorkforcePredictionsView';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useState, useEffect } from 'react';
import type { WorkforcePrediction } from '@/lib/workforce/models';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';

export default function WorkforcePredictionsPage() {
  const [prediction, setPrediction] = useState<WorkforcePrediction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPredictions = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/workforce/predictions`);
        if (!response.ok) throw new Error('Failed to fetch predictions');
        const data = await response.json();
        setPrediction(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load predictions');
      } finally {
        setLoading(false);
      }
    };

    void loadPredictions();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-4">
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!prediction) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <p>No prediction data available</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <WorkforcePredictionsView prediction={prediction} />;
}








