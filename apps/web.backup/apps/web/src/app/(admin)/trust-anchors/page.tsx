'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Shield, RefreshCcw, TrendingUp, Lock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useRoleUX } from '@/contexts/RoleUXContext';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.API_BASE_URL ||
  '';

interface TrustAnchorScore {
  entityDid: string;
  entityType: 'issuer' | 'employer' | 'validator' | 'wallet';
  score: number;
  metadata: Record<string, any>;
  alerts?: string[];
  blocked?: boolean;
}

interface TrustAnchorSnapshot {
  generatedAt: string;
  issuers: TrustAnchorScore[];
  employers: TrustAnchorScore[];
  validators: TrustAnchorScore[];
  wallets: TrustAnchorScore[];
  alerts: Array<{ entityDid: string; reason: string }>;
  blockedEntities: string[];
}

export default function TrustAnchorsPage() {
  const { formatError } = useRoleUX();
  const [snapshot, setSnapshot] = useState<TrustAnchorSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/trust/anchors?refresh=true`);
      if (!response.ok) {
        throw new Error(`Trust anchor request failed (${response.status})`);
      }
      const payload = (await response.json()) as TrustAnchorSnapshot;
      setSnapshot(payload);
    } catch (err) {
      console.error('[admin][trust-anchors] load failed', err);
      setError(formatError('trust_anchor_fetch_failed', err instanceof Error ? err.message : 'Unable to load anchors'));
    } finally {
      setLoading(false);
    }
  }, [formatError]);

  useEffect(() => {
    void load();
  }, [load]);

  const topIssuers = useMemo(() => snapshot?.issuers.slice(0, 5) ?? [], [snapshot]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 py-8">
      <header className="flex flex-col gap-3 px-4">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary" className="gap-2">
            <Shield className="h-3.5 w-3.5" />
            Trust anchoring engine v3
          </Badge>
          <Badge variant="outline">{snapshot ? new Date(snapshot.generatedAt).toLocaleString() : '—'}</Badge>
          <div className="ml-auto">
            <Button variant="outline" onClick={load} disabled={loading}>
              <RefreshCcw className={loading ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />
              Refresh anchor scores
            </Button>
          </div>
        </div>
        <div>
          <h1 className="text-3xl font-semibold">Trust anchor observatory</h1>
          <p className="text-sm text-muted-foreground">
            Dynamic scoring of issuers, employers, wallets, and validator nodes with guardrail enforcement.
          </p>
        </div>
        {error && (
          <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <AlertTriangle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}
      </header>

      {snapshot && (
        <>
          <section className="grid gap-4 px-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                  Overall issuers
                </CardTitle>
                <CardDescription>Average issuer confidence</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold">
                  {averageScore(snapshot.issuers).toLocaleString(undefined, { style: 'percent', maximumFractionDigits: 1 })}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Lock className="h-4 w-4 text-red-500" />
                  Auto-blocked entities
                </CardTitle>
                <CardDescription>Policy enforcement</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold">{snapshot.blockedEntities.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Alerts
                </CardTitle>
                <CardDescription>Entities below trust threshold</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold">{snapshot.alerts.length}</div>
              </CardContent>
            </Card>
          </section>

          <Card className="mx-4">
            <CardHeader>
              <CardTitle>Issuer trust anchors</CardTitle>
              <CardDescription>Top issuers ranked by trust score and recent lineage.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Issuer DID</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Org</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topIssuers.map((issuer) => (
                    <TableRow key={issuer.entityDid}>
                      <TableCell className="font-mono text-xs">
                        {issuer.entityDid}
                        {issuer.blocked && (
                          <Badge variant="destructive" className="ml-2 text-[10px]">
                            Blocked
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">
                            {(issuer.score * 100).toFixed(1)}%
                          </span>
                          <div className="h-2 w-24 rounded-full bg-muted">
                            <div
                              className={`h-2 rounded-full ${
                                issuer.score < 0.58
                                  ? 'bg-red-500'
                                  : issuer.score < 0.7
                                    ? 'bg-amber-500'
                                    : 'bg-emerald-500'
                              }`}
                              style={{ width: `${issuer.score * 100}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {issuer.metadata.orgName ?? '—'}
                        <p className="text-xs text-muted-foreground">{issuer.metadata.jurisdiction ?? '—'}</p>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {(issuer.metadata.contributions as Array<{ label: string; weight: number }> | undefined)?.map(
                          (contribution) => (
                            <Badge key={contribution.label} variant="outline" className="mr-1">
                              {contribution.label}: {(contribution.weight * 100).toFixed(0)}bps
                            </Badge>
                          ),
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <section className="grid gap-4 px-4 lg:grid-cols-3">
            <AnchorPanel title="Employers" anchors={snapshot.employers} />
            <AnchorPanel title="Validators" anchors={snapshot.validators} />
            <AnchorPanel title="Wallets" anchors={snapshot.wallets} />
          </section>
        </>
      )}
    </div>
  );
}

function AnchorPanel({ title, anchors }: { title: string; anchors: TrustAnchorScore[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{anchors.length} entries</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {anchors.length === 0 && <p className="text-sm text-muted-foreground">No entries available yet.</p>}
        {anchors.slice(0, 6).map((anchor) => (
          <div key={anchor.entityDid} className="rounded-md border p-3 text-sm">
            <div className="flex items-center justify-between">
              <p className="font-mono text-xs">{anchor.entityDid}</p>
              <Badge
                variant={
                  anchor.score < 0.58 ? 'destructive' : anchor.score < 0.7 ? 'secondary' : 'outline'
                }
              >
                {(anchor.score * 100).toFixed(0)}%
              </Badge>
            </div>
            {anchor.alerts?.length ? (
              <p className="text-xs text-muted-foreground">
                Alerts: {anchor.alerts.join(', ')}
              </p>
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function averageScore(entries: TrustAnchorScore[]) {
  if (!entries.length) return 0;
  const total = entries.reduce((sum, entry) => sum + entry.score, 0);
  return total / entries.length;
}

