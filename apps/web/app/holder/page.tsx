'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

type ShareResponse = {
  token: string;
  verifyUrl: string;
  readiness: {
    status: 'READY' | 'NOT_READY';
    reasons: string[];
    crsGrade: 'GREEN' | 'YELLOW' | 'RED';
  };
  holder: {
    id: string;
    name: string;
    npi: string;
  };
  scope: {
    purpose: string;
    expiry: string;
  };
  issuedAt: string;
  expiresAt: string;
};

const DEMO_HOLDER_ID = 'did:holder:demo-0001';

function buildDefaultScope(): ShareResponse['scope'] {
  const expiry = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();
  return { purpose: 'employment_verification', expiry };
}

export default function HolderHomePage() {
  const [share, setShare] = useState<ShareResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bootRef = useRef(false);

  const status = share?.readiness.status ?? 'NOT_READY';

  const handleShare = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          holderId: DEMO_HOLDER_ID,
          scope: buildDefaultScope(),
        }),
      });
      const data = (await response.json()) as ShareResponse | { error?: string };
      if (!response.ok) {
        throw new Error('error' in data && data.error ? data.error : 'Unable to share VitalCV');
      }
      setShare(data as ShareResponse);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to share VitalCV';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (bootRef.current) {
      return;
    }
    bootRef.current = true;
    void handleShare();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <div className="space-y-6">
          <header className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-slate-500">Holder Home</p>
            <h1 className="text-3xl font-semibold text-slate-900">VitalCV Readiness</h1>
            <p className="text-slate-600">
              Share a time-bound verification link with employers.
            </p>
          </header>

          <Card className="border-slate-200">
            <CardHeader className="space-y-2">
              <CardTitle className="flex items-center justify-between text-lg">
                <span>Readiness Status</span>
                <Badge
                  variant="secondary"
                  className={
                    status === 'READY'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-rose-600 text-white'
                  }
                >
                  {status}
                </Badge>
              </CardTitle>
              <p className="text-sm text-slate-500">
                {share?.holder?.name ? `${share.holder.name} • NPI ${share.holder.npi}` : 'Demo holder'}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {status === 'NOT_READY' && share?.readiness.reasons?.length ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                  <p className="font-medium">Why not ready</p>
                  <ul className="mt-2 space-y-1">
                    {share.readiness.reasons.map((reason) => (
                      <li key={reason}>- {reason}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              <div className="flex flex-col gap-3">
                <Button onClick={handleShare} disabled={loading}>
                  {loading ? 'Sharing...' : 'Share VitalCV'}
                </Button>
                <span className="text-xs text-slate-500">Time-bound. Revocable.</span>
              </div>

              {share?.verifyUrl ? (
                <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Share URL</div>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <code className="break-all rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">
                      {share.verifyUrl}
                    </code>
                    <Button asChild variant="outline" size="sm">
                      <Link href={share.verifyUrl} target="_blank" rel="noreferrer">
                        Open Verify
                      </Link>
                    </Button>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    Expires {new Date(share.expiresAt).toLocaleString()}
                  </div>
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

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

type ShareResponse = {
  token: string;
  verifyUrl: string;
  readiness: {
    status: 'READY' | 'NOT_READY';
    reasons: string[];
  };
  issuedAt: string;
};

export default function HolderHomePage() {
  const [readiness, setReadiness] = useState<ShareResponse['readiness'] | null>(null);
  const [shareResult, setShareResult] = useState<ShareResponse | null>(null);
  const [loadingReadiness, setLoadingReadiness] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReadiness = async () => {
    setLoadingReadiness(true);
    setError(null);
    try {
      const response = await fetch('/api/share', { method: 'POST' });
      if (!response.ok) {
        throw new Error('Failed to load readiness');
      }
      const data = (await response.json()) as ShareResponse;
      setReadiness(data.readiness);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load readiness');
    } finally {
      setLoadingReadiness(false);
    }
  };

  useEffect(() => {
    void fetchReadiness();
  }, []);

  const handleShare = async () => {
    setSharing(true);
    setError(null);
    try {
      const response = await fetch('/api/share', { method: 'POST' });
      if (!response.ok) {
        throw new Error('Failed to share VitalCV');
      }
      const data = (await response.json()) as ShareResponse;
      setShareResult(data);
      setReadiness(data.readiness);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to share VitalCV');
    } finally {
      setSharing(false);
    }
  };

  const readinessBadgeClass =
    readiness?.status === 'NOT_READY'
      ? 'border-amber-200 bg-amber-50 text-amber-900'
      : 'border-emerald-200 bg-emerald-50 text-emerald-900';

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 space-y-2">
        <h1 className="text-3xl font-semibold text-neutral-900">Holder Home</h1>
        <p className="text-sm text-muted-foreground">
          Share your VitalCV package once you are ready.
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-6">
        <Card className="border-neutral-200 shadow-sm">
          <CardHeader>
            <CardTitle>Readiness</CardTitle>
            <CardDescription>Current eligibility to share your VitalCV.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingReadiness ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-64" />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge variant="outline" className={readinessBadgeClass}>
                    {readiness?.status ?? 'READY'}
                  </Badge>
                </div>
                {readiness?.status === 'NOT_READY' && readiness.reasons.length > 0 && (
                  <div className="rounded-md border border-amber-100 bg-amber-50/60 p-3">
                    <p className="text-sm font-medium text-amber-900">Reasons</p>
                    <ul className="mt-2 space-y-1 text-sm text-amber-800">
                      {readiness.reasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-neutral-200 shadow-sm">
          <CardHeader>
            <CardTitle>Share VitalCV</CardTitle>
            <CardDescription>Generate a verifier link for the employer.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={handleShare} disabled={sharing} className="w-full">
              {sharing ? 'Sharing…' : 'Share VitalCV'}
            </Button>

            {shareResult ? (
              <div className="space-y-3 rounded-md border border-neutral-200 bg-neutral-50 p-4">
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Share link</p>
                  <p className="mt-1 break-all font-mono text-sm text-neutral-900">
                    {shareResult.verifyUrl}
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button asChild variant="outline" className="w-full">
                    <Link href={shareResult.verifyUrl}>Open Employer View</Link>
                  </Button>
                  <Button asChild className="w-full">
                    <Link href={shareResult.verifyUrl} target="_blank">
                      Open in New Tab
                    </Link>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Issued {new Date(shareResult.issuedAt).toLocaleString()} • Token{' '}
                  {shareResult.token}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Sharing creates a one-time verification link for the employer.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
