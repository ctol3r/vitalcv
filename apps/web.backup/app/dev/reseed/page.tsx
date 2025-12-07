"use client";
import { useState, useEffect } from 'react';

const KEYS = ['domain', 'physician', 'trace', 'compacts', 'staterules', 'exams', 'etl'];

export default function Reseed() {
  const [seeds, setSeeds] = useState<Record<string, boolean>>({
    domain: true,
    physician: true,
    trace: true
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [role, setRole] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/dev/me');
        const json = await res.json();
        setRole(json.role || 'viewer');
      } catch (error) {
        console.error('Failed to fetch user role:', error);
        setRole('viewer');
      } finally {
        setRoleLoading(false);
      }
    })();
  }, []);

  function toggle(k: string) {
    setSeeds(s => ({ ...s, [k]: !s[k] }));
  }

  async function run() {
    if (!confirm('This will wipe demo data and reseed selected items. Continue?')) return;

    setLoading(true);
    setResult(null);

    try {
      const r = await fetch('/ops/demo-reset', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ seeds })
      });
      const js = await r.json();
      setResult(js);
    } catch (e: any) {
      setResult({ error: e.message });
    } finally {
      setLoading(false);
    }
  }

  if (roleLoading) {
    return (
      <div className='max-w-3xl mx-auto py-8'>
        <div className='text-sm text-gray-500'>Loading...</div>
      </div>
    );
  }

  if (role !== 'admin') {
    return (
      <div className='max-w-3xl mx-auto py-8'>
        <h1 className='text-xl font-bold mb-4'>Reseed Wizard</h1>
        <div className='p-4 bg-red-50 border border-red-200 rounded'>
          <div className='font-semibold text-red-900'>Admin Only</div>
          <div className='text-sm text-red-700 mt-1'>
            This tool requires admin privileges. Please contact an administrator for access.
          </div>
          <div className='text-xs text-gray-600 mt-2'>
            Your current role: <code className='bg-red-100 px-1 py-0.5 rounded'>{role}</code>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='max-w-3xl mx-auto py-8'>
      <h1 className='text-xl font-bold mb-4'>Reseed Wizard</h1>

      <div className='mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-xs'>
        ⚠️ This will delete all demo data and reseed only the selected datasets.
      </div>

      <div className='grid grid-cols-2 gap-2 mt-3'>
        {KEYS.map(k => (
          <label
            key={k}
            className='text-xs flex items-center gap-2 border rounded px-3 py-2 hover:bg-gray-50 cursor-pointer'
          >
            <input
              type='checkbox'
              checked={!!seeds[k]}
              onChange={() => toggle(k)}
            />
            <span className='font-medium'>{k}</span>
          </label>
        ))}
      </div>

      <button
        className='mt-4 px-4 py-2 bg-black text-white rounded hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed'
        onClick={run}
        disabled={loading}
      >
        {loading ? 'Running...' : 'Run Selected Seeds'}
      </button>

      {result && (
        <div className='mt-4 p-3 border rounded'>
          <div className='text-sm font-bold mb-2'>Results:</div>
          <pre className='text-xs bg-gray-50 p-3 rounded overflow-auto max-h-96'>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

