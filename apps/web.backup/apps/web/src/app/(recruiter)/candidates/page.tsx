'use client';

import { useEffect, useState } from 'react';
import { RecruiterCandidateCard, type CandidateCardData } from '@/components/recruiter/RecruiterCandidateCard';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Users2, CheckCircle2, AlertTriangle, RefreshCw, Grid3x3, Table as TableIcon } from 'lucide-react';

type Candidate = {
  clinicianId: string;
  readinessScore: number;
  sanctionsClear: boolean;
  psvCurrent: boolean;
  npdbClear: boolean;
  compactEligibility?: string;
  psvFreshWithin48h: boolean;
  psvFreshnessHours?: number | null;
  updatedAt?: string;
};

const API_BASE = (process.env.NEXT_PUBLIC_PLATFORM_API ?? '').replace(/\/$/, '');

export default function CandidatesPage() {
  const [readyOnly, setReadyOnly] = useState(true);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingMock, setUsingMock] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('cards');

  useEffect(() => {
    void loadCandidates();
  }, [readyOnly]);

  async function loadCandidates() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(buildApiUrl(`/api/recruiter/candidates?ready=${readyOnly}`), {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        throw new Error(`Request failed with ${response.status}`);
      }
      const data = await response.json();
      const rows = (data.candidates ?? []).map(transformCandidate);
      setCandidates(rows);
      setUsingMock(false);
    } catch (err) {
      console.warn('Failed to load recruiter candidates, using mock data', err);
      setCandidates(buildMockCandidates());
      setError('Candidate API unavailable — showing mock surge slate instead.');
      setUsingMock(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto max-w-6xl space-y-6 py-8">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Recruiter Portal</p>
        <h1 className="text-3xl font-bold">48-Hour Ready Candidates</h1>
        <p className="text-muted-foreground max-w-3xl">
          Blend readiness scoring with sanctions, NPDB, and PSV signals to instantly surface
          surge-ready clinicians. Toggle the readiness gate to widen or tighten the pool, and look
          for the <span className="font-semibold text-emerald-600">Ready in 48 Hours</span> badge
          to identify talent that can start within two days.
        </p>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>Heads up</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users2 className="h-5 w-5 text-primary" aria-hidden="true" />
              Candidate roster
            </CardTitle>
            <CardDescription>
              {readyOnly
                ? 'Only readiness-verified clinicians are shown.'
                : 'All tracked clinicians.'}
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-3 py-2">
              <Label htmlFor="readyOnly" className="text-sm font-medium">
                Readiness filter
              </Label>
              <Switch id="readyOnly" checked={readyOnly} onCheckedChange={setReadyOnly} />
            </div>
            <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1">
              <Button
                variant={viewMode === 'cards' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('cards')}
              >
                <Grid3x3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('table')}
              >
                <TableIcon className="h-4 w-4" />
              </Button>
            </div>
            <Button variant="ghost" size="sm" onClick={() => loadCandidates()} disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {usingMock && (
            <Badge variant="outline" className="bg-amber-100 text-amber-700">
              Demo data
            </Badge>
          )}
          {loading ? (
            viewMode === 'cards' ? <LoadingCards /> : <LoadingTable />
          ) : candidates.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No clinicians match the current filter.
            </div>
          ) : viewMode === 'cards' ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {candidates.map((candidate) => {
                const cardData: CandidateCardData = {
                  candidateId: candidate.clinicianId,
                  name: `Clinician ${candidate.clinicianId}`,
                  trustScore: Math.round(candidate.readinessScore * 100),
                  lastVerifiedAt: candidate.updatedAt,
                  credentials: {
                    licenses: ['MD', 'DEA'],
                    certifications: [],
                    boardStatus: candidate.sanctionsClear && candidate.npdbClear ? 'active' : 'pending',
                  },
                  roleMatch: {
                    score: Math.round(candidate.readinessScore * 100),
                    level: candidate.readinessScore >= 0.9 ? 'perfect' : candidate.readinessScore >= 0.8 ? 'strong' : 'compatible',
                  },
                  chainStatus: {
                    anchored: candidate.psvCurrent,
                  },
                };
                return <RecruiterCandidateCard key={candidate.clinicianId} candidate={cardData} />;
              })}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Clinician</TableHead>
                  <TableHead className="w-32">Readiness</TableHead>
                  <TableHead>Sanctions</TableHead>
                  <TableHead>NPDB</TableHead>
                  <TableHead>PSV Status</TableHead>
                  <TableHead>PSV Freshness</TableHead>
                  <TableHead>Compact</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidates.map((candidate) => (
                  <TableRow key={candidate.clinicianId}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span>{candidate.clinicianId}</span>
                          {isReadyIn48(candidate) && (
                            <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
                              Ready in 48h
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {candidate.updatedAt
                            ? `Signals updated ${new Date(candidate.updatedAt).toLocaleString()}`
                            : 'Signal freshness unknown'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={candidate.readinessScore >= 0.9 ? 'default' : 'secondary'}
                        className="text-base font-semibold"
                      >
                        {candidate.readinessScore.toFixed(2)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {candidate.sanctionsClear ? (
                        <span className="inline-flex items-center gap-1 text-green-600">
                          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                          Clear
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-600">
                          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                          Review
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{candidate.npdbClear ? 'Clear' : 'Actioned'}</TableCell>
                    <TableCell>{candidate.psvCurrent ? 'Current' : 'Stale'}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span>{candidate.psvFreshWithin48h ? 'Fresh < 48h' : 'Needs refresh'}</span>
                        {typeof candidate.psvFreshnessHours === 'number' && (
                          <span className="text-xs text-muted-foreground">
                            {candidate.psvFreshnessHours.toFixed(1)} hours old
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{candidate.compactEligibility ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function transformCandidate(candidate: Record<string, unknown>): Candidate {
  const clinicianId =
    typeof candidate.clinicianId === 'string' ? candidate.clinicianId : 'unknown';
  const readinessScore =
    typeof candidate.readinessScore === 'number'
      ? candidate.readinessScore
      : typeof candidate.score === 'number'
        ? candidate.score
        : 0;

  return {
    clinicianId,
    readinessScore,
    sanctionsClear: Boolean(candidate.sanctionsClear ?? true),
    psvCurrent: Boolean(candidate.psvCurrent ?? true),
    npdbClear: Boolean(candidate.npdbClear ?? true),
    compactEligibility:
      typeof candidate.compactEligibility === 'string' ? candidate.compactEligibility : undefined,
    psvFreshWithin48h: Boolean(candidate.psvFreshWithin48h ?? false),
    psvFreshnessHours:
      typeof candidate.psvFreshnessHours === 'number' ? candidate.psvFreshnessHours : undefined,
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : undefined,
  };
}

function buildMockCandidates(): Candidate[] {
  return [
    {
      clinicianId: 'mock-npi-7788',
      readinessScore: 0.92,
      sanctionsClear: true,
      psvCurrent: true,
      npdbClear: true,
      compactEligibility: 'IMLC',
      psvFreshWithin48h: true,
      psvFreshnessHours: 6,
    },
    {
      clinicianId: 'mock-npi-9922',
      readinessScore: 0.88,
      sanctionsClear: true,
      psvCurrent: false,
      npdbClear: true,
      compactEligibility: 'None',
      psvFreshWithin48h: false,
      psvFreshnessHours: 120,
    },
    {
      clinicianId: 'mock-npi-4411',
      readinessScore: 0.81,
      sanctionsClear: false,
      psvCurrent: true,
      npdbClear: true,
      compactEligibility: 'PSYPACT',
      psvFreshWithin48h: true,
      psvFreshnessHours: 24,
    },
  ];
}

function buildApiUrl(path: string): string {
  if (!API_BASE) return path;
  return `${API_BASE}${path}`;
}

function LoadingTable() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={`loading-${index}`} className="grid grid-cols-7 gap-4">
          <Skeleton className="h-6" />
          <Skeleton className="h-6" />
          <Skeleton className="h-6" />
          <Skeleton className="h-6" />
          <Skeleton className="h-6" />
          <Skeleton className="h-6" />
          <Skeleton className="h-6" />
        </div>
      ))}
    </div>
  );
}

function isReadyIn48(candidate: Candidate): boolean {
  return (
    candidate.readinessScore >= 0.8 &&
    candidate.sanctionsClear &&
    candidate.npdbClear &&
    candidate.psvFreshWithin48h
  );
}

function LoadingCards() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={`loading-card-${i}`} className="space-y-3">
          <Skeleton className="h-48" />
        </div>
      ))}
    </div>
  );
}


