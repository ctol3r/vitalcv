"use client";

import { useState } from 'react';

const BASE = process.env.NEXT_PUBLIC_AGENT_BASE || 'http://localhost:4000';

export default function StatusCheck() {
  const [i, setI] = useState('42');
  const [out, setOut] = useState<any>();
  const [loading, setLoading] = useState(false);

  async function go() {
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/status/1/bit?index=${encodeURIComponent(i)}`);
      setOut(await r.json());
    } catch (error: any) {
      setOut({ error: error.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 border rounded-lg bg-white shadow-sm">
      <h3 className="font-semibold mb-3 text-sm">Quick Status Check</h3>
      <div className="flex gap-2 mb-3">
        <input
          className="p-2 border rounded w-28 text-sm"
          value={i}
          onChange={(e) => setI(e.target.value)}
          placeholder="Index"
          type="number"
        />
        <button
          className="px-3 py-2 bg-black text-white rounded text-sm hover:bg-gray-800 disabled:opacity-50"
          onClick={go}
          disabled={loading}
        >
          {loading ? 'Checking...' : 'Check'}
        </button>
      </div>
      {out && (
        <div className="mt-2">
          {out.error ? (
            <div className="text-xs text-red-600 p-2 bg-red-50 rounded border border-red-200">
              Error: {out.error}
            </div>
          ) : (
            <div
              className={`text-xs p-2 rounded border ${
                out.revoked
                  ? 'bg-red-50 border-red-200 text-red-800'
                  : 'bg-green-50 border-green-200 text-green-800'
              }`}
            >
              <div className="font-semibold">
                {out.revoked ? '❌ Revoked' : '✅ Active'}
              </div>
              <div className="text-xs opacity-75 mt-1">Index: {out.index}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

