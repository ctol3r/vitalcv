'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Flame, Gauge, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

type HeatmapSeverity = 'stable' | 'warning' | 'critical';

interface HeatmapCell {
  phase: string;
  avgDuration: number;
  medianDuration: number;
  sampleSize: number;
  bottleneckPressure: number;
  severity: HeatmapSeverity;
}

interface HeatmapResponse {
  generatedAt: string;
  windowDays: number;
  clinicianTotals: number;
  cells: HeatmapCell[];
  topBottlenecks: {
    type: string;
    frequency: number;
    severity: 'low' | 'moderate' | 'high';
    sampleSize: number;
  }[];
  readinessBands: { label: string; count: number }[];
}

export default function OnboardingHeatmapPage() {
  const [windowDays, setWindowDays] = useState(30);
  const [data, setData] = useState<HeatmapResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHeatmap = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/onboarding/heatmap?windowDays=${windowDays}`);
      if (!response.ok) {
        throw new Error(`Failed to load heatmap (status ${response.status})`);
      }
      const payload = (await response.json()) as HeatmapResponse;
      setData(payload);
    } catch (err) {
      console.error('[heatmap] unable to load onboarding kinetics', err);
      setError(err instanceof Error ? err.message : 'Unexpected error while loading heatmap');
    } finally {
      setLoading(false);
    }
  }, [windowDays]);

  useEffect(() => {
    fetchHeatmap();
  }, [fetchHeatmap]);

  const overallAvg = useMemo(() => {
    if (!data?.cells.length) return 0;
    return (
      data.cells.reduce((sum, cell) => sum + cell.avgDuration, 0) / Math.max(data.cells.length, 1)
    );
  }, [data]);

  const criticalPhases = useMemo(
    () => data?.cells.filter((cell) => cell.severity === 'critical') ?? [],
    [data],
  );

  return (
    <div className="p-8 space-y-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Onboarding heatmap</h1>
          <p className="text-muted-foreground">
            Phase-level kinetics, bottleneck density, and readiness cohorts for the last {windowDays} days.
          </p>
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Window (days)
            <Input
              type="number"
              min={7}
              max={180}
              value={windowDays}
              onChange={(event) => setWindowDays(Number(event.target.value))}
              className="w-28"
            />
          </label>
          <Button onClick={fetchHeatmap} variant="secondary" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Refreshing
              </>
            ) : (
              'Refresh'
            )}
          </Button>
        </div>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Unable to load heatmap</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Average total duration</CardTitle>
            <CardDescription>Across all active onboarding journeys</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-3xl font-semibold">{overallAvg ? `${overallAvg.toFixed(1)}d` : '--'}</div>
            <Badge variant="secondary">{data?.clinicianTotals ?? 0} clinicians</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Critical phases</CardTitle>
            <CardDescription>Phases breaching SLA or high pressure</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-3xl font-semibold">{criticalPhases.length}</div>
            <Flame className="h-6 w-6 text-destructive" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Median document cycle</CardTitle>
            <CardDescription>Docs phase duration (median)</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-3xl font-semibold">
              {formatMedian(data?.cells.find((cell) => cell.phase === 'docs')?.medianDuration)}
            </div>
            <Activity className="h-6 w-6 text-muted-foreground" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Velocity</CardTitle>
            <CardDescription>Phases trending under 6 days</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-3xl font-semibold">
              {data?.cells.filter((cell) => cell.avgDuration <= 6).length ?? 0}
            </div>
            <Gauge className="h-6 w-6 text-muted-foreground" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Phase kinetics heatmap</CardTitle>
          <CardDescription>Average + bottleneck pressure for each onboarding phase</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && <p className="text-sm text-muted-foreground">Loading heatmap...</p>}
          {!loading && (
            <div className="grid gap-4 md:grid-cols-5">
              {data?.cells.map((cell) => (
                <div
                  key={cell.phase}
                  className={`rounded-lg border p-4 text-sm transition ${
                    cell.severity === 'critical'
                      ? 'border-destructive/40 bg-destructive/10'
                      : cell.severity === 'warning'
                      ? 'border-amber-400/40 bg-amber-100/30 dark:bg-amber-900/10'
                      : 'border-border'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{formatPhase(cell.phase)}</p>
                    <Badge variant={badgeVariant(cell.severity)}>{cell.severity}</Badge>
                  </div>
                  <p className="mt-2 text-2xl font-bold">{cell.avgDuration.toFixed(1)}d</p>
                  <p className="text-xs text-muted-foreground">Median {cell.medianDuration.toFixed(1)}d</p>
                  <Progress value={cell.bottleneckPressure * 100} className="mt-3" />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Pressure {(cell.bottleneckPressure * 100).toFixed(0)}% · {cell.sampleSize} samples
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Bottleneck predictors</CardTitle>
            <CardDescription>Top predicted blockers across cohorts</CardDescription>
          </CardHeader>
          <CardContent>
            {data?.topBottlenecks.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Frequency</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Samples</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.topBottlenecks.map((bottleneck) => (
                    <TableRow key={bottleneck.type}>
                      <TableCell className="font-medium">{formatBottleneck(bottleneck.type)}</TableCell>
                      <TableCell>{bottleneck.frequency}</TableCell>
                      <TableCell>
                        <Badge variant={severityColor(bottleneck.severity)}>{bottleneck.severity}</Badge>
                      </TableCell>
                      <TableCell>{bottleneck.sampleSize}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">No bottleneck signals detected in this window.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Readiness distribution</CardTitle>
            <CardDescription>Cohorts by end-to-end onboarding timeline</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data?.readinessBands.map((band) => (
              <div key={band.label}>
                <div className="flex items-center justify-between text-sm">
                  <span>{band.label}</span>
                  <span className="text-muted-foreground">{band.count}</span>
                </div>
                <Progress
                  value={
                    data.clinicianTotals ? (band.count / Math.max(data.clinicianTotals, 1)) * 100 : 0
                  }
                  className="mt-2"
                />
              </div>
            )) || <p className="text-sm text-muted-foreground">No cohorts available.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function badgeVariant(severity: HeatmapSeverity) {
  if (severity === 'critical') return 'destructive';
  if (severity === 'warning') return 'secondary';
  return 'outline';
}

function severityColor(severity: 'low' | 'moderate' | 'high') {
  if (severity === 'high') return 'destructive';
  if (severity === 'moderate') return 'secondary';
  return 'outline';
}

function formatPhase(phase: string) {
  if (phase === 'itAccess') return 'IT access';
  return phase.charAt(0).toUpperCase() + phase.slice(1);
}

function formatMedian(value?: number) {
  if (!value && value !== 0) return '--';
  return `${value.toFixed(1)}d`;
}

function formatBottleneck(type: string) {
  switch (type) {
    case 'missingDocuments':
      return 'Missing documents';
    case 'expiredLicenses':
      return 'Expired licenses';
    case 'unverifiedNpdb':
      return 'Unverified NPDB';
    default:
      return type;
  }
}


