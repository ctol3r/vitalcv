'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, RefreshCcw, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BurnoutSafetySentinel {
  burnoutSignals: {
    workload: number;
    readinessDecay: number;
    employerSignals: number;
    burnoutRisk: number;
  };
  safetySignals: {
    incidents: number;
    deterioration: number;
    risk: number;
  };
  fusedRisk: number;
  surgeStress: number;
  interventions: Array<{ action: string; priority: number; impact: number }>;
  timeline: Array<{ date: string; burnoutRisk: number; safetyRisk: number }>;
}

export default function BurnoutSafetyPage() {
  const [sentinel, setSentinel] = useState<BurnoutSafetySentinel | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('loading');

  useEffect(() => {
    void loadSentinel();
  }, []);

  async function loadSentinel() {
    setStatus('loading');
    try {
      const clinicianId = 'demo-clinician-id';
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || '';
      const response = await fetch(`${baseUrl}/api/burnout-safety/${clinicianId}`);
      if (!response.ok) throw new Error('Failed to load sentinel');
      const data = await response.json();
      setSentinel(data);
      setStatus('idle');
    } catch (error) {
      console.warn('[burnout-safety]', error);
      setStatus('error');
    }
  }

  async function handleExport() {
    if (!sentinel) return;
    const clinicianId = 'demo-clinician-id';
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || '';
    const response = await fetch(`${baseUrl}/api/burnout-safety/${clinicianId}/export`);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `burnout-safety-sentinel-${Date.now()}.json`;
    a.click();
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <header className="space-y-2">
        <Badge variant="secondary">Wallet · Burnout & Safety Sentinel</Badge>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold leading-tight">Predictive Burnout & Safety Sentinel</h1>
            <p className="text-muted-foreground">
              Forecast burnout, safety issues, and risk before they manifest.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport} disabled={!sentinel}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button variant="outline" onClick={loadSentinel} disabled={status === 'loading'}>
              <RefreshCcw className={cn('mr-2 h-4 w-4', status === 'loading' && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      {sentinel && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Fused Risk Score</CardTitle>
              <CardDescription>Combined burnout + safety risk</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Overall Risk</span>
                  <span className="font-semibold">{(sentinel.fusedRisk * 100).toFixed(1)}%</span>
                </div>
                <Progress value={sentinel.fusedRisk * 100} className="h-3" />
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Burnout Risk</p>
                  <Progress value={sentinel.burnoutSignals.burnoutRisk * 100} className="h-2 mt-1" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Safety Risk</p>
                  <Progress value={sentinel.safetySignals.risk * 100} className="h-2 mt-1" />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Burnout Signals</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(sentinel.burnoutSignals).map(([key, value]) => (
                  <div key={key} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                      <span className="font-semibold">{(value * 100).toFixed(1)}%</span>
                    </div>
                    <Progress value={value * 100} className="h-2" />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Safety Signals</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(sentinel.safetySignals).map(([key, value]) => (
                  <div key={key} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                      <span className="font-semibold">{(value * 100).toFixed(1)}%</span>
                    </div>
                    <Progress value={value * 100} className="h-2" />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Surge Stress Prediction
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Progress value={sentinel.surgeStress * 100} className="h-3" />
              <p className="mt-2 text-sm text-muted-foreground">
                {(sentinel.surgeStress * 100).toFixed(1)}% predicted stress under sudden schedule spikes
              </p>
            </CardContent>
          </Card>

          {sentinel.interventions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recommended Interventions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {sentinel.interventions.map((intervention, idx) => (
                    <div key={idx} className="rounded-lg border p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium">{intervention.action}</p>
                          <p className="text-sm text-muted-foreground">
                            Impact: {(intervention.impact * 100).toFixed(0)}%
                          </p>
                        </div>
                        <Badge variant={intervention.priority === 1 ? 'destructive' : 'secondary'}>
                          Priority {intervention.priority}
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

