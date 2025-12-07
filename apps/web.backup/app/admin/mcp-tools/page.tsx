"use client";
import { useState } from 'react';

interface McpExport {
  mcp: Array<{
    name: string;
    description: string;
    scope: string;
    tags: string[];
    manifest: any;
    code?: string;
  }>;
}

export default function McpTools() {
  const [dump, setDump] = useState<McpExport | null>(null);
  const [loading, setLoading] = useState(false);
  const [importText, setImportText] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  const exportAll = async () => {
    try {
      setLoading(true);
      const baseUrl = process.env.NEXT_PUBLIC_AGENT_BASE || 'http://localhost:4000';
      const r = await fetch(`${baseUrl}/api/agent/mcp-admin/export`);
      if (!r.ok) throw new Error('Export failed');
      const data = await r.json();
      setDump(data);
    } catch (err: any) {
      console.error('Error exporting:', err);
      alert('Export failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const importMcp = async () => {
    try {
      setImportLoading(true);
      setImportResult(null);
      const parsed = JSON.parse(importText);

      const baseUrl = process.env.NEXT_PUBLIC_AGENT_BASE || 'http://localhost:4000';
      const r = await fetch(`${baseUrl}/api/agent/mcp-admin/import`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(parsed)
      });

      if (!r.ok) throw new Error('Import failed');
      const data = await r.json();
      setImportResult(`✓ Imported successfully! ID: ${data.id}`);
      setImportText('');
    } catch (err: any) {
      setImportResult(`✗ Import failed: ${err.message}`);
    } finally {
      setImportLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (dump) {
      navigator.clipboard.writeText(JSON.stringify(dump, null, 2));
      alert('Copied to clipboard!');
    }
  };

  return (
    <div className='max-w-6xl mx-auto py-8 px-4'>
      <h2 className='text-2xl font-bold mb-6'>MCP Import/Export</h2>

      {/* Export Section */}
      <div className='mb-8 p-4 border border-gray-200 rounded-lg'>
        <h3 className='text-lg font-semibold mb-3'>Export MCPs</h3>
        <div className='flex gap-2'>
          <button
            className='px-4 py-2 rounded bg-black text-white hover:bg-gray-800 disabled:opacity-50'
            onClick={exportAll}
            disabled={loading}
          >
            {loading ? 'Exporting...' : 'Export All MCPs'}
          </button>
          {dump && (
            <button
              className='px-4 py-2 rounded border border-gray-300 hover:bg-gray-50'
              onClick={copyToClipboard}
            >
              Copy to Clipboard
            </button>
          )}
        </div>

        {dump && (
          <div className='mt-4'>
            <div className='text-sm text-gray-600 mb-2'>
              Exported {dump.mcp.length} MCP(s)
            </div>
            <pre className='text-xs bg-gray-50 p-3 rounded overflow-auto max-h-96 border border-gray-200'>
              {JSON.stringify(dump, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Import Section */}
      <div className='p-4 border border-gray-200 rounded-lg'>
        <h3 className='text-lg font-semibold mb-3'>Import MCP</h3>
        <div className='mb-3'>
          <label className='block text-sm font-medium text-gray-700 mb-1'>
            MCP JSON (manifest + code)
          </label>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 font-mono text-xs'
            rows={12}
            placeholder='{"manifest": {...}, "code": "..."}'
          />
        </div>
        <div className='flex items-center gap-3'>
          <button
            className='px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'
            onClick={importMcp}
            disabled={importLoading || !importText}
          >
            {importLoading ? 'Importing...' : 'Import'}
          </button>
          {importResult && (
            <div className={`text-sm ${importResult.startsWith('✓') ? 'text-green-600' : 'text-red-600'}`}>
              {importResult}
            </div>
          )}
        </div>
      </div>

      {/* Info Box */}
      <div className='mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg'>
        <div className='text-sm text-blue-800'>
          <div className='font-semibold mb-1'>ℹ️ Import/Export Format</div>
          <div className='text-xs'>
            • Export downloads all MCPs as JSON array<br/>
            • Import expects: <code className='px-1 py-0.5 bg-blue-100 rounded'>{'{ manifest: {...}, code: "..." }'}</code><br/>
            • Can be used to backup, migrate, or share MCP tools between environments
          </div>
        </div>
      </div>
    </div>
  );
}

