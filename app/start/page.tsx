'use client';

import { lookupNpi } from '@/lib/apiClient';
import { isValidNpi } from '@/lib/npi';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function StartPage() {
  const [npi, setNpi] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const onChange = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 10);
    setNpi(digits);
    setError(null);
    if (digits.length === 10) {
      setWarning(isValidNpi(digits) ? null : "Checksum didn't match; you can still try lookup.");
    } else {
      setWarning(null);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (npi.length !== 10) {
      setError('NPI must be 10 digits.');
      return;
    }
    setLoading(true);
    try {
      await lookupNpi(npi); // just to give immediate feedback before we route
      router.push(`/npi/${npi}`);
    } catch (err: any) {
      setError(err?.message || 'Lookup failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white to-emerald-50 p-6">
      <div className="w-full max-w-md bg-white shadow rounded-lg p-6">
        <h1 className="text-2xl font-semibold text-center mb-6">VitalCV</h1>
        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block text-sm font-medium">NPI Number</label>
          <input
            value={npi}
            onChange={(e) => onChange(e.target.value)}
            inputMode="numeric"
            pattern="\d*"
            maxLength={10}
            className={`w-full border rounded px-3 py-2 outline-none ${
              error ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Enter 10-digit NPI"
          />
          {warning && !error && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
              {warning}
            </p>
          )}
          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading || npi.length !== 10}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded py-2 transition"
          >
            {loading ? 'Checking…' : 'Continue'}
          </button>
          <p className="text-xs text-center text-gray-500">
            Try a test NPI: 1538102066 · 1922074434 · 1801921143 · 1043233331
          </p>
        </form>
      </div>
    </div>
  );
}
