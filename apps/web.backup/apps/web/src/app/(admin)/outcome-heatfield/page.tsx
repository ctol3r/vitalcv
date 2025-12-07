'use client';

import { useCallback, useEffect, useState } from 'react';
import { Map, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useRoleUX } from '@/contexts/RoleUXContext';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.API_BASE_URL ||
  'http://localhost:4000';

export default function OutcomeHeatfieldPage() {
  const { formatError } = useRoleUX();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [heatfieldData, setHeatfieldData] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Load geo-outcome stress mapping
      const response = await fetch(`${API_BASE}/api/outcome-stability?region=all`);
      if (!response.ok) {
        throw new Error(`Heatfield API failed (${response.status})`);
      }
      const payload = await response.json();
      setHeatfieldData(payload);
    } catch (err) {
      console.error('[admin][outcome-heatfield] load failed', err);
      setError(formatError('heatfield_fetch_failed', err instanceof Error ? err.message : 'Unable to load heatfield'));
    } finally {
      setLoading(false);
    }
  }, [formatError]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !heatfieldData) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Outcome Heatfield Viewer</CardTitle>
            <CardDescription>Loading heatfield data...</CardDescription>
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
                <Map className="h-5 w-5" />
                Outcome Heatfield Viewer
              </CardTitle>
              <CardDescription>
                Geographic mapping of regions with high outcome instability
              </CardDescription>
            </div>
            <Button onClick={load}>Refresh</Button>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-4 bg-destructive/10 text-destructive rounded">
              {error}
            </div>
          )}

          {heatfieldData && (
            <div className="space-y-6">
              {/* Geo Stress Map */}
              {heatfieldData.geoStress && heatfieldData.geoStress.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Regional Instability Map
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {heatfieldData.geoStress.map((region: any, idx: number) => (
                        <div
                          key={idx}
                          className={`p-4 rounded border ${
                            region.instability > 70
                              ? 'bg-destructive/10 border-destructive'
                              : region.instability > 50
                                ? 'bg-yellow-100 border-yellow-500'
                                : 'bg-muted'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium">{region.region}</span>
                            <Badge
                              variant={
                                region.instability > 70
                                  ? 'destructive'
                                  : region.instability > 50
                                    ? 'default'
                                    : 'secondary'
                              }
                            >
                              {region.instability}%
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Instability Level: {region.instability > 70 ? 'High' : region.instability > 50 ? 'Medium' : 'Low'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Heat Map Visualization Placeholder */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Heat Map Visualization</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64 bg-muted rounded flex items-center justify-center">
                    <div className="text-muted-foreground">Heat map visualization would appear here</div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}








