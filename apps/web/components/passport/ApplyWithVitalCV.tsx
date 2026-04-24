'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';

interface ApplyWithVitalCVProps {
  npi: string;
  className?: string;
}

export function ApplyWithVitalCV({ npi, className = '' }: ApplyWithVitalCVProps) {
  const { userId } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleApply() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/apply/bundle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-clerk-user-id': userId ?? '',
        },
        body: JSON.stringify({ npi }),
      });
      const data = await res.json() as { bundleId?: string; error?: string };
      if (!res.ok || !data.bundleId) {
        throw new Error(data.error ?? 'Failed to create employer review bundle.');
      }
      router.push(`/apply/${data.bundleId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className={`space-y-2 ${className}`}>
        <p className="text-sm font-semibold text-foreground">Preparing employer review…</p>
        <p className="text-xs text-muted-foreground">
          Creating a fixed employer review link from this passport and opening the employer decision view.
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <button
        className="w-full py-3 bg-vt-success hover:bg-vt-success/90 rounded-xl text-sm font-semibold text-foreground transition-colors"
        onClick={handleApply}
      >
        Apply with VitalCV
      </button>
      {error ? (
        <p className="text-xs text-[var(--vt-critical)]">{error}</p>
      ) : null}
    </div>
  );
}

export default ApplyWithVitalCV;
