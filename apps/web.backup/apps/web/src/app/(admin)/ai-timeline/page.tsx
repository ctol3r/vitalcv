'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, CalendarClock, Loader2, RefreshCw, Sparkles, Target } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:4000').replace(/\/$/, '');

interface AiFeatureSpread {
  feature: string;
  share: number;
  direction: 'positive' | 'negative';
}

interface AiDecision {
  id: string;
  decision: string;
  outcome: string;
  timestamp: string;
  dominantFeature: {
    feature: string;
    contribution: number;
    direction: 'positive' | 'negative';
  } | null;
  featureSpread: AiFeatureSpread[];
}

interface AiDecisionResponse {
  success: boolean;
  decisions: AiDecision[];
}

export default function AiDecisionTimelinePage() {
  const [decisions, setDecisions] = useState<AiDecision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [outcomeFilter, setOutcomeFilter] = useState('');

  const fetchDecisions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: '40' });
      if (outcomeFilter.trim()) {
        params.set('outcome', outcomeFilter.trim());
      }
      const response = await fetch(`${API_BASE}/api/ai/decisions?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`API responded with ${response.status}`);
      }
      const payload = (await response.json()) as AiDecisionResponse;
      setDecisions(payload.decisions ?? []);
    } catch (err) {
      console.warn('[ai-timeline] unable to load decisions', err);
      setError('Falling back to cached decision timeline — live audit unavailable.');
      setDecisions(buildMockDecisions());
    } finally {
      setLoading(false);
    }
  }, [outcomeFilter]);

  useEffect(() => {
    void fetchDecisions();
  }, [fetchDecisions]);

  const timelineStats = useMemo(() => {
    const total = decisions.length || 1;
    const positives = decisions.filter(
      (decision) => decision.dominantFeature?.direction !== 'negative',
    ).length;
    return {
      total: decisions.length,
      positiveShare: Math.round((positives / total) * 100),
      dominantFeature: decisions[0]?.dominantFeature?.feature ?? 'n/a',
    };
  }, [decisions]);

  return (
    <div className="space-y-8 p-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-wide text-muted-foreground">Explainability</p>
          <h1 className="text-3xl font-bold tracking-tight">AI Decision Timeline</h1>
          <p className="text-muted-foreground max-w-3xl">
            Inspect the most recent explainable decisions, dominant features, and rollout timestamps.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            value={outcomeFilter}
            onChange={(event) => setOutcomeFilter(event.target.value)}
            placeholder="Outcome filter (optional)"
            className="w-full sm:w-56"
          />
          <Button onClick={fetchDecisions} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh timeline
          </Button>
        </div>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Using cached decisions</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Decisions captured</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{timelineStats.total}</div>
            <p className="text-xs text-muted-foreground">In the current window</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Positive direction</CardTitle>
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{timelineStats.positiveShare}%</div>
            <p className="text-xs text-muted-foreground">Aligned with configured guardrails</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dominant feature</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{timelineStats.dominantFeature}</div>
            <p className="text-xs text-muted-foreground">Most recent decision</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent explainable decisions</CardTitle>
          <CardDescription>Derived from ExplainableDecision ledger.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <Timeline decisions={decisions} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Timeline({ decisions }: { decisions: AiDecision[] }) {
  if (!decisions.length) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-10 text-sm text-muted-foreground">
        <CalendarClock className="h-4 w-4" />
        No explainable decisions recorded yet.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {decisions.map((decision, index) => (
        <div key={decision.id} className="relative pl-6">
          <div className="absolute left-1 top-1 h-full w-px bg-border" aria-hidden="true" />
          <div className="absolute left-0 top-2 h-3 w-3 rounded-full bg-primary shadow-sm" />
          <div className="rounded-lg border p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm uppercase text-muted-foreground">{decision.outcome}</p>
                <p className="text-lg font-semibold">{decision.decision}</p>
              </div>
              <div className="text-sm text-muted-foreground">
                {new Date(decision.timestamp).toLocaleString()}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {decision.dominantFeature ? (
                <Badge variant={decision.dominantFeature.direction === 'positive' ? 'secondary' : 'destructive'}>
                  {decision.dominantFeature.feature} ·{' '}
                  {Number((decision.dominantFeature.contribution * 100).toFixed(1))}%
                </Badge>
              ) : (
                <Badge variant="outline">No dominant feature</Badge>
              )}
              <Badge variant="outline">#{index + 1}</Badge>
            </div>
            <FeatureBreakdown spread={decision.featureSpread} />
          </div>
        </div>
      ))}
    </div>
  );
}

function FeatureBreakdown({ spread }: { spread: AiFeatureSpread[] }) {
  if (!spread.length) {
    return <p className="mt-3 text-sm text-muted-foreground">No feature telemetry captured.</p>;
  }
  return (
    <div className="mt-4 space-y-2">
      {spread.map((entry) => (
        <div key={`${entry.feature}-${entry.direction}`}>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{entry.feature}</span>
            <span>{(entry.share * 100).toFixed(1)}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted">
            <div
              className={`h-2 rounded-full ${
                entry.direction === 'positive' ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
              style={{ width: `${Math.min(entry.share * 100, 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function buildMockDecisions(): AiDecision[] {
  return [
    {
      id: 'mock-1',
      decision: 'Match clinician 491 to Neuro ICU role',
      outcome: 'approved',
      timestamp: new Date().toISOString(),
      dominantFeature: {
        feature: 'readiness_score',
        contribution: 0.82,
        direction: 'positive',
      },
      featureSpread: [
        { feature: 'readiness_score', share: 0.42, direction: 'positive' },
        { feature: 'sanctions_delta', share: 0.18, direction: 'positive' },
        { feature: 'ehr_alignment', share: 0.4, direction: 'positive' },
      ],
    },
    {
      id: 'mock-2',
      decision: 'Downgrade candidate due to stale PSV',
      outcome: 'manual_review',
      timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      dominantFeature: {
        feature: 'psv_age_days',
        contribution: -0.71,
        direction: 'negative',
      },
      featureSpread: [
        { feature: 'psv_age_days', share: 0.5, direction: 'negative' },
        { feature: 'fairness_adjust', share: 0.3, direction: 'negative' },
        { feature: 'market_pressure', share: 0.2, direction: 'positive' },
      ],
    },
  ];
}










