'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCcw,
  GitCommit,
  ShieldCheck,
  Activity,
  History,
  Layers,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useRoleUX } from '@/contexts/RoleUXContext';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.API_BASE_URL ||
  '';
const CLINICIAN_ID = process.env.NEXT_PUBLIC_WALLET_CLINICIAN_ID || 'cln_demo';

interface FabricSnapshot {
  clinicianId: string;
  version: number;
  status: string;
  generatedAt: string;
  fabric: Record<string, any>;
  integrity: {
    overall: 'pass' | 'warning' | 'fail';
    signatureChain: { ok: boolean; issues: string[] };
    expirations: { ok: boolean; expiringSoon: number; expired: number };
    revocations: { ok: boolean; revokedCount: number; orphanedCredentials: number };
  };
  conflicts: Array<{
    id: string;
    type: string;
    severity: 'low' | 'medium' | 'high';
    summary: string;
  }>;
  crossChain?: {
    root: string;
    evm?: { proof: string; chainId: string };
    cosmos?: { proof: string; chainId: string };
  } | null;
}

interface FabricDiff {
  id: string;
  version: number;
  previousVersion: number | null;
  diff: Array<{ path: string; previous: unknown; next: unknown }>;
  mutatedAt: string;
  actor?: string;
}

export default function CredentialFabricPage() {
  const { formatError } = useRoleUX();
  const [snapshot, setSnapshot] = useState<FabricSnapshot | null>(null);
  const [diffs, setDiffs] = useState<FabricDiff[]>([]);
  const [replay, setReplay] = useState<FabricSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (refresh = false) => {
      setLoading(true);
      setError(null);
      try {
        const query = refresh ? '?refresh=true' : '';
        const response = await fetch(`${API_BASE}/api/credentials/fabric/${CLINICIAN_ID}${query}`);
        if (!response.ok) {
          throw new Error(`Snapshot request failed (${response.status})`);
        }
        const payload = (await response.json()) as FabricSnapshot;
        setSnapshot(payload);
        const diffResponse = await fetch(
          `${API_BASE}/api/credentials/fabric/${CLINICIAN_ID}/diffs?limit=8`,
        );
        if (diffResponse.ok) {
          const diffPayload = (await diffResponse.json()) as { diffs: FabricDiff[] };
          setDiffs(diffPayload.diffs ?? []);
        }
      } catch (err) {
        console.error('[wallet][fabric] load failed', err);
        setError(formatError('fabric_fetch_failed', err instanceof Error ? err.message : 'Unable to load fabric'));
      } finally {
        setLoading(false);
      }
    },
    [formatError],
  );

  const handleReplay = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/credentials/fabric/${CLINICIAN_ID}/replay`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ version: snapshot?.version }),
      });
      if (!response.ok) {
        throw new Error(`Replay failed (${response.status})`);
      }
      const payload = (await response.json()) as FabricSnapshot;
      setReplay(payload);
    } catch (err) {
      console.error('[wallet][fabric] replay failed', err);
      setError(formatError('fabric_replay_failed', err instanceof Error ? err.message : 'Unable to replay events'));
    }
  }, [snapshot?.version, formatError]);

  useEffect(() => {
    void load(false);
  }, [load]);

  const stats = useMemo(() => {
    if (!snapshot) return [];
    return [
      {
        label: 'Fabric version',
        value: snapshot.version,
        icon: Layers,
      },
      {
        label: 'Integrity',
        value: snapshot.integrity.overall.toUpperCase(),
        icon: ShieldCheck,
        variant:
          snapshot.integrity.overall === 'fail'
            ? 'destructive'
            : snapshot.integrity.overall === 'warning'
              ? 'secondary'
              : 'default',
      },
      {
        label: 'Conflicts',
        value: snapshot.conflicts.length,
        icon: AlertTriangle,
        variant: snapshot.conflicts.length ? 'destructive' : 'default',
      },
    ];
  }, [snapshot]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 py-8">
      <header className="flex flex-col gap-4 px-4">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary" className="gap-2">
            <Activity className="h-3.5 w-3.5" />
            Credential fabric
          </Badge>
          <Badge variant="outline">
            Clinician <span className="font-mono">{CLINICIAN_ID}</span>
          </Badge>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={() => load(true)} disabled={loading}>
              <RefreshCcw className={loading ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />
              Refresh snapshot
            </Button>
            <Button variant="secondary" size="sm" onClick={handleReplay} disabled={loading}>
              <History className="mr-2 h-4 w-4" />
              Replay events
            </Button>
          </div>
        </div>
        <div>
          <h1 className="text-3xl font-semibold">Next-gen credential fabric</h1>
          <p className="text-sm text-muted-foreground">
            Lineage-aware stitching across state boards, NPI, issuer VCs, and audit hashes with cross-chain readiness.
          </p>
        </div>
        {error && (
          <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <AlertTriangle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}
      </header>

      <section className="grid gap-4 px-4 md:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </section>

      {snapshot && (
        <>
          <Card className="mx-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                Fabric integrity validator
              </CardTitle>
              <CardDescription>Signature chain, expiration, and revocation lineage reports.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <IntegrityTile
                title="Signature chain"
                ok={snapshot.integrity.signatureChain.ok}
                issues={snapshot.integrity.signatureChain.issues}
              />
              <IntegrityTile
                title="Expiration pulse"
                ok={snapshot.integrity.expirations.ok}
                issues={[
                  `${snapshot.integrity.expirations.expired} expired`,
                  `${snapshot.integrity.expirations.expiringSoon} expiring soon`,
                ]}
              />
              <IntegrityTile
                title="Revocation lineage"
                ok={snapshot.integrity.revocations.ok}
                issues={[
                  `${snapshot.integrity.revocations.revokedCount} revoked`,
                  `${snapshot.integrity.revocations.orphanedCredentials} orphaned`,
                ]}
              />
            </CardContent>
          </Card>

          <Card className="mx-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Fabric conflict inspector
              </CardTitle>
              <CardDescription>Highlight state board vs issuer inconsistencies.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {snapshot.conflicts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No conflicts detected 🎉</p>
              ) : (
                snapshot.conflicts.map((conflict) => (
                  <div
                    key={conflict.id}
                    className="flex items-start justify-between rounded-md border border-amber-200 bg-amber-50 p-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">{conflict.summary}</p>
                      <p className="text-xs text-muted-foreground">{conflict.type}</p>
                    </div>
                    <Badge variant={conflict.severity === 'high' ? 'destructive' : 'secondary'}>
                      {conflict.severity}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="mx-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitCommit className="h-4 w-4" />
                Mutation diff log
              </CardTitle>
              <CardDescription>Field-level diffs per snapshot version.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {diffs.length === 0 && (
                <p className="text-sm text-muted-foreground">No historical diffs recorded yet.</p>
              )}
              {diffs.map((entry) => (
                <details key={entry.id} className="rounded border p-3 text-sm">
                  <summary className="flex items-center justify-between">
                    <span>
                      v{entry.version} ← v{entry.previousVersion ?? '—'}
                    </span>
                    <Badge variant="outline">{new Date(entry.mutatedAt).toLocaleString()}</Badge>
                  </summary>
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {entry.diff.slice(0, 5).map((diff) => (
                      <li key={diff.path} className="font-mono">
                        {diff.path}: {JSON.stringify(diff.previous)} → {JSON.stringify(diff.next)}
                      </li>
                    ))}
                    {entry.diff.length > 5 && <li>…{entry.diff.length - 5} more fields</li>}
                  </ul>
                </details>
              ))}
            </CardContent>
          </Card>

          {snapshot.crossChain && (
            <Card className="mx-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Cross-chain readiness
                </CardTitle>
                <CardDescription>Prepared proofs for EVM + Cosmos verification.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <CrossChainTile title="EVM adapter" data={snapshot.crossChain.evm} />
                <CrossChainTile title="Cosmos adapter" data={snapshot.crossChain.cosmos} />
              </CardContent>
            </Card>
          )}

          {replay && (
            <Card className="mx-4 border-emerald-200 bg-emerald-50 text-emerald-900">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Event replayer
                </CardTitle>
                <CardDescription>
                  Reconstructed version {replay.version} from historical events ·{' '}
                  {new Date(replay.generatedAt).toLocaleString()}
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm">
                <p className="font-mono text-xs text-emerald-900">
                  {JSON.stringify(replay.fabric, null, 2).slice(0, 320)}…
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function IntegrityTile({ title, ok, issues }: { title: string; ok: boolean; issues: string[] }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm font-semibold">{title}</p>
      <div className="mt-2 flex items-center gap-2 text-sm">
        {ok ? (
          <>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span className="text-muted-foreground">All clear</span>
          </>
        ) : (
          <>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span className="text-muted-foreground">{issues[0]}</span>
          </>
        )}
      </div>
      {!ok && (
        <ul className="mt-2 text-xs text-muted-foreground">
          {issues.map((issue) => (
            <li key={issue}>• {issue}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CrossChainTile({ title, data }: { title: string; data?: { proof: string; chainId: string } | null }) {
  if (!data) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        No adapter generated yet.
      </div>
    );
  }
  return (
    <div className="rounded-lg border p-4 text-sm">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-muted-foreground">Chain ID: {data.chainId}</p>
      <p className="font-mono text-xs">{data.proof.slice(0, 32)}…</p>
    </div>
  );
}

