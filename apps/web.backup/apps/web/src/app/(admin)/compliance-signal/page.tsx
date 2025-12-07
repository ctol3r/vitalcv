'use client';

import { useCallback, useEffect, useState } from 'react';
import { Shield, AlertTriangle, Network } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useRoleUX } from '@/contexts/RoleUXContext';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.API_BASE_URL ||
  '';

export default function ComplianceSignalPage() {
  const { formatError } = useRoleUX();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [networkData, setNetworkData] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/compliance/signals`);
      if (!response.ok) {
        throw new Error(`Compliance signal API failed (${response.status})`);
      }
      const payload = await response.json();
      setNetworkData(payload);
    } catch (err) {
      console.error('[admin][compliance-signal] load failed', err);
      setError(formatError('signal_fetch_failed', err instanceof Error ? err.message : 'Unable to load signals'));
    } finally {
      setLoading(false);
    }
  }, [formatError]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Compliance Signal Network</CardTitle>
            <CardDescription>Loading compliance data...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Compliance Signal Network</CardTitle>
            <CardDescription className="text-destructive">{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Network className="h-5 w-5" />
                Compliance Signal Network v6
              </CardTitle>
              <CardDescription>
                Distributed compliance signals spanning clinicians, employers, credentials, regulators & AI agents
              </CardDescription>
            </div>
            <Button onClick={load}>Refresh</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Total Signals</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{networkData?.signalCount || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Critical Signals</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">{networkData?.criticalCount || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Risk Clusters</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{networkData?.clusterCount || 0}</div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

