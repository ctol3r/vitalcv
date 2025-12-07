"use client";

import { useState } from 'react';

const BASE = process.env.NEXT_PUBLIC_AGENT_BASE || 'http://localhost:4000';

export default function Present() {
  const [cred, setCred] = useState('');
  const [result, setResult] = useState<any>();
  const [fields, setFields] = useState('name,license_type');
  const [loading, setLoading] = useState(false);

  async function present() {
    setLoading(true);
    try {
      // Step 1: Create presentation with selective disclosure
      const presRes = await fetch(`${BASE}/api/crypto/sdjwt/present`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sd_jwt: cred,
          disclose: fields.split(',').map((s) => s.trim()).filter(Boolean),
        }),
      });
      const presData = await presRes.json();

      // Step 2: Send presentation to verifier
      const verifyRes = await fetch(`${BASE}/api/verifier/present`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ presentation: presData.presentation || presData }),
      });
      const verifyData = await verifyRes.json();

      setResult({
        presentation: presData,
        verification: verifyData,
      });
    } catch (error: any) {
      setResult({ error: error.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">Present to Verifier</h1>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">SD-JWT Credential</label>
          <textarea
            className="w-full p-3 border rounded-lg font-mono text-xs"
            rows={6}
            placeholder="Paste your SD-JWT credential here..."
            value={cred}
            onChange={(e) => setCred(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Fields to Disclose (comma-separated)</label>
          <input
            className="w-full p-3 border rounded-lg"
            value={fields}
            onChange={(e) => setFields(e.target.value)}
            placeholder="e.g., name,license_type"
          />
        </div>

        <button
          className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
          onClick={present}
          disabled={!cred || loading}
        >
          {loading ? 'Processing...' : 'Present & Verify'}
        </button>

        {result && (
          <div className="mt-6">
            <h2 className="text-lg font-semibold mb-3">Result</h2>
            <pre className="text-xs bg-gray-50 p-4 rounded-lg overflow-auto max-h-96 border">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

