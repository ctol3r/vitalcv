'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertCircle, BellRing, Loader2, RefreshCw, ShieldAlert } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:4000').replace(/\/$/, '');

interface ForensicsSignal {
  id: string;
  clinicianId: string;
  category: 'identity' | 'document' | 'behavior' | 'registry';
  type: string;
  severity: 'low' | 'medium' | 'high';
  score: number;
  description: string;
  observedAt: string;
}

interface ForensicsAlertRecord {
  id: string;
  clinicianId: string;
  riskScore: number;
  signals: ForensicsSignal[];
  lastReviewed: string;
}

interface AlertsResponse {
  records: ForensicsAlertRecord[];
}

export default function ForensicsAlertFeedPage() {
  const [alerts, setAlerts] = useState<ForensicsAlertRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [threshold, setThreshold] = useState('65');

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        limit: '40',
        minScore: threshold || '65',
      });
      const response = await fetch(buildApiUrl(`/api/forensics/alerts?${params.toString()}`), {
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error(`Alert feed responded ${response.status}`);
      }
      const payload = (await response.json()) as AlertsResponse;
      setAlerts(payload.records ?? []);
    } catch (err) {
      console.warn('[forensics][alerts] failed', err);
      setError('Falling back to cached alerts.');
      setAlerts(buildMockAlerts());
    } finally {
      setLoading(false);
    }
  }, [threshold]);

  useEffect(() => {
    void loadAlerts();
  }, [loadAlerts]);

  const stats = useMemo(() => {
    if (!alerts.length) {
      return { highRisk: 0, averageScore: 0 };
    }
    const highRisk = alerts.filter((alert) => alert.riskScore >= 80).length;
    const averageScore =
      alerts.reduce((sum, alert) => sum + alert.riskScore, 0) / Math.max(1, alerts.length);
    return { highRisk, averageScore };
  }, [alerts]);

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-wide text-muted-foreground">Credential forensics</p>
          <h1 className="text-3xl font-bold tracking-tight">Alert feed</h1>
          <p className="text-muted-foreground max-w-2xl">
            Aggregate view of clinicians crossing configured identity-forensics thresholds. High-risk
            signals require manual compliance review and block issuance automatically.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={threshold}
            onChange={(event) => setThreshold(event.target.value)}
            className="w-24"
            type="number"
            min={0}
            max={100}
            placeholder="Threshold"
          />
          <Button onClick={loadAlerts} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
        </div>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Live feed unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          title="Alerts in window"
          description="Forensics records above threshold"
          value={alerts.length}
          icon={<BellRing className="h-5 w-5 text-muted-foreground" />}
          loading={loading}
        />
        <SummaryCard
          title="High-risk cohort"
          description="Risk score ≥ 80"
          value={stats.highRisk}
          icon={<ShieldAlert className="h-5 w-5 text-muted-foreground" />}
          loading={loading}
        />
        <SummaryCard
          title="Average score"
          description="Across alert set"
          value={stats.averageScore.toFixed(1)}
          icon={<AlertCircle className="h-5 w-5 text-muted-foreground" />}
          loading={loading}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Active alerts</CardTitle>
          <CardDescription>Ordered by last review timestamp.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : alerts.length ? (
            alerts.map((alert) => <AlertRow key={alert.id} alert={alert} />)
          ) : (
            <div className="flex flex-col items-center gap-2 rounded border border-dashed p-8 text-sm text-muted-foreground">
              No forensics alerts found for this threshold.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AlertRow({ alert }: { alert: ForensicsAlertRecord }) {
  const dominantSignals = alert.signals
    .slice()
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return (
    <div className="rounded-lg border p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Clinician • {alert.clinicianId}</p>
          <p className="text-2xl font-semibold">{alert.riskScore.toFixed(1)} risk score</p>
        </div>
        <Badge variant={badgeVariant(alert.riskScore)}>
          {riskLabel(alert.riskScore)} · {new Date(alert.lastReviewed).toLocaleString()}
        </Badge>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {dominantSignals.map((signal) => (
          <Badge key={signal.id} variant={signalSeverityVariant(signal.severity)}>
            {signal.type.replace(/_/g, ' ')}
          </Badge>
        ))}
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        {dominantSignals[0]?.description ?? 'No dominant signal recorded.'}
      </p>
    </div>
  );
}

function SummaryCard({
  title,
  description,
  value,
  icon,
  loading,
}: {
  title: string;
  description: string;
  value: string | number;
  icon: ReactNode;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {icon}
      </CardHeader>
      <CardContent>{loading ? <Skeleton className="h-6 w-16" /> : <span className="text-2xl font-semibold">{value}</span>}</CardContent>
    </Card>
  );
}

function badgeVariant(score: number) {
  if (score >= 80) return 'destructive';
  if (score >= 60) return 'secondary';
  return 'outline';
}

function riskLabel(score: number) {
  if (score >= 85) return 'Critical';
  if (score >= 70) return 'High';
  if (score >= 55) return 'Elevated';
  return 'Monitor';
}

function signalSeverityVariant(severity: ForensicsSignal['severity']) {
  switch (severity) {
    case 'high':
      return 'destructive';
    case 'medium':
      return 'secondary';
    default:
      return 'outline';
  }
}

function buildApiUrl(path: string) {
  if (!API_BASE) return path;
  return `${API_BASE}${path}`;
}

function buildMockAlerts(): ForensicsAlertRecord[] {
  return Array.from({ length: 3 }).map((_, index) => ({
    id: `mock-alert-${index}`,
    clinicianId: `clinician-${400 + index}`,
    riskScore: 70 + index * 6,
    lastReviewed: new Date(Date.now() - index * 1000 * 60 * 30).toISOString(),
    signals: [
      {
        id: `mock-signal-${index}`,
        clinicianId: `clinician-${400 + index}`,
        category: 'identity',
        type: 'name_drift_vs_npi_history',
        severity: 'high',
        score: 0.81,
        description: 'Preferred name diverged from NPPES record.',
        observedAt: new Date().toISOString(),
      },
    ],
  }));
}


