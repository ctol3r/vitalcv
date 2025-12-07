'use client';
import { useEffect, useState } from 'react';

export default function PilotHealth() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const r = await fetch('/api/pilot/health');
      const json = await r.json();
      setData(json);
    } catch (error) {
      console.error('Failed to load pilot health:', error);
    } finally {
      setLoading(false);
    }
  }

  async function sendSummary() {
    try {
      setSending(true);
      const r = await fetch('/api/pilot/summary/send', {
        method: 'POST',
      });
      const json = await r.json();
      if (json.ok) {
        alert('Summary sent successfully!');
      } else {
        alert('Failed to send summary: ' + (json.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Failed to send summary:', error);
      alert('Failed to send summary');
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <h1 className="text-xl font-bold">Pilot Health</h1>
        <p className="text-sm text-gray-600 mt-2">Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8">
      <h1 className="text-xl font-bold">Pilot Health</h1>
      {data && (
        <div className="grid md:grid-cols-2 gap-3 text-xs mt-3">
          <div className="p-3 border rounded">
            <b>Exec Brief</b> len: {data.exec_length || 0}
          </div>
          <div className="p-3 border rounded">
            <b>PSV</b>: {data.psv_score?.pct || 0}% ({data.psv_score?.grade || 'C'})
          </div>
          <div className="p-3 border rounded">
            <b>AI Events</b>: {data.ai_events || 0}
          </div>
          <div className="p-3 border rounded">
            <b>Wallet</b>: Remote {data.wallet?.remote || 0} • Proximity {data.wallet?.proximity || 0} • Cert{' '}
            {Math.round((data.wallet?.cert_share || 0) * 100)}%
          </div>
        </div>
      )}
      <button
        className="mt-4 px-3 py-2 border rounded hover:bg-gray-50 disabled:opacity-50"
        onClick={sendSummary}
        disabled={sending}
      >
        {sending ? 'Generating...' : 'Generate Weekly PDF'}
      </button>
    </div>
  );
}
