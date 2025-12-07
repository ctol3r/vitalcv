'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Clock, RefreshCcw, Download, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CredentialLifespan {
  estimatedLifespan: number;
  renewalCycles: Array<{ date: string; type: string }>;
  regulatoryRisk: number;
  evidenceStrength: number;
  chainStability: number;
  harmonizedLifespan: number;
  drift: {
    detected: boolean;
    magnitude: number;
    detectedAt?: string;
  };
  expirationTrajectory: Array<{ date: string; estimatedExpiration: string }>;
  strengtheningSuggestions: Array<{ action: string; impact: number }>;
}

export default function CredentialLifespanPage() {
  const [lifespan, setLifespan] = useState<CredentialLifespan | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('loading');
  const [credentialId, setCredentialId] = useState('demo-credential-id');

  useEffect(() => {
    void loadLifespan();
  }, [credentialId]);

  async function loadLifespan() {
    setStatus('loading');
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || '';
      const response = await fetch(`${baseUrl}/api/credential-lifespan/${credentialId}`);
      if (!response.ok) throw new Error('Failed to load lifespan');
      const data = await response.json();
      setLifespan(data);
      setStatus('idle');
    } catch (error) {
      console.warn('[lifespan]', error);
      setStatus('error');
    }
  }

  async function handleExport() {
    if (!lifespan) return;
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || '';
    const response = await fetch(`${baseUrl}/api/credential-lifespan/${credentialId}/export`);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `credential-lifespan-${Date.now()}.json`;
    a.click();
  }

  const daysToYears = (days: number) => (days / 365).toFixed(1);
  const daysToMonths = (days: number) => (days / 30).toFixed(1);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <header className="space-y-2">
        <Badge variant="secondary">Wallet · Credential Lifespan</Badge>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold leading-tight">Chain-Aware Credential Lifespan</h1>
            <p className="text-muted-foreground">
              Model the expected lifespan of credentials across chains, regions, and regulatory bodies.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport} disabled={!lifespan}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button variant="outline" onClick={loadLifespan} disabled={status === 'loading'}>
              <RefreshCcw className={cn('mr-2 h-4 w-4', status === 'loading' && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      {lifespan && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Estimated Lifespan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Estimated Duration</span>
                  <div className="text-right">
                    <p className="text-2xl font-semibold">{daysToYears(lifespan.estimatedLifespan)} years</p>
                    <p className="text-sm text-muted-foreground">{lifespan.estimatedLifespan} days</p>
                  </div>
                </div>
                {lifespan.drift.detected && (
                  <div className="flex items-center gap-2 rounded-lg border p-3">
                    {lifespan.drift.magnitude > 0 ? (
                      <TrendingUp className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-rose-500" />
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-medium">Lifespan Drift Detected</p>
                      <p className="text-xs text-muted-foreground">
                        {(Math.abs(lifespan.drift.magnitude) * 100).toFixed(1)}% change
                        {lifespan.drift.magnitude > 0 ? ' (expanding)' : ' (shrinking)'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Regulatory Risk</CardTitle>
              </CardHeader>
              <CardContent>
                <Progress value={lifespan.regulatoryRisk * 100} className="h-3" />
                <p className="mt-2 text-sm text-muted-foreground">
                  {(lifespan.regulatoryRisk * 100).toFixed(1)}% (lower is better)
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Evidence Strength</CardTitle>
              </CardHeader>
              <CardContent>
                <Progress value={lifespan.evidenceStrength * 100} className="h-3" />
                <p className="mt-2 text-sm text-muted-foreground">
                  {(lifespan.evidenceStrength * 100).toFixed(1)}%
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Chain Stability</CardTitle>
              </CardHeader>
              <CardContent>
                <Progress value={lifespan.chainStability * 100} className="h-3" />
                <p className="mt-2 text-sm text-muted-foreground">
                  {(lifespan.chainStability * 100).toFixed(1)}%
                </p>
              </CardContent>
            </Card>
          </div>

          {lifespan.expirationTrajectory.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Expiration Trajectory</CardTitle>
                <CardDescription>Forecasted expiration window over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {lifespan.expirationTrajectory.slice(0, 6).map((trajectory, idx) => (
                    <div key={idx} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                      <span>{new Date(trajectory.date).toLocaleDateString()}</span>
                      <span className="text-muted-foreground">
                        → {new Date(trajectory.estimatedExpiration).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {lifespan.strengtheningSuggestions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Strengthening Suggestions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {lifespan.strengtheningSuggestions.map((suggestion, idx) => (
                    <div key={idx} className="rounded-lg border p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium">{suggestion.action}</p>
                          <p className="text-sm text-muted-foreground">
                            Expected impact: {(suggestion.impact * 100).toFixed(0)}%
                          </p>
                        </div>
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

