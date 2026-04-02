'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import { buildWebAppUrl } from '../../lib/webAppUrl';

/**
 * NPI lookup input — the primary conversion wedge.
 *
 * Flow:
 * 1. User enters 10-digit NPI
 * 2. On submit → POST to /api/npi/:npi
 * 3. If exists → route to /clinician?npi=...
 * 4. If not found → inline "NPI not found" error
 * 5. If network error → graceful inline message
 *
 * Edge cases:
 * - Double-submit prevention via loading flag + ref guard
 * - State reset on any input change
 * - Input disabled during request
 */
export function NpiInput() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
      setValue(digits);
      if (error) setError('');
    },
    [error],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      // ── Client-side validation ──
      if (value.length < 10) {
        setError('NPI must be exactly 10 digits');
        return;
      }

      // ── Double-submit guard ──
      if (submittingRef.current) return;
      submittingRef.current = true;
      setLoading(true);
      setError('');
      const rawRef = searchParams.get('ref');
      const ref = rawRef === 'demo' || rawRef === 'yc' || rawRef === 'direct' ? rawRef : null;
      const refQuery = ref ? `?ref=${ref}` : '';

      try {
        const res = await fetch(`/api/npi/${value}${refQuery}`);

        if (!res.ok) {
          const body = await res.json().catch(() => null);
          setError(body?.error ?? 'Invalid request');
          return;
        }

        const data: { exists: boolean } = await res.json();

        if (data.exists) {
          // Route to the real live wedge on vitalcv.com
          window.location.href = buildWebAppUrl('/passport', `?npi=${encodeURIComponent(value)}`);
        } else {
          setError('NPI not found');
        }
      } catch {
        setError('Network error — please try again');
      } finally {
        setLoading(false);
        submittingRef.current = false;
      }
    },
    [searchParams, value, router],
  );

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md">
      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="Enter 10-digit NPI"
          value={value}
          onChange={handleChange}
          disabled={loading}
          aria-label="National Provider Identifier"
          aria-describedby={error ? 'npi-error' : undefined}
          aria-invalid={error ? 'true' : undefined}
          className="w-full rounded-lg border border-border bg-transparent px-4 py-3 pr-24 text-base text-foreground placeholder:text-muted outline-none transition-theme focus:border-foreground focus:ring-1 focus:ring-foreground disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-accent-foreground transition-theme hover:opacity-80 disabled:opacity-50"
        >
          {loading ? 'Checking…' : 'Look up'}
        </button>
      </div>
      {error && (
        <p id="npi-error" role="alert" className="mt-2 text-sm text-red-500">
          {error}
        </p>
      )}
      <p className="mt-3 text-xs text-muted">
        Enter any NPI to preview a clinician credential profile.
      </p>
    </form>
  );
}
