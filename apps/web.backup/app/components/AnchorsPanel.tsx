"use client";
import { useEffect, useState } from 'react';

const BASE = process.env.NEXT_PUBLIC_AGENT_BASE || '';

export default function AnchorsPanel() {
  const [data, setData] = useState<any>();
  const [root, setRoot] = useState('');
  const [anchorResult, setAnchorResult] = useState<any>();

  useEffect(() => {
    (async () => {
      const r = await fetch(BASE + '/audit-chain/anchors');
      setData(await r.json());
    })();
  }, []);

  const handleAnchor = async () => {
    if (!root) return;
    const r = await fetch(BASE + '/audit-chain/anchor', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ root })
    });
    const result = await r.json();
    setAnchorResult(result);
  };

  return (
    <div className='p-4 border rounded space-y-4'>
      <h3 className='font-semibold'>Audit Anchors</h3>

      {/* Submit Root */}
      <div className='flex gap-2'>
        <input
          type='text'
          className='flex-1 px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
          placeholder='Enter merkle root to anchor...'
          value={root}
          onChange={(e) => setRoot(e.target.value)}
        />
        <button
          className='px-4 py-2 bg-black text-white rounded text-sm font-medium hover:bg-gray-800 transition-colors'
          onClick={handleAnchor}
        >
          Anchor
        </button>
      </div>

      {/* Anchor Result */}
      {anchorResult && (
        <div className='p-3 bg-green-50 border border-green-300 rounded'>
          <div className='text-sm font-semibold text-green-800 mb-1'>
            {anchorResult.ok ? '✓ Anchored' : '✗ Failed'}
          </div>
          <div className='text-xs text-gray-700'>
            <div><strong>Note:</strong> {anchorResult.note}</div>
            <div><strong>Root:</strong> {anchorResult.root}</div>
          </div>
        </div>
      )}

      {/* Recent Anchors */}
      {!data ? (
        <div className='text-xs opacity-70'>loading…</div>
      ) : (
        <pre className='text-[10px] bg-gray-50 p-2 rounded overflow-auto'>
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

