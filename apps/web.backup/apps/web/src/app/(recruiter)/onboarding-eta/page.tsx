'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Download, Loader2, ShieldCheck } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

type OnboardingPhase = 'docs' | 'verification' | 'committee' | 'itAccess' | 'onboarding';

interface PhaseProjection {
  phase: OnboardingPhase;
  durationDays: number;
  startDate: string;
  projectedCompletion: string;
  confidence: number;
  bottleneckRisk: Record<string, number>;
}

interface BottleneckPrediction {
  type: string;
  severity: 'low' | 'moderate' | 'high';
  confidence: number;
  signals: string[];
  recommendedActions: string[];
}

interface AutoExpediteSuggestion {
  type: 'licenseRenewal' | 'boardCertUpdate' | 'compactEnrollment';
  impactScore: number;
  rationale: string;
  recommendedAction: string;
  blocking: boolean;
}

interface EfficiencyScoreBreakdown {
  overall: number;
  readiness: number;
  documentQuality: number;
  automation: number;
  penalty: number;
}

interface VelocityModel {
  projectedCompletionDate: string;
  projectedDays: number;
  currentPhase: OnboardingPhase;
  progressPercent: number;
  etaConfidence: number;
}

interface OnboardingExportPayload {
  rows: Array<Record<string, unknown>>;
  csv: string;
}

interface OnboardingEtaResponse {
  clinicianId: string;
  orgId: string | null;
  projectedCompletionDate: string;
  phases: PhaseProjection[];
  bottlenecks: BottleneckPrediction[];
  expediteSuggestions: AutoExpediteSuggestion[];
  efficiency: EfficiencyScoreBreakdown;
  velocity: VelocityModel;
  export: OnboardingExportPayload;
}

