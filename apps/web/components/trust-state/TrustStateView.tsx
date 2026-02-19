'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';
import { TrustStateCard } from './TrustStateCard';
import { CredentialPanel } from './CredentialPanel';
import { MonitoringPanel } from './MonitoringPanel';
import { IntegrityPanel } from './IntegrityPanel';
import { DownloadBundleButton } from './DownloadBundleButton';
import type { TrustStateViewData } from './types';
import { PANEL_TRANSITION, STAGGER_MS } from './motion';

// ── Component ──────────────────────────────────────────────

export function TrustStateView({
  artifactId,
  backendUrl,
}: {
  artifactId: string;
  backendUrl: string;
}) {
  const [data, setData] = useState<TrustStateViewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchArtifact = useCallback(async () => {
    if (!artifactId || !backendUrl) {
      setError('Artifact ID and backend URL are required.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(
        `${backendUrl}/api/artifact/bundle/${encodeURIComponent(artifactId)}`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      // Map API response to TrustStateViewData
      const artifact = json.artifact ?? json;
      const view: TrustStateViewData = mapArtifactToView(artifact, artifactId);
      setData(view);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load artifact');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [artifactId, backendUrl]);

  useEffect(() => {
    fetchArtifact();
  }, [fetchArtifact]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16" role="status">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" aria-hidden="true" />
        <span className="sr-only">Loading artifact data</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="bg-red-50 border-red-200">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!data) return null;

  const panels = [
    { key: 'trust-state', node: <TrustStateCard data={data.trustState} /> },
    { key: 'credentials', node: <CredentialPanel data={data.credentials} /> },
    { key: 'monitoring', node: <MonitoringPanel data={data.monitoring} /> },
    { key: 'integrity', node: <IntegrityPanel data={data.integrity} /> },
  ];

  return (
    <article aria-label={`Trust state for ${data.providerName || data.npi}`}>
      {/* Page header */}
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
          Trust State
        </h1>
        <p className="text-sm text-slate-500 mt-1 font-mono">
          NPI {data.npi} · Artifact {data.artifactId.substring(0, 8)}
        </p>
      </header>

      {/* Panels with staggered entry */}
      <div className="space-y-6">
        {panels.map((panel, i) => (
          <div
            key={panel.key}
            className={`${PANEL_TRANSITION} opacity-0 translate-y-2`}
            style={{
              transitionDelay: `${i * STAGGER_MS}ms`,
              animation: `trust-panel-enter 320ms cubic-bezier(0.2, 0.8, 0.2, 1) ${i * STAGGER_MS}ms forwards`,
            }}
          >
            {panel.node}
          </div>
        ))}
      </div>

      {/* Download */}
      <footer className="mt-6 pt-4 border-t border-slate-200">
        <DownloadBundleButton artifactId={data.artifactId} />
      </footer>
    </article>
  );
}

// ── Mapper ─────────────────────────────────────────────────

function mapArtifactToView(artifact: Record<string, unknown>, fallbackId: string): TrustStateViewData {
  const a = artifact as Record<string, unknown>;
  const provider = (a.provider ?? {}) as Record<string, unknown>;
  const name = (provider.name ?? {}) as Record<string, string>;
  const credentials = (a.credentials ?? []) as Record<string, unknown>[];
  const retrieval = (a.retrieval ?? {}) as Record<string, unknown>;
  const integrity = (a.integrity ?? {}) as Record<string, unknown>;
  const decisionWindow = (a.decisionWindow ?? {}) as Record<string, unknown>;
  const monitoring = (a.monitoring ?? {}) as Record<string, unknown>;

  return {
    artifactId: String(a.artifactId ?? fallbackId),
    npi: String(provider.npi ?? a.npi ?? ''),
    providerName: [name.first, name.last].filter(Boolean).join(' ') || String(provider.npi ?? ''),
    trustState: {
      band: (decisionWindow.windowStatus === 'EXPIRED' ? 'RED'
        : decisionWindow.windowStatus === 'EXPIRING_SOON' ? 'YELLOW'
        : 'GREEN') as 'GREEN' | 'YELLOW' | 'RED',
      windowStatus: String(decisionWindow.windowStatus ?? 'WITHIN_WINDOW') as TrustStateViewData['trustState']['windowStatus'],
      verifiedAt: String(decisionWindow.verifiedAt ?? ''),
      validUntil: String(decisionWindow.validUntil ?? ''),
      daysRemaining: Number(decisionWindow.daysRemaining ?? 0),
      windowDays: Number(decisionWindow.windowDays ?? 120),
      startReady: decisionWindow.windowStatus === 'WITHIN_WINDOW',
      blockingReasons: decisionWindow.windowStatus === 'EXPIRED'
        ? ['EXPIRED_PSV']
        : decisionWindow.windowStatus === 'EXPIRING_SOON'
        ? ['PSV_EXPIRING_SOON']
        : [],
    },
    credentials: {
      credentials: credentials.map((c) => ({
        credentialType: String(c.credentialType ?? 'UNKNOWN') as TrustStateViewData['credentials']['credentials'][number]['credentialType'],
        status: String(c.status ?? 'UNKNOWN') as TrustStateViewData['credentials']['credentials'][number]['status'],
        issuer: String(c.issuer ?? ''),
        issuingStateOrBody: String(c.issuingStateOrBody ?? ''),
        credentialIdentifier: String(c.credentialIdentifier ?? ''),
        issueDate: String(c.issueDate ?? ''),
        expirationDate: String(c.expirationDate ?? ''),
      })),
      retrieval: {
        method: String(retrieval.method ?? 'API') as TrustStateViewData['credentials']['retrieval']['method'],
        retrievedAt: String(retrieval.retrievedAt ?? ''),
        agent: {
          system: String((retrieval.agent as Record<string, unknown>)?.system ?? 'VitalCV'),
          version: String((retrieval.agent as Record<string, unknown>)?.version ?? '1.0'),
        },
        source: {
          sourceType: String((retrieval.source as Record<string, unknown>)?.sourceType ?? 'NPPES') as TrustStateViewData['credentials']['retrieval']['source']['sourceType'],
          sourceName: String((retrieval.source as Record<string, unknown>)?.sourceName ?? ''),
          sourceUrl: String((retrieval.source as Record<string, unknown>)?.sourceUrl ?? ''),
          authoritative: Boolean((retrieval.source as Record<string, unknown>)?.authoritative ?? false),
        },
      },
    },
    monitoring: {
      enabled: Boolean(monitoring.enabled ?? false),
      lastCheckedAt: String(monitoring.lastCheckedAt ?? ''),
      checkIntervalHours: Number(monitoring.checkIntervalHours ?? 24),
      deltaLog: ((monitoring.deltaLog ?? []) as Record<string, unknown>[]).map((d) => ({
        deltaId: String(d.deltaId ?? ''),
        detectedAt: String(d.detectedAt ?? ''),
        changeSet: {
          changedFields: ((d.changeSet as Record<string, unknown>)?.changedFields as Record<string, string>[] ?? []).map((f) => ({
            field: String(f.field ?? ''),
            previousValue: String(f.previousValue ?? ''),
            newValue: String(f.newValue ?? ''),
          })),
          materialChange: Boolean((d.changeSet as Record<string, unknown>)?.materialChange ?? false),
          changeHash: String((d.changeSet as Record<string, unknown>)?.changeHash ?? ''),
        },
        previousArtifactHash: String(d.previousArtifactHash ?? ''),
        newArtifactHash: String(d.newArtifactHash ?? ''),
      })),
    },
    integrity: {
      rawPayloadHash: String(integrity.rawPayloadHash ?? ''),
      artifactHash: String(integrity.artifactHash ?? ''),
      signatureAlgorithm: 'ES256',
      publicKeyId: String(integrity.publicKeyId ?? ''),
      signedAt: String(integrity.signedAt ?? ''),
    },
  };
}
