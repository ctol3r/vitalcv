'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ClaimBadge } from '@/components/ui/claim-badge';
import {
  GlassCard,
  GlassCardContent,
  GlassCardHeader,
  GlassCardTitle,
} from '@/components/ui/glass-card';
import { Input } from '@/components/ui/input';
import {
  AlertTriangle,
  ArrowUpDown,
  Database,
  MoreHorizontal,
  Search,
  XCircle,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import type { CredentialRecord, CredentialStatus } from './issuer-types';
import { STATUS_STYLES, CREDENTIAL_TYPE_LABELS, type CredentialType } from './issuer-types';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface CredentialRegistryProps {
  credentials: CredentialRecord[];
  onManageStatus: (credential: CredentialRecord) => void;
}

/* ------------------------------------------------------------------ */
/*  CredentialRegistry — data table with filtering/sorting             */
/* ------------------------------------------------------------------ */

export function CredentialRegistry({ credentials, onManageStatus }: CredentialRegistryProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CredentialStatus | 'ALL'>('ALL');
  const [sortField, setSortField] = useState<'issuedAt' | 'subjectName' | 'credentialType'>('issuedAt');
  const [sortAsc, setSortAsc] = useState(false);

  const filtered = useMemo(() => {
    let result = [...credentials];

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.subjectName.toLowerCase().includes(q) ||
          c.subjectNpi.includes(q) ||
          c.credentialType.toLowerCase().includes(q),
      );
    }

    // Status filter
    if (statusFilter !== 'ALL') {
      result = result.filter((c) => c.status === statusFilter);
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'issuedAt') {
        cmp = new Date(a.issuedAt).getTime() - new Date(b.issuedAt).getTime();
      } else if (sortField === 'subjectName') {
        cmp = a.subjectName.localeCompare(b.subjectName);
      } else {
        cmp = a.credentialType.localeCompare(b.credentialType);
      }
      return sortAsc ? cmp : -cmp;
    });

    return result;
  }, [credentials, search, statusFilter, sortField, sortAsc]);

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <GlassCard>
      <GlassCardHeader>
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-[var(--accent)]" />
          <GlassCardTitle>Credential Registry</GlassCardTitle>
        </div>
        <Badge variant="outline" className="text-xs">
          {filtered.length} of {credentials.length}
        </Badge>
      </GlassCardHeader>

      <GlassCardContent className="space-y-4">
        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, NPI, or type..."
              className="pl-9 h-9 text-sm"
            />
          </div>
          <div className="flex gap-1.5">
            {(['ALL', 'ACTIVE', 'EXPIRED', 'REVOKED', 'PENDING'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  statusFilter === s
                    ? 'bg-primary/10 border border-primary/20 text-foreground'
                    : 'bg-muted/30 border border-transparent text-muted-foreground hover:border-border/40'
                }`}
              >
                {s === 'ALL' ? 'All' : STATUS_STYLES[s].label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-[var(--glass-border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--glass-border)] bg-muted/20">
                <Th onClick={() => toggleSort('credentialType')} active={sortField === 'credentialType'}>
                  Type
                </Th>
                <Th onClick={() => toggleSort('subjectName')} active={sortField === 'subjectName'}>
                  Subject
                </Th>
                <Th>Status</Th>
                <Th>Level</Th>
                <Th onClick={() => toggleSort('issuedAt')} active={sortField === 'issuedAt'}>
                  Issued
                </Th>
                <Th>Expires</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-muted-foreground">
                    No credentials match your filters.
                  </td>
                </tr>
              ) : (
                filtered.map((cred) => {
                  const statusStyle = STATUS_STYLES[cred.status];
                  const typeLabel =
                    CREDENTIAL_TYPE_LABELS[cred.credentialType as CredentialType] ||
                    cred.credentialType;

                  return (
                    <tr
                      key={cred.id}
                      className="border-b border-[var(--glass-border)] last:border-b-0 hover:bg-muted/10 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium">{typeLabel}</td>
                      <td className="px-4 py-3">
                        <div>
                          <span className="font-medium">{cred.subjectName}</span>
                          <span className="text-xs text-muted-foreground block font-mono">
                            {cred.subjectNpi}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`text-[10px] ${statusStyle.color}`}>
                          {cred.status === 'REVOKED' && <XCircle className="h-3 w-3 mr-0.5" />}
                          {cred.status === 'EXPIRED' && <AlertTriangle className="h-3 w-3 mr-0.5" />}
                          {statusStyle.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <ClaimBadge level={cred.claimLevel} />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {new Date(cred.issuedAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {cred.expiresAt
                          ? new Date(cred.expiresAt).toLocaleDateString()
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => onManageStatus(cred)}
                        >
                          <MoreHorizontal className="h-3 w-3 mr-0.5" />
                          Manage
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </GlassCardContent>
    </GlassCard>
  );
}

/* ------------------------------------------------------------------ */
/*  Table header cell                                                  */
/* ------------------------------------------------------------------ */

function Th({
  children,
  onClick,
  active,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <th className="px-4 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
        >
          {children}
          <ArrowUpDown className={`h-3 w-3 ${active ? 'text-[var(--accent)]' : ''}`} />
        </button>
      ) : (
        children
      )}
    </th>
  );
}
