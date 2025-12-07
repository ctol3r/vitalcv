'use client';

import { useCallback, useEffect, useState } from 'react';
import { Route, Network, Zap } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useRoleUX } from '@/contexts/RoleUXContext';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.API_BASE_URL ||
  '';

export default function RoutingGridPage() {
  const { formatError } = useRoleUX();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gridData, setGridData] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/routing/grid`);
      if (!response.ok) {
        throw new Error(`Routing grid API failed (${response.status})`);
      }
      const payload = await response.json();
      setGridData(payload);
    } catch (err) {
      console.error('[admin][routing-grid] load failed', err);
      setError(formatError('routing_fetch_failed', err instanceof Error ? err.message : 'Unable to load grid'));
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
            <CardTitle>Workforce Routing Grid</CardTitle>
            <CardDescription>Loading routing data...</CardDescription>
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
            <CardTitle>Workforce Routing Grid</CardTitle>
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
                <Route className="h-5 w-5" />
                Autonomous Workforce Routing Grid v5
              </CardTitle>
              <CardDescription>
                Global routing logic for clinician placement, matching availability, readiness & shortage patterns
              </CardDescription>
            </div>
            <Button onClick={load}>Refresh</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Routing Nodes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{gridData?.nodeCount || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Active Routes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{gridData?.routeCount || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Last Updated</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  {gridData?.updatedAt ? new Date(gridData.updatedAt).toLocaleString() : 'Never'}
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Routing Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <Network className="h-5 w-5 mt-0.5" />
              <div>
                <div className="font-semibold">Multi-Factor Routing</div>
                <div className="text-sm text-muted-foreground">
                  Weights: readiness, specialty, shortage, employer trust
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Zap className="h-5 w-5 mt-0.5" />
              <div>
                <div className="font-semibold">Constraint-Aware</div>
                <div className="text-sm text-muted-foreground">
                  Respects compacts, visas, hospital policies
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

