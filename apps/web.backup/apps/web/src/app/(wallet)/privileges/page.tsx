'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, RefreshCw, Shield } from 'lucide-react';

import { ConflictBadge } from '@/components/privileges/ConflictBadge';
import { PrivilegeGraph, PrivilegeGraphLegend } from '@/components/privileges/PrivilegeGraph';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CLINICIAN_PRIVILEGE_PROFILE,
  PRIVILEGE_NODES,
  PRIVILEGE_RENEWALS,
  type PrivilegeNode,
  getAllPrerequisites,
  getDownstreamPrivileges,
  getPrivilegeByCode,
} from '@/data/privileges';

const API_BASE = (process.env.NEXT_PUBLIC_PLATFORM_API ?? '').replace(/\/$/, '');
const DEMO_CLINICIAN_ID = 'wallet-demo-privileges';

type PrivilegeStatus = 'granted' | 'pending' | 'missing' | 'conflict';

interface WalletPrivilegeEntry {
  code: string;
  label: string;
  site: string;
  status: PrivilegeStatus;
  lastReviewed?: string;
  nextReview?: string;
  blockers: string[];
  evidence?: string[];
}

interface WalletPrivilegeEligibility {
  clinicianId: string;
  privileges: WalletPrivilegeEntry[];
  recommendations: Array<{ label: string; description: string; href: string }>;
  generatedAt: string;
}

