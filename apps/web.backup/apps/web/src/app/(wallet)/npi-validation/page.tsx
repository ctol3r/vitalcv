'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Anchor,
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  History,
  Loader2,
  Network,
  RefreshCcw,
  Shield,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';

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
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE ??
  'http://localhost:4000';
const CLINICIAN_ID = process.env.NEXT_PUBLIC_WALLET_CLINICIAN_ID ?? 'cln_demo';

type IdentityField =
  | 'name'
  | 'address'
  | 'taxonomy'
  | 'enrollmentState';

interface IdentityConsistencyField {
  field: IdentityField;
  expected: string | null;
  observed: string | null;
  matchScore: number;
  status: 'match' | 'review' | 'mismatch';
  drift?: number;
}

interface IdentityConsistency {
  summaryScore: number;
  fields: IdentityConsistencyField[];
  notes: string[];
  mismatchedFields: IdentityField[];
}

interface SpecialtyMismatch {
  source: 'taxonomy' | 'license' | 'board';
  expected: string | null;
  observed: string | null;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  details?: string;
}

interface SpecialtyReport {
  taxonomy: {
    nppes: string | null;
    license: string | null;
    board: string | null;
  };
  mismatches: SpecialtyMismatch[];
  alignmentScore: number;
}

interface FraudFlag {
  type: 'duplicateNpi' | 'stolenNpi' | 'dobProxyMismatch';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
}

interface FraudReport {
  flags: FraudFlag[];
  duplicateCount: number;
  riskScore: number;
  summary: string;
}

interface NpdbReport {
  matchedEvents: number;
  unmatchedEvents: number;
  coverageRatio: number;
  lastQueriedAt?: string | null;
  issues: string[];
}

interface DisambiguationCandidate {
  clinicianId: string;
  clinicianName?: string | null;
  did?: string | null;
  confidence: number;
  reason?: string;
}

interface DisambiguationReport {
  status: 'unique' | 'collision' | 'undetermined';
  canonicalClinicianId: string;
  canonicalDid?: string | null;
  candidates: DisambiguationCandidate[];
}

interface HistoryDiff {
  field: string;
  before?: unknown;
  after?: unknown;
  delta?: number;
  notes?: string;
}

interface NpiHistoryEntry {
  id: string;
  clinicianId: string;
  npi: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  summary: string;
  detectedAt: string;
  diffs: HistoryDiff[];
  source: string;
  reason?: string;
}

interface AnchorSummary {
  id: string;
  txHash: string;
  network: string;
  timestamp: string;
}

interface NpiValidationResponse {
  clinicianId: string;
  npi: string;
  score: number;
  status: 'pass' | 'review' | 'fail';
  summary: string;
  identityConsistency: IdentityConsistency;
  specialty: SpecialtyReport;
  fraud: FraudReport;
  npdbCorrelation: NpdbReport;
  disambiguation: DisambiguationReport;
  generatedAt: string;
  updatedAt: string;
  history: NpiHistoryEntry[];
  anchor: AnchorSummary | null;
}

