'use client';

import { useEffect, useState } from 'react';
import { Server, CheckCircle2, XCircle, AlertTriangle, Globe } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

const REGIONS = ['us-west-2', 'us-east-1', 'eu-central-1', 'ap-southeast-1'];

export default function ResiliencyPage() {
  const [nodes, setNodes] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNodes();
  }, []);

  const fetchNodes = async () => {
    try {
      const nodePromises = REGIONS.map(async (region) => {
        const res = await fetch(`${API_BASE}/api/resiliency/node/${region}`);
        if (res.ok) {
          const data = await res.json();
          return [region, data];
        }
        return [region, null];
      });
      const results = await Promise.all(nodePromises);
      const nodeMap: Record<string, any> = {};
      results.forEach(([region, data]) => {
        if (data) nodeMap[region] = data;
      });
      setNodes(nodeMap);
    } catch (error) {
      console.error('Failed to fetch nodes', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateOutage = async (region: string) => {
    if (!confirm(`Simulate outage for ${region}?`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/resiliency/simulate-outage/${region}`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        alert(`Outage simulated. Backup region: ${data.backupRegion}. Recovery time: ${data.recoveryTime}s`);
        fetchNodes();
      }
    } catch (error) {
      console.error('Failed to simulate outage', error);
    }
  };

  const handleAnchor = async (region: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/resiliency/anchor/${region}`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        alert(`Resiliency state anchored! TX Hash: ${data.txHash}`);
        fetchNodes();
      }
    } catch (error) {
      console.error('Failed to anchor resiliency state', error);
    }
  };

  const getHealthStatus = (health: any) => {
    if (!health) return { status: 'unknown', color: 'gray', icon: AlertTriangle };
    switch (health.status) {
      case 'healthy':
        return { status: 'Healthy', color: 'green', icon: CheckCircle2 };
      case 'degraded':
        return { status: 'Degraded', color: 'yellow', icon: AlertTriangle };
      case 'down':
        return { status: 'Down', color: 'red', icon: XCircle };
      default:
        return { status: 'Unknown', color: 'gray', icon: AlertTriangle };
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
      <div>
        <h1 className="text-3xl font-bold">Global Credential Resiliency Network</h1>
        <p className="text-muted-foreground mt-2">
          Disaster-proof, multi-region, multi-chain backup of credential anchors & status
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {REGIONS.map((region) => {
          const node = nodes[region];
          const health = node?.health || {};
          const healthInfo = getHealthStatus(health);
          const Icon = healthInfo.icon;
          const anchors = node?.anchors || [];

          return (
            <Card key={region}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  {region}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Status</span>
                  <Badge variant={healthInfo.color === 'green' ? 'default' : 'destructive'}>
                    <Icon className="h-3 w-3 mr-1" />
                    {healthInfo.status}
                  </Badge>
                </div>
                <div>
                  <span className="text-sm font-medium">Anchors: </span>
                  {Array.isArray(anchors) ? anchors.length : 0}
                </div>
                {health.latency && (
                  <div>
                    <span className="text-sm font-medium">Latency: </span>
                    {health.latency}ms
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleSimulateOutage(region)}
                    variant="outline"
                    size="sm"
                  >
                    Simulate Outage
                  </Button>
                  <Button onClick={() => handleAnchor(region)} variant="outline" size="sm">
                    Anchor State
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resiliency Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div>
              <span className="font-medium">Total Regions: </span>
              {REGIONS.length}
            </div>
            <div>
              <span className="font-medium">Healthy Regions: </span>
              {Object.values(nodes).filter((n) => n.health?.status === 'healthy').length}
            </div>
            <div>
              <span className="font-medium">Total Anchors: </span>
              {Object.values(nodes).reduce(
                (sum, n) => sum + (Array.isArray(n.anchors) ? n.anchors.length : 0),
                0
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

