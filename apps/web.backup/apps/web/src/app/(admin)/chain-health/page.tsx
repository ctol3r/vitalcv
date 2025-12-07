'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle, Server } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function ChainHealthPage() {
  const [orchestrator, setOrchestrator] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrchestrator = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/chain-load-orchestrator`);
      if (!response.ok) {
        throw new Error(`Failed to load chain health (${response.status})`);
      }
      const data = await response.json();
      setOrchestrator(data);
    } catch (err) {
      console.error('Failed to fetch chain health', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrchestrator();
    const interval = setInterval(fetchOrchestrator, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [fetchOrchestrator]);

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Chain Health & Load Orchestration</h1>
          <p className="text-muted-foreground">
            Autonomously balance chain load, throughput, finality, and integrity across networks
          </p>
        </div>
        <Button onClick={fetchOrchestrator} variant="secondary">
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && <p className="text-muted-foreground">Loading chain health...</p>}

      {orchestrator && orchestrator.chains && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {orchestrator.chains.map((chain: any, idx: number) => (
            <Card key={idx}>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Server className="h-4 w-4" />
                  {chain.name.toUpperCase()}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm">Health</span>
                    <Badge variant={chain.health > 0.7 ? 'default' : chain.health > 0.4 ? 'secondary' : 'destructive'}>
                      {(chain.health * 100).toFixed(0)}%
                    </Badge>
                  </div>
                  <Progress value={chain.health * 100} className="h-2" />
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <div className="text-muted-foreground">Block Time</div>
                    <div className="font-medium">{chain.metrics.blockTime}s</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Queue Depth</div>
                    <div className="font-medium">{chain.metrics.txQueueDepth}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Throughput</div>
                    <div className="font-medium">{chain.metrics.throughput} TPS</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Validator Lag</div>
                    <div className="font-medium">{chain.metrics.validatorLag} blocks</div>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm">Current Load</span>
                    <span className="text-sm font-medium">{(chain.load.current * 100).toFixed(0)}%</span>
                  </div>
                  <Progress value={chain.load.current * 100} className="h-2" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {orchestrator && orchestrator.routing && (
        <Card>
          <CardHeader>
            <CardTitle>Routing Strategy</CardTitle>
            <CardDescription>Current load-balancing configuration</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Primary Chain</span>
                <Badge>{orchestrator.routing.primary}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Strategy</span>
                <Badge variant="secondary">{orchestrator.routing.strategy}</Badge>
              </div>
              {orchestrator.routing.fallback && orchestrator.routing.fallback.length > 0 && (
                <div>
                  <span className="text-sm font-medium">Fallback Chains</span>
                  <div className="flex gap-2 mt-1">
                    {orchestrator.routing.fallback.map((chain: string, idx: number) => (
                      <Badge key={idx} variant="outline">{chain}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {orchestrator && orchestrator.failover && orchestrator.failover.active && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Failover Active</AlertTitle>
          <AlertDescription>
            Traffic has been routed from {orchestrator.failover.from} to {orchestrator.failover.to}.
            Reason: {orchestrator.failover.reason}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

