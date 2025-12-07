"use client";

import { useState } from 'react';

const BASE = process.env.NEXT_PUBLIC_AGENT_BASE || 'http://localhost:4000';

export default function RevokeAdmin() {
  const [credId, setCredId] = useState('');
  const [idx, setIdx] = useState('42');
  const [reason, setReason] = useState('Administrative revocation');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function assign() {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/status-admin/assign`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          cred_id: credId,
          index: Number(idx),
        }),
      });
      const data = await res.json();
      setMessage(`✅ Assigned index ${idx} to credential ${credId}`);
    } catch (error: any) {
      setMessage(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function revoke() {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/status-admin/revoke`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          cred_id: credId,
          reason: reason,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessage(`✅ Revoked credential ${credId} at index ${data.index}`);
      } else {
        setMessage(`❌ Error: ${data.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      setMessage(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">Revocation Admin</h1>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Credential ID</label>
          <input
            className="w-full p-3 border rounded-lg"
            value={credId}
            onChange={(e) => setCredId(e.target.value)}
            placeholder="e.g., cred_abc123..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Status Index</label>
          <input
            type="number"
            className="w-full p-3 border rounded-lg"
            value={idx}
            onChange={(e) => setIdx(e.target.value)}
            placeholder="42"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Revocation Reason</label>
          <input
            className="w-full p-3 border rounded-lg"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for revocation"
          />
        </div>

        <div className="flex gap-3">
          <button
            className="px-6 py-3 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
            onClick={assign}
            disabled={!credId || loading}
          >
            Assign Index
          </button>
          <button
            className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            onClick={revoke}
            disabled={!credId || loading}
          >
            {loading ? 'Processing...' : 'Revoke Credential'}
          </button>
        </div>

        {message && (
          <div className="mt-4 p-4 bg-gray-50 border rounded-lg">
            <p className="text-sm">{message}</p>
          </div>
        )}
      </div>

      <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <h2 className="font-semibold text-yellow-900 mb-2">⚠️ Warning</h2>
        <p className="text-sm text-yellow-800">
          Revoking a credential is permanent and cannot be undone. The credential holder will no longer be able to use this credential for verification.
        </p>
      </div>
    </div>
  );
}

