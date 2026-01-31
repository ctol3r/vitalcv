'use client';

import { useEffect, useState } from 'react';
import { Shield } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

import { AuthorityPanel } from '@/components/AuthorityPanel';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import type { AuthorityEvent } from '@domain-common/authorityEvents';

export default function EmployerVerifyPage() {
  const searchParams = useSearchParams();
  const [authorityEvent, setAuthorityEvent] = useState<AuthorityEvent | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const raw = searchParams.get('authority') || searchParams.get('event');
    if (!raw) {
      setError('No authority event provided. This page accepts authority event links only.');
      return;
    }

    try {
      const parsed = JSON.parse(decodeURIComponent(raw));
      setAuthorityEvent(parsed as AuthorityEvent);
      setError(null);
    } catch {
      setError('Invalid authority event token. Ensure the link is not truncated.');
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Shield className="h-8 w-8 text-blue-600" />
            <span className="text-2xl font-bold text-gray-900">VitalCV</span>
          </div>
          <span className="text-xs uppercase tracking-[0.35em] text-muted-foreground">
            Employer Verify
          </span>
        </div>
      </header>

      <main className="container mx-auto px-4 py-10 max-w-3xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Authority Acceptance</h1>
          <p className="text-gray-600 mt-2">
            Review a VitalCV authority event and record immutable acceptance.
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!error && !authorityEvent && (
          <Card className="border-dashed border-border/70 bg-card/40">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Waiting for authority event payload.
            </CardContent>
          </Card>
        )}

        {authorityEvent && <AuthorityPanel authorityEvent={authorityEvent} />}
      </main>
    </div>
  );
}
