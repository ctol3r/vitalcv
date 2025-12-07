'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Network, Shield, Activity } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function TrustRoutingPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/trust-routing`);
      if (res.ok) {
        const fabricData = await res.json();
        setData(fabricData);
      }
    } catch (error) {
      console.error('Failed to load trust routing fabric:', error);
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

  const fabric = data?.fabric || {};
  const routes = fabric.routes || [];
  const chainHealth = fabric.chainHealth || [];
  const trustClusters = fabric.trustClusters || [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Trust-Adaptive Routing Fabric</h1>
          <p className="text-muted-foreground mt-2">
            Route hiring, verification, and credential use cases through trust-aware logic
          </p>
        </div>
        <Button variant="outline" onClick={loadData} disabled={loading}>
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Routes</CardTitle>
            <CardDescription>Configured routing paths</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{routes.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Chain Health</CardTitle>
            <CardDescription>Blockchain health status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{chainHealth.length}</div>
            <div className="text-sm text-muted-foreground mt-2">
              {chainHealth.filter((h: any) => h.health === 'healthy').length} healthy
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Trust Clusters</CardTitle>
            <CardDescription>Network trust clusters</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{trustClusters.length}</div>
          </CardContent>
        </Card>
      </div>

      {routes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Routing Paths</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {routes.map((route: any, idx: number) => (
                <div key={idx} className="border-b pb-4 last:border-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold">{route.useCase}</div>
                    <Badge>Default: {route.defaultPath}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {route.paths?.length || 0} available paths
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {chainHealth.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Chain Health Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {chainHealth.map((health: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-2 border rounded">
                  <div>
                    <div className="font-medium">{health.chainId}</div>
                    <div className="text-sm text-muted-foreground">
                      Trust modifier: {(health.trustModifier * 100).toFixed(0)}%
                    </div>
                  </div>
                  <Badge
                    variant={
                      health.health === 'healthy'
                        ? 'default'
                        : health.health === 'degraded'
                        ? 'secondary'
                        : 'destructive'
                    }
                  >
                    {health.health}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {trustClusters.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Trust Clusters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {trustClusters.map((cluster: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-2 border rounded">
                  <div>
                    <div className="font-medium">{cluster.clusterId}</div>
                    <div className="text-sm text-muted-foreground">
                      {cluster.members?.length || 0} members
                    </div>
                  </div>
                  <Badge>Avg Trust: {(cluster.averageTrust * 100).toFixed(0)}%</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

