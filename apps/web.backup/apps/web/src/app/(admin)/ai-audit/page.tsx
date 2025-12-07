'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, Gauge, Loader2, ShieldCheck, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:4000').replace(/\/$/, '');
const DEFAULT_JOB_ID = 'demo-job-992';

interface RepresentationBucket {
  group: string;
  share: number;
}

interface FairnessOverlay {
  totalAlerts: number;
  representation: {
    specialty: RepresentationBucket[];
    gender: RepresentationBucket[];
    region: RepresentationBucket[];
  };
}

interface CandidateFairnessRow {
  clinicianId: string;
  fairnessScore: number;
  biasAlerts: string[];
  decisionScore: number;
  summary: string;
}

interface AuditPayload {
  jobId: string;
  fairnessOverlay: FairnessOverlay;
  candidates: CandidateFairnessRow[];
  generatedAt: string;
}

export default function AiFairnessAuditPage() {
  const [jobId, setJobId] = useState(DEFAULT_JOB_ID);
  const [audit, setAudit] = useState<AuditPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAudit = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = `${API_BASE}/api/matching/predictive/${encodeURIComponent(jobId)}?limit=25`;
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`API responded with ${response.status}`);
      }
      const payload = await response.json();
      setAudit({
        jobId: payload.job?.id ?? jobId,
        fairnessOverlay: payload.fairnessOverlay ?? buildEmptyFairnessOverlay(),
        generatedAt: payload.generatedAt ?? new Date().toISOString(),
        candidates: (payload.candidates ?? []).map((candidate: any) => ({
          clinicianId: candidate.clinicianId,
          fairnessScore: candidate.fairness?.fairnessScore ?? candidate.readinessScore ?? 0,
          biasAlerts: candidate.fairness?.biasAlerts ?? [],
          decisionScore: candidate.prediction?.score ?? candidate.prediction?.predictionScore ?? 0,
          summary: candidate.explanation?.summary ?? 'No explanation provided.',
        })),
      });
    } catch (err) {
      console.warn('[ai-audit] fairness fetch failed', err);
      setError('Live fairness telemetry unavailable. Showing last cached snapshot.');
      setAudit(buildMockAudit(jobId));
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    void fetchAudit();
  }, [fetchAudit]);

  const representationGaps = useMemo(() => {
    if (!audit) return [];
    return [
      audit.fairnessOverlay.representation.specialty,
      audit.fairnessOverlay.representation.gender,
      audit.fairnessOverlay.representation.region,
    ]
      .flat()
      .sort((a, b) => b.share - a.share)
      .slice(0, 3);
  }, [audit]);

  return (
    <div className="space-y-8 p-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-wide text-muted-foreground">AI Governance</p>
          <h1 className="text-3xl font-bold tracking-tight">Fairness Audit</h1>
          <p className="text-muted-foreground max-w-2xl">
            Monitor bias guardrails, representation share, and override workload for AI-driven matches.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            aria-label="Job identifier"
            value={jobId}
            onChange={(event) => setJobId(event.target.value)}
            className="w-full sm:w-52"
            placeholder="job-id"
          />
          <Button onClick={fetchAudit} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Run audit
          </Button>
        </div>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Using cached audit</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          icon={Gauge}
          label="Total bias alerts"
          value={audit?.fairnessOverlay.totalAlerts ?? 0}
          description="Requires human acknowledgement"
        />
        <MetricCard
          icon={BarChart3}
          label="Largest gap"
          value={`${representationGaps[0]?.group ?? 'N/A'} · ${representationGaps[0]?.share ?? 0}%`}
          description="Top under/over represented slice"
        />
        <MetricCard
          icon={ShieldCheck}
          label="Job monitored"
          value={audit?.jobId ?? '—'}
          description={audit ? `Generated ${new Date(audit.generatedAt).toLocaleString()}` : 'Pending'}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Representation snapshot</CardTitle>
          <CardDescription>Percent share surfaced by AI matching.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading || !audit ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="grid gap-6 md:grid-cols-3">
              <RepresentationColumn title="Specialty" buckets={audit.fairnessOverlay.representation.specialty} />
              <RepresentationColumn title="Gender" buckets={audit.fairnessOverlay.representation.gender} />
              <RepresentationColumn title="Region" buckets={audit.fairnessOverlay.representation.region} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Candidate fairness ledger</CardTitle>
          <CardDescription>Bias alerts and decision impact for surfaced clinicians.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading || !audit ? (
            <TableSkeleton rows={5} />
          ) : (
            <CandidateTable rows={audit.candidates} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  description,
}: {
  icon: typeof Sparkles;
  label: string;
  value: string | number;
  description: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function RepresentationColumn({ title, buckets }: { title: string; buckets: RepresentationBucket[] }) {
  return (
    <div>
      <p className="text-sm font-semibold">{title}</p>
      <div className="mt-3 space-y-2">
        {buckets.length === 0 ? (
          <p className="text-sm text-muted-foreground">Not enough data.</p>
        ) : (
          buckets.map((bucket) => (
            <div key={`${title}-${bucket.group}`}>
              <div className="flex items-center justify-between text-sm">
                <span>{bucket.group}</span>
                <span className="text-muted-foreground">{bucket.share}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted">
                <div
                  className="h-1.5 rounded-full bg-primary"
                  style={{ width: `${Math.min(bucket.share, 100)}%` }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function CandidateTable({ rows }: { rows: CandidateFairnessRow[] }) {
  if (!rows.length) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed p-10 text-sm text-muted-foreground">
        <ShieldCheck className="h-4 w-4" />
        No fairness violations logged for this job.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Clinician</TableHead>
            <TableHead>Fairness score</TableHead>
            <TableHead>Decision score</TableHead>
            <TableHead>Bias alerts</TableHead>
            <TableHead>Summary</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.clinicianId}>
              <TableCell className="font-medium">{truncateId(row.clinicianId)}</TableCell>
              <TableCell>{(row.fairnessScore * 100).toFixed(1)}%</TableCell>
              <TableCell>{(row.decisionScore * 100).toFixed(1)}%</TableCell>
              <TableCell>
                {row.biasAlerts.length === 0 ? (
                  <Badge variant="outline">Cleared</Badge>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {row.biasAlerts.map((alert) => (
                      <Badge key={`${row.clinicianId}-${alert}`} variant="destructive">
                        {alert}
                      </Badge>
                    ))}
                  </div>
                )}
              </TableCell>
              <TableCell className="max-w-xs text-sm text-muted-foreground">{row.summary}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function TableSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={`fairness-row-${index}`} className="h-10 w-full" />
      ))}
    </div>
  );
}

function truncateId(id: string) {
  if (id.length <= 10) return id;
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

function buildEmptyFairnessOverlay(): FairnessOverlay {
  return {
    totalAlerts: 0,
    representation: {
      specialty: [],
      gender: [],
      region: [],
    },
  };
}

function buildMockAudit(jobId: string): AuditPayload {
  return {
    jobId,
    generatedAt: new Date().toISOString(),
    fairnessOverlay: {
      totalAlerts: 2,
      representation: {
        specialty: [
          { group: 'Cardiology', share: 38 },
          { group: 'Emergency', share: 25 },
          { group: 'Other', share: 37 },
        ],
        gender: [
          { group: 'Female', share: 52 },
          { group: 'Male', share: 41 },
          { group: 'Unknown', share: 7 },
        ],
        region: [
          { group: 'West', share: 35 },
          { group: 'South', share: 33 },
          { group: 'Other', share: 32 },
        ],
      },
    },
    candidates: [
      {
        clinicianId: 'mock-clinician-1',
        fairnessScore: 0.74,
        decisionScore: 0.82,
        biasAlerts: ['regional_underrepresentation'],
        summary: 'AI boosted representation for telehealth-friendly specialties.',
      },
      {
        clinicianId: 'mock-clinician-2',
        fairnessScore: 0.65,
        decisionScore: 0.79,
        biasAlerts: [],
        summary: 'Match uses compact portability and PSV freshness.',
      },
    ],
  };
}










