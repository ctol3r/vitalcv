"use client";
import { useState } from 'react';

interface PsypactStatus {
  npi: string;
  apit: boolean;
  tap: boolean;
  epassport: string;
  expires_at: string;
}

export default function PsypactAdmin() {
  const [npi, setNpi] = useState('');
  const [row, setRow] = useState<PsypactStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function get() {
    if (!npi.trim()) {
      setError('Please enter an NPI');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const r = await fetch('/api/psych/psypact/status?npi=' + encodeURIComponent(npi));
      if (!r.ok) throw new Error('Failed to fetch status');
      setRow(await r.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setRow(null);
    } finally {
      setLoading(false);
    }
  }

  async function del() {
    if (!npi.trim()) return;

    setLoading(true);
    setError(null);

    try {
      await fetch('/api/psych/psypact/cache/' + encodeURIComponent(npi), { method: 'DELETE' });
      setRow(null);
      setNpi('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to invalidate cache');
    } finally {
      setLoading(false);
    }
  }

  const ttl = row?.expires_at
    ? Math.max(0, Math.floor((new Date(row.expires_at).getTime() - Date.now()) / 1000))
    : 0;

  return (
    <div className='max-w-3xl mx-auto py-8 px-4'>
      <h1 className='text-xl font-bold mb-4'>PSYPACT Cache Management</h1>

      <div className='bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6'>
        <h2 className='text-sm font-semibold text-blue-900 mb-2'>About PSYPACT</h2>
        <ul className='text-xs text-blue-800 space-y-1'>
          <li><strong>APIT:</strong> Authority for Interjurisdictional Practice of Telepsychology</li>
          <li><strong>TAP:</strong> Temporary Authorization to Practice</li>
          <li><strong>E.Passport:</strong> Electronic credential identifier</li>
        </ul>
      </div>

      <div className='flex gap-2 mb-4'>
        <input
          className='flex-1 p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500'
          placeholder='Enter NPI (e.g., 1234567890)'
          value={npi}
          onChange={e => setNpi(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && get()}
          disabled={loading}
        />
        <button
          className='px-4 py-2 bg-black text-white rounded hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed'
          onClick={get}
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Load'}
        </button>
        <button
          className='px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'
          onClick={del}
          disabled={loading || !row}
        >
          Invalidate
        </button>
      </div>

      {error && (
        <div className='bg-red-50 border border-red-200 rounded-lg p-3 mb-4'>
          <p className='text-sm text-red-800'>{error}</p>
        </div>
      )}

      {row && (
        <div className='border rounded-lg p-4 bg-white shadow-sm'>
          <h2 className='text-sm font-semibold mb-3'>Cache Entry for NPI: {row.npi}</h2>

          <div className='grid grid-cols-2 gap-3 text-sm'>
            <div className='flex items-center gap-2'>
              <span className='text-gray-600'>APIT:</span>
              <span className={`font-bold ${row.apit ? 'text-green-600' : 'text-gray-400'}`}>
                {String(row.apit)}
              </span>
            </div>

            <div className='flex items-center gap-2'>
              <span className='text-gray-600'>TAP:</span>
              <span className={`font-bold ${row.tap ? 'text-green-600' : 'text-gray-400'}`}>
                {String(row.tap)}
              </span>
            </div>

            <div className='flex items-center gap-2'>
              <span className='text-gray-600'>E.Passport:</span>
              <span className='font-mono text-xs'>{row.epassport || '—'}</span>
            </div>

            <div className='flex items-center gap-2'>
              <span className='text-gray-600'>TTL:</span>
              <span className={`font-bold ${ttl < 3600 ? 'text-orange-600' : 'text-green-600'}`}>
                {ttl}s
              </span>
              <span className='text-xs text-gray-500'>
                ({Math.floor(ttl / 3600)}h {Math.floor((ttl % 3600) / 60)}m)
              </span>
            </div>
          </div>

          <div className='mt-3 pt-3 border-t text-xs text-gray-500'>
            Expires: {new Date(row.expires_at).toLocaleString()}
          </div>
        </div>
      )}

      <div className='mt-8 p-4 bg-gray-50 border rounded-lg'>
        <h2 className='text-sm font-semibold mb-2'>Operations</h2>
        <ul className='text-xs text-gray-600 space-y-1'>
          <li>• Cache TTL: 90 days (configurable)</li>
          <li>• Sweeper runs nightly to purge expired entries</li>
          <li>• Manual invalidation available for real-time updates</li>
          <li>• NLC 60-day residency rule enforcement happens in AuthZ layer</li>
        </ul>
      </div>
    </div>
  );
}

