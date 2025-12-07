'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Download,
  GitMerge,
  History,
  RefreshCcw,
  ShieldCheck,
  SplitSquareHorizontal,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.API_BASE_URL ||
  '';
const CLINICIAN_ID = process.env.NEXT_PUBLIC_WALLET_CLINICIAN_ID || 'cln_demo';

interface FusionComponent {
  id: string;
  label: string;
  type: string;
  status: 'active' | 'expired' | 'revoked' | 'pending';
  metrics: {
    trust: number;
    recency: number;
    anchor: number;
    score: number;
  };
  fields: Record<string, unknown>;
  sources: FusionSourceRef[];
}

interface FusionSourceRef {
  sourceId: string;
  type: string;
  trust: number;
  updatedAt?: string;
  anchor?: string | null;
  issuer?: string | null;
  issuerDid?: string | null;
  summary: Record<string, unknown>;
}

interface FusionTimelineEvent {
  id: string;
  componentId: string;
  label: string;
  type: string;
  status: FusionComponent['status'];
  occurredAt: string;
  context?: string;
}

interface FusionDiffEntry {
  componentId: string;
  label: string;
  fused: Record<string, unknown>;
  inputs: FusionSourceRef[];
}

interface FusedRecord {
  clinicianId: string;
  generatedAt: string;
  summary: {
    componentCount: number;
    activeComponents: number;
    expiredComponents: number;
    sourceCount: number;
  };
  components: FusionComponent[];
  timeline: FusionTimelineEvent[];
  diff: FusionDiffEntry[];
  rootHash: string;
}

interface FusionValidation {
  id: string;
  level: 'info' | 'warning' | 'error';
  message: string;
  componentId?: string;
}

interface FusionConflict {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high';
  message: string;
}

interface AnchorPayload {
  txHash: string;
  network: string;
  payload: {
    timestamp: string;
  };
}

interface FusionApiResponse {
  clinicianId: string;
  generatedAt: string;
  fused: FusedRecord;
  sources: Record<string, unknown>;
  conflicts: FusionConflict[];
  resolutions: Array<{
    selectedComponentId: string;
    policy: string;
    rationale: string[];
  }>;
  validations: FusionValidation[];
  anchor: AnchorPayload | null;
  bundle?: Record<string, unknown> | null;
}

type LoadState = 'idle' | 'loading' | 'error';

