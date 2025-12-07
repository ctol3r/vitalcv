'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileCheck2,
  Lightbulb,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { cn } from '@/lib/utils';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  '';
const CLINICIAN_ID = process.env.NEXT_PUBLIC_WALLET_CLINICIAN_ID || 'cln_demo';

type ReadinessSignal = {
  type: string;
  score: number;
  metadata: Record<string, any>;
  updatedAt: string;
};

interface ReadinessResponse {
  readinessScore: number;
  recencyPenalty: number;
  signalBreakdown: ReadinessSignal[];
  recommendedActions: string[];
}

interface NpiValidationResponse {
  score: number;
  status: string;
  summary: string;
  generatedAt: string;
  sources?: {
    nppes?: {
      payload?: {
        enumerationType?: string;
      };
    };
  };
}

interface CompactEligibilityResponse {
  entries: Array<{
    compact: string;
    eligible: boolean;
    rationale?: string | null;
  }>;
}

interface OnboardingCheckpointSummary {
  checkpoints: Array<{
    id: string;
    step: string;
    status: string;
    blockerCode: string | null;
    timestamp: string;
    metadata?: Record<string, any> | null;
  }>;
  summary: {
    latestByStep: Record<
      string,
      {
        status: string;
        timestamp: string;
        blockerCode: string | null;
      }
    >;
    activeBlockers: Array<{
      step: string;
      blockerCode: string | null;
      status: string;
      since: string;
    }>;
    completedSteps: number;
    totalSteps: number;
    fastPathEligible: boolean;
  };
}

interface BlockerAnalyticsResponse {
  blockers: Array<{
    blockerCode: string;
    label: string;
    occurrences: number;
    medianMinutes: number;
    totalMinutes: number;
    affectedClinicians: number;
    latestExample?: {
      clinicianId: string;
      step: string;
      since: string;
    };
  }>;
  generatedAt: string;
}

interface WizardStep {
  id: string;
  label: string;
  status: 'complete' | 'ready' | 'in_progress' | 'pending' | 'blocked';
  description: string;
  blockers?: string[];
  meta?: Record<string, any>;
}

interface ExplainabilityContent {
  why: string;
  visibility: string;
  sharing: string;
}

const EXPLAINERS: Record<string, ExplainabilityContent> = {
  identity: {
    why: 'NPI classification verifies you are the legal entity requesting onboarding.',
    visibility: 'Credentialing + automated identity services.',
    sharing: 'Shared with payer/regulatory verifiers tied to this packet.',
  },
  documents: {
    why: 'Licenses, references, and voided checks map to the packet evidence grid.',
    visibility: 'Document automation + escalation reviewer if a flag trips.',
    sharing: 'Only the target organization receives hashed proofs.',
  },
  psv: {
    why: 'Primary source verification is required before privileging and orientation.',
    visibility: 'PSV automation bot + medical staff office.',
    sharing: 'Chain anchor only—no raw data leaks outside your org.',
  },
  compact: {
    why: 'Determines if you can be routed via multistate compacts without new onboarding.',
    visibility: 'Compact automation service.',
    sharing: 'Only aggregated status shared with requesting org.',
  },
  orientation: {
    why: 'Auto-scheduling tethers provisioning + final readiness gates.',
    visibility: 'Mobility coordinator + scheduling bot.',
    sharing: 'Calendar invite only to you and onboarding host.',
  },
};