export default function NpiValidationPage() {
  const [validation, setValidation] = useState<NpiValidationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadValidation();
  }, []);

  async function loadValidation(forceRefresh = false) {
    setLoading((prev) => prev && !forceRefresh);
    setError(null);
    try {
      const payload = await fetchValidation(forceRefresh);
      setValidation(payload);
    } catch (err) {
      console.error('[wallet][npi-validation] load failed', err);
      setError(err instanceof Error ? err.message : 'Failed to load NPI validation.');
      setValidation(buildFallbackValidation());
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadValidation(true);
    setRefreshing(false);
  }

  const scorePercent = useMemo(
    () => (validation ? Math.round(validation.score * 100) : 0),
    [validation],
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="space-y-2">
        <Badge variant="secondary">Wallet · NPI Validation</Badge>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold leading-tight">Clinician NPI validation</h1>
            <p className="text-muted-foreground">
              Cross-check NPPES identity, taxonomy, enrollments, NPDB correlation, and fraud telemetry.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => loadValidation(false)} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
              Reload
            </Button>
            <Button onClick={handleRefresh} disabled={refreshing}>
              {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
              Re-run validation
            </Button>
          </div>
        </div>
        {error && <p className="text-sm text-rose-500">{error}</p>}
      </header>

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : validation ? (
        <>
          <ScoreSummaryCard validation={validation} scorePercent={scorePercent} />

          <div className="grid gap-4 lg:grid-cols-3">
            <IdentityCard identity={validation.identityConsistency} />
            <SpecialtyCard specialty={validation.specialty} />
            <FraudCard fraud={validation.fraud} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <NpdbCard npdb={validation.npdbCorrelation} />
            <DisambiguationCard disambiguation={validation.disambiguation} />
          </div>

          <HistoryCard entries={validation.history} />
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No validation available</CardTitle>
            <CardDescription>Run the validator to hydrate this panel.</CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}

function ScoreSummaryCard({
  validation,
  scorePercent,
}: {
  validation: NpiValidationResponse;
  scorePercent: number;
}) {
  const previousAnchoredAt = validation.anchor ? new Date(validation.anchor.timestamp).toLocaleString() : null;
  const statusTone =
    validation.status === 'pass'
      ? 'text-emerald-600'
      : validation.status === 'review'
        ? 'text-amber-600'
        : 'text-rose-600';

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle className="flex items-center gap-3 text-2xl">
            <BadgeCheck className="h-5 w-5 text-primary" />
            Score {scorePercent}%
          </CardTitle>
          <CardDescription>{validation.summary}</CardDescription>
        </div>
        <Badge variant="outline" className={cn('text-base capitalize', statusTone)}>
          {validation.status}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={validation.score * 100} className="h-3" />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border p-4">
            <p className="text-xs font-semibold uppercase text-muted-foreground">NPI</p>
            <p className="text-lg font-mono">{validation.npi}</p>
            <p className="text-xs text-muted-foreground">Updated {new Date(validation.updatedAt).toLocaleString()}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Anchor</p>
            {validation.anchor ? (
              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-1 font-mono text-xs">
                  <Anchor className="h-4 w-4 text-primary" />
                  {validation.anchor.txHash.slice(0, 12)}…
                </div>
                <p className="text-muted-foreground">{validation.anchor.network}</p>
                <p className="text-xs text-muted-foreground">{previousAnchoredAt}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Not anchored yet.</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function IdentityCard({ identity }: { identity: IdentityConsistency }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Identity consistency
        </CardTitle>
        <CardDescription>{(identity.summaryScore * 100).toFixed(1)}% alignment with NPPES</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {identity.fields.map((field) => (
          <div key={field.field} className="rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium capitalize">{field.field.replace(/([A-Z])/g, ' $1')}</p>
              <Badge variant={badgeVariant(field.status)}>{field.status}</Badge>
            </div>
            <div className="mt-2">
              <Progress value={field.matchScore * 100} className="h-2" />
              <p className="mt-1 text-xs text-muted-foreground">
                Registry: {field.expected ?? 'unknown'} · Wallet: {field.observed ?? 'unknown'}
              </p>
            </div>
          </div>
        ))}
        <div className="rounded-lg border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
          {identity.notes.map((note) => (
            <p key={note}>{note}</p>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SpecialtyCard({ specialty }: { specialty: SpecialtyReport }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Network className="h-4 w-4" />
          Specialty alignment
        </CardTitle>
        <CardDescription>
          {(specialty.alignmentScore * 100).toFixed(1)}% match between taxonomy, board, and license
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border p-3 text-xs">
          <p className="font-semibold uppercase text-muted-foreground">Source comparison</p>
          <div className="mt-2 grid gap-2">
            <ComparisonRow label="NPPES" value={specialty.taxonomy.nppes} />
            <ComparisonRow label="License" value={specialty.taxonomy.license} />
            <ComparisonRow label="Board" value={specialty.taxonomy.board} />
          </div>
        </div>
        {specialty.mismatches.length ? (
          specialty.mismatches.map((mismatch) => (
            <div key={`${mismatch.source}-${mismatch.observed}`} className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs">
              <p className="font-semibold capitalize">{mismatch.source} mismatch</p>
              <p>Expected: {mismatch.expected || '—'}</p>
              <p>Observed: {mismatch.observed || '—'}</p>
              {mismatch.details && <p className="text-muted-foreground">{mismatch.details}</p>}
            </div>
          ))
        ) : (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 text-sm text-emerald-700">
            <ShieldCheck className="mr-2 inline h-4 w-4" />
            All specialty sources align.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FraudCard({ fraud }: { fraud: FraudReport }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-rose-500" />
          Fraud telemetry
        </CardTitle>
        <CardDescription>{fraud.summary}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border p-3">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Risk level</p>
          <Progress value={(1 - fraud.riskScore) * 100} className="mt-2 h-2" />
          <p className="mt-1 text-xs text-muted-foreground">
            {(fraud.riskScore * 100).toFixed(1)}% fraud likelihood
          </p>
        </div>
        {fraud.flags.length ? (
          fraud.flags.map((flag) => (
            <div key={`${flag.type}-${flag.message}`} className="rounded-lg border border-rose-200 bg-rose-50/70 p-3 text-sm">
              <p className="font-semibold capitalize">{flag.type.replace(/([A-Z])/g, ' $1')}</p>
              <p className="text-muted-foreground">{flag.message}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No active fraud flags.</p>
        )}
      </CardContent>
    </Card>
  );
}

function NpdbCard({ npdb }: { npdb: NpdbReport }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-4 w-4" />
          NPDB correlation
        </CardTitle>
        <CardDescription>
          {(npdb.coverageRatio * 100).toFixed(1)}% of NPDB events linked to clinician NPI
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between text-sm">
          <span>Matched events</span>
          <span className="font-semibold">{npdb.matchedEvents}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span>Unmatched events</span>
          <span className="font-semibold">{npdb.unmatchedEvents}</span>
        </div>
        {npdb.issues.length ? (
          npdb.issues.map((issue) => (
            <div key={issue} className="rounded border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
              {issue}
            </div>
          ))
        ) : (
          <p className="text-xs text-muted-foreground">No outstanding NPDB issues.</p>
        )}
      </CardContent>
    </Card>
  );
}

function DisambiguationCard({ disambiguation }: { disambiguation: DisambiguationReport }) {
  const tone =
    disambiguation.status === 'unique'
      ? 'text-emerald-600'
      : disambiguation.status === 'collision'
        ? 'text-rose-600'
        : 'text-amber-600';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Network className="h-4 w-4" />
          Multi-NPI disambiguation
        </CardTitle>
        <CardDescription className={cn('capitalize', tone)}>
          {disambiguation.status === 'unique'
            ? 'Single canonical clinician'
            : disambiguation.status === 'collision'
              ? 'Collision detected'
              : 'Needs review'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {disambiguation.candidates.map((candidate) => (
          <div key={candidate.clinicianId} className="rounded border p-3 text-sm">
            <div className="flex items-center justify-between">
              <p className="font-semibold">{candidate.clinicianName ?? candidate.clinicianId}</p>
              <Badge variant="outline">{Math.round(candidate.confidence * 100)}%</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{candidate.reason ?? '—'}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function HistoryCard({ entries }: { entries: NpiHistoryEntry[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-4 w-4" />
          Change history
        </CardTitle>
        <CardDescription>Tracking NPPES drift and recomputation events.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {entries.length ? (
          entries.map((entry) => (
            <div key={entry.id} className="rounded-lg border p-3 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{entry.summary}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(entry.detectedAt).toLocaleString()} · {entry.source}
                  </p>
                </div>
                <Badge variant={severityVariant(entry.severity)}>{entry.severity}</Badge>
              </div>
              {entry.diffs.length ? (
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {entry.diffs.slice(0, 3).map((diff) => (
                    <li key={`${entry.id}-${diff.field}`}>
                      {diff.field}: {diff.notes ?? `Δ ${(diff.delta ?? 0).toFixed(3)}`}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No drift recorded yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

function ComparisonRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value || '—'}</span>
    </div>
  );
}

function badgeVariant(status: IdentityConsistencyField['status']) {
  switch (status) {
    case 'match':
      return 'secondary';
    case 'review':
      return 'outline';
    case 'mismatch':
    default:
      return 'destructive';
  }
}

function severityVariant(severity: NpiHistoryEntry['severity']) {
  switch (severity) {
    case 'CRITICAL':
    case 'HIGH':
      return 'destructive';
    case 'MEDIUM':
      return 'outline';
    case 'LOW':
    default:
      return 'secondary';
  }
}

async function fetchValidation(refresh = false): Promise<NpiValidationResponse> {
  const endpoint = new URL(
    `${API_BASE.replace(/\/$/, '')}/api/npi/validation/${encodeURIComponent(CLINICIAN_ID)}`,
  );
  endpoint.searchParams.set('history', '8');
  if (refresh) {
    endpoint.searchParams.set('refresh', 'true');
  }

  const response = await fetch(endpoint.toString(), { cache: 'no-store' });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.message ?? 'Unable to load validation.');
  }
  return payload as NpiValidationResponse;
}

function buildFallbackValidation(): NpiValidationResponse {
  return {
    clinicianId: CLINICIAN_ID,
    npi: '9999999999',
    score: 0.82,
    status: 'review',
    summary: 'Synthetic validation snapshot',
    identityConsistency: {
      summaryScore: 0.88,
      fields: [
        { field: 'name', expected: 'Demo Clinician', observed: 'Demo Clinician', matchScore: 0.96, status: 'match' },
        { field: 'address', expected: 'WA', observed: 'WA', matchScore: 0.92, status: 'match' },
        { field: 'taxonomy', expected: '207R00000X', observed: 'Internal Medicine', matchScore: 0.74, status: 'review' },
        { field: 'enrollmentState', expected: 'WA', observed: 'CA', matchScore: 0.4, status: 'mismatch' },
      ],
      notes: ['Fallback data — live validator offline.'],
      mismatchedFields: ['enrollmentState'],
    },
    specialty: {
      taxonomy: { nppes: '207R00000X', license: 'Internal Medicine', board: 'Internal Medicine' },
      mismatches: [],
      alignmentScore: 0.78,
    },
    fraud: {
      flags: [{ type: 'duplicateNpi', severity: 'MEDIUM', message: 'Synthetic duplicate detected.' }],
      duplicateCount: 2,
      riskScore: 0.35,
      summary: '1 fraud flag raised',
    },
    npdbCorrelation: {
      matchedEvents: 0,
      unmatchedEvents: 0,
      coverageRatio: 1,
      lastQueriedAt: null,
      issues: [],
    },
    disambiguation: {
      status: 'undetermined',
      canonicalClinicianId: CLINICIAN_ID,
      canonicalDid: null,
      candidates: [
        { clinicianId: CLINICIAN_ID, clinicianName: 'Demo Clinician', confidence: 0.9, reason: 'Fallback data' },
      ],
    },
    generatedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    history: [],
    anchor: null,
  };
}









