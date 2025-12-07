"use client";
import { useState } from 'react';

export default function DemoReset() {
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    try {
      const r = await fetch('/ops/demo-reset', { method: 'POST' });
      const json = await r.json();
      setMsg(JSON.stringify(json, null, 2));
    } catch (error: any) {
      setMsg(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <h1 className="text-xl font-bold mb-4">Demo Reset</h1>
      <p className="mb-4 text-sm text-gray-600">
        Safely clears demo-tagged data from the system:
      </p>
      <ul className="mb-6 text-sm text-gray-600 list-disc list-inside">
        <li>AgentTrace records with task_type LIKE &apos;demo.%&apos;</li>
        <li>AgentTrace records with input.licensePdfId = &apos;demo&apos;</li>
        <li>Current month invoices for org_id = &apos;default&apos;</li>
        <li>Related receipts</li>
      </ul>
      <button
        className="px-3 py-2 rounded bg-black text-white disabled:opacity-50 hover:bg-gray-800 transition-colors"
        onClick={run}
        disabled={loading}
      >
        {loading ? 'Resetting...' : 'Reset Now'}
      </button>
      {msg && (
        <pre className="text-xs bg-gray-50 p-3 rounded mt-3 overflow-x-auto border">
          {msg}
        </pre>
      )}
    </div>
  );
}

