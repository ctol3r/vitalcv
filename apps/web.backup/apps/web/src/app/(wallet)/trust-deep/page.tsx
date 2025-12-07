'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ShieldAlert, TrendingUp, TrendingDown, RefreshCcw, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TrustDeepSignal {
  fusedScore: number;
  signals: {
    regulatory: number;
    safety: number;
    credentialIntegrity: number;
    behavioral: number;
    multiChain: number;
  };
  vulnerabilities: Array<{ type: string; severity: number; detectedAt: string }>;
  reinforcement: Array<{ action: string; impact: number; priority: number }>;
  polarity: 'positive' | 'neutral' | 'negative';
  polarityShift?: { from: string; to: string; magnitude: number; detectedAt: string };
}

export default function TrustDeepSignalPage() {
  const [signal, setSignal] = useState<TrustDeepSignal | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('loading');

  useEffect(() => {
    void loadSignal();
  }, []);

  async function loadSignal() {
    setStatus('loading');
    try {
      // In production, get clinicianId from auth context
      const clinicianId = 'demo-clinician-id';
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || '';
      const response = await fetch(`${baseUrl}/api/trust-deep/${clinicianId}`);
      if (!response.ok) throw new Error('Failed to load trust signal');
      const data = await response.json();
      setSignal(data);
      setStatus('idle');
    } catch (error) {
      console.warn('[trust-deep]', error);
      setStatus('error');
    }
  }

  async function handleExport() {
    if (!signal) return;
    const clinicianId = 'demo-clinician-id';
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || '';
    const response = await fetch(`${baseUrl}/api/trust-deep/${clinicianId}/export`);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trust-deep-signal-${Date.now()}.json`;
    a.click();
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <header className="space-y-2">
        <Badge variant="secondary">Wallet · Trust Deep Signal</Badge>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold leading-tight">Trust Deep Signal Engine</h1>
            <p className="text-muted-foreground">
              Extract, fuse, and score trust signals deeper than any existing credentialing workflow.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport} disabled={!signal}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button variant="outline" onClick={loadSignal} disabled={status === 'loading'}>
              <RefreshCcw className={cn('mr-2 h-4 w-4', status === 'loading' && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      {signal && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Fused Trust Score</CardTitle>
              <CardDescription>Hierarchical weighted fusion across all trust signals</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Overall Trust Score</span>
                  <span className="font-semibold">{(signal.fusedScore * 100).toFixed(1)}%</span>
                </div>
                <Progress value={signal.fusedScore * 100} className="h-3" />
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant={signal.polarity === 'positive' ? 'default' : signal.polarity === 'negative' ? 'destructive' : 'secondary'}
                >
                  {signal.polarity === 'positive' && <TrendingUp className="mr-1 h-3 w-3" />}
                  {signal.polarity === 'negative' && <TrendingDown className="mr-1 h-3 w-3" />}
                  {signal.polarity}
                </Badge>
                {signal.polarityShift && (
                  <span className="text-sm text-muted-foreground">
                    Shift: {signal.polarityShift.from} → {signal.polarityShift.to}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Signal Components</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(signal.signals).map(([key, value]) => (
                <div key={key} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                    <span className="font-semibold">{(value * 100).toFixed(1)}%</span>
                  </div>
                  <Progress value={value * 100} className="h-2" />
                </div>
              ))}
            </CardContent>
          </Card>

          {signal.vulnerabilities.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-amber-500" />
                  Trust Vulnerabilities
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {signal.vulnerabilities.map((vuln, idx) => (
                    <div key={idx} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{vuln.type.replace(/_/g, ' ')}</span>
                        <Badge variant={vuln.severity > 0.5 ? 'destructive' : 'secondary'}>
                          {(vuln.severity * 100).toFixed(0)}% severity
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {signal.reinforcement.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Trust Reinforcement Insights</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {signal.reinforcement.map((insight, idx) => (
                    <div key={idx} className="rounded-lg border p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium">{insight.action}</p>
                          <p className="text-sm text-muted-foreground">
                            Impact: {(insight.impact * 100).toFixed(0)}%
                          </p>
                        </div>
                        <Badge variant={insight.priority === 1 ? 'destructive' : 'secondary'}>
                          Priority {insight.priority}
                        </Badge>
                      </div>
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

