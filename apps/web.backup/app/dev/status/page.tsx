'use client';
import { useEffect, useState } from 'react';

export default function DevStatus() {
  const [d, setD] = useState<any>();
  const [demo, setDemo] = useState(false);
  const [loading, setLoading] = useState(false);

  async function load() {
    const r = await fetch('/dev/status');
    setD(await r.json());
  }

  async function loadDemoStatus() {
    try {
      const r = await fetch('/api/dev/demo-mode');
      const data = await r.json();
      setDemo(data.demo || false);
    } catch (e) {
      console.error('Failed to load demo status:', e);
    }
  }

  useEffect(() => {
    load();
    loadDemoStatus();
  }, []);

  async function reseed() {
    const r = await fetch('/ops/demo-reset?reseed=1', { method: 'POST' });
    const t = await r.text();
    alert(t);
  }

  async function toggleDemo() {
    setLoading(true);
    try {
      const newDemo = !demo;
      const r = await fetch(`/api/dev/demo-mode?on=${newDemo ? '1' : '0'}`, {
        method: 'POST',
      });
      const data = await r.json();
      setDemo(data.demo);
      // Store in localStorage for DEMO chip
      if (typeof window !== 'undefined') {
        localStorage.setItem('dev_demo_chip', data.demo ? '1' : '0');
        // Trigger storage event for other components
        window.dispatchEvent(new Event('storage'));
      }
    } catch (e) {
      console.error('Failed to toggle demo mode:', e);
      alert('Failed to toggle demo mode');
    } finally {
      setLoading(false);
    }
  }

  function showRibbon() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('dev_ribbon_hide');
      window.location.reload();
    }
  }

  const [tenant, setTenant] = useState('');

  function openBrief(format: 'html' | 'pdf') {
    const t = tenant || 'global';
    window.open(`/api/dev/exec-brief/${t}.${format}`, '_blank');
  }

  return (
    <div className="max-w-3xl mx-auto py-8">
      <h1 className="text-xl font-bold mb-4">Dev Status</h1>
      <div className="text-xs space-y-2">
        <div className="p-2 border rounded">API: {d?.ok ? 'ok' : 'down'}</div>

        <div className="border-t pt-2 space-y-2">
          <h2 className="font-semibold text-sm">Demo Mode</h2>
          <button
            className={`px-4 py-2 border rounded transition-colors ${
              demo
                ? 'bg-yellow-100 border-yellow-400 text-yellow-900 font-semibold'
                : 'hover:bg-gray-50'
            }`}
            onClick={toggleDemo}
            disabled={loading}
          >
            {loading ? '...' : demo ? '🟡 DEMO ON' : '⚪ DEMO OFF'}
          </button>
          <p className="text-xs text-gray-600">
            When ON: Auto-allows Telehealth AuthZ, PSYPACT/APRN/IMLC eligibility
          </p>
        </div>

        <div className="border-t pt-2 space-y-2">
          <h2 className="font-semibold text-sm">Executive Briefs</h2>
          <div className="flex gap-2 items-center">
            <input
              type="text"
              placeholder="Tenant ID (optional)"
              className="px-3 py-2 border rounded flex-1"
              value={tenant}
              onChange={(e) => setTenant(e.target.value)}
            />
            <button
              className="px-3 py-2 border rounded hover:bg-gray-50"
              onClick={() => openBrief('html')}
            >
              Open HTML
            </button>
            <button
              className="px-3 py-2 border rounded hover:bg-gray-50"
              onClick={() => openBrief('pdf')}
            >
              Download PDF
            </button>
          </div>
        </div>

        <div className="border-t pt-2 space-y-2">
          <h2 className="font-semibold text-sm">Demo Tools</h2>
          <div className="flex gap-2">
            <a href="/dev/demo" className="px-3 py-2 border rounded hover:bg-gray-50 inline-block">
              Demo Scenarios
            </a>
            <a
              href="/dev/auto-demo"
              className="px-3 py-2 border rounded hover:bg-gray-50 inline-block"
            >
              Auto Demo
            </a>
          </div>
        </div>

        <div className="border-t pt-2 space-y-2">
          <button className="px-3 py-2 border rounded hover:bg-gray-50" onClick={reseed}>
            Reset & Reseed Demo
          </button>
          <button className="px-3 py-2 border rounded hover:bg-gray-50" onClick={showRibbon}>
            Show Dev Ribbon
          </button>
        </div>
      </div>
    </div>
  );
}
