'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Globe,
  Map as MapIcon,
  RefreshCw,
  ShieldCheck,
  Target,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type CompactStatus = 'eligible' | 'review' | 'blocked';

interface CompactEntry {
  compact: string;
  status: CompactStatus;
  authorizedStates: string[];
  notes: string;
  metadata: { coverage: number };
}

interface ReciprocityPathway {
  id: string;
  origin: string;
  destination: string;
  label: string;
  status: 'ready' | 'partial' | 'research';
  summary: string;
  processingTimeDays: number;
  metadata: { specialtyFocus: string };
}

interface WaiverProgram {
  id: string;
  state: string;
  name: string;
  trigger: string;
  windowDays: number;
  eligible: boolean;
  reason: string;
}

interface MobilityScore {
  total: number;
  version: string;
  components: {
    licenseBreadth: { value: number; contribution: number };
    compacts: { value: number; contribution: number };
    globalEquivalency: { value: number; contribution: number };
  };
}

interface PassportPdf {
  fileName: string;
  dataUri: string;
  digest: string;
  generatedAt: string;
}

interface PassportMetrics {
  licenseBreadth: number;
  compactCount: number;
  reciprocityReady: number;
}

interface AnchorSummary {
  txHash: string;
  merkleRoot: string;
  network: string;
  timestamp: string;
}

interface MobilityPassportResponse {
  passportId: string;
  clinicianId: string;
  updatedAt: string;
  generatedAt: string;
  statesEligible: string[];
  countries: string[];
  mobilityScore: MobilityScore;
  compacts: CompactEntry[];
  reciprocityPaths: ReciprocityPathway[];
  waiverEligibility: { status: string; programs: WaiverProgram[] };
  anomalies: Array<{ code: string; description: string; severity: string; affected: string[]; recommendation?: string }>;
  metrics: PassportMetrics;
  pdf: PassportPdf;
  anchor: AnchorSummary | null;
  snapshotHash: string;
}

const API_BASE = (process.env.NEXT_PUBLIC_PLATFORM_API ?? '').replace(/\/$/, '');
const DEFAULT_CLINICIAN_ID =
  process.env.NEXT_PUBLIC_WALLET_CLINICIAN_ID ?? process.env.NEXT_PUBLIC_DEFAULT_CLINICIAN_ID ?? 'wallet-demo-clinician';

