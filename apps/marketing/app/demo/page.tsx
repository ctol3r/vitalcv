'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const SAMPLE_NPIS = [
  { npi: '1003000126', label: 'Robert Smith' },
  { npi: '1497758544', label: 'Mary Johnson' },
  { npi: '1588667638', label: 'James Williams' },
];

export default function DemoLanding() {
  const router = useRouter();
  const [npi, setNpi] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleNpiChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setNpi(e.target.value.replace(/\D/g, '').slice(0, 10));
      setError('');
    },
    [],
  );

  const handleSubmit = useCallback(
    async (submittedNpi?: string) => {
      const target = submittedNpi ?? npi;
      if (target.length !== 10) {
        setError('Enter a 10-digit NPI');
        return;
      }

      setLoading(true);
      setError('');

      try {
        const res = await fetch('/api/demo/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ npi: target }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Verification failed (${res.status})`);
        }

        const data = await res.json();
        // Store artifact data in sessionStorage for the dashboard
        sessionStorage.setItem('vcv_artifact', JSON.stringify(data));
        router.push(`/demo/dashboard?npi=${target}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
        setLoading(false);
      }
    },
    [npi, router],
  );

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-6 text-white">
      {/* Logo */}
      <div className="mb-12">
        <h2 className="text-lg font-semibold tracking-[0.3em] uppercase text-white/60">
          VitalCV
        </h2>
      </div>

      {/* Headline */}
      <h1 className="max-w-lg text-center text-4xl font-semibold tracking-tight md:text-5xl">
        Verify a Healthcare Provider
      </h1>
      <p className="mt-4 max-w-md text-center text-base text-white/50">
        Enter an NPI to generate a cryptographically signed identity bundle in
        seconds.
      </p>

      {/* NPI Input */}
      <div className="mt-10 w-full max-w-md">
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="Enter 10-digit NPI"
          value={npi}
          onChange={handleNpiChange}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit();
          }}
          disabled={loading}
          className="w-full rounded-lg border border-white/20 bg-transparent px-5 py-4 text-center text-xl font-mono tracking-widest text-white placeholder:text-white/30 focus:border-white focus:outline-none disabled:opacity-50"
        />

        {error && (
          <p className="mt-3 text-center text-sm text-red-400">{error}</p>
        )}

        <button
          onClick={() => handleSubmit()}
          disabled={loading || npi.length !== 10}
          className="mt-4 w-full rounded-lg bg-white px-6 py-4 text-base font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-30"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black" />
              Verifying…
            </span>
          ) : (
            'Apply with VCV'
          )}
        </button>
      </div>

      {/* Sample NPIs */}
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        {SAMPLE_NPIS.map((sample) => (
          <button
            key={sample.npi}
            onClick={() => {
              setNpi(sample.npi);
              handleSubmit(sample.npi);
            }}
            disabled={loading}
            className="rounded-full border border-white/10 px-4 py-1.5 text-xs text-white/40 transition-colors hover:border-white/30 hover:text-white/70 disabled:opacity-30"
          >
            {sample.label} · {sample.npi}
          </button>
        ))}
      </div>

      {/* Subtle link to full wizard */}
      <a
        href="/demo/wizard"
        className="mt-12 text-xs text-white/20 transition-colors hover:text-white/40"
      >
        Full technical demo →
      </a>
    </div>
  );
}
