"use client";

import { useState, useEffect } from 'react';

export default function Compliance() {
  const [npi, setNpi] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [psvSource, setPsvSource] = useState('license');
  const [psvNpi, setPsvNpi] = useState('');
  const [sources, setSources] = useState<string[]>([]);
  const [complianceData, setComplianceData] = useState<any>(null);
  const [sourceWindows, setSourceWindows] = useState<Record<string, { ok: boolean; days_since: number | null; latest_at: string | null; method: string | null }>>({});
  const [overdueCount, setOverdueCount] = useState(0);
  const [selectedNpi, setSelectedNpi] = useState('');
  const [psvScore, setPsvScore] = useState<{ sources_ok: number; total: number; score: number; overdue: number } | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(false);

  const q = `subject_npi=${encodeURIComponent(npi || '')}&from=${encodeURIComponent(from || '')}&to=${encodeURIComponent(to || '')}`;

  // Load PSV sources
  useEffect(() => {
    (async () => {
      const r = await fetch('/api/verify/sources');
      const data = await r.json();
      setSources(data.rows || []);
    })();
  }, []);

  // Load compliance snapshot
  useEffect(() => {
    (async () => {
      const r = await fetch('/api/compliance/snapshot');
      const data = await r.json();
      setComplianceData(data);
    })();
  }, []);

  // Load source windows when NPI is selected
  useEffect(() => {
    if (!selectedNpi) {
      setSourceWindows({});
      setOverdueCount(0);
      setPsvScore(null);
      return;
    }
    (async () => {
      try {
        const r = await fetch(`/api/compliance/windows?npi=${encodeURIComponent(selectedNpi)}`);
        const data = await r.json();
        setSourceWindows(data.sources || {});
        setOverdueCount(data.summary?.overdue || 0);
      } catch (e) {
        console.error('Failed to load windows:', e);
      }
    })();
  }, [selectedNpi]);

  // Load PSV score for selected NPI or tenant aggregate
  useEffect(() => {
    (async () => {
      try {
        const npiParam = selectedNpi ? `npi=${encodeURIComponent(selectedNpi)}` : '';
        const r = await fetch(`/api/compliance/psv-score?${npiParam}`);
        const data = await r.json();
        setPsvScore(data);
      } catch (e) {
        console.error('Failed to load PSV score:', e);
      }
    })();
  }, [selectedNpi]);

  // Helper for last 30 days pilot survey packet
  const getLast30DaysUrl = () => {
    const to = new Date();
    const from = new Date(Date.now() - 30 * 86400000);
    const qs = `from=${from.toISOString().slice(0, 10)}&to=${to.toISOString().slice(0, 10)}`;
    return `/api/audit/survey-packet.pdf?${qs}`;
  };

  // Run PSV for a given source and NPI
  const runPSV = async () => {
    if (!psvNpi) {
      alert('Please enter an NPI');
      return;
    }
    const r = await fetch(`/api/verify/run?source=${encodeURIComponent(psvSource)}&npi=${encodeURIComponent(psvNpi)}`, {
      method: 'POST'
    });
    const data = await r.json();
    if (data.ok) {
      alert(`PSV run successful for ${psvSource}`);
      // Reload compliance snapshot
      const snap = await fetch('/api/compliance/snapshot');
      setComplianceData(await snap.json());
    } else {
      alert('PSV run failed');
    }
  };

  // Quick action: Run License PSV (Batch 69)
  const runLicensePSV = async () => {
    if (!psvNpi) {
      alert('Please enter an NPI');
      return;
    }
    const r = await fetch(`/api/verify/run?source=license&npi=${encodeURIComponent(psvNpi)}`, {
      method: 'POST'
    });
    const data = await r.json();
    if (data.ok) {
      alert('License PSV stored');
      // Reload compliance snapshot
      const snap = await fetch('/api/compliance/snapshot');
      setComplianceData(await snap.json());
    } else {
      alert('License PSV failed');
    }
  };

  return (
    <div className='max-w-4xl mx-auto py-8 px-4'>
      <div className='flex items-center justify-between mb-4'>
        <div>
          <h1 className='text-2xl font-bold'>Compliance & Audit</h1>
          <p className='text-sm text-gray-600 mt-2'>
            Generate survey packets combining NCQA PSV evidence and monthly anchor proofs for Joint Commission readiness.
          </p>
        </div>

        <div className='flex gap-2 items-center'>
          {/* PSV Score Badge */}
          {psvScore && (
            <div className={`px-3 py-1 rounded text-sm font-semibold border ${
              psvScore.score >= 90 ? 'bg-green-100 border-green-300 text-green-800' :
              psvScore.score >= 70 ? 'bg-yellow-100 border-yellow-300 text-yellow-800' :
              'bg-red-100 border-red-300 text-red-800'
            }`}>
              PSV: {psvScore.score}% {psvScore.overdue > 0 && `(${psvScore.overdue} overdue)`}
            </div>
          )}
          {overdueCount > 0 && (
            <div className='px-3 py-1 bg-red-100 border border-red-300 text-red-800 rounded text-sm font-semibold'>
              Overdue: {overdueCount}
            </div>
          )}
          {/* One-click Pilot Survey Packet */}
          <a
            className='px-4 py-2 bg-black text-white rounded font-medium text-sm hover:bg-gray-800 transition-colors whitespace-nowrap'
            href={getLast30DaysUrl()}
            target='_blank'
            rel='noopener noreferrer'
          >
            📋 Pilot Survey Packet (30d)
          </a>

          {/* Ops Runbook Link */}
          <a
            className='px-4 py-2 border border-gray-300 rounded font-medium text-sm hover:bg-gray-50 transition-colors whitespace-nowrap'
            href='/api/runbook/ops'
            target='_blank'
            rel='noopener noreferrer'
          >
            📖 Ops Runbook
          </a>
        </div>
      </div>

      {/* NPI Filter for Windows */}
      <div className='bg-white border rounded-lg p-6 shadow-sm mt-6'>
        <h2 className='text-lg font-semibold mb-4'>NCQA Window Status</h2>
        <div className='mb-4'>
          <label className='text-xs text-gray-600 mb-1 block'>NPI (for window check)</label>
          <input
            className='px-3 py-2 border rounded text-sm w-full max-w-xs'
            placeholder='Enter NPI to check windows...'
            value={selectedNpi}
            onChange={e => setSelectedNpi(e.target.value)}
          />
        </div>

        {/* PSV Window Badges */}
        {Object.keys(sourceWindows).length > 0 && (
          <div>
            <div className='text-xs text-gray-600 mb-2 font-medium'>PSV Source Windows</div>
            <div className='grid grid-cols-2 md:grid-cols-4 gap-2'>
              {Object.entries(sourceWindows).map(([src, data]) => (
                <div
                  key={src}
                  className={`px-3 py-2 rounded text-xs font-medium border ${
                    data.ok
                      ? 'bg-green-50 border-green-300 text-green-800'
                      : 'bg-red-50 border-red-300 text-red-800'
                  }`}
                >
                  <div className='flex items-center justify-between'>
                    <span className='uppercase'>{src}</span>
                    <span>{data.ok ? '✅' : '⚠'}</span>
                  </div>
                  <div className='text-[10px] mt-1 opacity-70'>
                    {data.ok
                      ? `≤${data.method === 'CVO' ? '90' : '120'}d (${data.days_since || 0}d)`
                      : `overdue (${data.days_since || 'N/A'}d)`}
                  </div>
                  {data.latest_at && (
                    <div className='text-[10px] mt-1 opacity-50'>
                      {new Date(data.latest_at).toLocaleDateString()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* PSV Runner */}
      <div className='bg-white border rounded-lg p-6 shadow-sm mt-6'>
        <h2 className='text-lg font-semibold mb-4'>Run PSV (Primary Source Verification)</h2>

        <div className='flex gap-3 items-end mb-4'>
          <div className='flex flex-col'>
            <label className='text-xs text-gray-600 mb-1'>NPI</label>
            <input
              className='px-3 py-2 border rounded text-sm'
              placeholder='Enter NPI...'
              value={psvNpi}
              onChange={e => setPsvNpi(e.target.value)}
            />
          </div>

          <div className='flex flex-col'>
            <label className='text-xs text-gray-600 mb-1'>Source</label>
            <select
              className='px-3 py-2 border rounded text-sm'
              value={psvSource}
              onChange={e => setPsvSource(e.target.value)}
            >
              {sources.map(s => (
                <option key={s} value={s}>{s.toUpperCase()}</option>
              ))}
            </select>
          </div>

          <button
            className='px-4 py-2 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700 transition-colors'
            onClick={runPSV}
          >
            Run PSV
          </button>

          <button
            className='px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 transition-colors'
            onClick={runLicensePSV}
            title='Quick action: Run License Board PSV'
          >
            🏥 Run License PSV
          </button>
        </div>

        <div className='space-y-3'>
          {complianceData?.ncqa_window120_pct !== undefined && (
            <div className='text-xs bg-blue-50 border border-blue-200 rounded p-2 inline-block'>
              120-day window coverage: <span className='font-semibold'>{complianceData.ncqa_window120_pct}%</span>
            </div>
          )}
        </div>
      </div>

      <div className='bg-white border rounded-lg p-6 shadow-sm mt-6'>
        <h2 className='text-lg font-semibold mb-4'>Survey Packet (PDF)</h2>

        <div className='flex flex-wrap gap-3 items-center mb-4'>
          <div className='flex flex-col'>
            <label className='text-xs text-gray-600 mb-1'>NPI (optional)</label>
            <input
              className='px-3 py-2 border rounded text-sm'
              placeholder='Enter NPI...'
              value={npi}
              onChange={e => setNpi(e.target.value)}
            />
          </div>

          <div className='flex flex-col'>
            <label className='text-xs text-gray-600 mb-1'>From Date</label>
            <input
              type='date'
              className='px-3 py-2 border rounded text-sm'
              value={from}
              onChange={e => setFrom(e.target.value)}
            />
          </div>

          <div className='flex flex-col'>
            <label className='text-xs text-gray-600 mb-1'>To Date</label>
            <input
              type='date'
              className='px-3 py-2 border rounded text-sm'
              value={to}
              onChange={e => setTo(e.target.value)}
            />
          </div>

          <div className='flex flex-col justify-end'>
            <a
              className='px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 transition-colors'
              href={`/api/audit/survey-packet.pdf?${q}`}
              target='_blank'
              rel='noopener noreferrer'
            >
              Download PDF
            </a>
          </div>
        </div>

        <div className='text-xs text-gray-500 mt-4'>
          <p>• Leave NPI blank to include all providers</p>
          <p>• Leave dates blank to include all time periods</p>
          <p>• PDF includes NCQA verification events and blockchain anchor proofs</p>
        </div>
      </div>

      <div className='mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4'>
        <h3 className='text-sm font-semibold text-blue-900 mb-2'>About Survey Packets</h3>
        <p className='text-xs text-blue-800'>
          Survey packets provide auditors with a comprehensive report of all verification events and
          cryptographic anchor proofs. This documentation supports NCQA PSV requirements and Joint
          Commission traceability standards.
        </p>
      </div>

      <div className='mt-6 bg-white border rounded-lg p-4'>
        <label className='flex items-center gap-2 text-sm cursor-pointer'>
          <input
            type='checkbox'
            checked={showHeatmap}
            onChange={(e) => setShowHeatmap(e.target.checked)}
            className='cursor-pointer'
          />
          <span>Show compact heatmap</span>
        </label>
        {showHeatmap && (
          <iframe
            src='/admin/digests/heatmap'
            className='w-full h-[380px] border rounded mt-3'
            title='Compliance Heatmap'
          />
        )}
      </div>
    </div>
  );
}

