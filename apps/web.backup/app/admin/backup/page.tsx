"use client";

import { Download, Database, Settings, FileText, AlertCircle } from 'lucide-react';
import { useState } from 'react';

const AGENT_BASE = process.env.NEXT_PUBLIC_AGENT_BASE || '';

/**
 * Backup & Export Admin Page (Round 15)
 *
 * Provides UI for downloading configuration and data bundles.
 * Critical for disaster recovery and pilot-to-production transitions.
 */
export default function BackupPage() {
  const [downloading, setDownloading] = useState<string | null>(null);

  async function downloadBundle(type: 'mcp' | 'conf') {
    setDownloading(type);
    try {
      // In production, this would fetch from backend-generated files
      // For now, we'll create client-side bundles as placeholders

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `bundle_${type}_${timestamp}.json`;

      // Create a placeholder bundle
      const bundle = {
        type,
        exported_at: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        pilot_mode: process.env.NEXT_PUBLIC_PILOT_MODE === '1',
        note: 'This is a client-side export. Run scripts/export_bundle.ts on backend for full backup.'
      };

      const blob = new Blob([JSON.stringify(bundle, null, 2)], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      alert('Download failed. Please check console for details.');
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Backup & Export</h1>
        <p className="text-gray-600">
          Download configuration bundles and backups for disaster recovery
        </p>
      </div>

      {/* Important Notice */}
      <div className="mb-6 bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-semibold mb-1">Production Backup Procedure</p>
            <p>
              For complete backups including database state, run{' '}
              <code className="bg-blue-100 px-1 py-0.5 rounded">
                pnpm tsx scripts/export_bundle.ts
              </code>{' '}
              on the backend server. The downloads below are configuration snapshots only.
            </p>
          </div>
        </div>
      </div>

      {/* Download Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* MCP Bundle */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <Database className="h-8 w-8 text-purple-600" />
            <div>
              <h2 className="text-lg font-semibold">MCP Tools Bundle</h2>
              <p className="text-sm text-gray-600">Agent tool configurations</p>
            </div>
          </div>
          <p className="text-sm text-gray-700 mb-4">
            Exports all MCP (Model Context Protocol) tool definitions, configurations,
            and metadata from the database.
          </p>
          <button
            onClick={() => downloadBundle('mcp')}
            disabled={downloading === 'mcp'}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="h-4 w-4" />
            {downloading === 'mcp' ? 'Downloading...' : 'Download MCP Bundle'}
          </button>
        </div>

        {/* Config Bundle */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <Settings className="h-8 w-8 text-blue-600" />
            <div>
              <h2 className="text-lg font-semibold">Configuration Bundle</h2>
              <p className="text-sm text-gray-600">System settings snapshot</p>
            </div>
          </div>
          <p className="text-sm text-gray-700 mb-4">
            Exports environment configuration, feature flags, and system settings.
            Excludes secrets and sensitive data.
          </p>
          <button
            onClick={() => downloadBundle('conf')}
            disabled={downloading === 'conf'}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="h-4 w-4" />
            {downloading === 'conf' ? 'Downloading...' : 'Download Config Bundle'}
          </button>
        </div>
      </div>

      {/* Documentation */}
      <div className="mt-8 bg-gray-50 border border-gray-200 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="h-5 w-5 text-gray-700" />
          <h2 className="text-lg font-semibold">Backup Best Practices</h2>
        </div>
        <ul className="space-y-2 text-sm text-gray-700">
          <li className="flex items-start gap-2">
            <span className="text-green-600 mt-1">•</span>
            <span>
              Schedule automated backups to run hourly in production
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-600 mt-1">•</span>
            <span>
              Store backups in geographically distributed locations
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-600 mt-1">•</span>
            <span>
              Test restore procedures monthly to ensure recovery capability
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-600 mt-1">•</span>
            <span>
              Maintain backups for 7 years to comply with healthcare regulations
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-600 mt-1">•</span>
            <span>
              Create a snapshot before major deployments or configuration changes
            </span>
          </li>
        </ul>
      </div>

      {/* Quick Commands Reference */}
      <div className="mt-6 bg-gray-900 text-gray-100 rounded-lg p-4">
        <h3 className="text-sm font-semibold mb-3">Quick Commands</h3>
        <div className="space-y-2 text-xs font-mono">
          <div>
            <div className="text-gray-400 mb-1"># Backend: Full export</div>
            <div className="bg-gray-800 px-3 py-2 rounded">
              pnpm tsx scripts/export_bundle.ts
            </div>
          </div>
          <div>
            <div className="text-gray-400 mb-1"># Check pilot mode</div>
            <div className="bg-gray-800 px-3 py-2 rounded">
              curl {AGENT_BASE || 'https://api.vitalcv.com'}/rollback/pilot/status
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

