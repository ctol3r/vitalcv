"use client";

import { useEffect, useState } from 'react';
import { Shield, CheckCircle, AlertTriangle, Info } from 'lucide-react';

const AGENT_BASE = process.env.NEXT_PUBLIC_AGENT_BASE || '';

interface CisoSummary {
  crypto: any;
  identity: any;
  revocation: any;
  audit: any;
  privacy: any;
  ops: any;
  compliance?: any;
  metadata?: any;
}

/**
 * CISO Explain Panel (Round 15)
 *
 * Provides a comprehensive security posture summary for CISO stakeholders.
 * Shows cryptography, identity, revocation, audit, privacy, and ops status
 * in an executive-friendly format.
 */
export default function CISOPage() {
  const [summary, setSummary] = useState<CisoSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSummary() {
      try {
        const response = await fetch(`${AGENT_BASE}/ciso/summary`);
        if (!response.ok) throw new Error('Failed to fetch CISO summary');
        const data = await response.json();
        setSummary(data);
      } catch (err) {
        console.error('Error fetching CISO summary:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchSummary();
  }, []);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto py-8 px-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="max-w-6xl mx-auto py-8 px-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-900">
          <AlertTriangle className="h-5 w-5 inline mr-2" />
          Error loading CISO summary: {error || 'Unknown error'}
        </div>
      </div>
    );
  }

  const sections = [
    {
      title: 'Cryptography',
      icon: '🔐',
      data: summary.crypto,
      color: 'blue'
    },
    {
      title: 'Identity',
      icon: '👤',
      data: summary.identity,
      color: 'purple'
    },
    {
      title: 'Revocation',
      icon: '🔄',
      data: summary.revocation,
      color: 'orange'
    },
    {
      title: 'Audit',
      icon: '📋',
      data: summary.audit,
      color: 'green'
    },
    {
      title: 'Privacy',
      icon: '🔒',
      data: summary.privacy,
      color: 'indigo'
    },
    {
      title: 'Operations',
      icon: '⚙️',
      data: summary.ops,
      color: 'gray'
    }
  ];

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold">CISO Security Posture</h1>
        </div>
        <p className="text-gray-600">
          Comprehensive security and compliance summary for VitalCV platform
        </p>
        {summary.metadata && (
          <p className="text-sm text-gray-500 mt-2">
            Generated: {new Date(summary.metadata.generated_at).toLocaleString()} •{' '}
            Environment: {summary.metadata.environment}
          </p>
        )}
      </div>

      {/* Pilot Mode Alert */}
      {summary.ops?.pilot_mode && (
        <div className="mb-6 bg-amber-50 border-l-4 border-amber-400 p-4 rounded">
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-amber-600" />
            <span className="font-semibold text-amber-900">
              System is currently in Pilot Mode
            </span>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {sections.map((section) => (
          <div
            key={section.title}
            className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">{section.icon}</span>
              <h2 className="text-lg font-semibold">{section.title}</h2>
            </div>
            <dl className="space-y-2 text-sm">
              {Object.entries(section.data).map(([key, value]) => (
                <div key={key} className="flex items-start gap-2">
                  {typeof value === 'boolean' ? (
                    value ? (
                      <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    )
                  ) : (
                    <span className="w-4" />
                  )}
                  <dt className="text-gray-600 flex-shrink-0 min-w-[120px]">
                    {key.replace(/_/g, ' ')}:
                  </dt>
                  <dd className="font-medium text-gray-900 break-all">
                    {Array.isArray(value)
                      ? value.join(', ')
                      : typeof value === 'boolean'
                      ? value ? 'Enabled' : 'Disabled'
                      : String(value)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>

      {/* Compliance Standards */}
      {summary.compliance && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Compliance Standards
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(summary.compliance).map(([category, standards]) => (
              <div key={category}>
                <h3 className="text-sm font-semibold text-gray-700 mb-2 capitalize">
                  {category}
                </h3>
                <ul className="space-y-1 text-sm text-gray-600">
                  {Array.isArray(standards) &&
                    standards.map((standard) => (
                      <li key={standard} className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                        {standard}
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Raw JSON (for detailed inspection) */}
      <details className="mt-8">
        <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900 mb-2">
          View Raw JSON
        </summary>
        <pre className="text-xs bg-gray-50 p-4 rounded border border-gray-200 overflow-auto max-h-96">
          {JSON.stringify(summary, null, 2)}
        </pre>
      </details>
    </div>
  );
}

