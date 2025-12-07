'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Shield,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

interface CandidateApiRecord {
  clinicianId: string;
  readinessScore: number;
  sanctionsClear: boolean;
  psvCurrent: boolean;
  npdbClear: boolean;
  compactEligibility: string;
  updatedAt: string;
  rationale: {
    components: Record<string, number>;
    notes: string[];
  };
}

interface RecruiterCandidatesResponse {
  candidates: CandidateApiRecord[];
}

interface MatchRationale {
  keyFactors: Array<{
    label: string;
    detail: string;
    impact: 'positive' | 'neutral' | 'warning';
  }>;
  compact?: {
    eligibleStates: string[];
    message: string;
    status: 'ready' | 'missing' | 'encouraged';
  };
}

interface JobMatchSummary {
  jobId: string;
  title: string;
  specialty?: string;
  matchScore: number;
  rawScore: number;
  compactRecommendation?: MatchRationale['compact'];
  keyFactors: MatchRationale['keyFactors'];
}

interface CandidateRow extends CandidateApiRecord {
  topMatch?: JobMatchSummary;
}

export default function RecruiterMatchingPanel() {
  const { toast } = useToast();
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestingId, setRequestingId] = useState<string | null>(null);

  const fetchCandidates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/recruiter/candidates?ready=true`, {
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error(`Unable to load candidates (${response.status})`);
      }
      const payload = (await response.json()) as RecruiterCandidatesResponse;
      const seed = payload.candidates.slice(0, 5);
      const withMatches = await Promise.all(
        seed.map(async (candidate) => {
          try {
            const matchRes = await fetch(
              `${API_BASE}/api/matching/jobs/${candidate.clinicianId}?limit=1`,
            );
            if (!matchRes.ok) {
              throw new Error('match_fetch_failed');
            }
            const matchData = await matchRes.json();
            const topMatch = matchData?.matches?.[0];
            if (!topMatch) {
              return candidate;
            }
            const summary: JobMatchSummary = {
              jobId: topMatch.jobId,
              title: topMatch.title,
              specialty: topMatch.specialty,
              matchScore: topMatch.matchScore,
              rawScore: topMatch.rawScore,
              compactRecommendation: topMatch.compactRecommendation,
              keyFactors: topMatch.rationale?.keyFactors ?? [],
            };
            return { ...candidate, topMatch: summary };
          } catch (matchError) {
            console.warn('Failed to hydrate job match for candidate', candidate.clinicianId, matchError);
            return candidate;
          }
        }),
      );

      setCandidates(withMatches);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load candidates';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  const handleRequestVerification = useCallback(
    async (candidate: CandidateRow) => {
      setRequestingId(candidate.clinicianId);
      try {
        const response = await fetch(`${API_BASE}/api/recruiter/verify/${candidate.clinicianId}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            readinessScoreBefore: candidate.readinessScore,
          }),
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body?.message ?? 'Verification could not be requested');
        }
        const payload = await response.json();
        toast({
          title: 'Verification pipeline started',
          description: `Anchored proof ${payload?.chain?.txHash ?? 'pending'}.`,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to request verification';
        toast({
          title: 'Verification request failed',
          description: message,
          variant: 'destructive',
        });
      } finally {
        setRequestingId(null);
      }
    },
    [toast],
  );

  const warningCount = useMemo(
    () =>
      candidates.reduce((sum, candidate) => {
        return sum + buildWarnings(candidate).length;
      }, 0),
    [candidates],
  );

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Matching · Top Candidates</h1>
          <p className="text-muted-foreground">
            Sanction-aware readiness, compact portability, and real-time match rationale.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={fetchCandidates}
            disabled={loading}
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Unable to load candidates</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Verification workload</CardTitle>
            <CardDescription>
              {warningCount > 0
                ? `${warningCount} outstanding eligibility warnings require review`
                : 'All surfaced clinicians pass readiness filters.'}
            </CardDescription>
          </div>
          <Badge variant={warningCount > 0 ? 'destructive' : 'secondary'}>
            {warningCount > 0 ? `${warningCount} blockers` : 'Green lane'}
          </Badge>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingState />
          ) : (
            <CandidateTable
              candidates={candidates}
              onRequestVerification={handleRequestVerification}
              requestingId={requestingId}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CandidateTable({
  candidates,
  onRequestVerification,
  requestingId,
}: {
  candidates: CandidateRow[];
  onRequestVerification: (candidate: CandidateRow) => Promise<void>;
  requestingId: string | null;
}) {
  if (candidates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
        <Shield className="h-6 w-6" />
        <p>No recruiter-ready clinicians surfaced yet.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Clinician</TableHead>
            <TableHead className="w-40">Readiness</TableHead>
            <TableHead>Top Match</TableHead>
            <TableHead>Key factors</TableHead>
            <TableHead>Eligibility warnings</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {candidates.map((candidate) => (
            <TableRow key={candidate.clinicianId}>
              <TableCell className="space-y-1">
                <div className="font-semibold">{truncateId(candidate.clinicianId)}</div>
                <div className="text-xs text-muted-foreground">
                  Compact: {candidate.compactEligibility}
                </div>
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Score</span>
                    <span className="font-semibold">
                      {(candidate.readinessScore * 100).toFixed(0)}%
                    </span>
                  </div>
                  <Progress value={candidate.readinessScore * 100} />
                  <div className="flex gap-1">
                    <StatusChip
                      label="Sanctions"
                      positive={candidate.sanctionsClear}
                    />
                    <StatusChip
                      label="PSV"
                      positive={candidate.psvCurrent}
                    />
                    <StatusChip
                      label="NPDB"
                      positive={candidate.npdbClear}
                    />
                  </div>
                </div>
              </TableCell>
              <TableCell>
                {candidate.topMatch ? (
                  <div className="space-y-1">
                    <div className="font-medium leading-tight">{candidate.topMatch.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {candidate.topMatch.specialty ?? 'Multi-specialty'} ·{' '}
                      {candidate.topMatch.matchScore.toFixed(1)}% match
                    </div>
                    {candidate.topMatch.compactRecommendation && (
                      <CompactChip recommendation={candidate.topMatch.compactRecommendation} />
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No AI match yet.</p>
                )}
              </TableCell>
              <TableCell>
                <KeyFactors factors={candidate.topMatch?.keyFactors ?? []} />
              </TableCell>
              <TableCell>
                <WarningList warnings={buildWarnings(candidate)} />
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => onRequestVerification(candidate)}
                  disabled={requestingId === candidate.clinicianId}
                >
                  {requestingId === candidate.clinicianId ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  Request verification
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="grid gap-4">
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton key={`candidate-skeleton-${index}`} className="h-20 w-full" />
      ))}
    </div>
  );
}

function StatusChip({ label, positive }: { label: string; positive: boolean }) {
  return (
    <Badge
      variant={positive ? 'outline' : 'destructive'}
      className="text-xs"
    >
      {positive ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <ShieldAlert className="mr-1 h-3 w-3" />}
      {label}
    </Badge>
  );
}

function CompactChip({
  recommendation,
}: {
  recommendation: NonNullable<JobMatchSummary['compactRecommendation']>;
}) {
  const variant =
    recommendation.status === 'ready'
      ? 'default'
      : recommendation.status === 'encouraged'
        ? 'secondary'
        : 'destructive';
  return (
    <Badge variant={variant} className="text-xs">
      {recommendation.message}
    </Badge>
  );
}

function KeyFactors({ factors }: { factors: JobMatchSummary['keyFactors'] }) {
  if (!factors?.length) {
    return (
      <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
        This candidate was matched because we still need more telemetry.
      </div>
    );
  }
  return (
    <div className="space-y-2 rounded-lg border bg-muted/30 p-3 text-sm leading-snug">
      <p className="text-xs font-semibold uppercase text-muted-foreground">
        This candidate was matched because…
      </p>
      <ul className="space-y-1">
        {factors.slice(0, 3).map((factor) => (
          <li key={factor.label}>
            <span
              className={
                factor.impact === 'warning'
                  ? 'text-amber-600'
                  : factor.impact === 'positive'
                    ? 'text-emerald-600'
                    : 'text-muted-foreground'
              }
            >
              {factor.label}
            </span>
            <span className="text-muted-foreground"> · {factor.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function WarningList({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) {
    return (
      <div className="inline-flex items-center gap-1 rounded-md border border-emerald-100 bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
        <Shield className="h-3.5 w-3.5" />
        Cleared
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {warnings.map((warning) => (
        <div
          className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800"
          key={warning}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          {warning}
        </div>
      ))}
    </div>
  );
}

function truncateId(id: string) {
  if (id.length <= 10) return id;
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

function buildWarnings(candidate: CandidateRow): string[] {
  const warnings: string[] = [];
  if (!candidate.sanctionsClear) {
    warnings.push('Sanctions review needed');
  }
  if (!candidate.psvCurrent) {
    warnings.push('PSV older than 90 days');
  }
  if (!candidate.npdbClear) {
    warnings.push('NPDB adverse history');
  }
  if (candidate.topMatch?.compactRecommendation?.status === 'missing') {
    warnings.push('No compact leverage for target role');
  }
  return warnings;
}

