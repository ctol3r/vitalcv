'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Flame, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type ForecastEntry = {
  specialty: string;
  region: string;
  shortageIndex: number;
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  signalConfidence: number;
  horizons: Array<{
    horizonDays: number;
    shortageIndex: number;
    riskLevel: string;
    recommendedHires: number;
  }>;
  recommendedHires: number;
  surgeReadiness: number;
};

type HeatmapEntry = {
  region: string;
  shortageIndex: number;
  riskLevel: string;
  headlineSpecialty: string;
};

type WorkforceAlert = {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

type ForecastResponse = {
  generatedAt: string;
  forecasts: ForecastEntry[];
  heatmap: HeatmapEntry[];
  alerts: WorkforceAlert[];
};

const API_BASE = (process.env.NEXT_PUBLIC_PLATFORM_API ?? '').replace(/\/$/, '');

export default function WorkforceForecastDashboard() {
  const [data, setData] = useState<ForecastResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchForecast = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(buildApiUrl('/api/workforce/forecast'));
      if (!response.ok) throw new Error(`Unable to load forecast (${response.status})`);
      const payload = (await response.json()) as ForecastResponse;
      setData(payload);
    } catch (err) {
      console.error('Failed to fetch workforce forecast', err);
      setError(err instanceof Error ? err.message : 'Unable to load forecast data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchForecast();
  }, [fetchForecast]);

  const highestRisk = useMemo(
    () =>
      data?.forecasts
        .slice()
        .sort((a, b) => b.shortageIndex - a.shortageIndex)
        .slice(0, 6) ?? [],
    [data],
  );

  return (
    <div className="container max-w-6xl space-y-8 py-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-wide text-muted-foreground">Workforce intelligence</p>
          <h1 className="text-3xl font-bold tracking-tight">Forecasting v3</h1>
          <p className="text-muted-foreground max-w-2xl">
            Specialty-by-specialty demand projections, time horizons, and surge hiring triggers.
          </p>
        </div>
        <Button variant="secondary" onClick={() => void fetchForecast()} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {data?.alerts.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-destructive" />
              Surge alerts
            </CardTitle>
            <CardDescription>Triggered when shortage index ≥ 0.75</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.alerts.map((alert) => (
              <Alert key={alert.id} variant={alert.severity === 'critical' ? 'destructive' : 'default'}>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{alert.message}</AlertTitle>
                {alert.metadata && (
                  <AlertDescription className="text-xs">
                    {Object.entries(alert.metadata)
                      .map(([key, value]) => `${key}: ${value as string}`)
                      .join(' · ')}
                  </AlertDescription>
                )}
              </Alert>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>High-risk specialties</CardTitle>
            <CardDescription>Top shortage indexes (30-day horizon)</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading forecasts…</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Specialty</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead>Shortage</TableHead>
                    <TableHead>Suggested hires</TableHead>
                    <TableHead>Confidence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {highestRisk.map((entry) => (
                    <TableRow key={`${entry.specialty}-${entry.region}`}>
                      <TableCell className="font-medium">{entry.specialty}</TableCell>
                      <TableCell>{entry.region}</TableCell>
                      <TableCell>
                        <Badge variant={badgeVariant(entry.riskLevel)}>
                          {(entry.shortageIndex * 100).toFixed(0)}%
                        </Badge>
                      </TableCell>
                      <TableCell>{entry.recommendedHires}</TableCell>
                      <TableCell>
                        <Progress value={entry.signalConfidence * 100} className="h-2" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Regional heatmap</CardTitle>
            <CardDescription>Composite shortage severity</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {data?.heatmap.map((region) => (
              <div
                key={region.region}
                className={`rounded-lg border p-4 ${heatmapBackground(region.shortageIndex)}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-semibold">{region.region}</p>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Hot spot: {region.headlineSpecialty}
                    </p>
                  </div>
                  <Badge variant={badgeVariant(region.riskLevel as ForecastEntry['riskLevel'])}>
                    {(region.shortageIndex * 100).toFixed(0)}%
                  </Badge>
                </div>
              </div>
            )) || <p className="text-sm text-muted-foreground">No regions available.</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Horizon analysis</CardTitle>
          <CardDescription>Projected shortage index by 30/60/90 days</CardDescription>
        </CardHeader>
        <CardContent className="overflow-auto">
          {data?.forecasts.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Specialty</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>30d</TableHead>
                  <TableHead>60d</TableHead>
                  <TableHead>90d</TableHead>
                  <TableHead>Surge readiness</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.forecasts.slice(0, 12).map((entry) => (
                  <TableRow key={`${entry.specialty}-${entry.region}-horizons`}>
                    <TableCell>{entry.specialty}</TableCell>
                    <TableCell>{entry.region}</TableCell>
                    {['30', '60', '90'].map((bucket) => {
                      const horizon = entry.horizons.find((h) => `${h.horizonDays}` === bucket);
                      return (
                        <TableCell key={bucket}>
                          <Badge variant={badgeVariant((horizon?.riskLevel as ForecastEntry['riskLevel']) ?? 'low')}>
                            {(horizon?.shortageIndex ?? 0).toFixed(2)}
                          </Badge>
                        </TableCell>
                      );
                    })}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={entry.surgeReadiness * 100} className="h-2 w-28" />
                        <span className="text-xs text-muted-foreground">
                          {(entry.surgeReadiness * 100).toFixed(0)}%
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">No forecasts available yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function badgeVariant(level: ForecastEntry['riskLevel']) {
  switch (level) {
    case 'critical':
      return 'destructive';
    case 'high':
      return 'destructive';
    case 'moderate':
      return 'secondary';
    default:
      return 'outline';
  }
}

function heatmapBackground(value: number) {
  if (value >= 0.75) return 'bg-destructive/10';
  if (value >= 0.5) return 'bg-amber-100/60 dark:bg-amber-500/10';
  if (value >= 0.3) return 'bg-muted/70';
  return 'bg-muted/40';
}

function buildApiUrl(path: string) {
  if (!API_BASE) return path;
  return `${API_BASE}${path}`;
}

