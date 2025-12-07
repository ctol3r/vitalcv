'use client';

import { useCallback, useEffect, useState } from 'react';
import { Globe, AlertTriangle, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

interface RegInteropLayer {
  region: string;
  conflicts: Array<{
    field: string;
    country: string;
    severity: string;
  }>;
  harmonizedRules: Array<{
    field: string;
    countries: string[];
  }>;
}

export default function RegInteropLayerPage() {
  const [region, setRegion] = useState('us');
  const [layer, setLayer] = useState<RegInteropLayer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLayer = useCallback(async () => {
    if (!region) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/reg-interop-layer/${region}`);
      if (!res.ok) throw new Error(`Failed to load interop layer (${res.status})`);
      const data = await res.json();
      setLayer(data);
    } catch (err) {
      console.error('Failed to fetch regulatory interop layer', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [region]);

  useEffect(() => {
    if (region) {
      fetchLayer();
    }
  }, [region, fetchLayer]);

  const criticalConflicts = layer?.conflicts.filter((c) => c.severity === 'critical') || [];

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Regulatory Interop Layer</h1>
          <p className="text-muted-foreground">
            Controls regulatory interoperability across countries, healthcare systems & evidence standards.
          </p>
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Input
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="Region (us, uk, au, sg, eu)"
            className="md:w-56"
          />
          <Button onClick={fetchLayer} variant="secondary">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && (
        <div className="text-center py-8">
          <p className="text-muted-foreground">Loading regulatory interop layer...</p>
        </div>
      )}

      {!loading && layer && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Region</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold uppercase">{layer.region}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Conflicts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{layer.conflicts.length}</div>
                <p className="text-sm text-muted-foreground mt-1">
                  {criticalConflicts.length} critical
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Harmonized Rules</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{layer.harmonizedRules.length}</div>
                <p className="text-sm text-muted-foreground mt-1">Unified across countries</p>
              </CardContent>
            </Card>
          </div>

          {layer.conflicts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Regulatory Conflicts</CardTitle>
                <CardDescription>Mismatches between countries</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {layer.conflicts.map((conflict, idx) => (
                    <Alert key={idx} variant={conflict.severity === 'critical' ? 'destructive' : 'default'}>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>{conflict.field} - {conflict.country}</AlertTitle>
                      <AlertDescription>
                        Severity: {conflict.severity}
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {layer.harmonizedRules.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Harmonized Rules</CardTitle>
                <CardDescription>Unified requirements across countries</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {layer.harmonizedRules.map((rule, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium">{rule.field}</div>
                        <div className="text-sm text-muted-foreground">
                          {rule.countries.join(', ')}
                        </div>
                      </div>
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
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








