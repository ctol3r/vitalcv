'use client';

import useSWR from 'swr';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Activity } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function getRiskLevel(score: number) {
  if (score > 0.8) return { label: 'Critical', variant: 'destructive' as const, color: 'bg-red-500' };
  if (score > 0.5) return { label: 'At Risk', variant: 'default' as const, color: 'bg-yellow-500' };
  return { label: 'Stable', variant: 'secondary' as const, color: 'bg-green-500' };
}

export default function AnalyticsPage() {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
  const { data: health } = useSWR(`${backendUrl}/api/health`, fetcher, {
    refreshInterval: 30000,
  });

  const { data: risks } = useSWR(`${backendUrl}/api/aiops/predict`, fetcher, {
    refreshInterval: 5000,
  });

  const failoverActive = health?.db?.failoverActive;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Analytics Dashboard</h1>

      {failoverActive && (
        <Alert variant="destructive" className="mb-4 bg-yellow-50 text-yellow-900 border-yellow-200">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertTitle className="text-yellow-800">Database Failover Active</AlertTitle>
          <AlertDescription className="text-yellow-700">
            Database failover active — write actions disabled temporarily.
          </AlertDescription>
        </Alert>
      )}

      {/* Predictive Risk Analysis Section */}
      <div>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Predictive Risk Analysis
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
           {/* Chain Risk */}
           <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Chain Risk</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold">
                    {(risks?.riskChain !== undefined) ? (risks.riskChain * 100).toFixed(0) + '%' : '...'}
                </div>
                {risks?.riskChain !== undefined && (
                    <Badge variant={getRiskLevel(risks.riskChain).variant} className={getRiskLevel(risks.riskChain).color + " text-white"}>
                        {getRiskLevel(risks.riskChain).label}
                    </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Agent Risk */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Agent Risk</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold">
                    {(risks?.riskAgent !== undefined) ? (risks.riskAgent * 100).toFixed(0) + '%' : '...'}
                </div>
                {risks?.riskAgent !== undefined && (
                    <Badge variant={getRiskLevel(risks.riskAgent).variant} className={getRiskLevel(risks.riskAgent).color + " text-white"}>
                        {getRiskLevel(risks.riskAgent).label}
                    </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* DB Risk */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">DB Risk</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold">
                    {(risks?.riskDB !== undefined) ? (risks.riskDB * 100).toFixed(0) + '%' : '...'}
                </div>
                {risks?.riskDB !== undefined && (
                    <Badge variant={getRiskLevel(risks.riskDB).variant} className={getRiskLevel(risks.riskDB).color + " text-white"}>
                        {getRiskLevel(risks.riskDB).label}
                    </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Verifier Risk */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Verifier Risk</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold">
                    {(risks?.riskVerifier !== undefined) ? (risks.riskVerifier * 100).toFixed(0) + '%' : '...'}
                </div>
                {risks?.riskVerifier !== undefined && (
                    <Badge variant={getRiskLevel(risks.riskVerifier).variant} className={getRiskLevel(risks.riskVerifier).color + " text-white"}>
                        {getRiskLevel(risks.riskVerifier).label}
                    </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">
              {health?.status || 'Loading...'}
            </div>
            {health?.environment && (
                <p className="text-xs text-muted-foreground mt-1">
                    Env: {health.environment}
                </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Primary DB</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {health?.db ? (health.db.primaryOK ? 'Online' : 'Offline') : 'Unknown'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Replica DB</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
               {health?.db ? (health.db.replicaOK ? 'Online' : 'Offline') : 'Unknown'}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
