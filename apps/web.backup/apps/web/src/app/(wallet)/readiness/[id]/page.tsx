'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, RefreshCcw, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

type DimensionBreakdown = {
  dimension: string;
  score: number;
  metadata: Record<string, unknown>;
  updatedAt: string;
};

type ReadinessBreakdown = {
  readinessScore: number;
  dimensions: DimensionBreakdown[];
  penalties: {
    recency: number;
    titleVII: number;
  };
  titleVII: {
    compliant: boolean;
    findings: string[];
  };
};

const TARGET_SCORE = 0.9;

export default function ReadinessBreakdownPage({ params }: { params: { id: string } }) {
  const [breakdown, setBreakdown] = useState<ReadinessBreakdown | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadBreakdown(params.id);
  }, [params.id]);

  async function loadBreakdown(id: string) {
    setIsRefreshing(true);
    setError(null);

    try {
      const response = await fetchReadinessBreakdown(id);
      setBreakdown(response);
    } catch (err) {
      console.warn('[readiness][ui]', err);
      setError('Unable to load readiness data. Showing demo snapshot instead.');
      setBreakdown(buildFallbackSnapshot(id));
    } finally {
      setIsRefreshing(false);
    }
  }

  const plan = useMemo(() => {
    if (!breakdown) return null;
    const opportunities = [...breakdown.dimensions]
      .sort((a, b) => a.score - b.score)
      .slice(0, 3)
      .map((dimension) => ({
        dimension: dimension.dimension,
        current: dimension.score,
        target: Math.max(TARGET_SCORE, dimension.score + 0.1),
      }));

    const liftNeeded = Math.max(TARGET_SCORE - breakdown.readinessScore, 0);

    return { opportunities, liftNeeded };
  }, [breakdown]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="space-y-2">
        <Badge variant="secondary">Wallet · Readiness</Badge>
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <h1 className="text-3xl font-semibold leading-tight">Readiness breakdown</h1>
            <p className="text-muted-foreground">
              Clinician <span className="font-mono text-xs">{params.id}</span>
            </p>
          </div>
          <Button
            variant="outline"
            className="ml-auto gap-2"
            onClick={() => loadBreakdown(params.id)}
            disabled={isRefreshing}
          >
            <RefreshCcw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
            Refresh now
          </Button>
        </div>
        {error && <p className="text-sm text-amber-600">{error}</p>}
      </header>

      {breakdown && (
        <>
          <section className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Composite readiness</CardTitle>
                <CardDescription>
                  Weighted dimension score after recency and compliance penalties.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col gap-2">
                  <div className="flex items-baseline gap-3">
                    <span className="text-4xl font-semibold">
                      {(breakdown.readinessScore * 100).toFixed(1)}%
                    </span>
                    <Badge variant="outline">
                      Target {(TARGET_SCORE * 100).toFixed(0)}%
                    </Badge>
                  </div>
                  <Progress
                    value={breakdown.readinessScore * 100}
                    className="h-3"
                  />
                </div>

                {plan && (
                  <div className="rounded-lg border bg-muted/40 p-4">
                    <p className="text-sm font-medium text-muted-foreground">
                      Next steps
                    </p>
                    <p className="text-sm">
                      Raise readiness from{' '}
                      <span className="font-semibold">
                        {(breakdown.readinessScore * 100).toFixed(1)}%
                      </span>{' '}
                      to{' '}
                      <span className="font-semibold">
                        {(TARGET_SCORE * 100).toFixed(1)}%
                      </span>{' '}
                      (lift of {(plan.liftNeeded * 100).toFixed(1)} pts).
                    </p>
                    <ul className="mt-2 space-y-1 text-sm">
                      {plan.opportunities.map((item) => (
                        <li key={item.dimension} className="flex items-center gap-2">
                          <ArrowUpRight className="h-4 w-4 text-emerald-600" />
                          <span className="font-medium">{dimensionLabel(item.dimension)}</span>
                          <span className="text-muted-foreground">
                            {(item.current * 100).toFixed(0)}% →{' '}
                            {(item.target * 100).toFixed(0)}%
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Compliance & penalties</CardTitle>
                <CardDescription>
                  Recency decay and Title VII screening applied to the composite.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <PenaltyMeter
                  label="Recency penalty"
                  value={breakdown.penalties.recency}
                  helper="Stale evidence reduces readiness."
                />
                <PenaltyMeter
                  label="Title VII guardrails"
                  value={breakdown.penalties.titleVII}
                  helper={
                    breakdown.titleVII.compliant
                      ? 'No protected data detected across dimensions.'
                      : 'Protected attributes detected in metadata.'
                  }
                />
                <div className="rounded-lg border border-dashed p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <ShieldCheck
                      className={cn(
                        'h-4 w-4',
                        breakdown.titleVII.compliant ? 'text-emerald-600' : 'text-amber-500',
                      )}
                    />
                    <span className="font-medium">
                      {breakdown.titleVII.compliant ? 'Title VII compliant' : 'Action required'}
                    </span>
                  </div>
                  {!breakdown.titleVII.compliant && (
                    <ul className="mt-2 list-disc pl-5 text-muted-foreground">
                      {breakdown.titleVII.findings.map((finding) => (
                        <li key={finding}>{finding}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            {breakdown.dimensions.map((dimension) => (
              <Card key={dimension.dimension}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{dimensionLabel(dimension.dimension)}</span>
                    <Badge
                      variant={dimension.score >= 0.85 ? 'default' : 'secondary'}
                    >
                      {(dimension.score * 100).toFixed(0)}%
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Updated {new Date(dimension.updatedAt).toLocaleString()}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Progress value={dimension.score * 100} />
                  <MetadataList metadata={dimension.metadata} />
                </CardContent>
              </Card>
            ))}
          </section>
        </>
      )}
    </div>
  );
}

function MetadataList({ metadata }: { metadata: Record<string, unknown> }) {
  const entries = Object.entries(metadata ?? {}).slice(0, 4);

  if (!entries.length) {
    return <p className="text-sm text-muted-foreground">No metadata provided.</p>;
  }

  return (
    <dl className="grid gap-2 text-sm">
      {entries.map(([key, value]) => (
        <div key={key} className="flex items-center justify-between rounded border px-3 py-2">
          <dt className="text-muted-foreground">{humanizeKey(key)}</dt>
          <dd className="font-medium">{formatMetadataValue(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function PenaltyMeter({
  label,
  value,
  helper,
}: {
  label: string;
  value: number;
  helper: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm font-medium">
        <span>{label}</span>
        <span>{(value * 100).toFixed(1)} pts</span>
      </div>
      <Progress value={value * 100} className="mt-2 h-2 bg-muted" />
      <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
    </div>
  );
}

async function fetchReadinessBreakdown(clinicianId: string): Promise<ReadinessBreakdown> {
  const baseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    process.env.API_BASE_URL ??
    (typeof window !== 'undefined' ? window.location.origin : '');

  if (!baseUrl) {
    throw new Error('API base URL not configured');
  }

  const response = await fetch(`${baseUrl}/api/readiness/${clinicianId}/v3`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Aggregator returned ${response.status}`);
  }

  return (await response.json()) as ReadinessBreakdown;
}

function buildFallbackSnapshot(clinicianId: string): ReadinessBreakdown {
  return {
    readinessScore: 0.72,
    penalties: {
      recency: 0.04,
      titleVII: 0,
    },
    titleVII: {
      compliant: true,
      findings: [],
    },
    dimensions: [
      {
        dimension: 'PSD',
        score: 0.78,
        metadata: {
          licenseId: 'CA-328710',
          state: 'CA',
          status: 'ACTIVE',
          lastCheckedAt: new Date().toISOString(),
        },
        updatedAt: new Date().toISOString(),
      },
      {
        dimension: 'BOARD',
        score: 0.74,
        metadata: {
          mismatchCount: 1,
          lastCheckAt: new Date().toISOString(),
        },
        updatedAt: new Date().toISOString(),
      },
      {
        dimension: 'SANCTIONS',
        score: 0.81,
        metadata: {
          sanctionsProbability: 0.1,
          activeSignals: 0,
        },
        updatedAt: new Date().toISOString(),
      },
      {
        dimension: 'COMPACT',
        score: 0.66,
        metadata: {
          compactEligibility: 'PENDING',
        },
        updatedAt: new Date().toISOString(),
      },
      {
        dimension: 'IDENTITY',
        score: 0.84,
        metadata: {
          npiPresent: true,
          didBound: true,
          walletDevices: 1,
        },
        updatedAt: new Date().toISOString(),
      },
      {
        dimension: 'NPDB',
        score: 0.7,
        metadata: {
          adverseActions: 1,
          lastReportAt: '2024-12-12T00:00:00.000Z',
        },
        updatedAt: new Date().toISOString(),
      },
    ],
  };
}

function dimensionLabel(key: string): string {
  switch (key) {
    case 'PSD':
      return 'Primary source';
    case 'BOARD':
      return 'Board clean room';
    case 'SANCTIONS':
      return 'Sanctions';
    case 'COMPACT':
      return 'Compact mobility';
    case 'IDENTITY':
      return 'Identity assurance';
    case 'NPDB':
      return 'NPDB watchlist';
    default:
      return key;
  }
}

function humanizeKey(value: string): string {
  return value
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatMetadataValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return value.toLocaleString();
  if (typeof value === 'string') {
    const date = Date.parse(value);
    if (!Number.isNaN(date) && value.includes('T')) {
      return new Date(value).toLocaleDateString();
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  return JSON.stringify(value);
}










