'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

type VerificationResponse = {
  token: string;
  verifiedAt: string;
  holder: {
    id: string;
    name: string;
    npi: string;
  };
  scope: {
    purpose: string;
    expiry: string;
  };
  freshness: string;
  credentials: Array<{
    id: string;
    issuer: string;
    status: string;
  }>;
  crs: {
    score: number;
    grade: 'GREEN' | 'YELLOW' | 'RED';
    reasons: string[];
  };
};

type DecisionResponse = {
  decision: 'GREENLIGHT' | 'BLOCK';
  reasons: string[];
  receipt: {
    capsuleId: string;
    decidedAt: string;
    model: {
      name: string;
      version: string;
    };
    rulesVersion: string;
    ledgerRoot: string;
  };
};

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

export default function EmployerVerifyPage() {
  const params = useParams();
  const token = useMemo(() => {
    const raw = params?.token;
    return Array.isArray(raw) ? raw[0] : raw || '';
  }, [params]);

  const [verification, setVerification] = useState<VerificationResponse | null>(null);
  const [decision, setDecision] = useState<DecisionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [deciding, setDeciding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadVerification = async () => {
      if (!token) {
        setError('Missing share token.');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/verify/${token}`);
        const data = (await response.json()) as VerificationResponse | { error?: string };
        if (!response.ok) {
          throw new Error('error' in data && data.error ? data.error : 'Unable to verify share');
        }
        setVerification(data as VerificationResponse);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to verify share';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    void loadVerification();
  }, [token]);

  const handleDecision = async () => {
    if (!token) {
      return;
    }
    setDeciding(true);
    setError(null);
    try {
      const response = await fetch('/api/decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = (await response.json()) as DecisionResponse | { error?: string };
      if (!response.ok) {
        throw new Error('error' in data && data.error ? data.error : 'Unable to make decision');
      }
      setDecision(data as DecisionResponse);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to make decision';
      setError(message);
    } finally {
      setDeciding(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="space-y-6">
          <header className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-slate-500">Employer Verify</p>
            <h1 className="text-3xl font-semibold text-slate-900">Verification Review</h1>
            <p className="text-slate-600">
              Read-only verification summary for hiring decisions.
            </p>
          </header>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg">Clinician</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-700">
              {loading && !verification ? (
                <p>Loading verification payload...</p>
              ) : (
                <>
                  <div className="font-medium text-slate-900">{verification?.holder.name}</div>
                  <div>NPI {verification?.holder.npi}</div>
                  <div className="text-xs text-slate-500">
                    Verified {verification ? formatTimestamp(verification.verifiedAt) : ''}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg">Verified Credentials</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading && !verification ? (
                <p className="text-sm text-slate-500">Loading credentials...</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {verification?.credentials.map((credential) => (
                    <li
                      key={credential.id}
                      className="flex flex-col gap-1 rounded border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="text-slate-700">{credential.issuer}</div>
                      <Badge variant="outline" className="w-fit">
                        {credential.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
              <div className="text-xs text-slate-500">
                Freshness timestamp:{' '}
                {verification ? formatTimestamp(verification.freshness) : '—'}
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">CRS Grade</CardTitle>
              {verification?.crs ? (
                <Badge
                  variant="secondary"
                  className={
                    verification.crs.grade === 'GREEN'
                      ? 'bg-emerald-600 text-white'
                      : verification.crs.grade === 'YELLOW'
                      ? 'bg-amber-500 text-white'
                      : 'bg-rose-600 text-white'
                  }
                >
                  {verification.crs.grade}
                </Badge>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              <div>Score {verification?.crs.score ?? '—'}</div>
              {verification?.crs.reasons.length ? (
                <div>
                  <p className="font-medium text-slate-900">Reasons</p>
                  <ul className="mt-2 space-y-1 text-sm text-slate-700">
                    {verification.crs.reasons.map((reason) => (
                      <li key={reason}>- {reason}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-xs text-slate-500">No CRS deductions.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg">Decision</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={handleDecision} disabled={deciding || !verification}>
                {deciding ? 'Deciding...' : 'Make Decision'}
              </Button>

              {decision ? (
                <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-slate-900">Result</div>
                    <Badge
                      variant="secondary"
                      className={
                        decision.decision === 'GREENLIGHT'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-rose-600 text-white'
                      }
                    >
                      {decision.decision}
                    </Badge>
                  </div>
                  <div className="mt-2 text-slate-700">
                    {decision.decision === 'GREENLIGHT'
                      ? 'Can start now'
                      : 'Cannot start today'}
                  </div>
                  {decision.decision === 'BLOCK' && decision.reasons.length ? (
                    <ul className="mt-2 space-y-1 text-sm text-slate-700">
                      {decision.reasons.map((reason) => (
                        <li key={reason}>- {reason}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

type VerifiedCredential = {
  id: string;
  type: string[] | string;
  issuer: string;
  status: string;
  issuedAt: string;
  expiresAt: string;
};

type VerificationResponse = {
  token: string;
  verifiedAt: string;
  freshness: string;
  credentials: VerifiedCredential[];
  crs: {
    score: number;
    grade: 'GREEN' | 'YELLOW' | 'RED';
    reasons: { code: string; message: string; deduction: number }[];
  };
};

type DecisionResponse = {
  decision: {
    outcome: 'APPROVE' | 'REVIEW' | 'DECLINE';
    confidence: number;
    rationale: string[];
  };
  capsule: {
    id: string;
    decidedAt: string;
    model: { name: string; version: string };
    rulesVersion: string;
    ledgerRoot: string;
  };
};

export default function EmployerVerifyPage() {
  const params = useParams();
  const tokenParam = params?.token;
  const token = Array.isArray(tokenParam) ? tokenParam[0] : tokenParam;

  const [verification, setVerification] = useState<VerificationResponse | null>(null);
  const [decision, setDecision] = useState<DecisionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [deciding, setDeciding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadVerification = async () => {
      if (!token) {
        setError('Missing share token');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/verify/${token}`, { cache: 'no-store' });
        if (!response.ok) {
          throw new Error('Unable to load verification');
        }
        const data = (await response.json()) as VerificationResponse;
        setVerification(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load verification');
      } finally {
        setLoading(false);
      }
    };

    void loadVerification();
  }, [token]);

  const handleDecision = async () => {
    if (!token) return;
    setDeciding(true);
    setError(null);
    try {
      const response = await fetch('/api/decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (!response.ok) {
        throw new Error('Unable to make decision');
      }
      const data = (await response.json()) as DecisionResponse;
      setDecision(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to make decision');
    } finally {
      setDeciding(false);
    }
  };

  const gradeBadgeClass = useMemo(() => {
    switch (verification?.crs.grade) {
      case 'GREEN':
        return 'border-emerald-200 bg-emerald-50 text-emerald-900';
      case 'YELLOW':
        return 'border-amber-200 bg-amber-50 text-amber-900';
      case 'RED':
        return 'border-rose-200 bg-rose-50 text-rose-900';
      default:
        return 'border-neutral-200 bg-neutral-50 text-neutral-900';
    }
  }, [verification?.crs.grade]);

  return (
    <div className="container mx-auto max-w-4xl px-4 py-10">
      <div className="mb-6 space-y-2">
        <h1 className="text-3xl font-semibold text-neutral-900">Employer Verify</h1>
        <p className="text-sm text-muted-foreground">
          Review shared credentials and make a hiring decision.
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-neutral-200 shadow-sm">
              <CardHeader>
                <CardTitle>Verified Credentials</CardTitle>
                <CardDescription>Read-only summary of verified items.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {verification?.credentials.map((credential) => (
                  <div
                    key={credential.id}
                    className="rounded-md border border-neutral-200 bg-white p-3"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-neutral-900">
                        {Array.isArray(credential.type)
                          ? credential.type.join(', ')
                          : credential.type}
                      </p>
                      <Badge variant="outline" className="border-neutral-200">
                        {credential.status}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      ID {credential.id}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Issuer {credential.issuer}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Expires {new Date(credential.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-neutral-200 shadow-sm">
              <CardHeader>
                <CardTitle>Freshness</CardTitle>
                <CardDescription>Latest verified timestamp.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-neutral-900">
                  {verification ? new Date(verification.freshness).toLocaleString() : '—'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Verified {verification ? new Date(verification.verifiedAt).toLocaleString() : '—'}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <Card className="border-neutral-200 shadow-sm">
              <CardHeader>
                <CardTitle>Credential Readiness Score</CardTitle>
                <CardDescription>CRS grade and supporting reasons.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Grade</span>
                  <Badge variant="outline" className={gradeBadgeClass}>
                    {verification?.crs.grade ?? '—'}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  Score {verification?.crs.score ?? '—'}
                </div>
                <div className="space-y-2">
                  {verification?.crs.reasons.length ? (
                    verification.crs.reasons.map((reason) => (
                      <div key={reason.code} className="rounded-md border border-neutral-200 p-2">
                        <p className="text-xs text-neutral-900">{reason.message}</p>
                        <p className="text-[11px] text-muted-foreground">
                          Deduction {reason.deduction}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">No deductions reported.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-neutral-200 shadow-sm">
              <CardHeader>
                <CardTitle>Decision</CardTitle>
                <CardDescription>Generate a decision based on CRS.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button onClick={handleDecision} disabled={deciding} className="w-full">
                  {deciding ? 'Deciding…' : 'Make Decision'}
                </Button>

                {decision ? (
                  <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-neutral-900">
                        {decision.decision.outcome}
                      </p>
                      <Badge variant="outline" className="border-neutral-200">
                        {Math.round(decision.decision.confidence * 100)}% confidence
                      </Badge>
                    </div>
                    <div className="mt-3 space-y-1">
                      {decision.decision.rationale.map((reason) => (
                        <p key={reason} className="text-xs text-neutral-700">
                          {reason}
                        </p>
                      ))}
                    </div>
                    <p className="mt-3 text-[11px] text-muted-foreground">
                      Capsule {decision.capsule.id} • {decision.capsule.model.name}{' '}
                      {decision.capsule.model.version}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Decision output will appear here after evaluation.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
