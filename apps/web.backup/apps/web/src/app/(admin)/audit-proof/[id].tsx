'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Copy,
  Download,
  Loader2,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Signal,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  '';

interface ProofMetrics {
  mode: 'snark' | 'mock';
  provingTimeMs: number;
  circuitSize: number;
  constraintCount: number;
  depth: number;
}

interface AuditProofPayload {
  eventId: string;
  circuitType: string;
  issuedAt?: string;
  proof: {
    mode: 'snark' | 'mock';
    snark?: Record<string, unknown>;
    publicSignals: string[];
    circuitInput?: {
      leaf: string;
      root: string;
      siblings: string[];
      pathPositions: string[];
    };
    ledgerRoot?: string;
    pathCommitment?: string;
    metrics: ProofMetrics;
    generatedAt?: string;
    block?: {
      blockHash: string;
      eventType?: string | null;
      timestamp?: string;
      palletName?: string | null;
      merklePath?: string[];
    };
  };
  anchor?: {
    id: string;
    txHash: string;
    merkleRoot: string;
    network: string;
    payload: {
      timestamp: string;
      ledgerRoot?: string;
      proofCommitment?: string;
      proofHash?: string;
    };
  } | null;
}

interface PageProps {
  params: { id: string };
}

export default function AuditProofWorkbench({ params }: PageProps) {
  const [eventId, setEventId] = useState(params.id ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<AuditProofPayload | null>(null);

  const fetchProof = useCallback(
    async (options?: { force?: boolean }) => {
      if (!eventId?.trim()) {
        setError('Provide an audit event id to generate a proof.');
        return;
      }

      setLoading(true);
      setError(null);
      const force = options?.force ?? false;

      try {
        const response = await fetch(
          buildApiUrl(`/api/audit/proof/${encodeURIComponent(eventId)}${force ? '?force=true' : ''}`),
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            cache: 'no-store',
            body: JSON.stringify({ force }),
          },
        );
        if (!response.ok) {
          throw new Error(`Audit proof API responded ${response.status}`);
        }
        const result = (await response.json()) as AuditProofPayload;
        setPayload(result);
      } catch (err) {
        console.warn('[audit-proof] falling back to mock data', err);
        setError('Live prover unavailable. Showing cached synthetic proof data.');
        setPayload(buildMockProof(eventId));
      } finally {
        setLoading(false);
      }
    },
    [eventId],
  );

  useEffect(() => {
    if (params.id) {
      setEventId(params.id);
      void fetchProof();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const publicSignals = useMemo(() => payload?.proof.publicSignals ?? [], [payload]);

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-wide text-muted-foreground">Admin · Audit proofs</p>
          <h1 className="text-3xl font-bold tracking-tight">Ledger membership verification</h1>
          <p className="text-muted-foreground max-w-3xl">
            Generate Groth16 proofs that a specific audit event hash is committed to the regulator-facing ledger. Each
            proof snapshot is persisted for compliance export and anchored to the verifier chain.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => fetchProof()} disabled={loading || !eventId.trim()}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shield className="mr-2 h-4 w-4" />}
            Load proof
          </Button>
          <Button onClick={() => fetchProof({ force: true })} disabled={loading || !eventId.trim()}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Regenerate SNARK
          </Button>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Lookup</CardTitle>
          <CardDescription>Generate or refresh the zero-knowledge proof for a given audit event id.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 md:flex-row md:items-center">
          <Input
            value={eventId}
            onChange={(event) => setEventId(event.target.value)}
            placeholder="audit-event-123"
            className="md:max-w-sm"
          />
          <div className="flex flex-1 gap-2">
            <Button onClick={() => fetchProof()} className="flex-1 md:flex-none" disabled={loading || !eventId.trim()}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
              Generate proof
            </Button>
            <Button
              onClick={() => fetchProof({ force: true })}
              variant="secondary"
              className="flex-1 md:flex-none"
              disabled={loading || !eventId.trim()}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Force recompute
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Prover degraded</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {payload ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricTile
              label="Circuit type"
              primary={payload.circuitType}
              secondary={payload.proof.mode === 'snark' ? 'Groth16 on BN254' : 'Mock fallback'}
              tone={payload.proof.mode === 'snark' ? 'success' : 'muted'}
            />
            <MetricTile
              label="Ledger root"
              primary={truncate(payload.proof.ledgerRoot ?? payload.proof.circuitInput?.root ?? '—')}
              secondary="Poseidon-style merkle commitment"
            />
            <MetricTile
              label="Proving time"
              primary={
                payload.proof.metrics.provingTimeMs
                  ? `${payload.proof.metrics.provingTimeMs.toLocaleString()} ms`
                  : '—'
              }
              secondary={`${payload.proof.metrics.circuitSize.toLocaleString()} constraints`}
            />
            <MetricTile
              label="Anchor status"
              primary={payload.anchor ? 'Anchored' : 'Pending'}
              secondary={payload.anchor ? payload.anchor.payload.timestamp : 'Awaiting submission'}
              tone={payload.anchor ? 'success' : 'warning'}
            />
          </section>

          <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Proof metadata</CardTitle>
                  <CardDescription>
                    Ledger root, path commitment, and proving metrics for the current snapshot.
                  </CardDescription>
                </div>
                <Badge variant={payload.proof.mode === 'snark' ? 'default' : 'secondary'} className="capitalize">
                  {payload.proof.mode}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <DetailRow label="Ledger root" value={payload.proof.ledgerRoot ?? '—'} />
                <DetailRow label="Path commitment" value={payload.proof.pathCommitment ?? '—'} />
                <dl className="grid gap-3 sm:grid-cols-2">
                  <DetailStat label="Depth" value={payload.proof.metrics.depth} />
                  <DetailStat
                    label="Constraints"
                    value={payload.proof.metrics.constraintCount.toLocaleString()}
                  />
                  <DetailStat label="Circuit size" value={payload.proof.metrics.circuitSize.toLocaleString()} />
                  <DetailStat
                    label="Generated"
                    value={
                      payload.proof.generatedAt
                        ? new Date(payload.proof.generatedAt).toLocaleString()
                        : payload.issuedAt
                    }
                  />
                </dl>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Public signals</span>
                    <Badge variant="outline">{publicSignals.length}</Badge>
                  </div>
                  {publicSignals.length ? (
                    <div className="flex flex-wrap gap-2">
                      {publicSignals.map((signal) => (
                        <Badge key={signal} variant="secondary" className="font-mono text-xs">
                          {truncate(signal, 18)}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Proof generated without public signals.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Anchor log</CardTitle>
                  <CardDescription>Chain receipt for the SNARK proof commitment.</CardDescription>
                </div>
                {payload.anchor ? (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                    Anchored
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <ShieldAlert className="h-3 w-3 text-amber-500" />
                    Pending
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <DetailRow label="Tx hash" value={payload.anchor?.txHash ?? '—'} />
                <DetailRow label="Network" value={payload.anchor?.network ?? '—'} />
                <DetailRow
                  label="Anchor timestamp"
                  value={payload.anchor?.payload.timestamp ? new Date(payload.anchor.payload.timestamp).toLocaleString() : '—'}
                />
                <DetailRow label="Proof hash" value={payload.anchor?.payload.proofHash ?? '—'} />
                <DetailRow label="Ledger root" value={payload.anchor?.payload.ledgerRoot ?? '—'} />
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={!payload.anchor}
                  onClick={() => payload.anchor && copyToClipboard(JSON.stringify(payload.anchor, null, 2))}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export anchor payload
                </Button>
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <JsonCard
              title="Circuit input"
              description="Leaf, siblings, and path positions passed to the prover."
              data={payload.proof.circuitInput ?? {}}
            />
            <JsonCard
              title="Proof blob"
              description="Raw Groth16 proof payload (or mock digest)."
              data={payload.proof.snark ?? { digest: 'mock', mode: payload.proof.mode }}
            />
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <BlockCard block={payload.proof.block} />
            <Textarea
              className="min-h-[220px] font-mono text-sm"
              readOnly
              value={JSON.stringify(payload, null, 2)}
            />
          </section>
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No proof loaded</CardTitle>
            <CardDescription>Enter an event id to fetch or recompute the SNARK proof.</CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}

function buildApiUrl(pathname: string): string {
  const trimmed = API_BASE.replace(/\/$/, '');
  if (!trimmed) return pathname;
  return `${trimmed}${pathname.startsWith('/') ? pathname : `/${pathname}`}`;
}

function truncate(value: string, length = 24): string {
  if (!value || value.length <= length) return value;
  return `${value.slice(0, length - 3)}...`;
}

function copyToClipboard(value: string) {
  void navigator.clipboard.writeText(value);
}

function buildMockProof(eventId: string): AuditProofPayload {
  return {
    eventId,
    circuitType: 'event-ledger.v1',
    issuedAt: new Date().toISOString(),
    proof: {
      mode: 'mock',
      publicSignals: [
        '12345678901234567890',
        '22345678901234567890',
        '32345678901234567890',
      ],
      circuitInput: {
        leaf: '1234123412341234',
        root: '9876987698769876',
        siblings: Array.from({ length: 4 }).map(
          (_, index) => `0x${createSyntheticHash(eventId, index)}`,
        ),
        pathPositions: Array.from({ length: 4 }).map((_, index) => (index % 2).toString()),
      },
      ledgerRoot: `0x${createSyntheticHash(eventId, 42)}`,
      pathCommitment: `0x${createSyntheticHash(eventId, 99)}`,
      metrics: {
        mode: 'mock',
        provingTimeMs: 0,
        circuitSize: 256,
        constraintCount: 512,
        depth: 4,
      },
      generatedAt: new Date().toISOString(),
      block: {
        blockHash: `0x${createSyntheticHash(eventId, 7)}`,
        eventType: 'auditEvidenceCommitted',
        timestamp: new Date().toISOString(),
        palletName: 'audit.scrapbook',
        merklePath: Array.from({ length: 3 }).map((_, index) => `0x${createSyntheticHash(eventId, index + 10)}`),
      },
    },
    anchor: null,
  };
}

function createSyntheticHash(seed: string, counter: number) {
  return (seed + counter.toString(16)).padEnd(32, 'a').slice(0, 32);
}

function MetricTile({
  label,
  primary,
  secondary,
  tone = 'default',
}: {
  label: string;
  primary: string;
  secondary?: string;
  tone?: 'default' | 'success' | 'warning' | 'muted';
}) {
  const toneClass =
    tone === 'success'
      ? 'border-emerald-200 bg-emerald-50/40 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40'
      : tone === 'warning'
        ? 'border-amber-200 bg-amber-50/40 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30'
        : tone === 'muted'
          ? 'border-muted bg-muted/30 text-muted-foreground'
          : 'border-border bg-card text-foreground';

  return (
    <div className={cn('rounded-xl border p-4 shadow-sm', toneClass)}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{primary}</p>
      {secondary && <p className="text-xs text-muted-foreground">{secondary}</p>}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-sm">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-mono text-sm break-all">{value || '—'}</p>
    </div>
  );
}

function DetailStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3 text-sm">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

function JsonCard({
  title,
  description,
  data,
}: {
  title: string;
  description: string;
  data: Record<string, unknown>;
}) {
  const serialized = JSON.stringify(data ?? {}, null, 2);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <Button variant="ghost" size="icon" onClick={() => copyToClipboard(serialized)}>
          <Copy className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <pre className="max-h-72 overflow-auto rounded-lg border bg-muted/30 p-4 text-xs">
          <code>{serialized}</code>
        </pre>
      </CardContent>
    </Card>
  );
}

function BlockCard({ block }: { block?: AuditProofPayload['proof']['block'] }) {
  if (!block) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Block proof</CardTitle>
          <CardDescription>No block proof metadata persisted for this event.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Block proof</CardTitle>
          <CardDescription>Chain metadata persisted when the audit event was anchored.</CardDescription>
        </div>
        <Badge variant="outline" className="flex items-center gap-1">
          <Signal className="h-3 w-3" />
          {block.palletName ?? 'audit.scrapbook'}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <DetailRow label="Block hash" value={block.blockHash} />
        <DetailRow label="Event type" value={block.eventType ?? '—'} />
        <DetailRow label="Timestamp" value={block.timestamp ? new Date(block.timestamp).toLocaleString() : '—'} />
        <Separator />
        <p className="text-xs text-muted-foreground">
          Merkle path ({block.merklePath?.length ?? 0} limbs)
        </p>
        <div className="flex flex-wrap gap-2">
          {(block.merklePath ?? []).map((node) => (
            <Badge key={node} variant="secondary" className="font-mono text-[11px]">
              {truncate(node, 18)}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

