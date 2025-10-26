'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function StartPage() {
  const [npi, setNpi] = useState('');
  const [err, setErr] = useState('');
  const router = useRouter();

  function go() {
    if (!/^\d{10}$/.test(npi)) {
      setErr('Enter a valid 10-digit NPI');
      return;
    }
    router.push(`/npi/${npi}?auto=1`);
  }

  return (
    <main className="grid min-h-[70vh] place-items-center p-6">
      <div className="w-full max-w-md rounded-xl border p-6">
        <h1 className="mb-2 text-2xl font-semibold">Welcome</h1>
        <p className="mb-4 text-sm text-neutral-500">
          Enter your NPI to begin. This looks up public record and lets you claim the NPI.
        </p>
        <div className="space-y-3">
          <input
            inputMode="numeric"
            pattern="\d{10}"
            value={npi}
            onChange={(e) => {
              setErr('');
              setNpi(e.target.value.replace(/\D/g, '').slice(0, 10));
            }}
            placeholder="10-digit NPI"
            className="w-full rounded border p-3"
          />
          {err && <div className="text-xs text-red-600">{err}</div>}
          <button onClick={go} className="w-full rounded bg-neutral-900 px-3 py-2 text-white">
            Continue
          </button>
        </div>
        <div className="mt-6 text-xs text-neutral-500">
          Public lookup ≠ login. Claiming verifies your identity in steps (L1–L3).
        </div>
      </div>
    </main>
  );
}
