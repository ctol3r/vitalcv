'use client';

import {
  Activity,
  AlertCircle,
  BadgeCheck,
  Bot,
  Fingerprint,
  Globe,
  LinkIcon,
  MousePointer2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Timer,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  collectBotSignals,
  getBotDeviceSignature,
  type BotSignalSnapshot,
} from '@/lib/bot/signals';
import { cn } from '@/lib/utils';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  '';

const REGION_NAME_MAP: Record<string, string> = {
  'us-west-2': 'US-West Region',
  'us-east-1': 'US-East Region',
  'eu-central-1': 'EU-Central Region',
};

const IDENTITY_SOURCE_LABELS: Record<string, string> = {
  nppes: 'NPPES',
  state_board: 'State Boards',
  npdb: 'NPDB',
  ahpra: 'AHPRA',
  gmc: 'GMC',
  nmc: 'NMC',
};

interface ChainEntry {
  sequence: number;
  hash: string;
  event: string;
  actor: string;
  observedAt: string;
  digest: string;
}

interface LifecycleTransition {
  id: string;
  phase: string;
  timestamp: string;
  metadata: Record<string, unknown> | null;
}

interface LifecycleSummary {
  phase: string;
  displayStatus: 'active' | 'expiring' | 'expired';
  expiresAt: string | null;
  transitions: LifecycleTransition[];
}

interface DocumentHistoryResponse {
  docId: string;
  clinicianId: string;
  lastUpdated: string;
  chain: {
    valid: boolean;
    issues: string[];
    digest: string;
    chainLength: number;
    hashSeq: string[];
    persisted: boolean;
    entries: ChainEntry[];
  };
  provenance: {
    verdict: 'verified' | 'suspicious';
    confidence: number;
    captureDevice: string | null;
    captureTimestamp: string | null;
    gps: { lat: number; lng: number; accuracyMeters: number } | null;
    warnings: string[];
    anomalies: string[];
  };
  fingerprint: {
    duplicateScore: number;
    collisions: Array<{
      fingerprintId: string;
      clinicianId: string;
      similarity: number;
      reason: string[];
      matchedFields: string[];
      recordedAt: string;
    }>;
    sampleSize: number;
  };
  liveness: {
    sessionId: string;
    clinicianId: string;
    score: number;
    verdict: 'pass' | 'review';
    spoofLikelihood: number;
    signals: {
      blink: number;
      motion: number;
      depth: number;
      challenge: number;
      illumination: number;
    };
    frameCount: number;
    evaluatedAt: string;
    challengeBreakdown: Array<{
      prompt: string;
      success: boolean;
      latencyMs: number;
    }>;
    riskFactors: string[];
    entropy: number;
  };
  watermark: {
    digest: string;
    mutatedBytes: number;
    traceVector: number[];
    insertedAt: string;
    bitCount: number;
  };
  signatureChain: {
    docId: string;
    rootHash: string;
    chainLength: number;
    generatedAt: string;
    layers: Array<{
      signerId: string;
      algorithm: string;
      signature: string;
      timestamp: string;
      sequence: number;
      layerHash: string;
      previousLayerHash?: string | null;
    }>;
  };
  botDefense: BotDefenseSummary;
  walletClones: WalletCloneSummary;
  lifecycle?: LifecycleSummary | null;
}

interface BotDefenseSummary {
  riskScore: number;
  flags: string[];
  navigation: {
    samples: number;
    averageSpeed: number;
    maxSpeed: number;
    impossible: boolean;
  };
  fingerprint: {
    deviceSig: string | null;
    uniqueIpCount: number;
    identicalAcrossIps: boolean;
    recentIps: string[];
  };
  runtime: BotSignalSnapshot | null;
  network: {
    ipChain: string[];
    residentialProxyHop: boolean;
    torSuspected: boolean;
    vpnSuspected: boolean;
  };
  anchor: {
    anchorId: string;
    txHash: string;
    blockHash: string;
    blockNumber: number;
    network: string;
    timestamp: string;
  } | null;
}

interface WalletCloneSummary {
  totalDevices: number;
  findings: Array<{
    keyHash: string;
    collisions: number;
    accounts: Array<{
      clinicianId: string;
      deviceId: string;
      lastUsedAt: string | null;
    }>;
  }>;
}

interface IdentityFusionPayload {
  clinicianId: string;
  generatedAt: string;
  primaryName: string | null;
  normalizedName: string | null;
  aliases: string[];
  birthDate: string | null;
  graduationYear: number | null;
  specialties: string[];
  sourceBreakdown: Record<string, number>;
  reliability: {
    overall: number;
    coverage: number;
    agreement: number;
    recency: number;
    validationDensity: number;
  };
  transparency: Array<{
    field: string;
    winningSource: string | null;
    supportingSources: string[];
    rationale: string[];
    confidence: number;
  }>;
}

interface IdentityEventLogEntry {
  id: string;
  snapshotId: string;
  field: string;
  eventType: string;
  changeHash: string;
  createdAt: string;
  oldValue: unknown;
  newValue: unknown;
}

