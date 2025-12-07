'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { RefreshCcw } from 'lucide-react';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  'http://localhost:4000';
const CLINICIAN_ID = process.env.NEXT_PUBLIC_WALLET_CLINICIAN_ID || 'cln_demo';

type IndexCredentialType = 'license' | 'board' | 'employment' | 'dea_mate' | 'compact';
type IndexStatus = 'active' | 'expired' | 'revoked';

interface IndexTimelineEvent {
  label: string;
  occurredAt: string;
  status: IndexStatus;
  context?: string;
}

interface IndexRow {
  clinicianId: string;
  credentialType: IndexCredentialType;
  credentialId: string;
  issuerDid: string;
  status: IndexStatus;
  lastUpdated: string;
  summary: Record<string, unknown>;
  timeline: IndexTimelineEvent[];
}

interface IndexApiResponse {
  clinicianId: string;
  generatedAt: string;
  index: Record<IndexCredentialType, IndexRow[]>;
  rows: IndexRow[];
  statuses: {
    total: number;
    byStatus: Record<IndexStatus, number>;
    byType: Record<IndexCredentialType, number>;
  };
  snapshotHash: string;
  chainAnchors: {
    snapshot: AnchorPayload | null;
    diff: AnchorPayload | null;
  };
}

interface AnchorPayload {
  anchorId: string;
  txHash: string;
  blockNumber: number;
  network: string;
  timestamp: string;
}

