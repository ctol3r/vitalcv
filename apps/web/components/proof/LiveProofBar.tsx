'use client';

import { getSession, useSessionListener } from '@/lib/session';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type HealthResponse = {
  status?: string;
  timestamp?: string;
  gitSha?: string;
  error?: string;
};

type BuildInfoResponse = {
  commit?: string;
  builtAt?: string;
  gitSha?: string;
  buildTime?: string;
  environment?: string;
  version?: string;
  error?: string;
};

type AuditSummaryResponse = {
  latestHash?: string | null;
  eventCount?: number;
  merkleRoot?: string | null;
  lastEvent?: { type?: string | null; timestamp?: string | null } | null;
  lastCredentialIssuanceAt?: string | null;
  lastVerificationAt?: string | null;
  lastRevocationAt?: string | null;
  anchorReference?: string | null;
  error?: string;
};

type ProofSnapshot = {
  fetchedAt: string;
  health: HealthResponse | null;
  build: BuildInfoResponse | null;
  audit: AuditSummaryResponse | null;
};

type ProofFetchStatus = {
  fetchedAt: string;
  healthOk: boolean;
  buildOk: boolean;
  auditOk: boolean;
};

const LAST_KNOWN_GOOD_KEY = 'vitalcv.proof.lastKnownGood.v1';

function shortHash(hash?: string | null) {
  if (!hash) return '—';
  return hash.length > 12 ? `${hash.slice(0, 6)}…${hash.slice(-6)}` : hash;
}

