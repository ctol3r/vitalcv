'use client';

import { useState, useEffect, useCallback } from 'react';
import { adminChainApi } from '@/lib/admin/api';
import { ChainHealthStatus, AnchorBacklog } from '@/lib/admin/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Link2,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Database,
  Layers,
  Activity,
  Search,
} from 'lucide-react';
import { Input } from '@/components/ui/input';

export default function AdminChainMonitorPage() {
  const [chainHealth, setChainHealth] = useState<ChainHealthStatus | null>(null);
  const [backlog, setBacklog] = useState<AnchorBacklog | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockHash, setBlockHash] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [health, backlogData] = await Promise.all([
        adminChainApi.getChainHealth(),
        adminChainApi.getAnchorBacklog(),
      ]);
      setChainHealth(health);
      setBacklog(backlogData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch chain data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleExploreEvent = async () => {
    if (!blockHash.trim()) return;
    try {
      const data = await adminChainApi.exploreChainEvent(blockHash);
      // In a real app, you'd show this in a modal or detail panel
      console.log('Chain event data:', data);
      alert(`Found ${data.anchors.length} anchors and ${data.vcs.length} VCs in block`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to explore chain event');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'degraded':
        return <AlertCircle className="h-5 w-5 text-yellow-600" />;
      case 'down':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600';
      case 'degraded':
        return 'text-yellow-600';
      case 'down':
        return 'text-red-600';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Chain Monitoring</h1>
          <p className="text-muted-foreground">
            Monitor multi-chain health, anchor backlogs, and explore chain events
          </p>
        </div>
        <Button onClick={fetchData} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Chain Health */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Primary Chain */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Primary Chain
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-20" />
            ) : chainHealth ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Status</span>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(chainHealth.primaryChain.status)}
                    <Badge
                      variant={
                        chainHealth.primaryChain.status === 'healthy'
                          ? 'default'
                          : chainHealth.primaryChain.status === 'degraded'
                          ? 'secondary'
                          : 'destructive'
                      }
                    >
                      {chainHealth.primaryChain.status}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Latency:</span>
                    <span className="font-medium">{chainHealth.primaryChain.latency}ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Block Height:</span>
                    <span className="font-medium">
                      {chainHealth.primaryChain.blockHeight.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last Block:</span>
                    <span className="font-medium text-xs">
                      {new Date(chainHealth.primaryChain.lastBlockTime).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Mirror Chain */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Mirror Chain
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-20" />
            ) : chainHealth ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Status</span>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(chainHealth.mirrorChain.status)}
                    <Badge
                      variant={
                        chainHealth.mirrorChain.status === 'healthy'
                          ? 'default'
                          : chainHealth.mirrorChain.status === 'degraded'
                          ? 'secondary'
                          : 'destructive'
                      }
                    >
                      {chainHealth.mirrorChain.status}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Latency:</span>
                    <span className="font-medium">{chainHealth.mirrorChain.latency}ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Block Height:</span>
                    <span className="font-medium">
                      {chainHealth.mirrorChain.blockHeight.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last Block:</span>
                    <span className="font-medium text-xs">
                      {new Date(chainHealth.mirrorChain.lastBlockTime).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Rollup Layer */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Rollup Layer
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-20" />
            ) : chainHealth ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Status</span>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(chainHealth.rollupLayer.status)}
                    <Badge
                      variant={
                        chainHealth.rollupLayer.status === 'healthy'
                          ? 'default'
                          : chainHealth.rollupLayer.status === 'degraded'
                          ? 'secondary'
                          : 'destructive'
                      }
                    >
                      {chainHealth.rollupLayer.status}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pending TXs:</span>
                    <span className="font-medium">
                      {chainHealth.rollupLayer.pendingTransactions.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Throughput:</span>
                    <span className="font-medium">
                      {chainHealth.rollupLayer.throughput} TX/s
                    </span>
                  </div>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* Anchor Backlog */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Anchor Backlog
          </CardTitle>
          <CardDescription>
            Pending, failed, and stale anchor operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-32" />
          ) : backlog ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">{backlog.pending}</div>
                  <div className="text-sm text-muted-foreground">Pending</div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{backlog.failed}</div>
                  <div className="text-sm text-muted-foreground">Failed</div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-gray-600">{backlog.stale}</div>
                  <div className="text-sm text-muted-foreground">Stale</div>
                </div>
              </div>

              {backlog.items.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Recent Items</h3>
                  <div className="space-y-1">
                    {backlog.items.slice(0, 10).map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-2 border rounded text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {item.type}
                          </Badge>
                          <span className="text-muted-foreground">{item.resourceId}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              item.status === 'pending'
                                ? 'secondary'
                                : item.status === 'failed'
                                ? 'destructive'
                                : 'outline'
                            }
                          >
                            {item.status}
                          </Badge>
                          {item.retryCount > 0 && (
                            <span className="text-xs text-muted-foreground">
                              Retries: {item.retryCount}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Chain Event Explorer */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Chain Event Explorer
          </CardTitle>
          <CardDescription>
            Explore chain events by block hash
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Enter block hash..."
              value={blockHash}
              onChange={(e) => setBlockHash(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleExploreEvent} disabled={!blockHash.trim()}>
              <Search className="h-4 w-4 mr-2" />
              Explore
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

