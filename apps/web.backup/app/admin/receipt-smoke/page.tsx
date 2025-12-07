"use client";
import { useState } from 'react';

const BASE = process.env.NEXT_PUBLIC_AGENT_BASE?.replace('/api/agent', '') || 'http://localhost:4000';

export default function ReceiptSmoke() {
  const [out, setOut] = useState('');
  const [running, setRunning] = useState(false);

  async function run() {
    setRunning(true);
    setOut('Running receipt smoke test...');
    try {
      const r = await fetch(`${BASE}/ops/receipt-smoke`);
      const text = await r.text();
      setOut(text);
    } catch (error) {
      setOut(`Error: ${error}`);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className='max-w-3xl mx-auto py-8 px-4'>
      <h1 className='text-2xl font-bold mb-4'>Receipt Smoke Test</h1>
      <p className='text-gray-600 mb-6'>
        End-to-end test: Generate invoice → Pay → Verify receipt email
      </p>

      <button
        className='px-4 py-2 bg-black text-white rounded hover:bg-gray-800 disabled:opacity-50'
        onClick={run}
        disabled={running}
      >
        {running ? 'Running...' : 'Run Test'}
      </button>

      {out && (
        <div className='mt-4'>
          <h2 className='font-semibold mb-2'>Output:</h2>
          <pre className='text-xs bg-gray-50 dark:bg-gray-900 p-4 rounded overflow-auto border'>
            {out}
          </pre>
          {out.includes('RECEIPT_SMOKE_OK') && (
            <div className='mt-3 p-3 bg-green-50 border border-green-200 rounded text-green-800'>
              ✓ Test passed successfully!
            </div>
          )}
        </div>
      )}
    </div>
  );
}

