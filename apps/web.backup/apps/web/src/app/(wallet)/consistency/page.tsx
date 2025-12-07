'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, RefreshCcw, Shield, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  'http://localhost:4000';

interface ConsistencyResult {
  consistent: boolean;
  discrepancies: Array<{
    field: string;
    values: Record<string, any>;
    sources: string[];
  }>;
  score: number;
}

export default function ConsistencyPage() {
  const [consistency, setConsistency] = useState<ConsistencyResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [clinicianId, setClinicianId] = useState('');

  useEffect(() => {
    setClinicianId('demo_clinician_123');
    loadConsistency('demo_clinician_123');
  }, []);

  async function loadConsistency(id: string) {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/credential-consistency/${id}`);
      if (response.ok) {
        const data = await response.json();
        setConsistency(data);
      }
    } catch (error) {
      console.error('Failed to load consistency:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAnchor() {
    try {
      const response = await fetch(`${API_BASE}/api/credential-consistency/${clinicianId}/anchor`, {
        method: 'POST',
      });
      if (response.ok) {
        const data = await response.json();
        alert(`Anchored! TX: ${data.txHash}`);
      }
    } catch (error) {
      console.error('Failed to anchor:', error);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="space-y-2">
        <Badge variant="secondary">Wallet · Credential Consistency</Badge>
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <h1 className="text-3xl font-semibold leading-tight">Cross-Platform Consistency</h1>
            <p className="text-muted-foreground">
              Ensure credentials are consistent across devices, wallets, chains, regions, and issuers
            </p>
          </div>
          <div className="ml-auto flex gap-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => loadConsistency(clinicianId)}
              disabled={loading}
            >
              <RefreshCcw className={cn('h-4 w-4', loading && 'animate-spin')} />
              Refresh
            </Button>
            <Button variant="outline" onClick={handleAnchor}>
              Anchor Snapshot
            </Button>
          </div>
        </div>
      </header>

      {consistency && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Consistency Score</CardTitle>
              <CardDescription>Overall credential consistency rating</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-semibold">{consistency.score}%</span>
                <Badge
                  variant={
                    consistency.score >= 90
                      ? 'default'
                      : consistency.score >= 70
                        ? 'secondary'
                        : 'destructive'
                  }
                >
                  {consistency.score >= 90
                    ? 'Excellent'
                    : consistency.score >= 70
                      ? 'Good'
                      : 'Needs Attention'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {consistency.discrepancies.length > 0 && (
            <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                  <AlertCircle className="h-5 w-5" />
                  Inconsistencies Detected
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {consistency.discrepancies.map((disc, idx) => (
                    <div key={idx} className="rounded-lg border border-amber-300 p-3">
                      <div className="font-semibold text-amber-900 dark:text-amber-100">
                        {disc.field}
                      </div>
                      <div className="mt-2 space-y-1 text-sm">
                        {Object.entries(disc.values).map(([source, value]) => (
                          <div key={source} className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {source}
                            </Badge>
                            <span className="text-muted-foreground">{JSON.stringify(value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {consistency.consistent && (
            <Card className="border-green-500 bg-green-50 dark:bg-green-950">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-300">
                  <CheckCircle2 className="h-5 w-5" />
                  All Credentials Consistent
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-green-800 dark:text-green-200">
                  All credentials are consistent across all platforms and sources.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

