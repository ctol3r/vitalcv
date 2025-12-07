'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, TrendingUp, Clock, Users } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

interface EconomicsMetrics {
  psvCost: number;
  timeToFillDelta: number;
  credentialingOverhead: number;
  readinessROI: number;
  staffingEfficiency: number;
  laborShortageImpact: number;
  completionVelocity: number;
}

export default function EconomicsPage() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<EconomicsMetrics | null>(null);
  const [orgId] = useState('demo-org-1'); // In production, get from auth

  useEffect(() => {
    loadMetrics();
  }, [orgId]);

  async function loadMetrics() {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/economics/org/${orgId}`);
      const data = await res.json();
      if (data.success) {
        setMetrics(data.metrics);
      }
    } catch (error) {
      console.error('Failed to load metrics:', error);
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

  if (!metrics) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-muted-foreground">No economics data available</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Verification Economics</h1>
        <p className="text-muted-foreground mt-2">
          Cost savings, time saved, readiness impact, and staffing efficiency
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">PSV Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${metrics.psvCost.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Average per verification</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Time Saved</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.timeToFillDelta} days</div>
            <p className="text-xs text-muted-foreground mt-1">vs traditional onboarding</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Readiness ROI</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(metrics.readinessROI / 1000).toFixed(0)}K</div>
            <p className="text-xs text-muted-foreground mt-1">Revenue regained</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Efficiency Gain</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(metrics.staffingEfficiency * 100).toFixed(0)}%</div>
            <p className="text-xs text-muted-foreground mt-1">Workforce optimization</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Labor Shortage Impact</CardTitle>
            <CardDescription>Shifts saved by faster onboarding</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.laborShortageImpact.toFixed(1)}</div>
            <p className="text-sm text-muted-foreground mt-2">shifts per month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Completion Velocity</CardTitle>
            <CardDescription>Improvement over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{(metrics.completionVelocity * 100).toFixed(0)}%</div>
            <p className="text-sm text-muted-foreground mt-2">faster than baseline</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