export default function RecruiterOnboardingEtaPage() {
  const [clinicianId, setClinicianId] = useState('demo-clinician');
  const [data, setData] = useState<OnboardingEtaResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEta = useCallback(async () => {
    if (!clinicianId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/onboarding/eta/${clinicianId}`);
      if (!response.ok) {
        throw new Error(`Failed to generate ETA (status ${response.status})`);
      }
      const payload = (await response.json()) as OnboardingEtaResponse;
      setData(payload);
    } catch (err) {
      console.error('[recruiter][eta] failed to fetch', err);
      setError(err instanceof Error ? err.message : 'Unable to generate onboarding ETA');
    } finally {
      setLoading(false);
    }
  }, [clinicianId]);

  useEffect(() => {
    fetchEta();
  }, [fetchEta]);

  const projectedCompletion = data ? new Date(data.velocity.projectedCompletionDate) : null;

  const dominantBottleneck = useMemo(() => {
    if (!data?.bottlenecks.length) return null;
    return data.bottlenecks.reduce((max, current) => (current.confidence > max.confidence ? current : max));
  }, [data]);

  const handleDownload = useCallback(() => {
    if (!data?.export?.csv) return;
    const blob = new Blob([data.export.csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `onboarding-${data.clinicianId}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [data]);

  return (
    <div className="p-8 space-y-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Recruiter onboarding ETA</h1>
          <p className="text-muted-foreground">Predictive timeline, blockers, and expedite levers for any clinician.</p>
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Input
            value={clinicianId}
            onChange={(event) => setClinicianId(event.target.value)}
            placeholder="Clinician ID"
            className="md:w-72"
          />
          <Button onClick={fetchEta} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Simulating
              </>
            ) : (
              'Run simulation'
            )}
          </Button>
        </div>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Unable to generate ETA</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Velocity &amp; completion</CardTitle>
            <CardDescription>Phase progress + projected finish</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data ? (
              <>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <Badge variant="secondary">Current phase: {formatPhase(data.velocity.currentPhase)}</Badge>
                  <Badge variant="outline">
                    ETA confidence {(data.velocity.etaConfidence * 100).toFixed(0)}%
                  </Badge>
                  <Badge variant="outline">Projected {projectedCompletion?.toLocaleDateString() ?? '--'}</Badge>
                </div>
                <div>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Progress</span>
                    <span>{data.velocity.progressPercent.toFixed(1)}%</span>
                  </div>
                  <Progress value={data.velocity.progressPercent} className="mt-2" />
                  {dominantBottleneck && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Top bottleneck:{' '}
                      <span className="font-medium text-foreground">{formatBottleneck(dominantBottleneck.type)}</span>{' '}
                      · {(dominantBottleneck.confidence * 100).toFixed(0)}% confidence
                    </p>
                  )}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {data.phases.map((phase) => (
                    <PhaseCard key={phase.phase} phase={phase} isActive={phase.phase === data.velocity.currentPhase} />
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Enter a clinician to generate a timeline.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Efficiency score</CardTitle>
            <CardDescription>Readiness + document quality composite</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-4xl font-bold">
              {data ? `${(data.efficiency.overall * 100).toFixed(0)} / 100` : '--'}
            </div>
            {data && (
              <>
                <EfficiencyRow label="Readiness" value={data.efficiency.readiness} />
                <EfficiencyRow label="Document quality" value={data.efficiency.documentQuality} />
                <EfficiencyRow label="Automation" value={data.efficiency.automation} />
                <EfficiencyRow label="Bottleneck penalty" value={data.efficiency.penalty} invert />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Predicted bottlenecks</CardTitle>
            <CardDescription>AI signal fusion across documents, licenses, and NPDB</CardDescription>
          </CardHeader>
          <CardContent>
            {data?.bottlenecks.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Signals</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.bottlenecks.map((bottleneck) => (
                    <TableRow key={bottleneck.type}>
                      <TableCell className="font-medium">{formatBottleneck(bottleneck.type)}</TableCell>
                      <TableCell>{(bottleneck.confidence * 100).toFixed(0)}%</TableCell>
                      <TableCell>
                        <Badge variant={severityVariant(bottleneck.severity)}>{bottleneck.severity}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {bottleneck.signals.slice(0, 2).join(' · ')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">No high-risk bottlenecks predicted.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Auto-expedite suggestions</CardTitle>
            <CardDescription>Programmatic levers to keep timelines on track</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data?.expediteSuggestions.length ? (
              data.expediteSuggestions.map((suggestion) => (
                <Alert
                  key={suggestion.type}
                  variant={suggestion.blocking ? 'destructive' : 'default'}
                  className="flex flex-col gap-1"
                >
                  {suggestion.blocking ? (
                    <AlertTriangle className="h-4 w-4" />
                  ) : (
                    <ShieldCheck className="h-4 w-4" />
                  )}
                  <AlertTitle>
                    {formatSuggestion(suggestion.type)} · {(suggestion.impactScore * 100).toFixed(0)}% impact
                  </AlertTitle>
                  <AlertDescription className="space-y-1 text-xs text-muted-foreground">
                    <p>{suggestion.rationale}</p>
                    <p className="font-medium text-foreground">{suggestion.recommendedAction}</p>
                  </AlertDescription>
                </Alert>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No expedite actions recommended.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Download onboarding snapshot</CardTitle>
            <CardDescription>CSV export for CFO / ops reporting</CardDescription>
          </div>
          <Button onClick={handleDownload} disabled={!data?.export?.csv}>
            <Download className="mr-2 h-4 w-4" />
            Download CSV
          </Button>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {data ? (
            <p>
              Includes per-phase durations, confidence scores, and readiness factors for {data.export.rows.length}{' '}
              segments.
            </p>
          ) : (
            <p>Run a simulation to enable exports.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PhaseCard({ phase, isActive }: { phase: PhaseProjection; isActive: boolean }) {
  const start = new Date(phase.startDate).toLocaleDateString();
  const target = new Date(phase.projectedCompletion).toLocaleDateString();
  return (
    <div className={`rounded-lg border p-3 ${isActive ? 'border-primary bg-primary/5' : 'border-border'}`}>
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold">{formatPhase(phase.phase)}</span>
        {isActive && <Badge variant="secondary">Active</Badge>}
      </div>
      <p className="mt-2 text-2xl font-bold">{phase.durationDays.toFixed(1)}d</p>
      <p className="text-xs text-muted-foreground">
        {start} → {target}
      </p>
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>Confidence</span>
        <span>{(phase.confidence * 100).toFixed(0)}%</span>
      </div>
      <Progress value={phase.confidence * 100} className="mt-1" />
    </div>
  );
}

function EfficiencyRow({ label, value, invert }: { label: string; value: number; invert?: boolean }) {
  const numeric = invert ? (1 - value) * 100 : value * 100;
  return (
    <div>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{label}</span>
        <span>{numeric.toFixed(0)}%</span>
      </div>
      <Progress value={numeric} className="mt-2" />
    </div>
  );
}

function formatPhase(phase: string) {
  if (phase === 'itAccess') return 'IT access';
  return phase.charAt(0).toUpperCase() + phase.slice(1);
}

function formatBottleneck(type: string) {
  switch (type) {
    case 'missingDocuments':
      return 'Missing documents';
    case 'expiredLicenses':
      return 'Expired licenses';
    case 'unverifiedNpdb':
      return 'Unverified NPDB';
    default:
      return type;
  }
}

function formatSuggestion(type: AutoExpediteSuggestion['type']) {
  switch (type) {
    case 'licenseRenewal':
      return 'License renewal';
    case 'boardCertUpdate':
      return 'Board cert update';
    case 'compactEnrollment':
      return 'Compact enrollment';
    default:
      return type;
  }
}

function severityVariant(severity: BottleneckPrediction['severity']) {
  if (severity === 'high') return 'destructive';
  if (severity === 'moderate') return 'secondary';
  return 'outline';
}


