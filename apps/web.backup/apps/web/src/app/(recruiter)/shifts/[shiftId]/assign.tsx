'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, CheckCircle2, ClipboardCheck } from 'lucide-react';

const API_BASE = (process.env.NEXT_PUBLIC_PLATFORM_API ?? '').replace(/\/$/, '');

interface ClinicianEligibility {
  clinicianId: string;
  clinicianName?: string | null;
  readinessScore: number;
  licenseStates: {
    covered: string[];
    missing: string[];
    expiresSoon: boolean;
  };
  privilegeSummary: {
    satisfied: string[];
    missing: string[];
  };
  compactSummary: {
    eligible: string[];
    missing: string[];
  };
  eligible: boolean;
  privilegeReasons: string[];
  missing?: {
    licenses: string[];
    privileges: string[];
    compacts: string[];
  };
}

interface RecommendationResponse {
  shiftId: string;
  requirement: {
    role?: string | null;
    start?: string;
    end?: string;
    licenseStates: string[];
    privilegeCodes: string[];
    compactTypes: string[];
  };
  readinessThreshold: number;
  clinicians: ClinicianEligibility[];
  nearMisses: ClinicianEligibility[];
  missingItems: {
    licenses: Array<{ item: string; count: number }>;
    privileges: Array<{ item: string; count: number }>;
    compacts: Array<{ item: string; count: number }>;
  };
  privilegeReasons: string[];
  generatedAt: string;
}

