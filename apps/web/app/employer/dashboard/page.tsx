'use client';

import { useEffect, useState } from 'react';
import { Loader2, AlertCircle, Inbox } from 'lucide-react';

type DashboardData = {
  applications?: {
    new?: number;
    under_review?: number;
    waiting_for_docs?: number;
    approved?: number;
    rejected?: number;
  };
  bottlenecks?: {
    avg_time_to_credential_days?: number;
    delayed_checks?: number;
  };
  missing_data_requests?: Array<{
    id: string;
    label: string;
    detail: string;
  }>;
};

type Phase = 'loading' | 'loaded' | 'empty' | 'error';

export default function EmployerDashboardPage() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [data, setData] = useState<DashboardData | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setPhase('loading');
      try {
        const res = await fetch('/api/employer/applications/dashboard');
        if (!res.ok) {
          if (!cancelled) setPhase('error');
          return;
        }
        const json = (await res.json()) as DashboardData;
        if (cancelled) return;

        const hasData =
          json.applications &&
          Object.values(json.applications).some((v) => typeof v === 'number' && v > 0);

        setData(json);
        setPhase(hasData ? 'loaded' : 'empty');
      } catch {
        if (!cancelled) setPhase('error');
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [retryCount]);

  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-7 w-7 text-muted-foreground animate-spin" />
          <p className="text-sm text-muted-foreground">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="max-w-sm text-center space-y-4">
          <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
          <p className="text-foreground font-medium">Couldn&apos;t load the dashboard</p>
          <p className="text-sm text-muted-foreground">Check your connection and try again.</p>
          <button
            onClick={() => setRetryCount((c) => c + 1)}
            className="rounded-lg border border-border px-5 py-2 text-sm text-muted-foreground hover:text-foreground transition"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'empty') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="max-w-sm text-center space-y-4">
          <Inbox className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="text-foreground font-medium">No applications yet</p>
          <p className="text-sm text-muted-foreground">
            When clinicians apply through VitalCV, their applications will appear here.
          </p>
        </div>
      </div>
    );
  }

  const apps = data?.applications;
  const bottlenecks = data?.bottlenecks;
  const missing = data?.missing_data_requests ?? [];

  return (
    <div className="p-8 text-foreground bg-background min-h-screen">
      <h1 className="text-3xl font-bold mb-8">Employer Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 border border-border rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Applications by State</h2>
          <ul className="space-y-2">
            {[
              ['New', apps?.new],
              ['Under Review', apps?.under_review],
              ['Waiting for Docs', apps?.waiting_for_docs],
              ['Approved', apps?.approved],
              ['Rejected', apps?.rejected],
            ].map(([label, count]) => (
              <li key={label as string} className="flex justify-between">
                <span>{label as string}</span>
                <span className="font-bold tabular-nums">{count ?? 0}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="p-6 border border-border rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Workflow Bottlenecks</h2>
          <div className="p-4 bg-amber-500/10 text-amber-600 rounded">
            <strong>Time to Credential:</strong>{' '}
            {bottlenecks?.avg_time_to_credential_days != null
              ? `${bottlenecks.avg_time_to_credential_days} days avg`
              : 'Not available'}
          </div>
          <div className="p-4 bg-destructive/10 text-destructive rounded mt-4">
            <strong>Delayed Checks:</strong>{' '}
            {bottlenecks?.delayed_checks != null
              ? `${bottlenecks.delayed_checks} applications`
              : 'None'}
          </div>
        </div>

        <div className="p-6 border border-border rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Missing Data Requests</h2>
          {missing.length === 0 ? (
            <p className="text-sm text-muted-foreground">No outstanding requests.</p>
          ) : (
            <ul className="space-y-3">
              {missing.map((req) => (
                <li key={req.id} className="p-3 border border-border rounded text-sm">
                  <strong>{req.label}</strong> — {req.detail}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
