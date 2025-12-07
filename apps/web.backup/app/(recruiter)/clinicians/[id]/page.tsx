import { AtsExportPanel } from './ats-export';

export default function RecruiterClinicianPage({ params }: { params: { id: string } }) {
  return (
    <div className="container mx-auto max-w-4xl space-y-6 py-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Clinician ATS Handoff</h1>
        <p className="text-muted-foreground">
          Push verification bundles for clinician {params.id} to connected ATS destinations.
        </p>
      </div>
      <AtsExportPanel clinicianId={params.id} />
    </div>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  ShieldCheck,
  ShieldAlert,
  Link as LinkIcon,
  Activity,
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  MinusCircle,
} from 'lucide-react';

type ChainStatus = 'anchored' | 'pending' | 'stale';

interface Credential {
  id: string;
  label: string;
  issuer: string;
  type: string;
  status: 'verified' | 'expiring' | 'flagged';
  chainStatus: ChainStatus;
  lastVerified: string;
  readinessWeight: number;
  indicators: string[];
}

interface ClinicianDetail {
  id: string;
  name: string;
  specialty: string;
  readinessScore: number;
  readinessState: 'ready' | 'partial' | 'blocked';
  sanctions: { severity: 'none' | 'watch' | 'critical'; flags: string[] };
  npdb: { flagged: boolean; lastQueried: string };
  boardCertifications: string[];
  credentials: Credential[];
}

const chainTone: Record<ChainStatus, { label: string; color: string; icon: JSX.Element }> = {
  anchored: {
    label: 'Anchored',
    color: 'text-emerald-600',
    icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
  },
  pending: {
    label: 'Pending',
    color: 'text-amber-600',
    icon: <MinusCircle className="h-4 w-4 text-amber-500" />,
  },
  stale: {
    label: 'Stale',
    color: 'text-rose-600',
    icon: <AlertTriangle className="h-4 w-4 text-rose-600" />,
  },
};

export default function RecruiterClinicianDetailPage() {
  const params = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<ClinicianDetail | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    const load = async () => {
      await new Promise((resolve) => setTimeout(resolve, 350));
      if (controller.signal.aborted) return;
      setDetail(buildMockDetail(params.id));
      setLoading(false);
    };

    load();
    return () => controller.abort();
  }, [params.id]);

  const chainHealth = useMemo(() => {
    if (!detail) return 0;
    const anchorWeight = detail.credentials.reduce((weight, credential) => {
      if (credential.chainStatus === 'anchored') return weight + credential.readinessWeight;
      if (credential.chainStatus === 'pending') return weight + credential.readinessWeight * 0.5;
      return weight;
    }, 0);
    const totalWeight = detail.credentials.reduce((sum, credential) => sum + credential.readinessWeight, 0);
    return Math.round((anchorWeight / Math.max(totalWeight, 1)) * 100);
  }, [detail]);

  if (loading) {
    return (
      <div className="container mx-auto px-6 py-12">
        <div className="space-y-4">
          <div className="h-10 w-1/3 animate-pulse rounded-md bg-muted" />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="h-64 animate-pulse rounded-xl bg-muted" />
            <div className="h-64 animate-pulse rounded-xl bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="container mx-auto px-6 py-12">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Clinician not found</AlertTitle>
          <AlertDescription>Unable to load recruiter view for this clinician.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl px-6 py-10 space-y-8">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">Recruiter • Credential intelligence</p>
        <h1 className="text-3xl font-semibold tracking-tight">{detail.name}</h1>
        <p className="text-muted-foreground">{detail.specialty}</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Readiness & chain intelligence</CardTitle>
            <CardDescription>Full signal graph with credential anchoring detail.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <ChainSignal
                title="Readiness Score"
                value={`${Math.round(detail.readinessScore * 100)}%`}
                description="Recruiter readiness blend"
                variant={detail.readinessState}
              />
              <ChainSignal title="Chain Health" value={`${chainHealth}%`} description="Anchored credential weight" variant={chainHealth > 84 ? 'ready' : 'partial'} />
              <ChainSignal
                title="Sanctions posture"
                value={detail.sanctions.severity === 'none' ? 'Clear' : 'Watch'}
                description={`${detail.sanctions.flags.length} tracker${
                  detail.sanctions.flags.length === 1 ? '' : 's'
                }`}
                variant={detail.sanctions.severity === 'critical' ? 'blocked' : detail.sanctions.severity === 'watch' ? 'partial' : 'ready'}
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Credential Graph ({detail.credentials.length})</p>
                <Badge variant="outline" className="gap-1">
                  <Activity className="h-3 w-3" />
                  Node-weighted coverage
                </Badge>
              </div>
              <Separator className="my-3" />

              <div className="space-y-4">
                {detail.credentials.map((credential) => (
                  <div key={credential.id} className="flex flex-col gap-3 rounded-lg border p-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{credential.type}</Badge>
                        <p className="font-medium">{credential.label}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">Issuer: {credential.issuer}</p>
                      <p className="text-xs text-muted-foreground">
                        Verified {new Date(credential.lastVerified).toLocaleDateString()}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {credential.indicators.map((indicator) => (
                          <Badge key={indicator} variant="outline" className="text-[11px]">
                            {indicator}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-sm font-semibold">{chainTone[credential.chainStatus].label}</p>
                        <p className={`text-xs ${chainTone[credential.chainStatus].color} flex items-center justify-end gap-1`}>
                          {chainTone[credential.chainStatus].icon}
                          Chain status
                        </p>
                      </div>
                      <div className="w-28">
                        <Progress value={credential.readinessWeight * 100} />
                        <p className="text-right text-[11px] text-muted-foreground mt-1">readiness weight</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                NPDB & Board Certs
              </CardTitle>
              <CardDescription>Live trust indicators</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">NPDB Flag</p>
                  <p className="text-xs text-muted-foreground">Queried {detail.npdb.lastQueried}</p>
                </div>
                <Badge variant={detail.npdb.flagged ? 'destructive' : 'outline'} className="gap-1">
                  {detail.npdb.flagged ? <ShieldAlert className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
                  {detail.npdb.flagged ? 'Action required' : 'Clear'}
                </Badge>
              </div>
              <Separator />
              <div>
                <p className="text-sm font-medium mb-2">Board Certifications</p>
                <div className="space-y-2">
                  {detail.boardCertifications.map((board) => (
                    <div key={board} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                      <span>{board}</span>
                      <Badge variant="secondary">Verified</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LinkIcon className="h-4 w-4" />
                Sanctions & Flags
              </CardTitle>
              <CardDescription>Regulatory intelligence feed</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {detail.sanctions.flags.length === 0 && (
                <Alert>
                  <ShieldCheck className="h-4 w-4" />
                  <AlertTitle>No sanctions</AlertTitle>
                  <AlertDescription>All regulators report clean records.</AlertDescription>
                </Alert>
              )}
              {detail.sanctions.flags.map((flag) => (
                <div key={flag} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                  <CircleDot className="h-3 w-3 text-amber-500" />
                  <span>{flag}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function buildMockDetail(id: string): ClinicianDetail {
  return {
    id,
    name: 'Dr. Lena Ortiz',
    specialty: 'Acute Care Nurse Practitioner • Compact Ready',
    readinessScore: 0.91,
    readinessState: 'ready',
    sanctions: {
      severity: 'watch',
      flags: ['DEA follow-up scheduled'],
    },
    npdb: {
      flagged: false,
      lastQueried: '2025-11-01',
    },
    boardCertifications: ['AANP Acute Care', 'ANCC Family Practice'],
    credentials: [
      {
        id: 'cred-license-ny',
        label: 'NY RN License',
        issuer: 'NYSED',
        type: 'License',
        status: 'verified',
        chainStatus: 'anchored',
        lastVerified: new Date().toISOString(),
        readinessWeight: 1,
        indicators: ['PSV-verified', 'Compact eligible'],
      },
      {
        id: 'cred-license-nj',
        label: 'NJ APRN License',
        issuer: 'NJ Board of Nursing',
        type: 'License',
        status: 'verified',
        chainStatus: 'pending',
        lastVerified: new Date().toISOString(),
        readinessWeight: 0.9,
        indicators: ['Renewal due 2026'],
      },
      {
        id: 'cred-board-1',
        label: 'AANP Acute Care NP Board',
        issuer: 'AANP',
        type: 'Board Cert',
        status: 'verified',
        chainStatus: 'anchored',
        lastVerified: new Date().toISOString(),
        readinessWeight: 0.85,
        indicators: ['NPDB link'],
      },
      {
        id: 'cred-sanctions-1',
        label: 'OIG Sanctions Scan',
        issuer: 'HHS OIG',
        type: 'Sanctions',
        status: 'verified',
        chainStatus: 'anchored',
        lastVerified: new Date().toISOString(),
        readinessWeight: 0.4,
        indicators: ['No findings'],
      },
    ],
  };
}

function ChainSignal({
  title,
  value,
  description,
  variant,
}: {
  title: string;
  value: string;
  description: string;
  variant: 'ready' | 'partial' | 'blocked';
}) {
  const tone =
    variant === 'ready'
      ? 'text-emerald-600 bg-emerald-50'
      : variant === 'partial'
      ? 'text-amber-600 bg-amber-50'
      : 'text-rose-600 bg-rose-50';

  return (
    <div className="rounded-xl border p-3">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="text-2xl font-semibold mt-2">{value}</p>
      <p className="text-sm text-muted-foreground">{description}</p>
      <span className={`mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${tone}`}>
        {variant === 'ready' && <CheckCircle2 className="h-3.5 w-3.5" />}
        {variant === 'partial' && <MinusCircle className="h-3.5 w-3.5" />}
        {variant === 'blocked' && <AlertTriangle className="h-3.5 w-3.5" />}
        {variant === 'ready' ? 'Ready' : variant === 'partial' ? 'Partial' : 'Blocked'}
      </span>
    </div>
  );
}