export default function ShiftAssignmentPage({ params }: { params: { shiftId: string } }) {
  const [data, setData] = useState<RecommendationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadRecommendations() {
      setLoading(true);
      setError(null);
      try {
        const url = buildApiUrl(`/api/scheduling/recommend?shiftId=${params.shiftId}`);
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Request failed with ${response.status}`);
        }
        const payload = (await response.json()) as RecommendationResponse;
        if (!cancelled) {
          setData(payload);
        }
      } catch (err) {
        console.warn('Failed to load scheduling recommendations, using mock data', err);
        if (!cancelled) {
          setError('Scheduling service unavailable. Showing mock recommendation slate.');
          setData(buildMockResponse(params.shiftId));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void loadRecommendations();
    return () => {
      cancelled = true;
    };
  }, [params.shiftId]);

  const requirement = data?.requirement;
  const missingItems = useMemo(
    () => data?.missingItems ?? { licenses: [], privileges: [], compacts: [] },
    [data],
  );

  return (
    <div className="container mx-auto max-w-6xl space-y-6 py-8">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Recruiter Portal</p>
        <h1 className="text-3xl font-bold">Shift Assignment for {params.shiftId}</h1>
        <p className="text-muted-foreground max-w-3xl">
          Credential-aware scheduling blends readiness scoring with licenses, privilege packs, and
          compacts. Review eligible clinicians, inspect blockers, and dispatch verification
          requests.
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
        <CardHeader className="flex flex-wrap justify-between gap-4">
          <div>
            <CardTitle>Shift Summary</CardTitle>
            <CardDescription>Role-aligned requirements pulled from workforce demand.</CardDescription>
          </div>
          {requirement && (
            <div className="space-y-1 text-sm">
              <div>
                <span className="font-medium">Role:</span> {requirement.role ?? 'Not specified'}
              </div>
              <div>
                <span className="font-medium">Licenses:</span>{' '}
                {requirement.licenseStates.length > 0
                  ? requirement.licenseStates.join(', ')
                  : 'None'}
              </div>
              <div>
                <span className="font-medium">Privileges:</span>{' '}
                {requirement.privilegeCodes.length > 0
                  ? requirement.privilegeCodes.join(', ')
                  : 'None'}
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : data ? (
            <div className="grid gap-4 md:grid-cols-3">
              <MetricTile
                label="Eligible Clinicians"
                value={data.clinicians.length}
                hint={`Readiness ≥ ${data.readinessThreshold.toFixed(2)}`}
              />
              <MetricTile
                label="Near Misses"
                value={data.nearMisses.length}
                hint="Missing 1+ gate"
              />
              <MetricTile
                label="Generated"
                value={new Date(data.generatedAt).toLocaleTimeString()}
                hint="UTC"
              />
            </div>
          ) : (
            <div className="text-muted-foreground text-sm">No data available.</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Eligible Clinicians</CardTitle>
          <CardDescription>Ranked by readiness and credential coverage.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <TableSkeleton rows={3} />
          ) : data && data.clinicians.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Clinician</TableHead>
                  <TableHead className="w-24">Readiness</TableHead>
                  <TableHead>Licenses</TableHead>
                  <TableHead>Privileges</TableHead>
                  <TableHead>Compacts</TableHead>
                  <TableHead className="w-36 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.clinicians.map((clinician) => (
                  <TableRow key={clinician.clinicianId}>
                    <TableCell>
                      <div className="font-medium">
                        {clinician.clinicianName ?? clinician.clinicianId}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Licenses: {clinician.licenseStates.covered.join(', ') || '—'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="text-base font-semibold border-green-500 text-green-700"
                      >
                        {clinician.readinessScore.toFixed(2)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <ChecklistBadge
                        ok={clinician.licenseStates.missing.length === 0}
                        label={
                          clinician.licenseStates.missing.length
                            ? `Missing ${clinician.licenseStates.missing.join(', ')}`
                            : 'Aligned'
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <ChecklistBadge
                        ok={clinician.privilegeSummary.missing.length === 0}
                        label={
                          clinician.privilegeSummary.missing.length
                            ? `Missing ${clinician.privilegeSummary.missing.join(', ')}`
                            : 'Meets pack'
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <ChecklistBadge
                        ok={clinician.compactSummary.missing.length === 0}
                        label={
                          clinician.compactSummary.missing.length
                            ? `Missing ${clinician.compactSummary.missing.join(', ')}`
                            : 'Eligible'
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleRequestVerification(clinician.clinicianId)}
                      >
                        <ClipboardCheck className="mr-2 h-4 w-4" aria-hidden="true" />
                        Request Verification
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No eligible clinicians matched this shift.
            </div>
          )}
        </CardContent>
      </Card>

      {data && data.nearMisses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Near Misses</CardTitle>
            <CardDescription>Clinicians missing a single gating item.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {data.nearMisses.map((miss) => (
              <Card key={`miss-${miss.clinicianId}`} className="border-muted-foreground/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{miss.clinicianName ?? miss.clinicianId}</CardTitle>
                  <CardDescription>Readiness {miss.readinessScore.toFixed(2)}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                    {(miss.missing?.licenses?.length ?? 0) > 0 && (
                    <div>
                        <span className="font-medium">Licenses:</span>{' '}
                        {miss.missing?.licenses?.join(', ')}
                    </div>
                  )}
                    {(miss.missing?.privileges?.length ?? 0) > 0 && (
                    <div>
                        <span className="font-medium">Privileges:</span>{' '}
                        {miss.missing?.privileges?.join(', ')}
                    </div>
                  )}
                    {(miss.missing?.compacts?.length ?? 0) > 0 && (
                    <div>
                        <span className="font-medium">Compacts:</span>{' '}
                        {miss.missing?.compacts?.join(', ')}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      )}

      {data && (
        <Card>
          <CardHeader>
            <CardTitle>Missing Items</CardTitle>
            <CardDescription>Aggregate blockers across all candidates.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <MissingList label="Licenses" items={missingItems.licenses} emptyLabel="Fully covered" />
            <MissingList
              label="Privileges"
              items={missingItems.privileges}
              emptyLabel="All satisfied"
            />
            <MissingList label="Compacts" items={missingItems.compacts} emptyLabel="No gaps" />
          </CardContent>
        </Card>
      )}

      {data && data.privilegeReasons.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Privilege Reasons</CardTitle>
            <CardDescription>Top drivers explaining eligibility decisions.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 text-sm space-y-1">
              {data.privilegeReasons.map((reason, idx) => (
                <li key={`reason-${idx}`}>{reason}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MetricTile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-3xl font-bold">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ChecklistBadge({ ok, label }: { ok: boolean; label: string }) {
  return ok ? (
    <Badge variant="outline" className="gap-1 border-green-500 text-green-700">
      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
      {label}
    </Badge>
  ) : (
    <Badge variant="destructive" className="gap-1">
      <AlertTriangle className="h-4 w-4" aria-hidden="true" />
      {label}
    </Badge>
  );
}

function MissingList({
  label,
  items,
  emptyLabel,
}: {
  label: string;
  items: Array<{ item: string; count: number }>;
  emptyLabel: string;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold">{label}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm">
          {items.map((entry) => (
            <li key={`${label}-${entry.item}`} className="flex justify-between">
              <span>{entry.item}</span>
              <span className="text-muted-foreground">×{entry.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TableSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, idx) => (
        <Skeleton key={`sk-${idx}`} className="h-12 w-full" />
      ))}
    </div>
  );
}

function handleRequestVerification(clinicianId: string) {
  console.info('Verification requested for clinician', clinicianId);
}

function buildApiUrl(path: string): string {
  if (!API_BASE) return path;
  return `${API_BASE}${path}`;
}

function buildMockResponse(shiftId: string): RecommendationResponse {
  return {
    shiftId,
    generatedAt: new Date().toISOString(),
    readinessThreshold: 0.8,
    requirement: {
      role: 'Cardiology Telehealth',
      start: new Date().toISOString(),
      end: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
      licenseStates: ['NY', 'NJ'],
      privilegeCodes: ['CARDIAC_CATH', 'STRUCTURAL_HEART'],
      compactTypes: ['IMLC'],
    },
    clinicians: [
      {
        clinicianId: 'mock-clinician-1',
        clinicianName: 'Dr. Mocked Ready',
        readinessScore: 0.92,
        licenseStates: { covered: ['NY', 'NJ'], missing: [], expiresSoon: false },
        privilegeSummary: { satisfied: ['CARDIAC_CATH'], missing: [] },
        compactSummary: { eligible: ['IMLC'], missing: [] },
        eligible: true,
        privilegeReasons: ['Meets pack baseline'],
      },
    ],
    nearMisses: [
      {
        clinicianId: 'mock-clinician-2',
        clinicianName: 'Dr. Almost There',
        readinessScore: 0.81,
        licenseStates: { covered: ['NY'], missing: ['NJ'], expiresSoon: false },
        privilegeSummary: { satisfied: ['CARDIAC_CATH'], missing: ['STRUCTURAL_HEART'] },
        compactSummary: { eligible: [], missing: ['IMLC'] },
        eligible: false,
        privilegeReasons: ['Missing STRUCTURAL_HEART'],
      },
    ],
    missingItems: {
      licenses: [
        { item: 'NJ', count: 1 },
      ],
      privileges: [{ item: 'STRUCTURAL_HEART', count: 1 }],
      compacts: [{ item: 'IMLC', count: 1 }],
    },
    privilegeReasons: ['Missing STRUCTURAL_HEART', 'IMLC compact required'],
  };
}