export default function WalletPrivilegeEligibilityPage() {
  const [eligibility, setEligibility] = useState<WalletPrivilegeEligibility | null>(null);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadEligibility();
  }, []);

  useEffect(() => {
    if (!eligibility || selectedCode) return;
    setSelectedCode(eligibility.privileges[0]?.code ?? null);
  }, [eligibility, selectedCode]);

  async function loadEligibility() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(buildApiUrl(`/api/wallet/privileges?clinicianId=${DEMO_CLINICIAN_ID}`));
      if (!response.ok) {
        throw new Error(`Eligibility API responded with ${response.status}`);
      }
      const payload = (await response.json()) as WalletPrivilegeEligibility;
      setEligibility(payload);
    } catch (err) {
      console.warn('Wallet privilege API unavailable, using mock data', err);
      setEligibility(buildMockEligibility());
      setError('Live privileging data unavailable — showing cached readiness.');
    } finally {
      setLoading(false);
    }
  }

  const summary = useMemo(() => {
    const initial = { granted: 0, pending: 0, missing: 0, conflict: 0 } satisfies Record<PrivilegeStatus, number>;
    return (eligibility?.privileges ?? []).reduce((acc, privilege) => {
      acc[privilege.status] += 1;
      return acc;
    }, initial);
  }, [eligibility]);

  const selectedPrivilege = useMemo(() => {
    if (!selectedCode) return null;
    return eligibility?.privileges.find((priv) => priv.code === selectedCode) ?? null;
  }, [eligibility, selectedCode]);

  const selectedNode = useMemo(() => (selectedCode ? getPrivilegeByCode(selectedCode) ?? null : null), [selectedCode]);
  const localEvaluation = useMemo(() => {
    if (!selectedNode) return null;
    return evaluateLocalEligibility(selectedNode);
  }, [selectedNode]);

  const highlightedNodes = useMemo(() => {
    if (!selectedCode) return new Set<string>();
    const prereqs = getAllPrerequisites(selectedCode);
    const downstream = getDownstreamPrivileges(selectedCode);
    return new Set([selectedCode, ...prereqs, ...downstream]);
  }, [selectedCode]);

  return (
    <div className="container mx-auto max-w-6xl space-y-6 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-wide text-muted-foreground">Wallet · Privileges</p>
          <h1 className="text-3xl font-bold">Privilege Eligibility</h1>
          <p className="max-w-3xl text-muted-foreground">
            Monitor hospital-ready privileges, understand prerequisite gaps, and push attestation packets from your
            wallet without waiting for committee day.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadEligibility} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            Refresh
          </Button>
          <Button>
            <Shield className="mr-2 h-4 w-4" aria-hidden="true" />
            Share privilege proof
          </Button>
        </div>
      </header>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-amber-500/60 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          {error}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Granted" value={summary.granted} description="Ready for instant share" tone="success" />
        <SummaryCard label="Pending" value={summary.pending} description="Evidence uploading" tone="warning" />
        <SummaryCard label="Missing" value={summary.missing} description="Needs remediation" tone="destructive" />
        <SummaryCard
          label="Conflict"
          value={summary.conflict}
          description="Policy conflicts detected"
          tone="secondary"
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Privilege status</CardTitle>
            <CardDescription>Tap a privilege to inspect prerequisites and remediation actions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading || !eligibility ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <div className="divide-y rounded-lg border">
                {eligibility.privileges.map((privilege) => (
                  <button
                    key={privilege.code}
                    onClick={() => setSelectedCode(privilege.code)}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-muted/40 focus-visible:outline-none ${
                      selectedCode === privilege.code ? 'bg-primary/5' : ''
                    }`}
                    aria-pressed={selectedCode === privilege.code}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{privilege.code}</p>
                        <StatusBadge status={privilege.status} />
                      </div>
                      <p className="text-sm text-muted-foreground">{privilege.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {privilege.site} · Last review{' '}
                        {privilege.lastReviewed ? new Date(privilege.lastReviewed).toLocaleDateString() : 'pending'}
                      </p>
                    </div>
                    {privilege.status === 'conflict' && (
                      <ConflictBadge privilegeCode={privilege.code} label="Policy" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Eligibility detail</CardTitle>
            <CardDescription>Prerequisite coverage and remediation pathways.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {!selectedNode || !selectedPrivilege || !localEvaluation ? (
              <p className="text-sm text-muted-foreground">Select a privilege to inspect requirements.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="secondary">{selectedNode.code}</Badge>
                  <p className="font-semibold">{selectedNode.name}</p>
                  <StatusBadge status={selectedPrivilege.status} />
                </div>
                <p className="text-sm text-muted-foreground">{selectedNode.description}</p>
                <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                  <p className="font-semibold">Site</p>
                  <p className="text-muted-foreground">{selectedPrivilege.site}</p>
                </div>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold">Prerequisite matrix</h3>
                  <div className="space-y-2 rounded-lg border">
                    {selectedNode.prerequisites.length === 0 ? (
                      <p className="p-3 text-sm text-muted-foreground">No prerequisites captured.</p>
                    ) : (
                      selectedNode.prerequisites.map((code) => (
                        <div
                          key={code}
                          className="flex flex-wrap items-center justify-between gap-3 border-b px-3 py-2 last:border-b-0"
                        >
                          <div>
                            <p className="text-sm font-medium">{code}</p>
                            <p className="text-xs text-muted-foreground">
                              {PRIVILEGE_NODES.find((node) => node.code === code)?.name ?? 'Refer to matrix'}
                            </p>
                          </div>
                          <RequirementBadge status={localEvaluation.requirementStatus[code] ?? 'missing'} />
                        </div>
                      ))
                    )}
                  </div>
                </section>

                {selectedPrivilege.blockers.length > 0 && (
                  <section className="space-y-2">
                    <h3 className="text-sm font-semibold">Blockers</h3>
                    <ul className="space-y-2">
                      {selectedPrivilege.blockers.map((blocker) => (
                        <li key={blocker} className="rounded-md border border-dashed p-3 text-sm">
                          {blocker}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {selectedNode.remediationActions.length > 0 && (
                  <section className="space-y-2">
                    <h3 className="text-sm font-semibold">Remediation actions</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedNode.remediationActions.map((action) => (
                        <Button key={action.label} asChild size="sm" variant="outline">
                          <a href={action.href} target="_blank" rel="noreferrer">
                            {action.label}
                          </a>
                        </Button>
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle>Privilege map</CardTitle>
            <CardDescription>Visual dependency graph with real-time highlights.</CardDescription>
          </div>
          <PrivilegeGraphLegend />
        </CardHeader>
        <CardContent>
          <PrivilegeGraph
            nodes={PRIVILEGE_NODES}
            selectedCode={selectedCode ?? undefined}
            highlightedNodes={highlightedNodes}
            dimUnselected
            onSelect={(node) => setSelectedCode(node.code)}
          />
        </CardContent>
      </Card>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Action center</CardTitle>
            <CardDescription>Next-best steps to stay committee-ready.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading || !eligibility ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              eligibility.recommendations.map((item) => (
                <div key={item.label} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{item.label}</p>
                    <Button asChild size="sm" variant="ghost">
                      <a href={item.href} className="inline-flex items-center gap-1 text-primary">
                        Open <ArrowRight className="h-3 w-3" />
                      </a>
                    </Button>
                  </div>
                  <p className="text-muted-foreground">{item.description}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Renewal timeline</CardTitle>
            <CardDescription>Chain of downstream impacts for expiring privileges.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {PRIVILEGE_RENEWALS.map((renewal) => (
              <div key={renewal.id} className="rounded-lg border p-3 text-sm shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{renewal.privilegeCode}</Badge>
                  <Badge variant={renewal.risk === 'high' ? 'destructive' : renewal.risk === 'moderate' ? 'warning' : 'secondary'}>
                    {renewal.risk} risk
                  </Badge>
                </div>
                <p className="py-2 text-muted-foreground">{renewal.summary}</p>
                <div className="space-y-1 text-xs text-muted-foreground">
                  {renewal.timeline.map((entry) => (
                    <p key={`${renewal.id}-${entry.date}`}>
                      <span className="font-medium">{entry.date} · </span>
                      {entry.label}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  description,
  tone,
}: {
  label: string;
  value: number;
  description: string;
  tone: 'success' | 'warning' | 'destructive' | 'secondary';
}) {
  const toneMap: Record<typeof tone, string> = {
    success: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    warning: 'bg-amber-50 border-amber-200 text-amber-900',
    destructive: 'bg-rose-50 border-rose-200 text-rose-900',
    secondary: 'bg-slate-50 border-slate-200 text-slate-900',
  };
  return (
    <div className={`rounded-lg border p-4 ${toneMap[tone]}`}>
      <p className="text-sm uppercase tracking-wide">{label}</p>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-sm">{description}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: PrivilegeStatus }) {
  const map: Record<PrivilegeStatus, { label: string; className: string }> = {
    granted: { label: 'Granted', className: 'bg-emerald-100 text-emerald-900' },
    pending: { label: 'Pending', className: 'bg-amber-100 text-amber-900' },
    missing: { label: 'Missing', className: 'bg-rose-100 text-rose-900' },
    conflict: { label: 'Conflict', className: 'bg-slate-200 text-slate-900' },
  };
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${map[status].className}`}>{map[status].label}</span>;
}

type RequirementStatus = 'complete' | 'expiring' | 'inProgress' | 'missing';

function RequirementBadge({ status }: { status: RequirementStatus }) {
  const map: Record<RequirementStatus, { label: string; className: string }> = {
    complete: { label: 'Complete', className: 'bg-emerald-100 text-emerald-900' },
    expiring: { label: 'Expiring', className: 'bg-amber-100 text-amber-900' },
    inProgress: { label: 'In progress', className: 'bg-blue-100 text-blue-900' },
    missing: { label: 'Missing', className: 'bg-rose-100 text-rose-900' },
  };
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${map[status].className}`}>{map[status].label}</span>;
}

function evaluateLocalEligibility(privilege: PrivilegeNode) {
  const granted = new Set(CLINICIAN_PRIVILEGE_PROFILE.granted);
  const expiring = new Set(CLINICIAN_PRIVILEGE_PROFILE.expiringSoon);
  const inProgress = new Set(CLINICIAN_PRIVILEGE_PROFILE.trainingInProgress);

  const requirementStatus: Record<string, RequirementStatus> = {};
  const missing: string[] = [];

  privilege.prerequisites.forEach((code) => {
    if (granted.has(code)) {
      requirementStatus[code] = expiring.has(code) ? 'expiring' : 'complete';
      return;
    }
    if (inProgress.has(code)) {
      requirementStatus[code] = 'inProgress';
      missing.push(code);
      return;
    }
    requirementStatus[code] = 'missing';
    missing.push(code);
  });

  return {
    missing,
    requirementStatus,
  };
}

function buildApiUrl(path: string) {
  if (!API_BASE) return path;
  return `${API_BASE}${path}`;
}

function buildMockEligibility(): WalletPrivilegeEligibility {
  const privileges: WalletPrivilegeEntry[] = [
    {
      code: 'CORE-100',
      label: 'Inpatient Core',
      site: 'NYC-001',
      status: 'granted',
      lastReviewed: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
      blockers: [],
      evidence: ['Board certification on file', 'Volume logs verified'],
    },
    {
      code: 'STRUCT-410',
      label: 'Structural Heart',
      site: 'NYC-001',
      status: 'pending',
      blockers: ['Upload structural case bundle', 'Hybrid OR simulation not scheduled'],
      nextReview: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      code: 'ROBOT-500',
      label: 'Robotic PCI',
      site: 'PA-003',
      status: 'missing',
      blockers: ['Vendor proctor attestations missing', 'FPPE observation required'],
    },
    {
      code: 'HYBRID-720',
      label: 'Hybrid Suite Lead',
      site: 'PA-003',
      status: 'conflict',
      blockers: ['Conflicts with pediatric call coverage', 'Needs pediatrics leadership waiver'],
    },
  ];

  return {
    clinicianId: DEMO_CLINICIAN_ID,
    privileges,
    recommendations: [
      {
        label: 'Upload structural heart bundle',
        description: 'Attaches MER and fluoroscopy badge audit to align with system baseline.',
        href: '/demo/clinician/revalidation',
      },
      {
        label: 'Schedule robotic simulation',
        description: 'Vendor-led simulation satisfies FPPE observation requirement.',
        href: '/demo/org/fppe',
      },
      {
        label: 'Route hybrid waiver',
        description: 'Submit hybrid suite waiver to committee packet prior to next MEC.',
        href: '/demo/org/privileges/admin/editor',
      },
    ],
    generatedAt: new Date().toISOString(),
  };
}


