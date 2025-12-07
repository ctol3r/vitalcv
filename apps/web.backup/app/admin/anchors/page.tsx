"use client";

import { useState } from 'react';

/**
 * Anchor Proof Viewer
 * Admin tool for verifying blockchain transaction anchors
 */
export default function Anchors() {
  const [h, setH] = useState('');
  const [out, setOut] = useState<any>();
  const [loading, setLoading] = useState(false);

  async function run() {
    if (!h.trim()) return;

    setLoading(true);
    try {
      const r = await fetch('/api/anchor/verify?txHash=' + encodeURIComponent(h));
      setOut(await r.json());
    } catch (error) {
      setOut({ error: 'Failed to verify anchor' });
    } finally {
      setLoading(false);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  return (
    <div className='max-w-3xl mx-auto py-8 px-4'>
      <h1 className='text-2xl font-bold mb-4'>Anchor Proof Viewer</h1>
      <p className='text-gray-600 mb-6'>
        Verify blockchain transaction hashes and view stored anchor proofs
      </p>

      <div className='flex gap-2'>
        <input
          className='p-2 border rounded flex-1 font-mono text-sm'
          value={h}
          onChange={e => setH(e.target.value)}
          placeholder='Enter transaction hash (e.g., 0x123...)'
          onKeyDown={e => e.key === 'Enter' && run()}
        />
        <button
          className='px-4 py-2 bg-black text-white rounded hover:bg-gray-800 disabled:opacity-50'
          onClick={run}
          disabled={loading || !h.trim()}
        >
          {loading ? 'Verifying...' : 'Verify'}
        </button>
      </div>

      {out && (
        <div className='mt-4 bg-gray-50 border rounded p-4'>
          <div className='flex justify-between items-start mb-2'>
            <h2 className='font-semibold'>Verification Result</h2>
            {out.txHash && (
              <button
                className='text-sm text-blue-600 hover:underline'
                onClick={() => copyToClipboard(out.txHash)}
              >
                Copy TxHash
              </button>
            )}
          </div>

          {out.error ? (
            <div className='text-red-600'>{out.error}</div>
          ) : (
            <div className='space-y-2'>
              {out.txHash && (
                <div>
                  <span className='font-medium'>TxHash:</span>{' '}
                  <code className='text-xs bg-white px-2 py-1 rounded'>{out.txHash}</code>
                </div>
              )}
              {out.root && (
                <div>
                  <span className='font-medium'>Root:</span>{' '}
                  <code className='text-xs bg-white px-2 py-1 rounded'>{out.root}</code>
                  <button
                    className='ml-2 text-sm text-blue-600 hover:underline'
                    onClick={() => copyToClipboard(out.root)}
                  >
                    Copy
                  </button>
                </div>
              )}
              {out.note && (
                <div className='text-sm text-gray-600 mt-2'>{out.note}</div>
              )}
            </div>
          )}

          <details className='mt-4'>
            <summary className='cursor-pointer text-sm text-gray-600 hover:text-gray-900'>
              View Raw JSON
            </summary>
            <pre className='mt-2 text-xs bg-white p-3 rounded overflow-x-auto'>
              {JSON.stringify(out, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}

