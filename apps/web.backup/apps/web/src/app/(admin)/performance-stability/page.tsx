'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Anchor, Download, Activity } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

interface PerformanceStabilityData {
  overallStability: number;
  hiringQuality: { variance: number; trend: 'improving' | 'stable' | 'declining' };
  safetyStability: { score: number; volatility: number };
  systemLevelStability: number;
  stressRecovery: number;
}

export default function PerformanceStabilityPage() {
  const [stability, setStability] = useState<PerformanceStabilityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [orgId] = useState('org-1');

  useEffect(() => {
    loadStability();
  }, [orgId]);

  async function loadStability() {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/stability/performance/${orgId}`);
      if (res.ok) {
        const data = await res.json();
        setStability(data);
      }
    } catch (error) {
      console.error('Failed to load performance stability', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="container mx-auto p-6">Loading...</div>;
  if (!stability) return <div className="container mx-auto p-6">No data available</div>;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Performance Stability Core</h1>
          <p className="text-muted-foreground">Track employer performance stability over time</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => fetch(`${API_BASE}/api/stability/performance/${orgId}/export`).then(r => r.json()).then(d => {
            const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `stability-${orgId}.json`;
            a.click();
          })} variant="outline">
            <Download className="w-4 h-4 mr-2" /> Export
          </Button>
          <Button onClick={() => fetch(`${API_BASE}/api/stability/performance/${orgId}/anchor`, { method: 'POST' }).then(r => r.json()).then(d => alert(`Anchored: ${d.txHash}`))} variant="outline">
            <Anchor className="w-4 h-4 mr-2" /> Anchor
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Overall Stability: {(stability.overallStability * 100).toFixed(1)}%</CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={stability.overallStability * 100} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Hiring Quality</CardTitle>
            <CardDescription>Trend: {stability.hiringQuality.trend}</CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={(1 - stability.hiringQuality.variance) * 100} />
            <p className="text-sm text-muted-foreground mt-2">Variance: {(stability.hiringQuality.variance * 100).toFixed(1)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Safety Stability</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={stability.safetyStability.score * 100} />
            <p className="text-sm text-muted-foreground mt-2">Volatility: {(stability.safetyStability.volatility * 100).toFixed(1)}%</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

