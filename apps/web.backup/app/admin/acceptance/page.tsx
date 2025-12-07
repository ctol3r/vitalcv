"use client";
import { useState } from 'react';

const BASE = process.env.NEXT_PUBLIC_AGENT_BASE || '';

export default function Acceptance() {
  const [out, setOut] = useState('');
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/ops/acceptance`);
      setOut(await r.text());
    } catch (error: any) {
      setOut(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className='max-w-3xl mx-auto py-8 px-4'>
      <h1 className='text-xl font-bold mb-4'>Acceptance Runner</h1>
      <p className='text-sm text-gray-600 mb-4'>
        Run the end-to-end acceptance test to verify all pilot path components.
      </p>
      <button
        className='px-3 py-2 bg-black text-white rounded hover:bg-gray-800 disabled:opacity-50'
        onClick={run}
        disabled={loading}
      >
        {loading ? 'Running...' : 'Run Now'}
      </button>
      {out && (
        <pre className='mt-3 text-xs bg-gray-50 p-3 rounded overflow-auto border'>
          {out}
        </pre>
      )}
    </div>
  );
}

