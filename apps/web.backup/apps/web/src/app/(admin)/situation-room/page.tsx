'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity, AlertTriangle, TrendingUp, Server } from 'lucide-react';
import { cn } from '@/lib/utils';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function SituationRoomPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/situation-room`);
      if (res.ok) {
        const roomData = await res.json();
        setData(roomData);
      }
    } catch (error) {
      console.error('Failed to load situation room:', error);
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

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Real-Time Workforce Situation Room</h1>
          <p className="text-muted-foreground mt-2">
            System-wide dashboard of staffing, readiness, safety, chain health & verification latency
          </p>
        </div>
        <Button variant="outline" onClick={loadData} disabled={loading}>
          <Activity className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Workforce Readiness</CardTitle>
                <CardDescription>Current staffing status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{data.workforce?.readiness?.ready || 0}</div>
                <div className="text-sm text-muted-foreground">
                  of {data.workforce?.readiness?.total || 0} ready
                </div>
                <div className="text-sm text-muted-foreground mt-2">
                  Avg Score: {data.workforce?.readiness?.avgScore?.toFixed(1) || 0}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Open Positions</CardTitle>
                <CardDescription>Current openings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{data.workforce?.openings?.total || 0}</div>
                <div className="text-sm text-red-500 mt-2">
                  Critical: {data.workforce?.openings?.critical || 0}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Safety Risks</CardTitle>
                <CardDescription>Clinician risk levels</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span>High Risk</span>
                    <Badge variant="destructive">{data.safety?.highRisk || 0}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Medium Risk</span>
                    <Badge variant="secondary">{data.safety?.mediumRisk || 0}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Low Risk</span>
                    <Badge variant="default">{data.safety?.lowRisk || 0}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {data.chain && data.chain.chains && (
            <Card>
              <CardHeader>
                <CardTitle>Chain Health</CardTitle>
                <CardDescription>Blockchain network status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.chain.chains.map((chain: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-3 border rounded">
                      <div>
                        <div className="font-medium">{chain.chain}</div>
                        <div className="text-sm text-muted-foreground">
                          Block Time: {chain.blockTime}s | Finality: {chain.finality} blocks
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={chain.status === 'healthy' ? 'default' : 'secondary'}>
                          {chain.status}
                        </Badge>
                        <span className="text-sm">{chain.validatorHealth}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {data.alerts && data.alerts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>System Alerts</CardTitle>
                <CardDescription>Active system alerts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.alerts.map((alert: any, i: number) => (
                    <div key={i} className="flex items-start gap-2 p-3 border rounded">
                      <AlertTriangle className={cn(
                        'h-5 w-5 mt-0.5',
                        alert.severity === 'critical' && 'text-red-500',
                        alert.severity === 'high' && 'text-orange-500',
                        alert.severity === 'medium' && 'text-yellow-500',
                        alert.severity === 'low' && 'text-blue-500'
                      )} />
                      <div className="flex-1">
                        <div className="font-medium">{alert.message}</div>
                        <div className="text-sm text-muted-foreground">{alert.timestamp}</div>
                      </div>
                      <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}>
                        {alert.severity}
                      </Badge>
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

