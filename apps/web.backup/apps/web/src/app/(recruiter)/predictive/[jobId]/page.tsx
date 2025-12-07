'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Sparkles, ShieldCheck, Scale, AlertTriangle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

interface PredictiveCandidate {
  clinicianId: string;
  name: string;
  specialty: string;
  state?: string;
  readinessScore: number;
  scheduleFit: number;
  commuteMinutes: number;
  shiftOverlap: number;
  fatigueRisk: number;
  shiftNotes: string[];
  prediction: {
    score: number;
    rationale: {
      contributions: Record<string, number>;
      confidenceBand: { lower: number; upper: number };
      factors: string[];
    };
  };
  fairness?: {
    adjustedScore: number;
    fairnessScore: number;
    biasAlerts: string[];
  };
}

interface PredictiveResponse {
  job: {
    id: string;
    title: string;
    specialty: string;
    organization: string;
  };
  candidates: PredictiveCandidate[];
  fairnessOverlay: {
    totalAlerts: number;
    representation: {
      specialty: Array<{ group: string; share: number }>;
      gender: Array<{ group: string; share: number }>;
      region: Array<{ group: string; share: number }>;
    };
  };
  autoVerifyRecommendation: Array<{
    clinicianId: string;
    predictedHireLikelihood: number;
    readinessScore: number;
  }>;
  generatedAt: string;
}

export default function PredictiveMatchPage({ params }: { params: { jobId: string } }) {
  const { toast } = useToast();
  const [payload, setPayload] = useState<PredictiveResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoVerifying, setAutoVerifying] = useState(false);

  const fetchPredictive = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/matching/predictive/${params.jobId}?limit=12`, {
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error(`Predictive feed failed (${response.status})`);
      }
      const data = (await response.json()) as PredictiveResponse;
      setPayload(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load predictive ranking';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [params.jobId]);

  useEffect(() => {
    fetchPredictive();
  }, [fetchPredictive]);

  const handleAutoVerify = useCallback(async () => {
    if (!payload?.autoVerifyRecommendation?.length) {
      toast({
        title: 'No candidates queued',
        description: 'Predictive engine has not surfaced an auto-verify set yet.',
      });
      return;
    }
    setAutoVerifying(true);
    try {
      for (const candidate of payload.autoVerifyRecommendation) {
        await fetch(`${API_BASE}/api/recruiter/verify/${candidate.clinicianId}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            readinessScoreBefore: candidate.readinessScore,
            reason: 'predictive-auto-verify',
          }),
        });
      }
      toast({
        title: 'Auto-verify pipeline dispatched',
        description: `Sent ${payload.autoVerifyRecommendation.length} verification requests.`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to auto-verify selection';
      toast({
        title: 'Auto-verify failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setAutoVerifying(false);
    }
  }, [payload, toast]);

  const topCandidate = useMemo(() => payload?.candidates?.[0], [payload]);

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Predictive Match · {payload?.job.title ?? 'Loading…'}</h1>
          <p className="text-muted-foreground">
            Readiness, fairness, and scheduling telemetry blended into a Title VII–aware ranking.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchPredictive} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Refresh
          </Button>
          <Button onClick={handleAutoVerify} disabled={autoVerifying || !payload?.autoVerifyRecommendation?.length}>
            {autoVerifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Auto-Verify Top 5
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Unable to load predictions</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Job Snapshot</CardTitle>
            <CardDescription>{payload?.job.organization ?? 'Loading job context'}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Specialty: <span className="font-medium text-foreground">{payload?.job.specialty ?? '—'}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Generated: {payload ? new Date(payload.generatedAt).toLocaleString() : '—'}
            </p>
            {topCandidate && (
              <div className="rounded-md border p-3">
                <p className="text-xs uppercase text-muted-foreground">Top candidate</p>
                <p className="font-semibold">{topCandidate.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(topCandidate.prediction.score * 100).toFixed(1)}% predicted hire likelihood
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fairness Overlay</CardTitle>
            <CardDescription>{payload?.fairnessOverlay.totalAlerts ?? 0} bias alerts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <OverlayRow label="Specialty" entries={payload?.fairnessOverlay.representation.specialty ?? []} />
            <OverlayRow label="Gender" entries={payload?.fairnessOverlay.representation.gender ?? []} />
            <OverlayRow label="Region" entries={payload?.fairnessOverlay.representation.region ?? []} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Confidence Band</CardTitle>
            <CardDescription>Predictive spread for the top candidate</CardDescription>
          </CardHeader>
          <CardContent>
            {topCandidate ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Lower bound</span>
                  <span>{(topCandidate.prediction.rationale.confidenceBand.lower * 100).toFixed(1)}%</span>
                </div>
                <Progress value={topCandidate.prediction.score * 100} />
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Upper bound</span>
                  <span>{(topCandidate.prediction.rationale.confidenceBand.upper * 100).toFixed(1)}%</span>
                </div>
                <div className="rounded-md border p-3 text-sm text-muted-foreground">
                  {topCandidate.prediction.rationale.factors[0] ?? 'Awaiting rationale'}
                </div>
              </div>
            ) : (
              <Skeleton className="h-24 w-full" />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Ranked clinicians</CardTitle>
            <CardDescription>
              Readiness, scheduling, fairness, and historical signals combined into a 0–1 prediction band.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>{loading ? <LoadingTable /> : <CandidatesTable candidates={payload?.candidates ?? []} />}</CardContent>
      </Card>
    </div>
  );
}

function OverlayRow({ label, entries }: { label: string; entries: Array<{ group: string; share: number }> }) {
  if (!entries.length) {
    return (
      <div className="text-sm text-muted-foreground">
        {label}: <span className="text-foreground">No data</span>
      </div>
    );
  }
  return (
    <div>
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <div className="mt-1 flex flex-wrap gap-2">
        {entries.map((entry) => (
          <Badge key={`${label}-${entry.group}`} variant="secondary">
            {entry.group}: {entry.share}%
          </Badge>
        ))}
      </div>
    </div>
  );
}

function LoadingTable() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={`candidate-loading-${index}`} className="h-16 w-full" />
      ))}
    </div>
  );
}

