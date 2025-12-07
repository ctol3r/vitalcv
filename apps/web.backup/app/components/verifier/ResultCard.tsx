import React from 'react';

interface ResultCardProps {
  result: {
    credentialType?: string;
    status: 'valid' | 'expired' | 'revoked' | 'partial' | 'unknown';
    disclosureLevel?: string;
    auditRef?: string;
    [key: string]: any;
  };
}

export function ResultCard({ result }: ResultCardProps) {
  const statusColors = {
    valid: 'bg-green-50 border-green-200 text-green-800',
    partial: 'bg-blue-50 border-blue-200 text-blue-800',
    expired: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    revoked: 'bg-red-50 border-red-200 text-red-800',
    unknown: 'bg-gray-50 border-gray-200 text-gray-800',
  };

  const statusIcon = {
    valid: '✅',
    partial: '⚠️', // Or some other icon indicating partial
    expired: '⏰',
    revoked: '🚫',
    unknown: '❓',
  };

  const colorClass = statusColors[result.status] || statusColors.unknown;
  const icon = statusIcon[result.status] || statusIcon.unknown;

  return (
    <div className={`p-6 rounded-xl border shadow-sm ${colorClass}`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            {icon} <span className="capitalize">{result.status}</span>
          </h3>
          <p className="text-sm opacity-80 mt-1">
            {result.credentialType || 'Credential'}
          </p>
        </div>
        {result.disclosureLevel && (
          <span className="text-xs px-2 py-1 bg-white/50 rounded-full border border-black/10 font-medium uppercase tracking-wide">
            {result.disclosureLevel} Disclosure
          </span>
        )}
      </div>

      <div className="space-y-2 text-sm">
        {result.auditRef && (
            <div className="flex flex-col">
                <span className="text-xs opacity-60 uppercase font-semibold">Audit Event ID</span>
                <code className="font-mono text-xs break-all">{result.auditRef}</code>
            </div>
        )}

        {result.reason && (
             <div className="pt-2 border-t border-black/10">
                <span className="font-semibold">Reason: </span> {result.reason}
             </div>
        )}
      </div>
    </div>
  );
}



















