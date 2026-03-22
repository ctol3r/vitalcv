'use client';

export const dynamic = 'force-dynamic';

/**
 * /passport — Wallet entry point
 *
 * This is THE PRODUCT.
 * User enters NPI → system fetches passport → shows READY/PARTIAL/BLOCKED
 * TYPE → SEE → TRUST → SHARE
 *
 * No dashboard. No tabs. One card. One truth.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type ReadinessStatus = 'READY' | 'PARTIAL' | 'BLOCKED';

interface PassportPreview {
  entityId:    string;
  npi:         string;
  displayName: string;
  specialty?:  string;
  readiness: {
    status:             ReadinessStatus;
    score:              number;
    blockers:           string[];
    gaps:               string[];
    estimatedStartDays: number | null;
  };
  authority: {
    summary: { active: number; expired: number; stale: number; missing: string[] };
  };
  standing: {
    exclusionClear:  boolean;
    licensureStatus: string;
  };
  lastCheckedAt: string;
}

const STATUS_CONFIG: Record<ReadinessStatus, {
  label: string; color: string; bg: string; border: string;
}> = {
  READY:   { label: 'Ready to start', color: 'text-white',     bg: 'bg-white/8',  border: 'border-white/15' },
  PARTIAL: { label: 'Partially ready', color: 'text-white/65', bg: 'bg-white/5',  border: 'border-white/10' },
  BLOCKED: { label: 'Action required', color: 'text-white/45', bg: 'bg-white/4',  border: 'border-white/8'  },
};

export default function PassportPage() {
  const router = useRouter();
  const [npi,      setNpi]      = useState('');
  const [loading,  setLoading]  = useState(false);
  const [passport, setPassport] = useState<PassportPreview | null>(null);
  const [error,    setError]    = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = npi.trim();
    if (!/^\d{10}$/.test(trimmed)) { setError('Enter a valid 10-digit NPI.'); return; }

    setLoading(true);
    setError(null);
    setPassport(null);

    try {
      const res  = await fetch(`/api/passport/npi/${trimmed}`);
      const data = await res.json() as PassportPreview & { error?: string };

      if (!res.ok || data.error) {
        // Fallback: resolve entity first, then get passport
        const resolveRes  = await fetch(`/api/entity/resolve/npi/${trimmed}`);
        if (!resolveRes.ok) throw new Error('NPI not found in NPPES.');
        const resolved = await resolveRes.json() as { entity: { id: string }};
        router.push(`/passport/${resolved.entity.id}`);
        return;
      }

      setPassport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const status = passport?.readiness.status;
  const cfg    = status ? STATUS_CONFIG[status] : null;

  return (
    <main className="min-h-screen bg-vt-surface-ops-base flex flex-col items-center px-4 pt-16 sm:pt-24 pb-20">
      <div className="w-full max-w-sm space-y-8">

        {/* Wordmark */}
        <div className="text-center">
          <span className="text-white/45 text-xs tracking-widest uppercase">VitalCV</span>
          <h1 className="text-white text-2xl font-semibold tracking-tight mt-1">
            Your trust passport
          </h1>
          <p className="text-white/45 text-sm mt-2">
            Enter your NPI to see your credential readiness.
          </p>
        </div>

        {/* NPI entry */}
        {!passport && (
          <form onSubmit={handleSubmit} className="space-y-3">
            <label htmlFor="passport-npi" className="sr-only">Your NPI number</label>
            <input
              id="passport-npi"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{10}"
              maxLength={10}
              value={npi}
              onChange={e => setNpi(e.target.value.replace(/\D/g, ''))}
              placeholder="1234567890"
              className="w-full bg-white/6 border border-white/12 rounded-xl px-4 py-4 text-white placeholder:text-white/25 text-[16px] tracking-widest text-center focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all"
              aria-label="NPI number"
            />
            {error && <p className="text-red-400/75 text-xs text-center">{error}</p>}
            <button
              type="submit"
              disabled={loading || npi.length !== 10}
              className="w-full bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 disabled:opacity-40 text-white rounded-full py-3.5 text-sm font-medium transition-all min-h-[48px]"
            >
              {loading ? 'Looking up…' : 'View my passport'}
            </button>
            <p className="text-center text-white/25 text-xs">No login required to preview</p>
          </form>
        )}

        {/* Passport card — THE PRODUCT */}
        {passport && cfg && (
          <div className={`rounded-2xl border ${cfg.border} ${cfg.bg} p-6 space-y-5 animate-fade-in-up`}>

            {/* Identity */}
            <div>
              <p className="text-white/35 text-xs uppercase tracking-widest mb-1">Provider</p>
              <h2 className="text-white text-lg font-semibold leading-tight">{passport.displayName}</h2>
              {passport.specialty && (
                <p className="text-white/55 text-sm mt-0.5">{passport.specialty}</p>
              )}
              <p className="text-white/25 text-xs mt-1">NPI {passport.npi}</p>
            </div>

            {/* Readiness status — the most important signal */}
            <div className={`rounded-xl border ${cfg.border} bg-black/20 px-4 py-3.5 flex items-center justify-between`}>
              <span className={`text-sm font-medium ${cfg.color}`}>{cfg.label}</span>
              <span className="text-white/35 text-xs tabular-nums">{passport.readiness.score}/100</span>
            </div>

            {/* Verified items */}
            {passport.authority.summary.active > 0 && (
              <div className="space-y-2">
                <p className="text-white/35 text-xs uppercase tracking-widest">Verified</p>
                <ul className="space-y-1.5">
                  {passport.standing.exclusionClear && (
                    <li className="flex items-center gap-2.5 text-white/65 text-sm">
                      <span className="text-white/35 text-xs">✓</span>
                      No exclusions or sanctions
                    </li>
                  )}
                  {passport.standing.licensureStatus === 'verified' && (
                    <li className="flex items-center gap-2.5 text-white/65 text-sm">
                      <span className="text-white/35 text-xs">✓</span>
                      State license verified
                    </li>
                  )}
                  {Array.from({ length: passport.authority.summary.active }, (_, i) => (
                    <li key={i} className="flex items-center gap-2.5 text-white/65 text-sm">
                      <span className="text-white/35 text-xs">✓</span>
                      Active credential {i + 1}
                    </li>
                  )).slice(0, 3)}
                </ul>
              </div>
            )}

            {/* Missing items */}
            {(passport.readiness.blockers.length > 0 || passport.authority.summary.missing.length > 0) && (
              <div className="space-y-2">
                <p className="text-white/35 text-xs uppercase tracking-widest">Needed</p>
                <ul className="space-y-1.5">
                  {[...passport.readiness.blockers, ...passport.authority.summary.missing].slice(0, 4).map((item, i) => (
                    <li key={i} className="flex items-center gap-2.5 text-white/45 text-sm">
                      <span className="text-white/20 text-xs">✕</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Estimated start */}
            {passport.readiness.estimatedStartDays !== null && (
              <div className="border-t border-white/8 pt-4">
                <p className="text-white/35 text-xs uppercase tracking-widest">Estimated start</p>
                <p className="text-white/70 text-sm mt-1">
                  {passport.readiness.estimatedStartDays === 0
                    ? 'Ready now'
                    : `~${passport.readiness.estimatedStartDays} days to clear`}
                </p>
              </div>
            )}

            {/* Share CTA */}
            <Link
              href={`/passport/${passport.entityId}`}
              className="block w-full bg-emerald-500 hover:bg-emerald-400 text-white text-center rounded-full py-3.5 text-sm font-medium transition-all min-h-[48px] leading-[48px]"
            >
              Share my passport
            </Link>

            {/* Start over */}
            <button
              onClick={() => { setPassport(null); setNpi(''); }}
              className="w-full text-white/30 hover:text-white/50 text-xs py-2 transition-colors min-h-[44px]"
            >
              Check a different NPI
            </button>
          </div>
        )}

        {/* Entry footer */}
        {!passport && (
          <p className="text-center text-white/20 text-xs">
            Already have an account?{' '}
            <Link href="/sign-in" className="text-white/40 underline underline-offset-2 hover:text-white/60 transition-colors">
              Sign in
            </Link>
          </p>
        )}

      </div>
    </main>
  );
}