export default function MasterIndexPage() {
  const [data, setData] = useState<IndexApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadIndex();
  }, []);

  async function loadIndex() {
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchIndex();
      setData(payload);
    } catch (err) {
      console.error('[wallet][index] load failed', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const payload = await fetchIndex();
      setData(payload);
    } catch (err) {
      console.error('[wallet][index] refresh failed', err);
      setError(err instanceof Error ? err.message : 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  }

  const statusCards = useMemo(() => {
    if (!data) return [];
    return [
      {
        label: 'Active credentials',
        count: data.statuses.byStatus.active,
        tone: 'text-emerald-500',
      },
      {
        label: 'Expiring / expired',
        count: data.statuses.byStatus.expired,
        tone: 'text-amber-500',
      },
      {
        label: 'Revoked or flagged',
        count: data.statuses.byStatus.revoked,
        tone: 'text-rose-500',
      },
    ];
  }, [data]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="space-y-2">
        <Badge variant="secondary">Wallet · Credential Index</Badge>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold leading-tight">Master credential index</h1>
            <p className="text-muted-foreground">
              Unified view across licenses, board certs, DEA/MATE, employment, and compact proofs.
            </p>
          </div>
          <Button onClick={handleRefresh} disabled={refreshing}>
            <RefreshCcw className={refreshing ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />
            Refresh index
          </Button>
        </div>
        {error && (
          <p className="text-sm text-rose-500">
            {error}
          </p>
        )}
      </header>

      {loading ? (
        <Card>
          <CardHeader>
            <CardTitle>Loading credential index…</CardTitle>
            <CardDescription>Building latest status snapshot</CardDescription>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      ) : data ? (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            {statusCards.map((card) => (
              <Card key={card.label}>
                <CardHeader>
                  <CardDescription>{card.label}</CardDescription>
                  <CardTitle className={`text-4xl font-semibold ${card.tone}`}>{card.count}</CardTitle>
                </CardHeader>
              </Card>
            ))}
          </section>

          <section className="space-y-6">
            {(Object.keys(data.index) as IndexCredentialType[])
              .filter((type) => data.index[type]?.length)
              .map((type) => (
                <CredentialSection key={type} type={type} rows={data.index[type]} />
              ))}
          </section>

          <ChainAnchorPanel anchors={data.chainAnchors} generatedAt={data.generatedAt} hash={data.snapshotHash} />
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No credential data</CardTitle>
            <CardDescription>Configure clinician data to view their index.</CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}

function CredentialSection({ type, rows }: { type: IndexCredentialType; rows: IndexRow[] }) {
  const label = sectionLabel(type);
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle>{label}</CardTitle>
              {type === 'license' && <LicenseComplianceTooltip />}
            </div>
            <CardDescription>
              {rows.length} credential{rows.length === 1 ? '' : 's'} tracked
            </CardDescription>
          </div>
          <Badge variant="outline">{type}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Credential</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Issuer</TableHead>
              <TableHead>Expiration / Review</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.credentialId}>
                <TableCell className="font-medium">
                  {String(row.summary?.label ?? row.credentialId)}
                </TableCell>
                <TableCell>
                  <StatusBadge status={row.status} />
                </TableCell>
                <TableCell>
                  <span className="text-xs font-mono">{row.issuerDid}</span>
                </TableCell>
                <TableCell>
                  {formatExpiry(row.summary)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {rows.map((row) => (
          <div key={`timeline-${row.credentialId}`} className="rounded-lg border bg-muted/30 p-4">
            <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {row.summary?.label ?? row.credentialId}
            </p>
            <ul className="space-y-2 text-sm">
              {row.timeline.map((event) => (
                <li key={`${row.credentialId}-${event.label}-${event.occurredAt}`} className="flex items-center justify-between gap-4 rounded border border-dashed px-3 py-2">
                  <div>
                    <p className="font-medium">{event.label}</p>
                    <p className="text-xs text-muted-foreground">{event.context ?? '—'}</p>
                  </div>
                  <div className="text-right text-xs">
                    <p>{new Date(event.occurredAt).toLocaleString()}</p>
                    <StatusBadge status={event.status} size="xs" />
                  </div>
                </li>
              ))}
              {!row.timeline.length && (
                <li className="text-xs text-muted-foreground">No timeline events recorded.</li>
              )}
            </ul>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ChainAnchorPanel({
  anchors,
  generatedAt,
  hash,
}: {
  anchors: IndexApiResponse['chainAnchors'];
  generatedAt: string;
  hash: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Chain anchors</CardTitle>
        <CardDescription>Snapshot hash {hash.slice(0, 12)}… · {new Date(generatedAt).toLocaleString()}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <AnchorCard title="Snapshot anchor" anchor={anchors.snapshot} />
        <AnchorCard title="Diff anchor" anchor={anchors.diff} />
      </CardContent>
    </Card>
  );
}

function AnchorCard({ title, anchor }: { title: string; anchor: AnchorPayload | null }) {
  if (!anchor) {
    return (
      <div className="rounded-lg border p-4 text-sm text-muted-foreground">
        <p className="font-medium">{title}</p>
        <p>No anchor recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-4 text-sm">
      <p className="font-medium">{title}</p>
      <p className="font-mono text-xs text-muted-foreground">Tx {anchor.txHash.slice(0, 18)}…</p>
      <p>Network: {anchor.network}</p>
      <p>Block #{anchor.blockNumber}</p>
      <p>Timestamp: {new Date(anchor.timestamp).toLocaleString()}</p>
    </div>
  );
}

function StatusBadge({ status, size = 'sm' }: { status: IndexStatus; size?: 'sm' | 'xs' }) {
  const tone =
    status === 'active'
      ? 'bg-emerald-100 text-emerald-700'
      : status === 'expired'
        ? 'bg-amber-100 text-amber-700'
        : 'bg-rose-100 text-rose-700';
  const scale = size === 'xs' ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs';
  return (
    <span className={`rounded-full ${tone} ${scale} font-semibold uppercase tracking-wide`}>
      {status}
    </span>
  );
}

function formatExpiry(summary: Record<string, unknown>): string {
  const expiresAt = summary?.expiresAt;
  if (typeof expiresAt === 'string') {
    return new Date(expiresAt).toLocaleDateString();
  }
  const verifiedAt = summary?.verifiedAt ?? summary?.lastVerifiedAt;
  if (typeof verifiedAt === 'string') {
    return `Verified ${new Date(verifiedAt).toLocaleDateString()}`;
  }
  return '—';
}

function sectionLabel(type: IndexCredentialType): string {
  switch (type) {
    case 'license':
      return 'State licenses';
    case 'board':
      return 'Board certifications';
    case 'employment':
      return 'Employment credentials';
    case 'dea_mate':
      return 'DEA & MATE';
    case 'compact':
      return 'Compact credentials';
    default:
      return type;
  }
}

function LicenseComplianceTooltip() {
  const [headline, setHeadline] = useState('According to FSMB rule update, renew expiring licenses.');

  useEffect(() => {
    let mounted = true;
    async function loadHeadline() {
      if (!API_BASE) return;
      try {
        const response = await fetch(`${API_BASE}/api/regulatory/FSMB`, { cache: 'no-store' });
        if (!response.ok) return;
        const payload = (await response.json()) as { diff?: { headline?: string } };
        if (payload?.diff?.headline && mounted) {
          setHeadline(`According to FSMB rule update, ${payload.diff.headline.toLowerCase()}.`);
        }
      } catch (error) {
        console.warn('[wallet][license-tooltip]', error);
      }
    }
    void loadHeadline();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center rounded-full border border-dashed px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground"
        >
          Reg update
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-left text-xs">{headline}</TooltipContent>
    </Tooltip>
  );
}

async function fetchIndex(): Promise<IndexApiResponse> {
  const response = await fetch(
    `${API_BASE}/api/index/${encodeURIComponent(CLINICIAN_ID)}?diff=true`,
    {
      cache: 'no-store',
    },
  );

  if (!response.ok) {
    throw new Error(`Index API failed with ${response.status}`);
  }

  return (await response.json()) as IndexApiResponse;
}


