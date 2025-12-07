'use client';

import { useMemo, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { Separator } from '@/components/ui/separator';
import { Sparkles, UsersRound, AlertCircle, ShieldCheck, Activity } from 'lucide-react';

type SurgeMember = {
  clinicianId: string;
  readinessScore: number;
  sanctionsClear: boolean;
  psvCurrent: boolean;
  compactEligibility?: string;
};

const DEFAULT_CLINICIANS = ['npi-1886759300', 'npi-1003875342', 'npi-1346657890', 'npi-1884123091'];

const API_BASE = (process.env.NEXT_PUBLIC_PLATFORM_API ?? '').replace(/\/$/, '');

export default function SurgeCreatePage() {
  const [specialty, setSpecialty] = useState('Emergency Medicine');
  const [region, setRegion] = useState('Pacific West');
  const [minimumScore, setMinimumScore] = useState(0.85);
  const [clinicianIds, setClinicianIds] = useState(DEFAULT_CLINICIANS.join('\n'));
  const [submitting, setSubmitting] = useState(false);
  const [members, setMembers] = useState<SurgeMember[]>([]);
  const [meta, setMeta] = useState<{ poolId: string; eligible: number; requested: number } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [usingMock, setUsingMock] = useState(false);

  const parsedClinicians = useMemo(() => parseClinicianIds(clinicianIds), [clinicianIds]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(buildApiUrl('/api/recruiter/surge/create'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          orgId: 'demo-health-system',
          specialty,
          region,
          clinicianIds: parsedClinicians,
          minimumScore,
        }),
      });

      if (!response.ok) {
        throw new Error(`API responded with ${response.status}`);
      }

      const data = await response.json();
      const transformed = (data.members ?? []).map(transformMember);
      setMembers(transformed);
      setMeta({
        poolId: data.poolId,
        eligible: data.eligible ?? transformed.length,
        requested: data.requested ?? parsedClinicians.length,
      });
      setUsingMock(false);
    } catch (err) {
      console.warn('Falling back to mock surge pool', err);
      setMembers(buildMockMembers(parsedClinicians.length));
      setMeta({
        poolId: 'demo-pool',
        eligible: 3,
        requested: parsedClinicians.length,
      });
      setError('API unavailable — showing simulated readiness output.');
      setUsingMock(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container mx-auto max-w-6xl space-y-8 py-8">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Surge Hiring Pools</p>
        <h1 className="text-3xl font-bold">Create Surge Pool</h1>
        <p className="text-muted-foreground max-w-2xl">
          Assemble clinicians by specialty and geography, filtered by readiness score, sanctions
          risk, and PSV freshness. Pools sync to workforce command centers within 60 seconds.
        </p>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>Degraded mode</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="grid gap-8 md:grid-cols-[1fr,400px]">
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
              Pool Configuration
            </CardTitle>
            <CardDescription>Define the specialty, region, and readiness cutoff.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="specialty">Specialty</Label>
                <Input
                  id="specialty"
                  value={specialty}
                  onChange={(event) => setSpecialty(event.target.value)}
                  placeholder="Acute care, telepsychiatry..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="region">Region</Label>
                <Input
                  id="region"
                  value={region}
                  onChange={(event) => setRegion(event.target.value)}
                  placeholder="Gulf Coast, Mid-Atlantic..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="minimumScore" className="flex items-center justify-between">
                  Readiness score threshold
                  <Badge variant="secondary">{minimumScore.toFixed(2)}</Badge>
                </Label>
                <input
                  id="minimumScore"
                  type="range"
                  min={0.5}
                  max={0.95}
                  step={0.01}
                  value={minimumScore}
                  onChange={(event) => setMinimumScore(Number(event.target.value))}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Candidates scoring below the threshold route to the surge HITL queue.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="clinicianIds" className="flex items-center gap-2">
                Clinician IDs
                <Badge variant="outline">{parsedClinicians.length} selected</Badge>
              </Label>
              <Textarea
                id="clinicianIds"
                value={clinicianIds}
                onChange={(event) => setClinicianIds(event.target.value)}
                rows={6}
                placeholder="One NPI or clinician ID per line"
              />
              <p className="text-xs text-muted-foreground">
                Paste NPIs, wallet IDs, or workforce graph handles. Duplicates are removed
                automatically.
              </p>
            </div>

            <Button type="submit" size="lg" disabled={submitting || parsedClinicians.length === 0}>
              {submitting ? 'Generating pool…' : 'Create pool'}
            </Button>
          </CardContent>
        </Card>

        <Card className="space-y-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UsersRound className="h-5 w-5 text-primary" aria-hidden="true" />
              Surge Readiness Preview
            </CardTitle>
            <CardDescription>
              Auto-triaged by sanctions risk, NPDB history, and PSV freshness.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-xs text-muted-foreground uppercase tracking-wide">Eligible</dt>
                <dd className="text-2xl font-semibold">{meta?.eligible ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground uppercase tracking-wide">Requested</dt>
                <dd className="text-2xl font-semibold">{meta?.requested ?? parsedClinicians.length}</dd>
              </div>
            </dl>
            <Separator />
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Readiness combines license freshness, sanctions probability, NPDB history, and
                compact mobility. Candidates failing any guardrail automatically route to HITL
                review.
              </p>
              {usingMock && (
                <Badge variant="outline" className="bg-amber-100 text-amber-700">
                  Demo data
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </form>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
            Candidate roster
          </CardTitle>
          <CardDescription>
            Sorted by readiness score. Sanctions or stale PSV checks are highlighted automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Submit the form above to generate a surge-ready slate.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Clinician</TableHead>
                  <TableHead className="w-32">Score</TableHead>
                  <TableHead>Sanctions</TableHead>
                  <TableHead>PSV</TableHead>
                  <TableHead>Compact</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.clinicianId}>
                    <TableCell className="font-medium">{member.clinicianId}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-base font-semibold">
                        {member.readinessScore.toFixed(2)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {member.sanctionsClear ? (
                        <span className="inline-flex items-center gap-1 text-sm text-green-600">
                          <Activity className="h-4 w-4" aria-hidden="true" /> Clean
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-sm text-red-600">
                          <AlertCircle className="h-4 w-4" aria-hidden="true" /> Review
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{member.psvCurrent ? 'Current' : 'Stale'}</TableCell>
                    <TableCell>{member.compactEligibility ?? '—'}</TableCell>
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

function parseClinicianIds(raw: string): string[] {
  return raw
    .split(/\r?\n|,/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function transformMember(member: Record<string, unknown>): SurgeMember {
  const clinicianId = typeof member.clinicianId === 'string' ? member.clinicianId : 'unknown';
  const readinessScore =
    typeof member.readinessScore === 'number'
      ? member.readinessScore
      : typeof member.score === 'number'
        ? member.score
        : 0;
  const factors =
    (member.factors as Record<string, unknown> | null | undefined) ?? {};
  const sanctions = (factors as { sanctions?: { hasActive?: boolean } }).sanctions;
  const licenseDays = Number(
    (factors as { licenseFreshnessDays?: number }).licenseFreshnessDays ?? 0
  );

  return {
    clinicianId,
    readinessScore,
    sanctionsClear: !(sanctions?.hasActive ?? false),
    psvCurrent: Number.isFinite(licenseDays) ? licenseDays <= 90 : true,
    compactEligibility: (factors as { compactEligibility?: string }).compactEligibility ?? '—',
  };
}

function buildMockMembers(target: number): SurgeMember[] {
  return Array.from({ length: Math.max(3, target) }).map((_, index) => ({
    clinicianId: `mock-${index + 1}`,
    readinessScore: 0.9 - index * 0.03,
    sanctionsClear: index !== 2,
    psvCurrent: index !== 1,
    compactEligibility: index % 2 === 0 ? 'IMLC' : 'None',
  }));
}

function buildApiUrl(path: string): string {
  if (!API_BASE) return path;
  return `${API_BASE}${path}`;
}