interface IdentityAnchorRecord {
  id: string;
  txHash: string;
  merkleRoot: string;
  network: string;
  payload?: {
    timestamp?: string;
  };
}

interface IdentityFusionApiResponse {
  clinicianId: string;
  snapshotId: string;
  generatedAt: string;
  confidence: number;
  payload: IdentityFusionPayload;
  anchor: IdentityAnchorRecord | null;
  events: IdentityEventLogEntry[];
}

interface RegionClusterSummary {
  region: string;
  displayName: string;
  status: string;
  latencyMs: number;
  replicationLagMs: number;
  conflictRate: number;
  updatedAt: string;
}

interface RegionHealthResponse {
  timestamp: string;
  clientRegion: string;
  nearestRegion: string;
  nearestRegionLabel: string;
  activeRegion: string;
  replication: {
    mode: string;
    lagMs: Record<string, number>;
    conflictRate: Record<string, number>;
  };
  clusters: RegionClusterSummary[];
}

type LoadState = 'idle' | 'loading' | 'error';

export default function DocumentHistoryPage({ params }: { params: { id: string } }) {
  const [history, setHistory] = useState<DocumentHistoryResponse | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [regionContext, setRegionContext] = useState<RegionHealthResponse | null>(null);
  const [regionContextError, setRegionContextError] = useState<string | null>(null);
  const [challengeCleared, setChallengeCleared] = useState(true);
  const [identityFusion, setIdentityFusion] = useState<IdentityFusionApiResponse | null>(null);
  const [identityState, setIdentityState] = useState<LoadState>('idle');
  const [identityError, setIdentityError] = useState<string | null>(null);
  const identityRequestIdRef = useRef(0);

  const docId = params.id;
  const clinicianId = history?.clinicianId ?? null;

  const refresh = useCallback(async () => {
    setState('loading');
    setError(null);
    setChallengeCleared(true);
    try {
      const data = await fetchDocumentHistory(docId);
      setHistory(data);
      setChallengeCleared(!(data.botDefense && data.botDefense.riskScore > 0.85));
      setState('idle');
    } catch (err) {
      console.warn('[documents][history]', err);
      setError(err instanceof Error ? err.message : 'Unable to load document history');
      setHistory(buildFallbackHistory(docId));
      setChallengeCleared(true);
      setState('error');
    }
  }, [docId]);

  const loadIdentityFusion = useCallback(
    async (options?: { refresh?: boolean }) => {
      if (!clinicianId) {
        return;
      }
      const requestId = identityRequestIdRef.current + 1;
      identityRequestIdRef.current = requestId;
      setIdentityState('loading');
      setIdentityError(null);
      try {
        const snapshot = await fetchIdentityFusion(clinicianId, options);
        if (identityRequestIdRef.current !== requestId) {
          return;
        }
        setIdentityFusion(snapshot);
        setIdentityState('idle');
      } catch (err) {
        if (identityRequestIdRef.current !== requestId) {
          return;
        }
        setIdentityError(
          err instanceof Error ? err.message : 'Unable to load identity transparency',
        );
        setIdentityState('error');
      }
    },
    [clinicianId],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!clinicianId) {
      setIdentityFusion(null);
      return;
    }
    void loadIdentityFusion();
  }, [clinicianId, loadIdentityFusion]);

  useEffect(() => {
    let cancelled = false;
    const loadRegionContext = async () => {
      try {
        const snapshot = await fetchRegionHealth();
        if (!cancelled) {
          setRegionContext(snapshot);
          setRegionContextError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setRegionContextError(err instanceof Error ? err.message : 'Region health unavailable');
        }
      }
    };

    void loadRegionContext();
    const interval = window.setInterval(loadRegionContext, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const signatureSummary = useMemo(() => {
    if (!history) return null;
    return `${history.signatureChain.chainLength} layers → ${shortHash(
      history.signatureChain.rootHash,
    )}`;
  }, [history]);

  const documentHints = useMemo(() => {
    if (!history) return [];
    return buildDocumentHints(history);
  }, [history]);

  const requiresChallenge = history?.botDefense ? history.botDefense.riskScore > 0.85 : false;
  const lockActive = Boolean(requiresChallenge && !challengeCleared);

  return (
    <div className="relative">
      {lockActive && history && (
        <TapHoldChallenge
          riskScore={history.botDefense.riskScore}
          flags={history.botDefense.flags}
          onResolved={() => setChallengeCleared(true)}
        />
      )}
      <div
        className={cn(
          'mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8',
          lockActive && 'pointer-events-none select-none opacity-40 blur-[1px]',
        )}
        aria-hidden={lockActive}
      >
        <header className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="secondary">Wallet · Document history</Badge>
            {history && (
              <ProvenanceBadge
                verdict={history.provenance.verdict}
                confidence={history.provenance.confidence}
              />
            )}
            {history?.lifecycle && <LifecycleStatusBadge lifecycle={history.lifecycle} />}
            {history && (
              <Badge className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700">
                <ShieldCheck className="h-3.5 w-3.5" />
                Protected Credential
              </Badge>
            )}
            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refresh()}
                disabled={state === 'loading'}
              >
                Refresh
              </Button>
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Document {docId}</h1>
            <p className="text-sm text-muted-foreground">
              Clinician <span className="font-mono">{history?.clinicianId ?? '—'}</span>
              {history && (
                <>
                  {' · '}Last update {new Date(history.lastUpdated).toLocaleString()}
                </>
              )}
            </p>
          </div>
          {error && (
            <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}
          {regionContext && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
              <Globe className="h-4 w-4 text-sky-600" />
              <span>
                Operating in{' '}
                <span className="font-semibold">{regionContext.nearestRegionLabel}</span>
                {regionContext.activeRegion !== regionContext.nearestRegion && (
                  <>
                    {' '}
                    · Active cluster{' '}
                    <span className="font-semibold">
                      {friendlyRegionName(regionContext.activeRegion)}
                    </span>
                  </>
                )}
              </span>
              <span className="text-[11px] text-sky-800/70">
                Updated {new Date(regionContext.timestamp).toLocaleTimeString()}
              </span>
            </div>
          )}
          {!regionContext && regionContextError && (
            <p className="text-xs text-muted-foreground">
              Region topology unavailable: {regionContextError}
            </p>
          )}
        </header>

        {history && (
          <>
            <section className="grid gap-4 md:grid-cols-[1.5fr_1fr]">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <LinkIcon className="h-4 w-4" />
                    Hash chain
                  </CardTitle>
                  <CardDescription>
                    {history.chain.valid ? 'Sequential chain intact' : 'Issues detected'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span
                      className={cn(
                        'font-medium',
                        history.chain.valid ? 'text-emerald-600' : 'text-red-600',
                      )}
                    >
                      {history.chain.valid ? 'Valid sequence' : 'Needs review'}
                    </span>
                    <Badge variant="outline">{history.chain.chainLength} versions</Badge>
                    <code className="rounded bg-muted px-2 py-1 text-xs font-mono">
                      {shortHash(history.chain.digest)}
                    </code>
                  </div>
                  <div className="space-y-3">
                    {history.chain.entries.map((entry) => (
                      <div
                        key={`${entry.hash}-${entry.sequence}`}
                        className="rounded-lg border p-3 text-sm"
                      >
                        <div className="flex items-center justify-between text-xs uppercase text-muted-foreground">
                          <span>#{entry.sequence}</span>
                          <span>{entry.event}</span>
                        </div>
                        <div className="mt-1 font-mono text-xs">{shortHash(entry.hash, 12)}</div>
                        <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                          <span>{new Date(entry.observedAt).toLocaleString()}</span>
                          <span>{entry.actor}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {!history.chain.valid && history.chain.issues.length > 0 && (
                    <p className="text-sm text-amber-600">
                      Issues: {history.chain.issues.join(', ')}
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4" />
                    Provenance
                  </CardTitle>
                  <CardDescription>Capture metadata and GPS evidence</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1 text-sm">
                    <p className="text-muted-foreground">Device</p>
                    <p className="font-medium">
                      {history.provenance.captureDevice ?? 'Unknown device'}
                    </p>
                  </div>
                  <div className="space-y-1 text-sm">
                    <p className="text-muted-foreground">Captured</p>
                    <p className="font-medium">
                      {history.provenance.captureTimestamp
                        ? new Date(history.provenance.captureTimestamp).toLocaleString()
                        : 'Not available'}
                    </p>
                  </div>
                  <div className="space-y-1 text-sm">
                    <p className="text-muted-foreground">Provenance confidence</p>
                    <Progress value={history.provenance.confidence * 100} className="h-2" />
                  </div>
                  {history.provenance.gps ? (
                    <p className="text-xs text-muted-foreground">
                      GPS lock at {history.provenance.gps.lat.toFixed(5)},{' '}
                      {history.provenance.gps.lng.toFixed(5)} ±
                      {history.provenance.gps.accuracyMeters}m
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">GPS lock unavailable</p>
                  )}
                  {history.provenance.warnings.length > 0 && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                      <p className="font-medium">Warnings</p>
                      <ul className="list-disc pl-4">
                        {history.provenance.warnings.map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>

            <Card className="border-primary/30 bg-primary/5">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Fingerprint className="h-4 w-4" />
                      Identity fusion transparency
                    </CardTitle>
                    <CardDescription>
                      Show which registries contributed to the fused identity snapshot.
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {identityFusion && (
                      <Badge variant="outline">
                        Reliability {(identityFusion.payload.reliability.overall * 100).toFixed(1)}%
                      </Badge>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadIdentityFusion({ refresh: true })}
                      disabled={identityState === 'loading' || !clinicianId}
                    >
                      Re-run fusion
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 text-sm">
                {identityError && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    {identityError}
                  </div>
                )}
                {identityState === 'loading' && !identityFusion && (
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                )}
                {identityFusion && (
                  <>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="rounded border bg-white/70 p-3">
                        <p className="text-[11px] uppercase text-muted-foreground">
                          Reliability index
                        </p>
                        <p className="text-3xl font-semibold">
                          {(identityFusion.payload.reliability.overall * 100).toFixed(1)}%
                        </p>
                        <Progress
                          value={identityFusion.payload.reliability.overall * 100}
                          className="mt-2 h-2"
                        />
                      </div>
                      <div className="rounded border bg-white/70 p-3">
                        <p className="text-[11px] uppercase text-muted-foreground">
                          Snapshot generated
                        </p>
                        <p className="font-medium">
                          {new Date(identityFusion.generatedAt).toLocaleString()}
                        </p>
                        {identityFusion.anchor && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Anchor {shortHash(identityFusion.anchor.txHash, 12)} ·{' '}
                            {identityFusion.anchor.network}
                          </p>
                        )}
                      </div>
                      <div className="rounded border bg-white/70 p-3">
                        <p className="text-[11px] uppercase text-muted-foreground">
                          Aliases tracked
                        </p>
                        <p className="text-sm font-medium">
                          {identityFusion.payload.aliases.length
                            ? identityFusion.payload.aliases.slice(0, 3).join(', ')
                            : 'None recorded'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Primary: {identityFusion.payload.primaryName ?? '—'}
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-medium">Source contributions</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(() => {
                          const entries = Object.entries(identityFusion.payload.sourceBreakdown);
                          if (!entries.length) {
                            return (
                              <span className="text-xs text-muted-foreground">
                                No sources recorded.
                              </span>
                            );
                          }
                          const total = entries.reduce((sum, [, weight]) => sum + weight, 0) || 1;
                          return entries.map(([source, weight]) => (
                            <Badge key={source} variant="secondary" className="gap-1 text-[11px]">
                              {IDENTITY_SOURCE_LABELS[source] ?? source.toUpperCase()} ·{' '}
                              {Math.round((weight / total) * 100)}%
                            </Badge>
                          ));
                        })()}
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-medium">Transparency by field</p>
                      {identityFusion.payload.transparency.length ? (
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          {identityFusion.payload.transparency.map((item) => (
                            <div key={item.field} className="rounded border bg-white p-3">
                              <div className="flex items-center justify-between text-[11px] uppercase text-muted-foreground">
                                <span>{formatTransparencyFieldLabel(item.field)}</span>
                                <Badge variant="outline">
                                  {(item.confidence * 100).toFixed(0)}%
                                </Badge>
                              </div>
                              <p className="mt-1 text-base font-semibold">
                                {formatTransparencyValue(item.field, identityFusion.payload)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {item.winningSource
                                  ? `Selected ${
                                      IDENTITY_SOURCE_LABELS[item.winningSource] ??
                                      item.winningSource.toUpperCase()
                                    }`
                                  : 'No primary source'}
                              </p>
                              {item.rationale.length > 0 && (
                                <p className="mt-1 text-[11px] text-muted-foreground">
                                  {item.rationale[0]}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-muted-foreground">
                          No transparency fields published yet.
                        </p>
                      )}
                    </div>

                    <div>
                      <p className="text-sm font-medium">Identity event log</p>
                      {identityFusion.events.length ? (
                        <ol className="mt-2 space-y-2 text-xs">
                          {identityFusion.events.slice(0, 4).map((event) => (
                            <li key={event.id} className="rounded border bg-white p-2">
                              <div className="flex items-center justify-between">
                                <span className="font-mono text-[11px] uppercase">
                                  {event.field}
                                </span>
                                <span className="text-muted-foreground">
                                  {new Date(event.createdAt).toLocaleString()}
                                </span>
                              </div>
                              <p className="mt-1">
                                {formatEventValue(event.oldValue)} →{' '}
                                {formatEventValue(event.newValue)}
                              </p>
                              <p className="font-mono text-[10px] text-muted-foreground">
                                {shortHash(event.changeHash, 12)}
                              </p>
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <p className="mt-2 text-xs text-muted-foreground">
                          No identity changes recorded yet.
                        </p>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <section className="grid gap-4 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Liveness
                  </CardTitle>
                  <CardDescription>Anti-spoof signals from selfie capture</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-semibold">
                      {(history.liveness.score * 100).toFixed(1)}%
                    </span>
                    <Badge
                      variant={history.liveness.verdict === 'pass' ? 'default' : 'destructive'}
                    >
                      {history.liveness.verdict === 'pass' ? 'Pass' : 'Review'}
                    </Badge>
                  </div>
                  <div className="space-y-2 text-sm">
                    {Object.entries(history.liveness.signals).map(([label, value]) => (
                      <div key={label}>
                        <div className="flex items-center justify-between text-xs uppercase text-muted-foreground">
                          <span>{label}</span>
                          <span>{(value * 100).toFixed(0)}%</span>
                        </div>
                        <Progress value={value * 100} className="h-1.5" />
                      </div>
                    ))}
                  </div>
                  {history.liveness.riskFactors.length > 0 && (
                    <ul className="space-y-1 text-xs text-amber-600">
                      {history.liveness.riskFactors.map((factor) => (
                        <li key={factor} className="flex items-center gap-1">
                          <ShieldAlert className="h-4 w-4" />
                          {factor}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Fingerprint className="h-4 w-4" />
                    Fingerprint collisions
                  </CardTitle>
                  <CardDescription>
                    {history.fingerprint.collisions.length
                      ? `${history.fingerprint.collisions.length} matches above threshold`
                      : 'No high risk overlaps'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {history.fingerprint.collisions.length === 0 ? (
                    <p className="text-muted-foreground">No suspicious duplicates detected.</p>
                  ) : (
                    history.fingerprint.collisions.map((collision) => (
                      <div key={collision.fingerprintId} className="rounded border p-2">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs">
                            {shortHash(collision.fingerprintId)}
                          </span>
                          <Badge variant="outline">
                            {(collision.similarity * 100).toFixed(1)}%
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(collision.recordedAt).toLocaleString()}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {collision.matchedFields.map((field) => (
                            <Badge key={field} variant="secondary" className="text-[10px]">
                              {field}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    AI document hints
                  </CardTitle>
                  <CardDescription>Tips generated from recent upload errors</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {documentHints.length === 0 ? (
                    <p className="text-muted-foreground">
                      No anomalies flagged in the latest upload.
                    </p>
                  ) : (
                    documentHints.map((hint) => (
                      <div key={hint.id} className="rounded border p-3">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              hint.severity === 'error'
                                ? 'destructive'
                                : hint.severity === 'warn'
                                ? 'secondary'
                                : 'outline'
                            }
                          >
                            {hint.severity}
                          </Badge>
                          <p className="font-medium">{hint.insight}</p>
                          <span className="ml-auto text-xs text-muted-foreground">
                            {(hint.confidence * 100).toFixed(0)}% confidence
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{hint.action}</p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    Watermark & digest
                  </CardTitle>
                  <CardDescription>Invisible watermark audit trail</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Digest</p>
                    <p className="font-mono text-xs">{shortHash(history.watermark.digest, 16)}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded border p-2">
                      <p className="text-muted-foreground">Mutated bytes</p>
                      <p className="text-sm font-medium">{history.watermark.mutatedBytes}</p>
                    </div>
                    <div className="rounded border p-2">
                      <p className="text-muted-foreground">Bits embedded</p>
                      <p className="text-sm font-medium">{history.watermark.bitCount}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Trace vector sample</p>
                    <div className="flex flex-wrap gap-1 font-mono text-[10px]">
                      {history.watermark.traceVector.slice(0, 10).map((index) => (
                        <span key={index} className="rounded bg-muted px-1 py-0.5">
                          {index}
                        </span>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="h-4 w-4" />
                    Bot defense signals
                  </CardTitle>
                  <CardDescription>Runtime anti-automation telemetry</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-3xl font-semibold">
                      {(history.botDefense.riskScore * 100).toFixed(1)}%
                    </span>
                    <Badge variant={botRiskVariant(history.botDefense.riskScore)}>
                      {classifyBotRisk(history.botDefense.riskScore)}
                    </Badge>
                    {history.botDefense.anchor && (
                      <code className="ml-auto rounded bg-muted px-2 py-1 text-xs font-mono">
                        {shortHash(history.botDefense.anchor.txHash)}
                      </code>
                    )}
                  </div>
                  {history.botDefense.flags.length > 0 ? (
                    <ul className="list-disc space-y-1 pl-4 text-xs text-amber-700">
                      {history.botDefense.flags.map((flag) => (
                        <li key={flag}>{flag}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">No active defense flags.</p>
                  )}
                  <div className="grid gap-3 text-xs md:grid-cols-2">
                    <div className="rounded border p-2">
                      <p className="text-[10px] uppercase text-muted-foreground">
                        Pointer velocity
                      </p>
                      <p className="text-sm font-semibold">
                        {Math.round(history.botDefense.navigation.maxSpeed)} px/s peak
                      </p>
                      <p className="text-muted-foreground">
                        {history.botDefense.navigation.samples} samples · avg{' '}
                        {Math.round(history.botDefense.navigation.averageSpeed)} px/s
                      </p>
                    </div>
                    <div className="rounded border p-2">
                      <p className="text-[10px] uppercase text-muted-foreground">Fingerprint</p>
                      <p className="font-mono text-sm">
                        {shortHash(history.botDefense.fingerprint.deviceSig ?? '—', 12)}
                      </p>
                      <p className="text-muted-foreground">
                        {history.botDefense.fingerprint.uniqueIpCount} IPs observed
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-3 text-xs md:grid-cols-2">
                    <div className="rounded border p-2">
                      <p className="text-[10px] uppercase text-muted-foreground">Network route</p>
                      <p className="font-mono text-xs">
                        {history.botDefense.network.ipChain.length
                          ? history.botDefense.network.ipChain.join(' → ')
                          : '—'}
                      </p>
                      <p className="text-muted-foreground">
                        {history.botDefense.network.residentialProxyHop
                          ? 'Residential → datacenter jump'
                          : 'Stable route'}
                      </p>
                    </div>
                    <div className="rounded border p-2">
                      <p className="text-[10px] uppercase text-muted-foreground">Recent IPs</p>
                      <p className="text-xs">
                        {history.botDefense.fingerprint.recentIps.length
                          ? history.botDefense.fingerprint.recentIps.join(', ')
                          : 'n/a'}
                      </p>
                      <p className="text-muted-foreground">
                        {history.botDefense.fingerprint.identicalAcrossIps
                          ? 'Shared across multiple IPs'
                          : 'Unique to this session'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MousePointer2 className="h-4 w-4" />
                    Wallet clone detection
                  </CardTitle>
                  <CardDescription>
                    {history.walletClones.totalDevices} wallet devices analyzed for duplicates
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {history.walletClones.findings.length === 0 ? (
                    <p className="text-muted-foreground">No cloned wallet keys detected.</p>
                  ) : (
                    history.walletClones.findings.map((finding) => (
                      <div key={finding.keyHash} className="rounded border p-3 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs">{shortHash(finding.keyHash)}</span>
                          <Badge variant="outline">{finding.collisions} accounts</Badge>
                        </div>
                        <div className="mt-2 space-y-1">
                          {finding.accounts.map((account) => (
                            <div
                              key={`${finding.keyHash}-${account.deviceId}`}
                              className="flex items-center justify-between text-muted-foreground"
                            >
                              <span className="font-mono">{account.clinicianId}</span>
                              <span>
                                {account.lastUsedAt
                                  ? new Date(account.lastUsedAt).toLocaleDateString()
                                  : 'unknown'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </section>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BadgeCheck className="h-4 w-4" />
                  Signature chain export
                </CardTitle>
                <CardDescription>{signatureSummary}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {history.signatureChain.layers.map((layer) => (
                  <div key={layer.sequence} className="rounded border p-3">
                    <div className="flex items-center justify-between text-xs uppercase text-muted-foreground">
                      <span>Layer {layer.sequence}</span>
                      <span>{layer.algorithm}</span>
                    </div>
                    <p className="font-medium">{layer.signerId}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(layer.timestamp).toLocaleString()}
                    </p>
                    <p className="mt-1 font-mono text-xs">{shortHash(layer.layerHash, 16)}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

function TapHoldChallenge({
  riskScore,
  flags,
  onResolved,
}: {
  riskScore: number;
  flags: string[];
  onResolved: () => void;
}) {
  const [holding, setHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const holdDuration = 1500;

  useEffect(() => {
    if (!holding) {
      setProgress(0);
      return;
    }
    let frame: number;
    let start: number;
    const tick = (timestamp: number) => {
      if (!start) start = timestamp;
      const elapsed = timestamp - start;
      setProgress(Math.min(elapsed, holdDuration));
      if (elapsed >= holdDuration) {
        setHolding(false);
        setProgress(holdDuration);
        onResolved();
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      if (frame) cancelAnimationFrame(frame);
    };
  }, [holding, holdDuration, onResolved]);

  const progressPercent = Math.round((progress / holdDuration) * 100);

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/80 backdrop-blur">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Timer className="h-4 w-4" />
            Extra verification required
          </CardTitle>
          <CardDescription>
            Runtime risk {(riskScore * 100).toFixed(1)}% · tap and hold to continue
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {flags.length > 0 && (
            <ul className="list-disc space-y-1 pl-4 text-xs text-amber-700">
              {flags.map((flag) => (
                <li key={flag}>{flag}</li>
              ))}
            </ul>
          )}
          <Button
            variant="default"
            className="w-full"
            type="button"
            onPointerDown={(event) => {
              event.preventDefault();
              setHolding(true);
            }}
            onPointerUp={() => setHolding(false)}
            onPointerLeave={() => setHolding(false)}
            disabled={progressPercent >= 100}
          >
            Tap and hold ({progressPercent}%)
          </Button>
          <Progress value={progressPercent} className="h-2" />
        </CardContent>
      </Card>
    </div>
  );
}

function ProvenanceBadge({
  verdict,
  confidence,
}: {
  verdict: 'verified' | 'suspicious';
  confidence: number;
}) {
  const isVerified = verdict === 'verified';
  return (
    <Badge variant={isVerified ? 'default' : 'destructive'} className="flex items-center gap-1">
      {isVerified ? <ShieldCheck className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
      {isVerified ? 'Provenance Verified' : 'Suspicious'}
      <span className="text-[10px] opacity-80">{(confidence * 100).toFixed(0)}%</span>
    </Badge>
  );
}

function formatTransparencyFieldLabel(field: string): string {
  switch (field) {
    case 'name':
      return 'Primary name';
    case 'birthDate':
      return 'Birth date';
    case 'graduationYear':
      return 'Graduation year';
    case 'specialties':
      return 'Specialties';
    default:
      return field;
  }
}

function formatTransparencyValue(field: string, payload: IdentityFusionPayload): string {
  switch (field) {
    case 'name':
      return payload.primaryName ?? '—';
    case 'birthDate':
      return payload.birthDate ? new Date(payload.birthDate).toLocaleDateString() : 'Not provided';
    case 'graduationYear':
      return payload.graduationYear ? String(payload.graduationYear) : 'Not provided';
    case 'specialties':
      return payload.specialties.length ? payload.specialties.join(', ') : 'Not declared';
    default:
      return '—';
  }
}

function formatEventValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '—';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .map((entry) => formatEventValue(entry))
      .filter(Boolean)
      .join(', ');
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '[object]';
    }
  }
  return String(value);
}

function classifyBotRisk(score: number): string {
  if (score >= 0.85) return 'High risk';
  if (score >= 0.6) return 'Elevated risk';
  if (score >= 0.3) return 'Low risk';
  return 'Minimal risk';
}

function botRiskVariant(score: number): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (score >= 0.85) return 'destructive';
  if (score >= 0.6) return 'secondary';
  return 'outline';
}

async function fetchDocumentHistory(docId: string): Promise<DocumentHistoryResponse> {
  const base = API_BASE || (typeof window !== 'undefined' ? window.location.origin : '');
  if (!base) {
    throw new Error('API base URL not configured');
  }
  const headers: HeadersInit = {};
  if (typeof window !== 'undefined') {
    try {
      headers['x-bot-device'] = getBotDeviceSignature();
      const signals = await collectBotSignals();
      headers['x-bot-signals'] = encodeSignalsPayload(signals);
    } catch (error) {
      console.warn('[bot][signals] unable to collect runtime metrics', error);
    }
  }
  const response = await fetch(`${base.replace(/\/$/, '')}/api/documents/${docId}/history`, {
    cache: 'no-store',
    headers,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.message || `API returned ${response.status}`);
  }
  return (await response.json()) as DocumentHistoryResponse;
}

async function fetchIdentityFusion(
  clinicianId: string,
  options: { refresh?: boolean } = {},
): Promise<IdentityFusionApiResponse> {
  const base = API_BASE || (typeof window !== 'undefined' ? window.location.origin : '');
  if (!base) {
    throw new Error('API base URL not configured');
  }
  const url = new URL(
    `${base.replace(/\/$/, '')}/api/identity/fusion/${encodeURIComponent(clinicianId)}`,
  );
  if (options.refresh) {
    url.searchParams.set('refresh', 'true');
  }
  const response = await fetch(url.toString(), { cache: 'no-store' });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.message || `Identity fusion returned ${response.status}`);
  }
  return (await response.json()) as IdentityFusionApiResponse;
}

async function fetchRegionHealth(): Promise<RegionHealthResponse> {
  const base = API_BASE || (typeof window !== 'undefined' ? window.location.origin : '');
  if (!base) {
    throw new Error('API base URL not configured');
  }
  const response = await fetch(`${base.replace(/\/$/, '')}/api/region/health`, {
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`Region health returned ${response.status}`);
  }
  return (await response.json()) as RegionHealthResponse;
}

function buildFallbackHistory(docId: string): DocumentHistoryResponse {
  const now = new Date();
  const chainEntries = Array.from({ length: 3 }).map((_, idx) => ({
    sequence: idx + 1,
    hash: `0x${createHashSeed(docId, idx)}`,
    event: idx === 0 ? 'ingested' : 'reconciled',
    actor: idx === 0 ? `cln_${docId.slice(0, 6)}` : 'system',
    observedAt: new Date(now.getTime() - (3 - idx) * 45_000).toISOString(),
    digest: `0x${createHashSeed(docId, idx + 4)}`,
  }));

  return {
    docId,
    clinicianId: `cln_${docId.slice(0, 8)}`,
    lastUpdated: now.toISOString(),
    chain: {
      valid: true,
      issues: [],
      digest: chainEntries.at(-1)?.digest ?? '0x0',
      chainLength: chainEntries.length,
      hashSeq: chainEntries.map((entry) => entry.hash),
      persisted: false,
      entries: chainEntries,
    },
    provenance: {
      verdict: 'verified',
      confidence: 0.78,
      captureDevice: 'Secure Capture Demo',
      captureTimestamp: now.toISOString(),
      gps: { lat: 37.7749, lng: -122.4194, accuracyMeters: 20 },
      warnings: [],
      anomalies: [],
    },
    fingerprint: {
      duplicateScore: 0,
      collisions: [],
      sampleSize: 0,
    },
    liveness: {
      sessionId: `fallback_${docId}`,
      clinicianId: `cln_${docId.slice(0, 8)}`,
      score: 0.74,
      verdict: 'pass',
      spoofLikelihood: 0.21,
      signals: {
        blink: 0.71,
        motion: 0.68,
        depth: 0.76,
        challenge: 0.8,
        illumination: 0.67,
      },
      frameCount: 28,
      evaluatedAt: now.toISOString(),
      challengeBreakdown: [
        { prompt: 'blink', success: true, latencyMs: 700 },
        { prompt: 'turn_left', success: true, latencyMs: 800 },
      ],
      riskFactors: [],
      entropy: 0.82,
    },
    watermark: {
      digest: `0x${createHashSeed(docId, 9)}`,
      mutatedBytes: 42,
      traceVector: [4, 18, 27, 39, 58],
      insertedAt: now.toISOString(),
      bitCount: 128,
    },
    signatureChain: {
      docId,
      rootHash: `0x${createHashSeed(docId, 15)}`,
      chainLength: 2,
      generatedAt: now.toISOString(),
      layers: [
        {
          signerId: `cln_${docId.slice(0, 6)}`,
          algorithm: 'ecdsa-p256',
          signature: `0x${createHashSeed(docId, 10)}`,
          timestamp: now.toISOString(),
          sequence: 1,
          layerHash: `0x${createHashSeed(docId, 11)}`,
          previousLayerHash: null,
        },
        {
          signerId: 'notary_service',
          algorithm: 'rsa-4096',
          signature: `0x${createHashSeed(docId, 12)}`,
          timestamp: now.toISOString(),
          sequence: 2,
          layerHash: `0x${createHashSeed(docId, 13)}`,
          previousLayerHash: `0x${createHashSeed(docId, 11)}`,
        },
      ],
    },
    botDefense: {
      riskScore: 0.32,
      flags: [],
      navigation: {
        samples: 18,
        averageSpeed: 640,
        maxSpeed: 1380,
        impossible: false,
      },
      fingerprint: {
        deviceSig: `bot_${docId.slice(0, 6)}`,
        uniqueIpCount: 1,
        identicalAcrossIps: false,
        recentIps: ['10.0.0.42'],
      },
      runtime: null,
      network: {
        ipChain: [],
        residentialProxyHop: false,
        torSuspected: false,
        vpnSuspected: false,
      },
      anchor: null,
    },
    walletClones: {
      findings: [],
      totalDevices: 0,
    },
  };
}

function createHashSeed(value: string, salt: number): string {
  const input = `${value}:${salt}`;
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function shortHash(hash: string, length = 10): string {
  if (!hash) return '—';
  if (hash.length <= length + 4) return hash;
  return `${hash.slice(0, length)}…${hash.slice(-4)}`;
}

function friendlyRegionName(region?: string): string {
  if (!region) return 'Unknown';
  return REGION_NAME_MAP[region] ?? region.toUpperCase();
}

interface DocumentHint {
  id: string;
  severity: 'info' | 'warn' | 'error';
  insight: string;
  action: string;
  confidence: number;
}

function buildDocumentHints(history: DocumentHistoryResponse): DocumentHint[] {
  const hints: DocumentHint[] = [];

  if (!history.chain.valid) {
    hints.push({
      id: 'chain-gap',
      severity: 'warn',
      insight: 'Hash chain replay detected',
      action: 'Re-upload the original PDF to rebuild an unbroken hash chain.',
      confidence: 0.82,
    });
  }

  if (history.provenance.warnings.length > 0 || history.provenance.anomalies.length > 0) {
    hints.push({
      id: 'provenance',
      severity: 'warn',
      insight: 'Camera metadata drifted',
      action: 'Capture with the secure app or enable geo-tagging for higher provenance confidence.',
      confidence: 0.74,
    });
  }

  if (history.botDefense.flags.length > 0) {
    hints.push({
      id: 'bot',
      severity: 'error',
      insight: 'Automation signature detected',
      action:
        'Pointer telemetry looked robotic. Complete the tap-and-hold challenge or slow down the capture.',
      confidence: history.botDefense.riskScore,
    });
  }

  if (history.fingerprint.collisions.length > 0) {
    hints.push({
      id: 'fingerprint',
      severity: 'warn',
      insight: 'Possible duplicate document',
      action: 'This scan matches another clinician. Double-check you uploaded the correct file.',
      confidence: 0.69,
    });
  }

  const failedChallenges = history.liveness.challengeBreakdown.filter(
    (challenge) => !challenge.success,
  );
  if (failedChallenges.length > 0) {
    hints.push({
      id: 'liveness',
      severity: 'info',
      insight: 'Face liveness needed retries',
      action: 'Keep your face centered with steady lighting to avoid extra attempts.',
      confidence: 0.58,
    });
  }

  return hints.slice(0, 3);
}

const LIFECYCLE_BADGES: Record<
  LifecycleSummary['displayStatus'],
  {
    label: string;
    variant: 'default' | 'secondary' | 'destructive';
    icon: ReactNode;
    helper: string;
  }
> = {
  active: {
    label: 'Active credential',
    variant: 'default',
    icon: <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />,
    helper: 'Good standing',
  },
  expiring: {
    label: 'Expiring soon',
    variant: 'secondary',
    icon: <Timer className="h-3.5 w-3.5 text-amber-500" />,
    helper: '<45 days remaining',
  },
  expired: {
    label: 'Expired',
    variant: 'destructive',
    icon: <ShieldAlert className="h-3.5 w-3.5" />,
    helper: 'Renew to reactivate',
  },
};

function LifecycleStatusBadge({ lifecycle }: { lifecycle: LifecycleSummary }) {
  const config = LIFECYCLE_BADGES[lifecycle.displayStatus];
  return (
    <Badge variant={config.variant} className="flex items-center gap-1.5">
      {config.icon}
      <span>{config.label}</span>
      {lifecycle.expiresAt && (
        <span className="text-[10px] uppercase text-muted-foreground">
          {new Date(lifecycle.expiresAt).toLocaleDateString()}
        </span>
      )}
      <span className="text-[10px] uppercase text-muted-foreground">{config.helper}</span>
    </Badge>
  );
}

function encodeSignalsPayload(snapshot: BotSignalSnapshot): string {
  const json = JSON.stringify(snapshot);
  if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
    return window.btoa(json);
  }
  return json;
}