function formatTimestamp(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function safeReadLastKnownGood(): ProofSnapshot | null {
  try {
    const raw = localStorage.getItem(LAST_KNOWN_GOOD_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ProofSnapshot;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.fetchedAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

function safeWriteLastKnownGood(snapshot: ProofSnapshot) {
  try {
    localStorage.setItem(LAST_KNOWN_GOOD_KEY, JSON.stringify(snapshot));
  } catch {
    // ignore (private mode / quota / disabled storage)
  }
}

async function fetchJson<T>(url: string): Promise<{ ok: boolean; status: number; json: T | null }> {
  const res = await fetch(url, { cache: 'no-store' });
  const json = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, json };
}

export function LiveProofBar() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [build, setBuild] = useState<BuildInfoResponse | null>(null);
  const [audit, setAudit] = useState<AuditSummaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetchStatus, setFetchStatus] = useState<ProofFetchStatus | null>(null);
  const [lastKnownGood, setLastKnownGood] = useState<ProofSnapshot | null>(null);
  const [verifiedHuman, setVerifiedHuman] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;

    const bootstrap = () => {
      const existingLkg = safeReadLastKnownGood();
      if (!mounted || !existingLkg) return;
      setLastKnownGood(existingLkg);
      // Prime UI with last-known-good while we verify live.
      setHealth(existingLkg.health);
      setBuild(existingLkg.build);
      setAudit(existingLkg.audit);
    };

    const load = async () => {
      const startedAt = new Date().toISOString();
      try {
        const [h, b, a] = await Promise.all([
          fetchJson<HealthResponse>('/api/health'),
          fetchJson<BuildInfoResponse>('/api/build-info'),
          fetchJson<AuditSummaryResponse>('/api/audit/summary'),
        ]);

        if (!mounted) return;

        const lkg = safeReadLastKnownGood();
        if (lkg) setLastKnownGood(lkg);

        setHealth((prev) => (h.ok && h.json ? h.json : lkg?.health ?? prev));
        setBuild((prev) => (b.ok && b.json ? b.json : lkg?.build ?? prev));
        setAudit((prev) => (a.ok && a.json ? a.json : lkg?.audit ?? prev));
        setFetchStatus({ fetchedAt: startedAt, healthOk: h.ok, buildOk: b.ok, auditOk: a.ok });

        if (h.ok && b.ok && a.ok && h.json && b.json && a.json) {
          const snapshot: ProofSnapshot = {
            fetchedAt: startedAt,
            health: h.json,
            build: b.json,
            audit: a.json,
          };
          safeWriteLastKnownGood(snapshot);
          setLastKnownGood(snapshot);
          setError(null);
        } else {
          const lkgAt = lkg?.fetchedAt ? formatTimestamp(lkg.fetchedAt) : null;
          setError(
            lkgAt
              ? `Some checks are unavailable. Showing last known good (${lkgAt}).`
              : 'Some checks are unavailable.',
          );
        }
      } catch (e) {
        if (!mounted) return;
        setFetchStatus({ fetchedAt: startedAt, healthOk: false, buildOk: false, auditOk: false });
        const lkgAt = safeReadLastKnownGood()?.fetchedAt;
        setError(
          lkgAt
            ? `Unable to verify right now. Showing last known good (${formatTimestamp(lkgAt)}).`
            : e instanceof Error
            ? e.message
            : 'Failed to load proof data',
        );
      }
    };

    bootstrap();
    load();
    const id = setInterval(load, 30_000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    const s = getSession();
    setVerifiedHuman(Boolean(s.verifiedHuman));

    const unsubscribe = useSessionListener((session) => {
      setVerifiedHuman(Boolean(session.verifiedHuman));
    });

    return unsubscribe;
  }, []);

  const readiness = useMemo(() => {
    const status = String(health?.status || '').toUpperCase();
    const healthOk = status === 'OK';
    const commit = build?.commit || build?.gitSha;
    const buildOk = Boolean(commit && commit !== 'unknown');
    const auditOk = Boolean(
      audit && (audit.latestHash || audit.merkleRoot || audit.eventCount !== undefined),
    );
    const endpointsOk = Boolean(
      fetchStatus?.healthOk && fetchStatus?.buildOk && fetchStatus?.auditOk,
    );
    return {
      ok: endpointsOk && healthOk && buildOk && auditOk && !error,
      healthStatus: status || 'UNKNOWN',
      commit,
    };
  }, [audit, build, error, fetchStatus, health]);

  const proofLevel: 'ok' | 'degraded' | 'loading' = useMemo(() => {
    if (!fetchStatus && !health && !build && !audit && !error) return 'loading';
    return readiness.ok ? 'ok' : fetchStatus ? 'degraded' : 'loading';
  }, [audit, build, error, fetchStatus, health, readiness.ok]);

  const receiptHash = useMemo(() => audit?.latestHash || audit?.merkleRoot || null, [audit]);
  const updatedAt = useMemo(
    () => health?.timestamp || build?.builtAt || build?.buildTime,
    [build, health],
  );

  const statusLabel = useMemo(() => {
    if (proofLevel === 'ok') return 'Safe';
    if (proofLevel === 'loading') return 'Verifying';
    return 'Degraded';
  }, [proofLevel]);

  const statusDetail = useMemo(() => {
    if (proofLevel === 'ok') return 'All systems normal';
    if (proofLevel === 'loading') return 'Verifying…';
    if (lastKnownGood?.fetchedAt)
      return `Using last known good (${formatTimestamp(lastKnownGood.fetchedAt)})`;
    return 'Some checks unavailable';
  }, [lastKnownGood?.fetchedAt, proofLevel]);

  return (
    <div className="w-full border-b bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-2 text-xs md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                proofLevel === 'ok'
                  ? 'bg-emerald-500'
                  : proofLevel === 'degraded'
                  ? 'bg-amber-400'
                  : 'bg-neutral-300 dark:bg-neutral-700'
              }`}
              aria-hidden="true"
            />
            <span className="font-semibold">{statusLabel}</span>
            <span className="text-neutral-600 dark:text-neutral-300">{statusDetail}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-neutral-700 dark:text-neutral-300">
            <span>Build: {readiness.commit ? shortHash(readiness.commit) : '…'}</span>
            <span>·</span>
            <span>Receipt: {receiptHash ? shortHash(receiptHash) : '…'}</span>
            <span>·</span>
            <span>
              Checked:{' '}
              {fetchStatus?.fetchedAt
                ? formatTimestamp(fetchStatus.fetchedAt)
                : updatedAt
                ? formatTimestamp(updatedAt)
                : '…'}
            </span>
            <span>·</span>
            <span>Human: {verifiedHuman ? 'verified' : 'unverified'}</span>
          </div>

          {error ? (
            <span
              className={
                proofLevel === 'degraded'
                  ? 'text-amber-700 dark:text-amber-300'
                  : 'text-rose-600 dark:text-rose-400'
              }
            >
              {error}
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <Link href="/status" className="underline underline-offset-2">
            View details
          </Link>
          <Link href="/changelog" className="underline underline-offset-2">
            Changelog
          </Link>
        </div>
      </div>
    </div>
  );
}
