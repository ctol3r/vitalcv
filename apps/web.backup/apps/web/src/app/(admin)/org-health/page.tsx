'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Building2, RefreshCcw, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrgHealth {
  culture: number;
  leadershipStability: number;
  clinicalQuality: number;
  fatigue: number;
  riskDiffusion: Record<string, number>;
  economicToOperational: number;
  overallHealth: number;
}

export default function OrgHealthPage() {
  const [health, setHealth] = useState<OrgHealth | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('loading');

  useEffect(() => {
    void loadHealth();
  }, []);

  async function loadHealth() {
    setStatus('loading');
    try {
      const orgId = 'demo-org-id';
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || '';
      const response = await fetch(`${baseUrl}/api/org-health/${orgId}`);
      if (!response.ok) throw new Error('Failed to load org health');
      const data = await response.json();
      setHealth(data);
      setStatus('idle');
    } catch (error) {
      console.warn('[org-health]', error);
      setStatus('error');
    }
  }

  async function handleExport() {
    if (!health) return;
    const orgId = 'demo-org-id';
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || '';
    const response = await fetch(`${baseUrl}/api/org-health/${orgId}/export`);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `org-health-${Date.now()}.json`;
    a.click();
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <header className="space-y-2">
        <Badge variant="secondary">Admin · Organizational Health Lens</Badge>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold leading-tight">Organizational Health Lens</h1>
            <p className="text-muted-foreground">
              A lens revealing employer culture, operational discipline, risk profile & workforce outcomes.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport} disabled={!health}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button variant="outline" onClick={loadHealth} disabled={status === 'loading'}>
              <RefreshCcw className={cn('mr-2 h-4 w-4', status === 'loading' && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      {health && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Overall Organizational Health
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Health Score</span>
                  <span className="font-semibold">{(health.overallHealth * 100).toFixed(1)}%</span>
                </div>
                <Progress value={health.overallHealth * 100} className="h-3" />
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Culture Score</CardTitle>
                <CardDescription>Inferred from hiring behavior patterns</CardDescription>
              </CardHeader>
              <CardContent>
                <Progress value={health.culture * 100} className="h-3" />
                <p className="mt-2 text-sm text-muted-foreground">
                  {(health.culture * 100).toFixed(1)}%
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Leadership Stability</CardTitle>
                <CardDescription>Turnover and stability in key roles</CardDescription>
              </CardHeader>
              <CardContent>
                <Progress value={health.leadershipStability * 100} className="h-3" />
                <p className="mt-2 text-sm text-muted-foreground">
                  {(health.leadershipStability * 100).toFixed(1)}%
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Clinical Quality Alignment</CardTitle>
                <CardDescription>Correlation with clinician performance</CardDescription>
              </CardHeader>
              <CardContent>
                <Progress value={health.clinicalQuality * 100} className="h-3" />
                <p className="mt-2 text-sm text-muted-foreground">
                  {(health.clinicalQuality * 100).toFixed(1)}%
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Organizational Fatigue</CardTitle>
                <CardDescription>Overload/underperformance indicators</CardDescription>
              </CardHeader>
              <CardContent>
                <Progress value={health.fatigue * 100} className="h-3" />
                <p className="mt-2 text-sm text-muted-foreground">
                  {(health.fatigue * 100).toFixed(1)}% (lower is better)
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Risk Diffusion Mapping</CardTitle>
              <CardDescription>Risk propagation across departments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(health.riskDiffusion).map(([dept, risk]) => (
                  <div key={dept} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="capitalize">{dept}</span>
                      <span className="font-semibold">{(risk * 100).toFixed(1)}%</span>
                    </div>
                    <Progress value={risk * 100} className="h-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Economic-to-Operational Correlation</CardTitle>
              <CardDescription>Financial health → operational quality mapping</CardDescription>
            </CardHeader>
            <CardContent>
              <Progress value={health.economicToOperational * 100} className="h-3" />
              <p className="mt-2 text-sm text-muted-foreground">
                {(health.economicToOperational * 100).toFixed(1)}%
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

