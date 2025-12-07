'use client';

import { useCallback, useEffect, useState } from 'react';
import { Network, TrendingUp, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useRoleUX } from '@/contexts/RoleUXContext';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.API_BASE_URL ||
  '';

export default function ReputationMeshPage() {
  const { formatError } = useRoleUX();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meshData, setMeshData] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/reputation/mesh`);
      if (!response.ok) {
        throw new Error(`Reputation mesh API failed (${response.status})`);
      }
      const payload = await response.json();
      setMeshData(payload);
    } catch (err) {
      console.error('[admin][reputation-mesh] load failed', err);
      setError(formatError('mesh_fetch_failed', err instanceof Error ? err.message : 'Unable to load mesh'));
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
            <CardTitle>Employer Reputation Mesh</CardTitle>
            <CardDescription>Loading reputation data...</CardDescription>
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
            <CardTitle>Employer Reputation Mesh</CardTitle>
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
                Employer Reputation Mesh v6
              </CardTitle>
              <CardDescription>
                Federated, multi-signal reputation scoring across entire healthcare networks
              </CardDescription>
            </div>
            <Button onClick={load}>Refresh</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Employer Nodes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{meshData?.nodeCount || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Influence Edges</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{meshData?.edgeCount || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Average Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {meshData?.avgScore ? Math.round(meshData.avgScore * 100) : 0}%
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

