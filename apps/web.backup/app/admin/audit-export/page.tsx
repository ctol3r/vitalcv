"use client";
import { useState } from 'react';

const BASE = process.env.NEXT_PUBLIC_AGENT_BASE?.replace('/api/agent', '') || 'http://localhost:4000';

export default function AuditExport() {
  const [format, setFormat] = useState<'json' | 'csv'>('json');
  const [tenantId, setTenantId] = useState('default-tenant');
  const [period, setPeriod] = useState('7d');
  const [summary, setSummary] = useState<any>(null);

  const handleExport = async () => {
    const params = new URLSearchParams({
      format,
      tenant_id: tenantId,
      period,
    });

    window.open(`${BASE}/api/audit/export?${params}`, '_blank');
  };

  const fetchSummary = async () => {
    try {
      const response = await fetch(`${BASE}/api/audit/summary?tenant_id=${tenantId}&period=${period}`);
      const data = await response.json();
      setSummary(data);
    } catch {
      setSummary(null);
    }
  };

  return (
    <div className='max-w-3xl mx-auto py-8 px-4'>
      <h1 className='text-2xl font-bold mb-6'>Audit Log Export</h1>

      <div className='space-y-4 mb-6'>
        <div>
          <label className='block text-sm font-medium mb-1'>Tenant ID</label>
          <input
            type='text'
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            className='w-full p-2 border rounded dark:bg-gray-800'
          />
        </div>

        <div>
          <label className='block text-sm font-medium mb-1'>Period</label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className='w-full p-2 border rounded dark:bg-gray-800'
          >
            <option value='7d'>Last 7 days</option>
            <option value='30d'>Last 30 days</option>
            <option value='1d'>Last 24 hours</option>
          </select>
        </div>

        <div>
          <label className='block text-sm font-medium mb-1'>Format</label>
          <div className='flex gap-4'>
            <label className='flex items-center'>
              <input
                type='radio'
                value='json'
                checked={format === 'json'}
                onChange={(e) => setFormat(e.target.value as 'json')}
                className='mr-2'
              />
              JSON
            </label>
            <label className='flex items-center'>
              <input
                type='radio'
                value='csv'
                checked={format === 'csv'}
                onChange={(e) => setFormat(e.target.value as 'csv')}
                className='mr-2'
              />
              CSV
            </label>
          </div>
        </div>

        <div className='flex gap-3'>
          <button
            onClick={handleExport}
            className='px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700'
          >
            Export Logs
          </button>
          <button
            onClick={fetchSummary}
            className='px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700'
          >
            View Summary
          </button>
        </div>
      </div>

      {summary && (
        <div className='p-4 bg-gray-50 dark:bg-gray-900 rounded-lg'>
          <h3 className='font-semibold mb-3'>Summary</h3>
          <div className='grid grid-cols-3 gap-4'>
            <div>
              <p className='text-sm text-gray-600 dark:text-gray-400'>Total</p>
              <p className='text-2xl font-bold'>{summary.total}</p>
            </div>
            <div>
              <p className='text-sm text-gray-600 dark:text-gray-400'>Success</p>
              <p className='text-2xl font-bold text-green-600'>{summary.success}</p>
            </div>
            <div>
              <p className='text-sm text-gray-600 dark:text-gray-400'>Success Rate</p>
              <p className='text-2xl font-bold'>{(summary.success_rate * 100).toFixed(1)}%</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
