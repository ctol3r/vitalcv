/**
 * Module Health Dashboard
 *
 * Shows uptime, latency, failure rate, last error, event throughput
 * for each domain module.
 */

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ModuleHealth {
  uptime: number;
  latency: number;
  failureRate: number;
  lastError?: string;
  lastErrorAt?: string;
  eventThroughput: number;
  lastChecked: string;
}

interface ModuleHealthData {
  id: string;
  name: string;
  enabled: boolean;
  health?: ModuleHealth;
  version?: string;
}

export function ModuleHealthDashboard() {
  const [modules, setModules] = useState<ModuleHealthData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchModuleHealth();
    const interval = setInterval(fetchModuleHealth, 5000); // Refresh every 5s
    return () => clearInterval(interval);
  }, []);

  async function fetchModuleHealth() {
    try {
      const res = await fetch('/api/demo/org/modules/health');
      if (!res.ok) throw new Error('Failed to fetch module health');
      const data = await res.json();
      setModules(data.modules || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  function formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  }

  function formatLatency(ms: number): string {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }

  function getHealthStatus(health?: ModuleHealth): 'healthy' | 'degraded' | 'unhealthy' {
    if (!health) return 'unhealthy';
    if (health.failureRate > 0.1) return 'unhealthy';
    if (health.failureRate > 0.05 || health.latency > 5000) return 'degraded';
    return 'healthy';
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="text-sm text-muted-foreground">Loading module health...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="text-sm text-destructive">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {modules.map((module) => {
          const health = module.health;
          const status = getHealthStatus(health);

          return (
            <Card key={module.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">{module.name}</CardTitle>
                  <div className="flex gap-2">
                    {module.enabled ? (
                      <Badge variant="outline" className="bg-green-50 text-green-700">
                        Enabled
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-gray-50 text-gray-600">
                        Disabled
                      </Badge>
                    )}
                    {status === 'healthy' && (
                      <Badge variant="outline" className="bg-green-50 text-green-700">
                        Healthy
                      </Badge>
                    )}
                    {status === 'degraded' && (
                      <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                        Degraded
                      </Badge>
                    )}
                    {status === 'unhealthy' && (
                      <Badge variant="outline" className="bg-red-50 text-red-700">
                        Unhealthy
                      </Badge>
                    )}
                  </div>
                </div>
                {module.version && (
                  <div className="text-xs text-muted-foreground">v{module.version}</div>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {health ? (
                  <>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <div className="text-muted-foreground">Uptime</div>
                        <div className="font-medium">{formatUptime(health.uptime)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Latency</div>
                        <div className="font-medium">{formatLatency(health.latency)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Failure Rate</div>
                        <div className="font-medium">
                          {(health.failureRate * 100).toFixed(2)}%
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Throughput</div>
                        <div className="font-medium">
                          {health.eventThroughput.toFixed(1)} evt/s
                        </div>
                      </div>
                    </div>
                    {health.lastError && (
                      <div className="rounded-md bg-red-50 p-2 text-xs">
                        <div className="font-medium text-red-900">Last Error</div>
                        <div className="text-red-700 mt-1 truncate">{health.lastError}</div>
                        {health.lastErrorAt && (
                          <div className="text-red-600 mt-1">
                            {new Date(health.lastErrorAt).toLocaleString()}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      Last checked: {new Date(health.lastChecked).toLocaleTimeString()}
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground">No health data available</div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
      {modules.length === 0 && (
        <div className="text-center text-sm text-muted-foreground py-8">
          No modules found
        </div>
      )}
    </div>
  );
}