export default function WalletMobilityPassportPage() {
  const [clinicianId, setClinicianId] = useState(DEFAULT_CLINICIAN_ID);
  const [passport, setPassport] = useState<MobilityPassportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildApiUrl = (path: string) => {
    if (!API_BASE) return path;
    return `${API_BASE}${path}`;
  };

  const fetchPassport = useCallback(
    async (refresh = false) => {
      setLoading(true);
      setError(null);
      try {
        const endpoint = refresh
          ? `/api/mobility/passport/${clinicianId}/refresh`
          : `/api/mobility/passport/${clinicianId}`;
        const response = await fetch(buildApiUrl(endpoint), {
          method: refresh ? 'POST' : 'GET',
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.message || 'Unable to load mobility passport');
        }
        const data = (await response.json()) as MobilityPassportResponse;
        setPassport(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unexpected error');
        setPassport(null);
      } finally {
        setLoading(false);
      }
    },
    [clinicianId],
  );

  useEffect(() => {
    void fetchPassport(false);
  }, [fetchPassport]);

  const handleDownload = () => {
    if (!passport?.pdf?.dataUri) return;
    const link = document.createElement('a');
    link.href = passport.pdf.dataUri;
    link.download = passport.pdf.fileName;
    link.click();
  };

  const severityColor = (status: CompactStatus) => {
    switch (status) {
      case 'eligible':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'review':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-red-50 text-red-700 border-red-200';
    }
  };

  const anomalyCount = passport?.anomalies?.length ?? 0;
  const readyPrograms = passport?.waiverEligibility.programs.filter((program) => program.eligible) ?? [];

  const scoreComponents = useMemo(() => {
    if (!passport) return [];
    return [
      {
        label: 'License breadth',
        value: passport.mobilityScore.components.licenseBreadth.value ?? passport.metrics.licenseBreadth,
        contribution: passport.mobilityScore.components.licenseBreadth.contribution ?? 0,
      },
      {
        label: 'Compacts eligible',
        value: passport.metrics.compactCount,
        contribution: passport.mobilityScore.components.compacts.contribution ?? 0,
      },
      {
        label: 'Global equivalency',
        value: passport.metrics.reciprocityReady,
        contribution: passport.mobilityScore.components.globalEquivalency.contribution ?? 0,
      },
    ];
  }, [passport]);

  return (
    <div className="container max-w-5xl space-y-8 py-10">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary">Wallet · Mobility</Badge>
          {passport?.anchor ? (
            <Badge className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700">
              <ShieldCheck className="h-3.5 w-3.5" />
              Anchored
            </Badge>
          ) : null}
        </div>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Mobility passport</h1>
          <p className="text-muted-foreground">
            Blend compact eligibility, reciprocity insights, and waiver readiness into a single shareable credential.
          </p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Clinician context</CardTitle>
          <CardDescription>Launch readiness for any clinician ID in your wallet sandbox.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 md:flex-row md:items-end">
          <div className="flex-1 space-y-2">
            <label className="text-sm font-medium text-muted-foreground" htmlFor="clinicianId">
              Clinician ID
            </label>
            <Input
              id="clinicianId"
              value={clinicianId}
              onChange={(event) => setClinicianId(event.target.value)}
              placeholder="wallet-demo-clinician"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => fetchPassport(false)} disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
              Refresh
            </Button>
            <Button onClick={() => fetchPassport(true)} disabled={loading}>
              <Target className="mr-2 h-4 w-4" aria-hidden="true" />
              Recompute
            </Button>
            <Button variant="outline" onClick={handleDownload} disabled={!passport}>
              <Download className="mr-2 h-4 w-4" aria-hidden="true" />
              PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive/50 bg-destructive/5 text-destructive">
          <CardHeader className="flex flex-row items-center gap-2 space-y-0">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <CardTitle className="text-base">Unable to load mobility passport</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      {passport && (
        <>
          <section className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-primary" />
                  Mobility score
                </CardTitle>
                <CardDescription>Composite score across licensure, compacts, and reciprocity.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-baseline gap-3">
                    <span className="text-4xl font-semibold">{passport.mobilityScore.total}</span>
                    <span className="text-sm text-muted-foreground">/ 100</span>
                  </div>
                  <Progress value={passport.mobilityScore.total} className="mt-2 h-2" />
                  <p className="mt-2 text-xs text-muted-foreground">
                    Snapshot {new Date(passport.generatedAt).toLocaleString()}
                  </p>
                </div>
                <div className="space-y-2 text-sm">
                  {scoreComponents.map((component) => (
                    <div key={component.label} className="flex items-center justify-between rounded-md border p-2">
                      <span>{component.label}</span>
                      <span className="font-medium">
                        {component.value} · {(component.contribution * 100).toFixed(0)} pts
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapIcon className="h-5 w-5 text-primary" />
                  Coverage overview
                </CardTitle>
                <CardDescription>States, pathways, and waiver programs currently in scope.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm md:grid-cols-2">
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-muted-foreground">Eligible states</p>
                  <p className="text-2xl font-semibold">{passport.statesEligible.length}</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-muted-foreground">Reciprocity pathways</p>
                  <p className="text-2xl font-semibold">{passport.reciprocityPaths.length}</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-muted-foreground">Ready waivers</p>
                  <p className="text-2xl font-semibold">{readyPrograms.length}</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-muted-foreground">Anchor hash</p>
                  <p className="text-xs font-mono">{passport.snapshotHash.slice(0, 16)}…</p>
                </div>
              </CardContent>
            </Card>
          </section>

          <Card>
            <CardHeader>
              <CardTitle>Compact eligibility engine v2</CardTitle>
              <CardDescription>Auto-evaluated compacts with blockers surfaced inline.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {passport.compacts.map((entry) => (
                <div
                  key={entry.compact}
                  className={`flex flex-col gap-2 rounded-lg border p-3 md:flex-row md:items-center md:justify-between ${severityColor(entry.status)}`}
                >
                  <div>
                    <p className="text-lg font-semibold">{entry.compact}</p>
                    <p className="text-sm">{entry.notes}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge variant={entry.status === 'eligible' ? 'default' : entry.status === 'review' ? 'secondary' : 'destructive'}>
                      {entry.status.toUpperCase()}
                    </Badge>
                    <span>{entry.authorizedStates.length} states</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Global reciprocity map</CardTitle>
              <CardDescription>High-mobility pathways orchestrated by MobilityEngine.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pathway</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Focus</TableHead>
                    <TableHead>ETA</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {passport.reciprocityPaths.map((path) => (
                    <TableRow key={path.id}>
                      <TableCell>
                        <div className="font-medium">{path.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {path.origin} → {path.destination}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={path.status === 'ready' ? 'default' : path.status === 'partial' ? 'secondary' : 'outline'}>
                          {path.status.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>{path.metadata?.specialtyFocus ?? '—'}</TableCell>
                      <TableCell>{path.processingTimeDays} days</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Disaster & waiver eligibility</CardTitle>
              <CardDescription>Automatic lookups for temporary licensure programs.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {passport.waiverEligibility.programs.map((program) => (
                <div key={program.id} className="flex flex-col gap-1 rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">
                        {program.state} · {program.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Trigger: {program.trigger} · Window {program.windowDays} days
                      </p>
                    </div>
                    <Badge variant={program.eligible ? 'default' : 'outline'}>
                      {program.eligible ? 'READY' : 'BLOCKED'}
                    </Badge>
                  </div>
                  <p className="text-sm">{program.reason}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>States & international corridors</CardTitle>
              <CardDescription>End-state list plus priority countries for reciprocity.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-medium text-muted-foreground">States ({passport.statesEligible.length})</p>
                <div className="flex flex-wrap gap-2">
                  {passport.statesEligible.map((state) => (
                    <Badge key={state} variant="outline">
                      {state}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-muted-foreground">Countries ({passport.countries.length})</p>
                <div className="flex flex-wrap gap-2">
                  {passport.countries.length > 0 ? (
                    passport.countries.map((country) => (
                      <Badge key={country} variant="secondary">
                        {country}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">No high-mobility corridors yet.</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Passport anomalies
              </CardTitle>
              <CardDescription>Signals for invalid mappings or conflicting snapshots.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {anomalyCount === 0 ? (
                <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                  <CheckCircle2 className="h-4 w-4" />
                  No anomalies detected — snapshot is consistent.
                </div>
              ) : (
                passport.anomalies.map((anomaly) => (
                  <div key={anomaly.code} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{anomaly.description}</span>
                      <Badge variant={anomaly.severity === 'high' ? 'destructive' : anomaly.severity === 'medium' ? 'secondary' : 'outline'}>
                        {anomaly.severity.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Scope: {anomaly.affected.join(', ') || 'n/a'}
                    </p>
                    {anomaly.recommendation && <p className="mt-1 text-xs">{anomaly.recommendation}</p>}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Anchor & integrity</CardTitle>
              <CardDescription>Chain evidence for the latest mobility snapshot.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm md:grid-cols-2">
              <div className="rounded-lg border bg-muted/40 p-3">
                <p className="text-muted-foreground">Anchor timestamp</p>
                <p className="font-medium">
                  {passport.anchor ? new Date(passport.anchor.timestamp).toLocaleString() : 'Pending anchor'}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/40 p-3">
                <p className="text-muted-foreground">Network</p>
                <p className="font-medium">{passport.anchor?.network ?? 'pilot-l2'}</p>
              </div>
              <div className="rounded-lg border bg-muted/40 p-3 md:col-span-2">
                <p className="text-muted-foreground">Tx hash</p>
                <p className="font-mono text-xs">
                  {passport.anchor?.txHash ?? 'n/a'}
                </p>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {loading && !passport && (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          Generating mobility passport…
        </div>
      )}
    </div>
  );
}

