'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle2, Info, ListChecks, Shield, RefreshCcw } from 'lucide-react';

type RiskFactor =
  | 'LICENSE_EXPIRED'
  | 'NPDB_HIT'
  | 'DEA_EXPIRED'
  | 'BOARD_EXPIRED'
  | 'PECOS_REVOKED'
  | 'SANCTION_FLAG'
  | 'LOW_OPPE'
  | 'FAILED_FPPE'
  | 'OUT_OF_STATE_WITHOUT_COMPACT'
  | 'MULTIPLE_DISCIPLINARY_ACTIONS';

interface CredentialRiskSummary {
  clinicianId: string;
  score: number;
  factors: RiskFactor[];
  updatedAt?: string;
}

const FACTOR_METADATA: Record<
  RiskFactor,
  { label: string; description: string; severity: 'critical' | 'high' | 'medium' }
> = {
  LICENSE_EXPIRED: {
    label: 'License expired',
    description: 'Primary state license requires immediate renewal or remediation.',
    severity: 'critical',
  },
  NPDB_HIT: {
    label: 'NPDB adverse action',
    description: 'An adverse NPDB entry exists and needs review.',
    severity: 'critical',
  },
  DEA_EXPIRED: {
    label: 'DEA issue',
    description: 'DEA registration is expired or in remediation.',
    severity: 'high',
  },
  BOARD_EXPIRED: {
    label: 'Board certification',
    description: 'Board certification is lapsed or pending evidence.',
    severity: 'medium',
  },
  PECOS_REVOKED: {
    label: 'PECOS revoked',
    description: 'CMS PECOS enrollment shows a deactivated or rejected status.',
    severity: 'high',
  },
  SANCTION_FLAG: {
    label: 'Sanction flag',
    description: 'OIG/LEIE or disciplinary sanction was detected during PSV.',
    severity: 'critical',
  },
  LOW_OPPE: {
    label: 'OPPE concerns',
    description: 'Latest OPPE case flagged performance issues for this clinician.',
    severity: 'medium',
  },
  FAILED_FPPE: {
    label: 'FPPE failed/overdue',
    description: 'FPPE evaluation failed or is overdue beyond the review window.',
    severity: 'high',
  },
  OUT_OF_STATE_WITHOUT_COMPACT: {
    label: 'Compact coverage gap',
    description: 'Non-home-state practice requires compact coverage or local license.',
    severity: 'medium',
  },
  MULTIPLE_DISCIPLINARY_ACTIONS: {
    label: 'Multiple disciplinary actions',
    description: 'Two or more disciplinary events detected (NPDB, sanctions, or boards).',
    severity: 'critical',
  },
};

const SCORE_BANDS = [
  { label: 'Low risk', min: 0, max: 29, color: 'from-emerald-500 to-emerald-600' },
  { label: 'Moderate risk', min: 30, max: 69, color: 'from-amber-400 to-amber-500' },
  { label: 'High risk', min: 70, max: 100, color: 'from-rose-500 to-rose-600' },
] as const;

function describeScore(score: number) {
  return SCORE_BANDS.find((band) => score >= band.min && score <= band.max) ?? SCORE_BANDS[0];
}

function formatDate(value?: string) {
  if (!value) return 'Not available';
  return new Date(value).toLocaleString();
}

function buildMockRiskSummary(clinicianId: string): CredentialRiskSummary {
  return {
    clinicianId,
    score: 58,
    updatedAt: new Date().toISOString(),
    factors: ['DEA_EXPIRED', 'LOW_OPPE', 'LICENSE_EXPIRED'],
  };
}

export default function ClinicianRiskPanel({ params }: { params: { id: string } }) {
  const [riskSummary, setRiskSummary] = useState<CredentialRiskSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/demo/org/clinicians/${params.id}/risk`, {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        throw new Error(`API responded with ${response.status}`);
      }
      const payload = await response.json();
      setRiskSummary({
        clinicianId: params.id,
        score: Math.min(100, Math.max(0, Number(payload.score) || 0)),
        factors: Array.isArray(payload.factors) ? payload.factors : [],
        updatedAt: payload.updatedAt,
      });
    } catch (err) {
      console.warn('Credential risk panel falling back to demo data', err);
      setRiskSummary(buildMockRiskSummary(params.id));
      setError('Showing demo data until the credential risk API is connected.');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const score = riskSummary?.score ?? 0;
  const band = describeScore(score);
  const factors = riskSummary?.factors ?? [];

  return (
    <div className="container mx-auto max-w-4xl space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Credential Risk Assessment</h1>
          <p className="text-muted-foreground">
            Consolidated NCQA-style risk score for clinician{' '}
            <span className="font-mono text-sm">{params.id}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={loadSummary}
            disabled={loading}
            aria-label="Refresh credential risk score"
          >
            <RefreshCcw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            Refresh
          </Button>
          <Badge variant="outline" className="text-xs">
            {riskSummary?.updatedAt ? `Updated ${formatDate(riskSummary.updatedAt)}` : 'Awaiting data'}
          </Badge>
        </div>
      </header>

      {error && (
        <div
          className="flex items-start gap-3 rounded-lg border border-amber-400/70 bg-amber-50 p-4 text-sm text-amber-900"
          role="alert"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{error}</p>
        </div>
      )}

      <Card aria-live="polite">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" aria-hidden="true" />
            Credential Risk Score
          </CardTitle>
          <CardDescription>0 = low risk, 100 = critical review required</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground" role="status">
              <Info className="h-4 w-4 animate-spin" aria-hidden="true" />
              Loading risk score…
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <div
                className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${band.color} p-6 text-white shadow-inner`}
                aria-label={`Risk score ${score} (${band.label})`}
              >
                <div className="text-sm uppercase tracking-wide opacity-80">{band.label}</div>
                <div className="text-6xl font-bold leading-none">{score}</div>
                <p className="mt-2 max-w-lg text-sm text-white/80">
                  Deterministic rollup of PSV, PECOS, DEA, board, OPPE/FPPE, and active remediation tasks.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border bg-card p-4 shadow-sm">
                  <div className="flex items-center gap-2">
                    <ListChecks className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      Triggered Factors
                    </h2>
                  </div>
                  {factors.length === 0 ? (
                    <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
                      No active risk factors. Keep PSV artifacts fresh to maintain low risk.
                    </p>
                  ) : (
                    <ul className="mt-4 space-y-4">
                      {factors.map((factor) => (
                        <li key={factor} className="rounded-lg border p-3">
                          <div className="flex items-center justify-between gap-2">
                            <Badge
                              variant="outline"
                              className={
                                FACTOR_METADATA[factor].severity === 'critical'
                                  ? 'border-red-500 text-red-600'
                                  : FACTOR_METADATA[factor].severity === 'high'
                                    ? 'border-amber-500 text-amber-600'
                                    : 'border-slate-400 text-slate-600'
                              }
                            >
                              {FACTOR_METADATA[factor].label}
                            </Badge>
                            <span className="text-xs uppercase text-muted-foreground">
                              {FACTOR_METADATA[factor].severity}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground">
                            {FACTOR_METADATA[factor].description}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="rounded-xl border bg-card p-4 shadow-sm">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      Reviewer Guidance
                    </h2>
                  </div>
                  <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                    <p>
                      Use this score to prioritize nightly credentialing reviews. High scores should trigger immediate
                      PECOS/PSV rechecks and privilege holds.
                    </p>
                    <p>
                      Triggered factors map directly to NCQA task categories so you can open remediation tasks directly
                      from the timeline.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

