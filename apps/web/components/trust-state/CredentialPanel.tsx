'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { CredentialPanelData, CredentialRow, CredentialStatus } from './types';
import { PANEL_TRANSITION } from './motion';

// ── Status Visual Config ───────────────────────────────────

const STATUS_CONFIG: Record<
  CredentialStatus,
  { dot: string; badgeBg: string; badgeText: string; badgeBorder: string }
> = {
  ACTIVE: {
    dot: 'bg-green-600',
    badgeBg: 'bg-green-50',
    badgeText: 'text-green-800',
    badgeBorder: 'border-green-200',
  },
  INACTIVE: {
    dot: 'bg-slate-400',
    badgeBg: 'bg-slate-50',
    badgeText: 'text-slate-600',
    badgeBorder: 'border-slate-200',
  },
  EXPIRED: {
    dot: 'bg-amber-500',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-800',
    badgeBorder: 'border-amber-200',
  },
  REVOKED: {
    dot: 'bg-red-600',
    badgeBg: 'bg-red-50',
    badgeText: 'text-red-800',
    badgeBorder: 'border-red-200',
  },
  SUSPENDED: {
    dot: 'bg-red-500',
    badgeBg: 'bg-red-50',
    badgeText: 'text-red-700',
    badgeBorder: 'border-red-200',
  },
  PENDING: {
    dot: 'bg-slate-400',
    badgeBg: 'bg-slate-50',
    badgeText: 'text-slate-600',
    badgeBorder: 'border-slate-200',
  },
  NOT_FOUND: {
    dot: 'bg-slate-300',
    badgeBg: 'bg-slate-50',
    badgeText: 'text-slate-500',
    badgeBorder: 'border-slate-200',
  },
  UNKNOWN: {
    dot: 'bg-slate-300',
    badgeBg: 'bg-slate-50',
    badgeText: 'text-slate-500',
    badgeBorder: 'border-slate-200',
  },
};

function formatCredentialType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(iso: string): string {
  if (!iso) return '\u2014';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '\u2014';
  }
}

function formatDateTime(iso: string): string {
  if (!iso) return '\u2014';
  try {
    return new Date(iso).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  } catch {
    return '\u2014';
  }
}

// ── Credential Row ─────────────────────────────────────────

function CredentialRowView({ credential }: { credential: CredentialRow }) {
  const config = STATUS_CONFIG[credential.status];

  return (
    <tr className={credential.status === 'REVOKED' || credential.status === 'SUSPENDED' ? 'bg-red-50/30' : ''}>
      <td className="px-4 py-2.5 font-medium text-slate-700 text-sm">
        {formatCredentialType(credential.credentialType)}
      </td>
      <td className="px-4 py-2.5">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Badge
                  className={`text-[11px] border ${config.badgeBg} ${config.badgeText} ${config.badgeBorder} hover:bg-transparent cursor-help`}
                >
                  <span className={`inline-block h-2 w-2 rounded-full ${config.dot} mr-1.5`} />
                  {credential.status}
                </Badge>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Credential identifier: {credential.credentialIdentifier || '\u2014'}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </td>
      <td className="px-4 py-2.5 text-sm text-slate-600">
        {credential.issuingStateOrBody}
      </td>
      <td className="px-4 py-2.5 text-xs text-slate-400 font-mono">
        {formatDate(credential.expirationDate)}
      </td>
    </tr>
  );
}

// ── Component ──────────────────────────────────────────────

export function CredentialPanel({ data }: { data: CredentialPanelData }) {
  const { credentials, retrieval } = data;

  return (
    <section aria-labelledby="credentials-heading" className={PANEL_TRANSITION}>
      <Card interactive>
        <CardHeader>
          <CardTitle id="credentials-heading" className="text-lg text-slate-800">
            Credentials
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Retrieval metadata */}
          <div className="rounded-md border border-slate-200 bg-slate-50/50 p-3">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
              <div>
                <dt className="text-slate-400 font-semibold uppercase tracking-wider">Source</dt>
                <dd className="text-slate-700 mt-0.5">
                  {retrieval.source.sourceName}
                  {retrieval.source.authoritative && (
                    <span className="ml-1.5 text-green-700 font-medium">(authoritative)</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400 font-semibold uppercase tracking-wider">Method</dt>
                <dd className="text-slate-700 mt-0.5 font-mono">{retrieval.method}</dd>
              </div>
              <div>
                <dt className="text-slate-400 font-semibold uppercase tracking-wider">Retrieved At</dt>
                <dd className="text-slate-700 mt-0.5 font-mono">{formatDateTime(retrieval.retrievedAt)}</dd>
              </div>
              <div>
                <dt className="text-slate-400 font-semibold uppercase tracking-wider">Agent</dt>
                <dd className="text-slate-700 mt-0.5 font-mono">
                  {retrieval.agent.system} v{retrieval.agent.version}
                </dd>
              </div>
            </dl>
          </div>

          {/* Credentials table */}
          {credentials.length > 0 ? (
            <div className="rounded-md border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Credential
                    </th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Issuing Body
                    </th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Expiration
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {credentials.map((cred, i) => (
                    <CredentialRowView
                      key={`${cred.credentialType}-${cred.credentialIdentifier}-${i}`}
                      credential={cred}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No credentials on record.</p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
