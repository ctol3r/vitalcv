"use client";
import { useState } from 'react';

const BASE = process.env.NEXT_PUBLIC_AGENT_BASE || '';

export default function DSAR() {
  const [u, setU] = useState('user_demo');
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    try {
      setDownloading(true);
      const url = `${BASE.replace('/api/agent', '/api/dsar')}/export/${encodeURIComponent(u)}`;

      // Fetch the data
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Create a blob and download
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `dsar_export_${u}_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
    } catch (error) {
      alert(`Export failed: ${error}`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className='max-w-3xl mx-auto py-8 px-4'>
      <h1 className='text-xl font-bold mb-2'>DSAR Export</h1>
      <p className='text-sm opacity-70 mb-6'>
        Data Subject Access Request - Export all user data for compliance purposes
      </p>

      <div className='bg-gray-50 border rounded p-4'>
        <label className='block text-sm font-medium mb-2'>
          User ID
        </label>
        <div className='flex gap-2'>
          <input
            className='flex-1 p-2 border rounded focus:outline-none focus:ring-2 focus:ring-black'
            value={u}
            onChange={e => setU(e.target.value)}
            placeholder='Enter user ID...'
          />
          <button
            className='px-4 py-2 rounded bg-black text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
            onClick={handleDownload}
            disabled={!u || downloading}
          >
            {downloading ? 'Downloading...' : 'Download JSON'}
          </button>
        </div>

        <p className='text-xs opacity-60 mt-3'>
          This will export all agent traces and associated data for the specified user.
        </p>
      </div>

      <div className='mt-6 p-4 bg-blue-50 border border-blue-200 rounded'>
        <h2 className='text-sm font-medium mb-2'>ℹ GDPR Compliance</h2>
        <ul className='text-xs space-y-1 opacity-80'>
          <li>• Must respond to DSAR within 30 days</li>
          <li>• Export includes all personal data processed</li>
          <li>• Verify requestor identity before sharing</li>
          <li>• Log all export requests for audit trail</li>
        </ul>
      </div>
    </div>
  );
}