function CandidatesTable({ candidates }: { candidates: PredictiveCandidate[] }) {
  if (!candidates.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
        <ShieldCheck className="h-6 w-6" />
        <p>No clinicians surfaced yet.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Clinician</TableHead>
            <TableHead>Readiness</TableHead>
            <TableHead>Schedule fit</TableHead>
            <TableHead>Predicted hire</TableHead>
            <TableHead>Fairness</TableHead>
            <TableHead>Signals</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {candidates.map((candidate) => (
            <TableRow key={candidate.clinicianId}>
              <TableCell>
                <div className="font-semibold">{candidate.name}</div>
                <div className="text-xs text-muted-foreground">
                  {candidate.specialty} · {candidate.state}
                </div>
              </TableCell>
              <TableCell>
                <ScoreBar label="Readiness" value={candidate.readinessScore} />
              </TableCell>
              <TableCell>
                <ScoreBar label="Schedule" value={candidate.scheduleFit} subtitle={`${candidate.commuteMinutes} min commute`} />
              </TableCell>
              <TableCell>
                <ScoreBar label="Prediction" value={candidate.prediction.score} subtitle="Hire likelihood" />
              </TableCell>
              <TableCell>
                {candidate.fairness ? (
                  <div className="space-y-1">
                    <Badge variant={candidate.fairness.biasAlerts.length ? 'destructive' : 'outline'} className="text-xs">
                      {candidate.fairness.biasAlerts.length ? `${candidate.fairness.biasAlerts.length} alerts` : 'Clear'}
                    </Badge>
                    <p className="text-xs text-muted-foreground">
                      Score {Math.round(candidate.fairness.fairnessScore * 100)}%
                    </p>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">Awaiting overlay</span>
                )}
              </TableCell>
              <TableCell>
                <div className="space-y-1 text-xs text-muted-foreground">
                  {(candidate.shiftNotes ?? []).slice(0, 2).map((note) => (
                    <p key={`${candidate.clinicianId}-${note}`}>{note}</p>
                  ))}
                  {!candidate.shiftNotes?.length && <span>No blockers</span>}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ScoreBar({ label, value, subtitle }: { label: string; value: number; subtitle?: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="font-semibold text-foreground">{(value * 100).toFixed(1)}%</span>
      </div>
      <Progress value={value * 100} />
      {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
    </div>
  );
}











