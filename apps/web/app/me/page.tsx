'use client';

/**
 * /me — Clinician insight panel
 *
 * Shows the authenticated clinician their application stats,
 * common blockers, and match performance from the learning system.
 */

import { useEffect, useState } from 'react';
import { useRoleContext } from '@/components/auth/RoleContext';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL ?? '';

interface Performance {
  interactions: number;
  [key: string]: unknown;
}

interface ApiResponse {
  ok: boolean;
  performance: Performance;
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{value}</p>
    </div>
  );
}

export default function MePage() {
  const { clinicianNpi, isClinician, isLoaded } = useRoleContext();
  const [data, setData] = useState<Performance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isClinician || !clinicianNpi) return;

    fetch(`${API}/api/learning/performance/${clinicianNpi}`)
      .then((res) => res.json())
      .then((json: ApiResponse) => {
        if (json.ok) setData(json.performance);
        else setError('Failed to load performance data.');
      })
      .catch(() => setError('Network error.'))
      .finally(() => setLoading(false));
  }, [isLoaded, isClinician, clinicianNpi]);

  if (!isLoaded) {
    return <div className="mx-auto max-w-2xl p-8 text-zinc-500">Loading...</div>;
  }

  if (!isClinician) {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <p className="text-zinc-600 dark:text-zinc-400">
          Sign in as a clinician to view your performance insights.
        </p>
        <Link href="/sign-in" className="mt-4 inline-block text-emerald-600 underline">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">My Insights</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Your application activity and match performance.
      </p>

      {loading && <p className="mt-8 text-zinc-500">Loading performance data...</p>}
      {error && <p className="mt-8 text-red-600">{error}</p>}

      {data && (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <MetricCard label="Total Interactions" value={data.interactions} />
          {typeof data.applicationCount === 'number' && (
            <MetricCard label="Applications" value={data.applicationCount} />
          )}
          {typeof data.acceptedCount === 'number' && (
            <MetricCard label="Accepted" value={data.acceptedCount} />
          )}
          {typeof data.rejectedCount === 'number' && (
            <MetricCard label="Rejected" value={data.rejectedCount} />
          )}
          {typeof data.requestedInfoCount === 'number' && (
            <MetricCard label="More Info Requested" value={data.requestedInfoCount} />
          )}
        </div>
      )}

      <div className="mt-8">
        <Link href="/passport" className="text-sm text-emerald-600 underline">
          View your passport
        </Link>
      </div>
    </div>
  );
}