export function OnboardingWizardPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [npi, setNpi] = useState<NpiValidationResponse | null>(null);
  const [readiness, setReadiness] = useState<ReadinessResponse | null>(null);
  const [compacts, setCompacts] = useState<CompactEligibilityResponse | null>(null);
  const [checkpoints, setCheckpoints] = useState<OnboardingCheckpointSummary | null>(null);
  const [analytics, setAnalytics] = useState<BlockerAnalyticsResponse | null>(null);
  const [drawerStep, setDrawerStep] = useState<WizardStep | null>(null);

  const fetchAll = useCallback(async () => {
    const base = API_BASE.replace(/\/$/, '');
    const [npiResp, readinessResp, compactResp, checkpointResp, blockerResp] = await Promise.all([
      getJson<NpiValidationResponse>(`${base}/npi/validation/${CLINICIAN_ID}`),
      getJson<ReadinessResponse>(`${base}/readiness/${CLINICIAN_ID}/v5`),
      getJson<CompactEligibilityResponse>(`${base}/compacts/eligibility/${CLINICIAN_ID}`),
      getJson<OnboardingCheckpointSummary>(`${base}/api/onboarding/checkpoints/${CLINICIAN_ID}`),
      getJson<BlockerAnalyticsResponse>(`${base}/api/onboarding/blockers?windowDays=45`),
    ]);
    setNpi(npiResp);
    setReadiness(readinessResp);
    setCompacts(compactResp);
    setCheckpoints(checkpointResp);
    setAnalytics(blockerResp);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        await fetchAll();
        if (!cancelled) {
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load onboarding wizard data.');
          setLoading(false);
        }
      }
    }
    void load();
    const interval = window.setInterval(() => {
      void fetchAll().catch((err) =>
        console.warn('[onboarding][wizard] refresh failed', err),
      );
    }, 45_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [fetchAll]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to refresh onboarding wizard.');
    } finally {
      setRefreshing(false);
    }
  }, [fetchAll]);

  const npiType = npi?.sources?.nppes?.payload?.enumerationType ?? 'NPI-1';
  const licenseSignal = readiness?.signalBreakdown.find((signal) => signal.type === 'license');
  const psvConfidence = normalizeConfidence(licenseSignal?.metadata?.riskScore);
  const fastPathEligible = (checkpoints?.summary.fastPathEligible ?? false) && psvConfidence > 0.85;
  const trustScore = computeTrustScore(npi, readiness);
  const missingDocs = deriveMissingDocs(checkpoints, readiness);

  const wizardSteps = useMemo<WizardStep[]>(() => {
    const steps: WizardStep[] = [
      {
        id: 'identity',
        label: `Identity (${npiType})`,
        status: npi?.status === 'pass' ? 'complete' : 'in_progress',
        description: npi?.summary ?? 'NPI validation pending',
      },
      {
        id: 'documents',
        label: 'Documents & attestations',
        status: missingDocs.length ? 'blocked' : 'ready',
        description: missingDocs.length
          ? 'Documents missing or flagged'
          : 'All critical documents uploaded',
        blockers: missingDocs,
      },
      {
        id: 'psv',
        label: 'Primary source verification',
        status: psvConfidence > 0.85 ? 'ready' : 'pending',
        description:
          psvConfidence > 0.85 ? 'Fast-path PSV confidence' : 'Waiting for PSV refresh',
        meta: {
          confidence: (psvConfidence * 100).toFixed(1),
        },
      },
      {
        id: 'compact',
        label: 'Compact eligibility',
        status: hasCompactEligibility(compacts) ? 'complete' : 'pending',
        description: hasCompactEligibility(compacts)
          ? 'Compact proof available'
          : 'Awaiting compact attestation',
      },
      {
        id: 'orientation',
        label: 'Orientation scheduling',
        status: deriveStepStatus(checkpoints, 'orientation'),
        description: deriveOrientationCopy(checkpoints),
      },
    ];
    return steps;
  }, [npi?.status, npiType, missingDocs, psvConfidence, compacts, checkpoints]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary" className="flex items-center gap-1">
            <ClipboardList className="h-3.5 w-3.5" />
            Wallet · Onboarding
          </Badge>
          {fastPathEligible && (
            <Badge className="bg-emerald-600 text-white">
              <Sparkles className="mr-1 h-3.5 w-3.5" />
              Fast path eligible
            </Badge>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
              Refresh data
            </Button>
          </div>
        </div>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Adaptive onboarding wizard</h1>
          <p className="text-muted-foreground">
            Steps update automatically based on NPI type, missing documents, and compact readiness.
          </p>
        </div>
        {error && (
          <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}
      </header>

      {loading ? (
        <Skeleton className="h-96 w-full rounded-xl" />
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <TrustScorePreview
              trustScore={trustScore}
              readyIn48={isReadyIn48(readiness, checkpoints)}
              blockers={buildReadinessBlockers(checkpoints, readiness)}
            />
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  PSV confidence
                </CardTitle>
                <CardDescription>Fast-path unlock if above 85%</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-semibold">{Math.round(psvConfidence * 100)}%</span>
                  <Badge variant={psvConfidence > 0.85 ? 'default' : 'secondary'}>
                    {psvConfidence > 0.85 ? 'Fast path' : 'Needs refresh'}
                  </Badge>
                </div>
                <Progress value={psvConfidence * 100} className="h-2" />
                <p className="text-sm text-muted-foreground">
                  License signal risk{' '}
                  {(licenseSignal?.metadata?.riskScore ?? 0.35).toFixed(2)}
                  {' · '}
                  {licenseSignal ? new Date(licenseSignal.updatedAt).toLocaleString() : 'No PSV run'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileCheck2 className="h-4 w-4" />
                  Document readiness
                </CardTitle>
                <CardDescription>AI triage for missing documents</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {missingDocs.length === 0 ? (
                  <p className="text-sm text-emerald-600">All required documents captured.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {missingDocs.slice(0, 3).map((doc) => (
                      <li key={doc} className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-amber-500" />
                        {doc}
                      </li>
                    ))}
                    {missingDocs.length > 3 && (
                      <li className="text-xs text-muted-foreground">
                        +{missingDocs.length - 3} more blockers
                      </li>
                    )}
                  </ul>
                )}
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 lg:grid-cols-[2fr,1fr]">
            <Card>
              <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle>Adaptive steps</CardTitle>
                  <CardDescription>
                    Click Explain to learn why each step exists and how data is handled.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {wizardSteps.map((step) => (
                  <div
                    key={step.id}
                    className={cn(
                      'flex flex-col gap-1 rounded-lg border p-3 transition-colors md:flex-row md:items-center md:justify-between',
                      statusToneClass(step.status),
                    )}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <StatusDot status={step.status} />
                        <p className="font-medium">{step.label}</p>
                      </div>
                      <p className="text-sm text-muted-foreground">{step.description}</p>
                      {step.blockers && step.blockers.length > 0 && (
                        <ul className="mt-2 list-disc pl-5 text-xs text-amber-700">
                          {step.blockers.map((blocker) => (
                            <li key={`${step.id}-${blocker}`}>{blocker}</li>
                          ))}
                        </ul>
                      )}
                      {step.meta?.confidence && (
                        <p className="text-xs text-muted-foreground">
                          Confidence {step.meta.confidence}%
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="self-start md:self-auto"
                      onClick={() => setDrawerStep(step)}
                    >
                      Explain step
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
            <CheckpointTimeline checkpoints={checkpoints} />
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <BlockerAnalyticsPanel analytics={analytics} />
            <CompactPanel compacts={compacts} />
          </section>

          <Drawer open={Boolean(drawerStep)} onOpenChange={(open) => !open && setDrawerStep(null)}>
            <DrawerContent className="mx-auto w-full max-w-xl">
              <DrawerHeader>
                <DrawerTitle>{drawerStep?.label}</DrawerTitle>
                <DrawerDescription>
                  {drawerStep ? explainabilityCopy(drawerStep.id) : ''}
                </DrawerDescription>
              </DrawerHeader>
              <div className="space-y-4 p-6 text-sm">
                {drawerStep && (
                  <>
                    <ExplainabilitySection
                      label="Why this step exists"
                      body={getExplainability(drawerStep.id).why}
                    />
                    <ExplainabilitySection
                      label="Who can see the data"
                      body={getExplainability(drawerStep.id).visibility}
                    />
                    <ExplainabilitySection
                      label="What data is shared onward"
                      body={getExplainability(drawerStep.id).sharing}
                    />
                  </>
                )}
              </div>
            </DrawerContent>
          </Drawer>
        </>
      )}
    </div>
  );
}

export default OnboardingWizardPage;

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }
  return (await response.json()) as T;
}

function computeTrustScore(npi: NpiValidationResponse | null, readiness: ReadinessResponse | null) {
  const readinessScore = readiness?.readinessScore ?? 0.6;
  const npiScore = npi?.score ?? 0.7;
  return Number((readinessScore * 0.6 + npiScore * 0.4).toFixed(2));
}

function normalizeConfidence(riskScore?: number) {
  if (typeof riskScore !== 'number' || Number.isNaN(riskScore)) {
    return 0.5;
  }
  return Math.max(0, Math.min(1, 1 - riskScore));
}

function hasCompactEligibility(compacts: CompactEligibilityResponse | null) {
  return Boolean(compacts?.entries.some((entry) => entry.eligible));
}

function deriveStepStatus(checkpoints: OnboardingCheckpointSummary | null, step: string) {
  const entry = checkpoints?.summary.latestByStep[step];
  if (!entry) return 'pending';
  if (entry.status.includes('complete')) return 'complete';
  if (entry.status.includes('blocked')) return 'blocked';
  if (entry.status.includes('ready') || entry.status.includes('scheduled')) return 'ready';
  return 'in_progress';
}

function deriveOrientationCopy(checkpoints: OnboardingCheckpointSummary | null) {
  const entry = checkpoints?.summary.latestByStep.orientation;
  if (!entry) return 'Auto-scheduling pending trigger from hiring event.';
  if (entry.status.includes('scheduled')) {
    return `Orientation scheduled ${new Date(entry.timestamp).toLocaleString()}`;
  }
  if (entry.status.includes('blocked')) {
    return 'Waiting for manual slot assignment.';
  }
  return 'Orientation workflow running.';
}

function deriveMissingDocs(
  checkpoints: OnboardingCheckpointSummary | null,
  readiness: ReadinessResponse | null,
) {
  const blockers = checkpoints?.summary.activeBlockers ?? [];
  const docBlockers = blockers
    .filter((blocker) => blocker.step.startsWith('documents'))
    .map((blocker) => friendlyName(blocker.blockerCode ?? blocker.step));
  const actionHints =
    readiness?.recommendedActions
      ?.filter((action) => /upload|capture|attest/i.test(action))
      .map((action) => action.replace(/\.$/, '')) ?? [];
  return Array.from(new Set([...docBlockers, ...actionHints]));
}

function friendlyName(code: string) {
  return code
    .replace(/[_:-]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildReadinessBlockers(
  checkpoints: OnboardingCheckpointSummary | null,
  readiness: ReadinessResponse | null,
) {
  const blockers = checkpoints?.summary.activeBlockers ?? [];
  if (blockers.length) {
    return blockers.map((blocker) => ({
      label: friendlyName(blocker.blockerCode ?? blocker.step),
      since: blocker.since,
    }));
  }
  return (readiness?.recommendedActions ?? []).slice(0, 3).map((action) => ({
    label: action,
    since: null,
  }));
}

function isReadyIn48(
  readiness: ReadinessResponse | null,
  checkpoints: OnboardingCheckpointSummary | null,
) {
  const readinessOk = (readiness?.readinessScore ?? 0) >= 0.78;
  const activeBlockers = checkpoints?.summary.activeBlockers ?? [];
  return readinessOk && activeBlockers.length === 0;
}

function statusToneClass(status: WizardStep['status']) {
  switch (status) {
    case 'complete':
      return 'border-emerald-200 bg-emerald-50/70';
    case 'ready':
      return 'border-sky-200 bg-sky-50/70';
    case 'blocked':
      return 'border-amber-200 bg-amber-50/70';
    default:
      return 'border-muted';
  }
}

function StatusDot({ status }: { status: WizardStep['status'] }) {
  const color =
    status === 'complete'
      ? 'bg-emerald-500'
      : status === 'blocked'
        ? 'bg-amber-500'
        : status === 'ready'
          ? 'bg-sky-500'
          : 'bg-muted-foreground';
  return <span className={cn('inline-block h-2.5 w-2.5 rounded-full', color)} />;
}

function explainabilityCopy(stepId: string) {
  const explainer = getExplainability(stepId);
  return `${explainer.why} ${explainer.visibility}`;
}

function getExplainability(stepId: string): ExplainabilityContent {
  return (
    EXPLAINERS[stepId] ?? {
      why: 'This step ensures the packet is auditable.',
      visibility: 'Limited to onboarding reviewers.',
      sharing: 'Only high-level status is shared externally.',
    }
  );
}

function TrustScorePreview({
  trustScore,
  readyIn48,
  blockers,
}: {
  trustScore: number;
  readyIn48: boolean;
  blockers: Array<{ label: string; since: string | null }>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-4 w-4" />
          Trust score preview
        </CardTitle>
        <CardDescription>Aggregates readiness + NPI signals.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-end gap-2">
          <span className="text-4xl font-semibold">{Math.round(trustScore * 100)}%</span>
          <Badge variant={readyIn48 ? 'default' : 'secondary'}>
            {readyIn48 ? 'Ready in 48h' : 'Blocked'}
          </Badge>
        </div>
        <Progress value={trustScore * 100} className="h-2" />
        <div className="space-y-1 text-xs text-muted-foreground">
          {readyIn48 ? (
            <p>All blockers cleared. Submit packet now to stay on 48h path.</p>
          ) : (
            blockers.map((blocker) => (
              <p key={`${blocker.label}-${blocker.since ?? 'na'}`}>
                <ArrowRight className="mr-1 inline h-3 w-3 text-amber-500" />
                {blocker.label}
                {blocker.since && ` • since ${new Date(blocker.since).toLocaleDateString()}`}
              </p>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function BlockerAnalyticsPanel({ analytics }: { analytics: BlockerAnalyticsResponse | null }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Onboarding blockers</CardTitle>
            <CardDescription>Time lost per blocker (last 45 days)</CardDescription>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Lightbulb className="h-4 w-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>
              Surface chain data to prioritize automation work.
            </TooltipContent>
          </Tooltip>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {analytics && analytics.blockers.length === 0 && (
          <p className="text-muted-foreground">No blockers recorded in this window.</p>
        )}
        {analytics?.blockers.slice(0, 4).map((blocker) => (
          <div key={blocker.blockerCode} className="rounded border p-3">
            <div className="flex items-center justify-between">
              <p className="font-medium">{blocker.label}</p>
              <Badge variant="outline">{blocker.occurrences} hits</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Median delay {blocker.medianMinutes} min · Total {Math.round(blocker.totalMinutes)} min
            </p>
            {blocker.latestExample && (
              <p className="text-xs text-muted-foreground">
                Latest: {new Date(blocker.latestExample.since).toLocaleDateString()}
              </p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function CompactPanel({ compacts }: { compacts: CompactEligibilityResponse | null }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Compact snapshot</CardTitle>
        <CardDescription>Auto-checks your portability options</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {compacts?.entries.length ? (
          compacts.entries.slice(0, 4).map((entry) => (
            <div key={entry.compact} className="flex items-center justify-between rounded border p-2">
              <div>
                <p className="font-medium">{entry.compact}</p>
                {entry.rationale && (
                  <p className="text-xs text-muted-foreground">{entry.rationale}</p>
                )}
              </div>
              <Badge variant={entry.eligible ? 'default' : 'secondary'}>
                {entry.eligible ? 'Eligible' : 'Pending'}
              </Badge>
            </div>
          ))
        ) : (
          <p className="text-muted-foreground">No compact eligibility records yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

function CheckpointTimeline({ checkpoints }: { checkpoints: OnboardingCheckpointSummary | null }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Checkpoint timeline</CardTitle>
        <CardDescription>Audit trail of onboarding checkpoints</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {checkpoints?.checkpoints.length ? (
          checkpoints.checkpoints.slice(0, 6).map((checkpoint) => (
            <div key={checkpoint.id} className="flex flex-col gap-1 rounded border p-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                <p className="font-medium">{friendlyName(checkpoint.step)}</p>
                <Badge variant="outline" className="ml-auto">
                  {checkpoint.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {new Date(checkpoint.timestamp).toLocaleString()}
              </p>
            </div>
          ))
        ) : (
          <p className="text-muted-foreground">No checkpoints recorded for this clinician.</p>
        )}
      </CardContent>
    </Card>
  );
}

function ExplainabilitySection({ label, body }: { label: string; body: string }) {
  return (
    <div>
      <p className="text-sm font-semibold">{label}</p>
      <p className="text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

