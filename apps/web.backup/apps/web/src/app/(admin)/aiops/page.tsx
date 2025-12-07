'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Activity, Server, AlertTriangle, CheckCircle, Zap } from 'lucide-react';

interface Anomaly {
  id: string;
  timestamp: string;
  message: string;
  anomaly?: {
    metricName: string;
    severity: number;
    description: string;
    recommendedAction: string;
  };
}

interface HealthStatus {
  status: string;
  timestamp: string;
  db: {
    primaryOK: boolean;
    replicaOK: boolean;
  };
  memory: {
    used: number;
    total: number;
  };
  aiops?: {
    enabled: boolean;
    lastCheck: string;
  };
}

export default function AIOpsDashboard() {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      // Assuming relative paths work if proxied, otherwise might need full URL or env var
      const [anomaliesRes, healthRes] = await Promise.all([
        fetch('/api/analytics/anomalies'),
        fetch('/api/health')
      ]);

      if (anomaliesRes.ok) {
        const data = await anomaliesRes.json();
        setAnomalies(Array.isArray(data) ? data : []);
      }
      if (healthRes.ok) {
        setHealth(await healthRes.json());
      }
    } catch (err) {
      console.error('Failed to fetch AI Ops data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-8 space-y-8">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">AI Ops Intelligence</h1>
            <p className="text-muted-foreground">Real-time anomaly detection and system health insights</p>
        </div>
        <Badge variant={health?.status === 'healthy' ? 'default' : 'destructive'}>
            {health?.status === 'healthy' ? <CheckCircle className="w-4 h-4 mr-2" /> : <AlertTriangle className="w-4 h-4 mr-2" />}
            System: {health?.status?.toUpperCase() || 'UNKNOWN'}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Anomalies (Recent)</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{anomalies.length}</div>
            <p className="text-xs text-muted-foreground">
              {anomalies.length > 0 ? 'Requires attention' : 'System stable'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">DB Health</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{health?.db.primaryOK ? 'Online' : 'Offline'}</div>
            <p className="text-xs text-muted-foreground">
              Replica: {health?.db.replicaOK ? 'Synced' : 'Lagging'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{health?.memory.used ?? 0}MB</div>
            <p className="text-xs text-muted-foreground">
              of {health?.memory.total ?? 0}MB allocated
            </p>
          </CardContent>
        </Card>

        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">AI Agent</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{health?.aiops?.enabled ? 'Active' : 'Inactive'}</div>
                <p className="text-xs text-muted-foreground">
                    Last scan: {health?.aiops?.lastCheck ? new Date(health.aiops.lastCheck).toLocaleTimeString() : 'Never'}
                </p>
            </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-7">
          <Card className="col-span-4">
            <CardHeader>
                <CardTitle>Recent Anomalies</CardTitle>
                <CardDescription>
                    AI-detected irregularities in system performance and traffic.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {anomalies.length === 0 ? (
                    <div className="flex items-center justify-center h-32 text-muted-foreground">
                        No anomalies detected.
                    </div>
                ) : (
                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                        {anomalies.map((item) => (
                            <div key={item.id} className="flex items-start p-4 border rounded-lg bg-card">
                                <AlertTriangle className={`w-5 h-5 mt-0.5 mr-3 ${(item.anomaly?.severity || 0) > 0.7 ? 'text-red-500' : 'text-yellow-500'}`} />
                                <div className="space-y-1">
                                    <p className="text-sm font-medium leading-none">
                                        {item.anomaly?.description || item.message}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        Detected at {new Date(item.timestamp).toLocaleString()}
                                    </p>
                                    {item.anomaly?.metricName && (
                                        <Badge variant="outline" className="mt-2">
                                            {item.anomaly.metricName}
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
          </Card>

          <Card className="col-span-3">
            <CardHeader>
                <CardTitle>Recommended Actions</CardTitle>
                <CardDescription>
                    AI-generated fixes for detected issues.
                </CardDescription>
            </CardHeader>
            <CardContent>
                 {anomalies.length === 0 ? (
                    <div className="flex items-center justify-center h-32 text-muted-foreground">
                        All systems operational.
                    </div>
                ) : (
                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                        {anomalies.slice(0, 10).map((item) => (
                             <Alert key={item.id}>
                                <Zap className="h-4 w-4" />
                                <AlertTitle>Suggestion</AlertTitle>
                                <AlertDescription>
                                    {item.anomaly?.recommendedAction || 'Investigate logs.'}
                                </AlertDescription>
                             </Alert>
                        ))}
                    </div>
                )}
            </CardContent>
          </Card>
      </div>
    </div>
  );
}














