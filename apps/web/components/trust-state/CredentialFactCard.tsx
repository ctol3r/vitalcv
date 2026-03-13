'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { CredentialRow, CredentialStatus } from './types';
import { PANEL_TRANSITION } from './motion';

// Visual Config for Status
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

export function CredentialFactCard({ credential, minimal = false }: { credential: CredentialRow, minimal?: boolean }) {
  const config = STATUS_CONFIG[credential.status];

  return (
    <Card className={PANEL_TRANSITION}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base text-slate-800">
            {formatCredentialType(credential.credentialType)}
          </CardTitle>
          <Badge
            className={`text-xs border ${config.badgeBg} ${config.badgeText} ${config.badgeBorder} hover:bg-transparent`}
          >
            <span className={`inline-block h-2 w-2 rounded-full ${config.dot} mr-1.5`} />
            {credential.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-y-4 gap-x-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Issuing Body
            </p>
            <p className="mt-1 text-sm text-slate-700">{credential.issuingStateOrBody}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Identifier
            </p>
            <p className="mt-1 text-sm font-mono text-slate-700">
              {credential.credentialIdentifier || '\u2014'}
            </p>
          </div>
          {!minimal && (
            <>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Issue Date
                </p>
                <p className="mt-1 text-sm font-mono text-slate-700">
                  {formatDate(credential.issueDate)}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Expiration Date
                </p>
                <p className="mt-1 text-sm font-mono text-slate-700">
                  {formatDate(credential.expirationDate)}
                </p>
              </div>
            </>
          )}
        </div>
        {!minimal && (
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
               <span className="text-xs text-slate-500 font-medium">Source-backed Fact</span>
               <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Portable Trust Artifact
               </span>
            </div>
        )}
      </CardContent>
    </Card>
  );
}
