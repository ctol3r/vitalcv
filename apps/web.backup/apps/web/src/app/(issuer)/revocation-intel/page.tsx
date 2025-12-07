'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, TrendingDown, RefreshCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function RevocationIntelPage() {
  const [loading, setLoading] = useState(true);
  const [intel, setIntel] = useState<any>(null);
  const [credentialId] = useState('cred_001');

  useEffect(() => {
    loadIntel();
  }, []);

  async function loadIntel() {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/revocation-intel/${credentialId}`);
      if (res.ok) {
        const data = await res.json();
        setIntel(data);
      }
    } catch (error) {
      console.error('Failed to load revocation intel:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Credential Revocation Intelligence</h1>
          <p className="text-muted-foreground mt-2">
            Automated revocation lifecycle with prediction, detection & propagation
          </p>
        </div>
        <Button variant="outline" onClick={loadIntel} disabled={loading}>
          <RefreshCcw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {intel && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Revocation Likelihood</CardTitle>
                <CardDescription>Predicted probability</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {(intel.prediction?.likelihood * 100 || 0).toFixed(1)}%
                </div>
                <div className="text-sm text-muted-foreground mt-2">
                  Timeframe: {intel.prediction?.timeframe || 'N/A'}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Severity Score</CardTitle>
                <CardDescription>Revocation severity</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-500">{intel.severity || 0}/100</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Triggers Detected</CardTitle>
                <CardDescription>Active revocation triggers</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{intel.triggers?.length || 0}</div>
              </CardContent>
            </Card>
          </div>

          {intel.triggers && intel.triggers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Revocation Triggers</CardTitle>
                <CardDescription>Detected conditions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {intel.triggers.map((t: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 p-3 border rounded">
                      <AlertTriangle className={cn(
                        'h-5 w-5',
                        t.severity === 'critical' && 'text-red-500',
                        t.severity === 'high' && 'text-orange-500',
                        t.severity === 'medium' && 'text-yellow-500',
                        t.severity === 'low' && 'text-blue-500'
                      )} />
                      <div className="flex-1">
                        <div className="font-medium">{t.type}</div>
                        <div className="text-sm text-muted-foreground">{t.details?.source || 'N/A'}</div>
                      </div>
                      <Badge variant={t.severity === 'critical' ? 'destructive' : 'secondary'}>
                        {t.severity}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {intel.propagationStatus && intel.propagationStatus.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Propagation Status</CardTitle>
                <CardDescription>Cross-org revocation propagation</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {intel.propagationStatus.map((p: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-2 border rounded">
                      <span>{p.orgId}</span>
                      <Badge variant={p.status === 'propagated' ? 'default' : 'secondary'}>
                        {p.status}
                      </Badge>
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

