'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, Users, AlertCircle, Anchor } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export default function OptimizationKernelPage() {
  const [kernel, setKernel] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchKernel();
  }, []);

  const fetchKernel = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/workforce-kernel`);
      if (res.ok) {
        const data = await res.json();
        setKernel(data.kernel);
      }
    } catch (error) {
      console.error('Failed to fetch kernel', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAnchor = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/workforce-kernel/anchor`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        alert(`Kernel anchored! Digest: ${data.digest}`);
        fetchKernel();
      }
    } catch (error) {
      console.error('Failed to anchor kernel', error);
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

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Workforce Optimization Kernel</h1>
          <p className="text-muted-foreground mt-2">
            Engine that optimizes staffing, coverage, shortages & readiness at scale
          </p>
        </div>
        <Button onClick={handleAnchor}>
          <Anchor className="mr-2 h-4 w-4" />
          Anchor Kernel
        </Button>
      </div>

      {kernel && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Deployments
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kernel.deployments?.length || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Shortages
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kernel.shortages?.length || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Bottlenecks
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kernel.bottlenecks?.length || 0}</div>
              </CardContent>
            </Card>
          </div>

          {kernel.shortages && kernel.shortages.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Shortages</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {kernel.shortages.slice(0, 10).map((s: any, i: number) => (
                    <div key={i} className="flex items-center justify-between">
                      <span>{s.region} - {s.specialty}</span>
                      <Badge variant={s.severity > 70 ? 'destructive' : 'secondary'}>
                        {s.severity}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {kernel.bottlenecks && kernel.bottlenecks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Systemic Bottlenecks</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {kernel.bottlenecks.map((b: any, i: number) => (
                    <div key={i} className="flex items-center justify-between">
                      <span>{b.type} - {b.location}</span>
                      <Badge>{b.impact.toFixed(0)}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}