export default function FusionPage() {
  const [fusion, setFusion] = useState<FusionApiResponse | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFusion = useCallback(
    async (includeBundle = false) => {
      const query = includeBundle ? '?bundle=true' : '';
      const response = await fetch(
        `${API_BASE}/api/fusion/${encodeURIComponent(CLINICIAN_ID)}${query}`,
        { cache: 'no-store' },
      );
      if (!response.ok) {
        throw new Error(`Fusion API failed with ${response.status}`);
      }
      return (await response.json()) as FusionApiResponse;
    },
    [],
  );

  useEffect(() => {
    const load = async () => {
      setState('loading');
      setError(null);
      try {
        const payload = await fetchFusion();
        setFusion(payload);
        setState('idle');
      } catch (err) {
        console.error('[wallet][fusion] load failed', err);
        setError(err instanceof Error ? err.message : 'Failed to load fusion snapshot');
        setState('error');
      }
    };
    void load();
  }, [fetchFusion]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const payload = await fetchFusion();
      setFusion(payload);
    } catch (err) {
      console.error('[wallet][fusion] refresh failed', err);
      setError(err instanceof Error ? err.message : 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  }, [fetchFusion]);

  const handleExportBundle = useCallback(async () => {
    try {
      const payload = await fetchFusion(true);
      if (!payload.bundle) {
        throw new Error('Fusion export bundle unavailable');
      }
      const blob = new Blob([JSON.stringify(payload.bundle, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `fusion-bundle-${CLINICIAN_ID}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[wallet][fusion] export failed', err);
      setError(err instanceof Error ? err.message : 'Export failed');
    }
  }, [fetchFusion]);

  const stats = useMemo(() => {
    if (!fusion) return [];
    return [
      {
        label: 'Fused components',
        value: fusion.fused.summary.componentCount,
        tone: 'text-emerald-600',
      },
      {
        label: 'Active components',
        value: fusion.fused.summary.activeComponents,
        tone: 'text-emerald-500',
      },
      {
        label: 'Expired components',
        value: fusion.fused.summary.expiredComponents,
        tone: 'text-amber-500',
      },
    ];
  }, [fusion]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary" className="gap-1">
            <GitMerge className="h-3.5 w-3.5" />
            Wallet · Credential fusion
          </Badge>
          {fusion && (
            <Badge variant="outline" className="gap-1">
              <ShieldCheck className="h-3.5 w-3.5" />
              Root {fusion.fused.rootHash.slice(0, 12)}…
            </Badge>
          )}
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={handleExportBundle} disabled={state === 'loading'}>
              <Download className="mr-2 h-4 w-4" />
              Export FHIR bundle
            </Button>
            <Button onClick={handleRefresh} disabled={refreshing}>
              <RefreshCcw className={refreshing ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />
              Refresh fusion
            </Button>
          </div>
        </div>
        <div>
          <h1 className="text-3xl font-semibold leading-tight">Credential fusion timeline</h1>
          <p className="text-muted-foreground">
            Clinician <span className="font-mono">{CLINICIAN_ID}</span> ·{' '}
            {fusion ? new Date(fusion.generatedAt).toLocaleString() : '—'}
          </p>
        </div>
        {error && (
          <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <AlertTriangle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}
      </header>

      {state === 'loading' && (
        <Card>
          <CardHeader>
            <CardTitle>Loading fusion snapshot…</CardTitle>
            <CardDescription>Collecting latest credential sources</CardDescription>
          </CardHeader>
          <CardContent className="text-muted-foreground">Please wait.</CardContent>
        </Card>
      )}

      {fusion && state !== 'loading' && (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            {stats.map((stat) => (
              <Card key={stat.label}>
                <CardHeader>
                  <CardDescription>{stat.label}</CardDescription>
                  <CardTitle className={`text-4xl ${stat.tone}`}>{stat.value}</CardTitle>
                </CardHeader>
              </Card>
            ))}
          </section>

          <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Fusion timeline
                </CardTitle>
                <CardDescription>Chronological view across US + global sources</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {fusion.fused.timeline.length === 0 && (
                  <p className="text-sm text-muted-foreground">No timeline events recorded.</p>
                )}
                {fusion.fused.timeline.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center justify-between rounded-lg border p-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">{event.label}</p>
                      <p className="text-xs text-muted-foreground">{event.context ?? '—'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-xs">
                        {new Date(event.occurredAt).toLocaleDateString()}
                      </p>
                      <StatusBadge status={event.status} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Conflicts & validations
                </CardTitle>
                <CardDescription>Policy engine + guardrail output</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <p className="mb-2 text-xs uppercase text-muted-foreground">Conflicts</p>
                  {fusion.conflicts.length === 0 ? (
                    <p className="text-muted-foreground">No open conflicts detected.</p>
                  ) : (
                    <ul className="space-y-2">
                      {fusion.conflicts.map((conflict) => (
                        <li key={conflict.id} className="rounded border p-2">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{conflict.type}</span>
                            <Badge variant="outline">{conflict.severity}</Badge>
                          </div>
                          <p className="text-xs text-foreground">{conflict.message}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <p className="mb-2 text-xs uppercase text-muted-foreground">Validation findings</p>
                  {fusion.validations.length === 0 ? (
                    <p className="text-muted-foreground">All deep checks passed.</p>
                  ) : (
                    <ul className="space-y-2">
                      {fusion.validations.map((finding) => (
                        <li
                          key={finding.id}
                          className={`rounded border p-2 ${
                            finding.level === 'error'
                              ? 'border-rose-200 bg-rose-50 text-rose-900'
                              : finding.level === 'warning'
                                ? 'border-amber-200 bg-amber-50 text-amber-900'
                                : 'border-emerald-200 bg-emerald-50 text-emerald-900'
                          }`}
                        >
                          <p className="text-xs font-semibold uppercase">{finding.level}</p>
                          <p className="text-sm">{finding.message}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </CardContent>
            </Card>
          </section>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SplitSquareHorizontal className="h-4 w-4" />
                Fusion diff viewer
              </CardTitle>
              <CardDescription>Compare raw inputs vs fused output side-by-side.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {fusion.fused.diff.map((entry) => (
                <DiffCard key={entry.componentId} entry={entry} />
              ))}
              {!fusion.fused.diff.length && (
                <p className="text-sm text-muted-foreground">No diff entries to display.</p>
              )}
            </CardContent>
          </Card>

          <AnchorPanel anchor={fusion.anchor} rootHash={fusion.fused.rootHash} />
        </>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: FusionComponent['status'] }) {
  const tone =
    status === 'active'
      ? 'bg-emerald-100 text-emerald-700'
      : status === 'expired'
        ? 'bg-amber-100 text-amber-700'
        : status === 'revoked'
          ? 'bg-rose-100 text-rose-700'
          : 'bg-slate-100 text-slate-700';
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${tone}`}>
      {status}
    </span>
  );
}

function DiffCard({ entry }: { entry: FusionDiffEntry }) {
  return (
    <div className="grid gap-4 rounded-lg border bg-muted/30 p-4 md:grid-cols-2">
      <div>
        <p className="text-xs uppercase text-muted-foreground">Fused output</p>
        <p className="font-semibold">{entry.label}</p>
        <pre className="mt-2 max-h-48 overflow-auto rounded bg-background p-3 text-xs">
          {JSON.stringify(entry.fused, null, 2)}
        </pre>
      </div>
      <div>
        <p className="text-xs uppercase text-muted-foreground">Raw inputs</p>
        <div className="mt-2 space-y-2">
          {entry.inputs.map((input) => (
            <div key={`${entry.componentId}-${input.sourceId}`} className="rounded border bg-background p-2 text-xs">
              <div className="flex items-center justify-between text-[10px] uppercase text-muted-foreground">
                <span>{input.type}</span>
                <Badge variant="outline">{(input.trust * 100).toFixed(0)}%</Badge>
              </div>
              <pre className="mt-2 max-h-32 overflow-auto">{JSON.stringify(input.summary, null, 2)}</pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AnchorPanel({ anchor, rootHash }: { anchor: AnchorPayload | null; rootHash: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" />
          Chain anchor
        </CardTitle>
        <CardDescription>Root {rootHash.slice(0, 16)}…</CardDescription>
      </CardHeader>
      <CardContent>
        {anchor ? (
          <div className="text-sm">
            <p>
              Network <span className="font-semibold">{anchor.network}</span>
            </p>
            <p className="font-mono text-xs text-muted-foreground">
              Tx {anchor.txHash.slice(0, 24)}…
            </p>
            <p className="text-xs text-muted-foreground">
              Anchored {new Date(anchor.payload.timestamp).toLocaleString()}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Anchor record not available yet.</p>
        )}
      </CardContent>
    </Card>
  );
}









