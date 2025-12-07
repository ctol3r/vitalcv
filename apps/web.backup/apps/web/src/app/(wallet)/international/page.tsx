'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw, Send } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { cn } from '@/lib/utils';

type EquivalencyLevel = 'FULL' | 'PARTIAL' | 'MANUAL';

type EquivalencyDecision = {
  credentialId: string;
  country: string;
  foreignType: string;
  foreignDescriptor: string;
  usEquivalent?: string;
  equivalencyLevel: EquivalencyLevel;
  rationale: string;
};

type EquivalencySummary = {
  clinicianId: string;
  evaluatedAt: string;
  accepted: EquivalencyDecision[];
  pendingManualReview: EquivalencyDecision[];
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  process.env.API_BASE_URL ??
  (typeof window !== 'undefined' ? window.location.origin : '');

const WALLET_CLINICIAN_ID = 'wallet-clinician';

export default function InternationalEligibilityPage() {
  const [summary, setSummary] = useState<EquivalencySummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRequestingReview, setIsRequestingReview] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    void loadSummary();
  }, []);

  async function loadSummary() {
    setIsRefreshing(true);
    setError(null);
    try {
      const response = await fetchInternationalEligibility(WALLET_CLINICIAN_ID);
      setSummary(response);
    } catch (err) {
      console.warn('[wallet][international] fell back to demo data', err);
      setSummary(buildFallbackEligibility());
      setError('Live equivalency service unavailable — showing demo snapshot.');
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleRequestReview() {
    if (!summary) return;
    setIsRequestingReview(true);
    setReviewSuccess(null);
    setError(null);
    try {
      await requestIssuerReview(summary.clinicianId);
      setReviewSuccess('Issuer review requested — we will notify you via wallet push.');
    } catch (err) {
      console.error('[wallet][international] review request failed', err);
      setError('Unable to contact issuer. Retry or email compliance@vitalcv.health.');
    } finally {
      setIsRequestingReview(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <header className="space-y-2">
        <Badge variant="secondary">Wallet · International Eligibility</Badge>
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="text-3xl font-semibold leading-tight">
              Cross-border equivalency snapshot
            </h1>
            <p className="text-muted-foreground">
              Clinician <span className="font-mono text-xs">{WALLET_CLINICIAN_ID}</span>
            </p>
          </div>
          <Button
            variant="outline"
            className="ml-auto gap-2"
            onClick={() => loadSummary()}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
            Refresh
          </Button>
        </div>
        {error && (
          <p className="text-sm text-amber-600">
            <AlertTriangle className="mr-1 inline h-4 w-4 align-middle" />
            {error}
          </p>
        )}
        {reviewSuccess && (
          <p className="text-sm text-emerald-600">
            <CheckCircle2 className="mr-1 inline h-4 w-4 align-middle" />
            {reviewSuccess}
          </p>
        )}
      </header>

      <section className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Accepted equivalencies</CardTitle>
            <CardDescription>
              Automatically mapped foreign credentials with US board alignment.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {summary && summary.accepted.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Jurisdiction</TableHead>
                    <TableHead>Foreign credential</TableHead>
                    <TableHead>US equivalent</TableHead>
                    <TableHead className="text-right">Level</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.accepted.map((decision) => (
                    <TableRow key={decision.credentialId}>
                      <TableCell className="font-medium">{decision.country}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{decision.foreignDescriptor}</span>
                          <span className="text-xs text-muted-foreground">
                            {decision.foreignType}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold">{decision.usEquivalent}</span>
                        <p className="text-xs text-muted-foreground">{decision.rationale}</p>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={decision.equivalencyLevel === 'FULL' ? 'default' : 'secondary'}>
                          {decision.equivalencyLevel}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState message="No cross-border equivalencies have been accepted yet." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Missing US equivalents</CardTitle>
            <CardDescription>
              Evidence we could not map — request issuer review for manual adjudication.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {summary && summary.pendingManualReview.length > 0 ? (
              <ul className="space-y-3">
                {summary.pendingManualReview.map((decision) => (
                  <li key={decision.credentialId} className="rounded-lg border bg-muted/30 p-3">
                    <div className="flex items-center justify-between text-sm font-medium">
                      <span>{decision.foreignDescriptor}</span>
                      <Badge variant="outline">{decision.country}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{decision.rationale}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState message="All submitted evidence has a mapped US equivalent." />
            )}

            <Button
              className="w-full gap-2"
              onClick={() => handleRequestReview()}
              disabled={isRequestingReview || !summary}
            >
              <Send className={cn('h-4 w-4', isRequestingReview && 'animate-pulse')} />
              Request US issuer review
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
      {message}
    </div>
  );
}

async function fetchInternationalEligibility(clinicianId: string): Promise<EquivalencySummary> {
  if (!API_BASE) {
    throw new Error('API base URL not configured');
  }

  const response = await fetch(`${API_BASE}/api/equiv/eligibility/${clinicianId}`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Equivalency API returned ${response.status}`);
  }

  return (await response.json()) as EquivalencySummary;
}

async function requestIssuerReview(clinicianId: string): Promise<void> {
  if (!API_BASE) {
    throw new Error('API base URL not configured');
  }

  const response = await fetch(`${API_BASE}/api/equiv/request-review`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ clinicianId }),
  });

  if (!response.ok) {
    throw new Error(`Issuer review endpoint returned ${response.status}`);
  }
}

function buildFallbackEligibility(): EquivalencySummary {
  const clinicianId = WALLET_CLINICIAN_ID;
  const generatedAt = new Date().toISOString();

  return {
    clinicianId,
    evaluatedAt: generatedAt,
    accepted: [
      {
        credentialId: 'demo-gmc-1',
        country: 'UK',
        foreignType: 'GMC',
        foreignDescriptor: 'General Practice (CCT)',
        usEquivalent: 'Family Medicine',
        equivalencyLevel: 'FULL',
        rationale: 'GMC CCT with revalidation maps to ABFM board certification.',
      },
      {
        credentialId: 'demo-gmc-2',
        country: 'UK',
        foreignType: 'GMC',
        foreignDescriptor: 'Foundation Year 2 (FY2)',
        usEquivalent: 'PGY1',
        equivalencyLevel: 'PARTIAL',
        rationale: 'FY2 completion meets PGY1 clinical exposure requirement.',
      },
      {
        credentialId: 'demo-eu-1',
        country: 'EU',
        foreignType: 'EU-Directive',
        foreignDescriptor: 'Cardiology',
        usEquivalent: 'Cardiovascular Disease',
        equivalencyLevel: 'FULL',
        rationale: 'Directive 2005/36/EC specialty matches ABIM cardiovascular track.',
      },
    ],
    pendingManualReview: [
      {
        credentialId: 'demo-eu-2',
        country: 'EU',
        foreignType: 'EU-Directive',
        foreignDescriptor: 'Clinical Informatics',
        equivalencyLevel: 'MANUAL',
        rationale: 'No automatic US board mapping. Provide CME proof for manual review.',
      },
    ],
  };
}










