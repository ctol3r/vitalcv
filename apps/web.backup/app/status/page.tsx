"use client";
import { useEffect, useState } from 'react';

export default function Status() {
  const [d, setD] = useState<any>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    (async () => {
      try {
        const base = process.env.NEXT_PUBLIC_AGENT_BASE || '';
        const url = base.replace('/api/agent', '/statuspage');
        const r = await fetch(url);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        setD(await r.json());
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className='max-w-3xl mx-auto py-8 px-4'>
      <h1 className='text-xl font-bold mb-4'>System Status</h1>

      {loading && <div className='text-sm opacity-70'>Loading status…</div>}

      {error && (
        <div className='bg-red-50 border border-red-200 rounded p-3 mb-4'>
          <p className='text-sm text-red-900'>Error: {error}</p>
        </div>
      )}

      {d && (
        <>
          <div className='mb-4'>
            <div className={`inline-block px-3 py-1 rounded text-sm font-medium ${
              d.status === 'operational'
                ? 'bg-green-100 text-green-800'
                : 'bg-yellow-100 text-yellow-800'
            }`}>
              {d.status === 'operational' ? '✓ Operational' : '⚠ Degraded'}
            </div>
            <p className='text-xs opacity-60 mt-2'>Last checked: {d.timestamp}</p>
          </div>

          <div className='grid gap-3'>
            <StatusItem label="Health Check" value={d.health?.ok} />
            <StatusItem label="Metrics Endpoint" value={d.metrics} />
            <StatusItem label="JWKS Endpoint" value={d.jwks} />
          </div>

          <details className='mt-6'>
            <summary className='cursor-pointer text-sm font-medium mb-2'>Raw Response</summary>
            <pre className='text-xs bg-gray-50 p-3 rounded overflow-auto'>
              {JSON.stringify(d, null, 2)}
            </pre>
          </details>
        </>
      )}
    </div>
  );
}

function StatusItem({ label, value }: { label: string; value: boolean | undefined }) {
  return (
    <div className={`p-3 border rounded ${value ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
      <div className='font-semibold text-sm'>{label}</div>
      <div className={`text-xs mt-1 ${value ? 'text-green-700' : 'text-red-700'}`}>
        {value ? '✓ OK' : '✗ Failed'}
      </div>
    </div>
  );
}

