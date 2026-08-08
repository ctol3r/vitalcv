'use client';

/**
 * ReviewQueueSurface — Wave L. The employer's review inbox: clinicians who
 * shared an apply bundle with the employer's own registered organization,
 * with a readiness summary (cached trust snapshot, labeled as such), the
 * honest prior-acceptance head-start signal, and batch actions.
 *
 * Batch semantics mirror the single-entity review exactly: every candidate
 * writes its own audit event, and a blocked candidate fails closed
 * individually — the response reports each outcome and this surface renders
 * them per row. The head start is visibility and a soft signal only; this
 * organization still decides.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

type QueueReadiness = {
  level: string;
  score: number;
  status: string;
  topBlockers: string[];
  source: string;
};

type QueueHeadStart = {
  acceptedOrganizationCount: number;
  hasPriorAcceptances: boolean;
  headline: string;
  trustCopy: string | null;
};

export interface QueueCandidate {
  entityId: string | null;
  npi: string;
  reviewable: boolean;
  sharedAt: string;
  purposeOfUse: string;
  readiness: QueueReadiness | null;
  headStart: QueueHeadStart | null;
  alreadyAccepted: { acceptanceId: string; acceptedAt: string } | null;
  reviewPath: string | null;
}

interface QueuePayload {
  ok: boolean;
  scope: { type: string; organizationId: string; organizationName: string };
  total: number;
  candidates: QueueCandidate[];
  readinessNote: string;
  generatedAt: string;
}

type BatchAction = 'accept' | 'request-refresh' | 'route-to-review';

interface BatchResult {
  entityId: string;
  ok: boolean;
  status: number;
  error?: string;
  error_description?: string;
}

type LoadState = 'loading' | 'ready' | 'signed-out' | 'no-org' | 'error';

const ACTION_LABEL: Record<BatchAction, string> = {
  accept: 'Accept as head start',
  'request-refresh': 'Request refresh',
  'route-to-review': 'Route to review',
};

const LEVEL_COLORS: Record<string, string> = {
  L0: 'var(--vt-risk-high, #8C2A2A)',
  L1: 'var(--vt-risk-medium, #A05C00)',
  L2: 'var(--vt-accent, #0A7B7F)',
  L3: 'var(--vt-status-resolved, #2E7D45)',
};

export function ReviewQueueSurface() {
  const [state, setState] = useState<LoadState>('loading');
  const [payload, setPayload] = useState<QueuePayload | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState<BatchAction | null>(null);
  const [outcomes, setOutcomes] = useState<Record<string, BatchResult>>({});
  const [batchNote, setBatchNote] = useState<string | null>(null);

  const loadQueue = useCallback(() => {
    setState('loading');
    fetch('/api/employer-review/queue', { cache: 'no-store', signal: AbortSignal.timeout(20_000) })
      .then(async (r) => {
        if (r.status === 401) return setState('signed-out');
        if (r.status === 403) return setState('no-org');
        if (!r.ok) return setState('error');
        const data = (await r.json()) as QueuePayload;
        setPayload(data);
        setState('ready');
      })
      .catch(() => setState('error'));
  }, []);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const selectable = useMemo(
    () => (payload?.candidates ?? []).filter((c) => c.reviewable && c.entityId),
    [payload],
  );

  const toggle = (entityId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(entityId)) next.delete(entityId);
      else next.add(entityId);
      return next;
    });
  };

  const runBatch = async (action: BatchAction) => {
    if (selected.size === 0 || submitting) return;
    setSubmitting(action);
    setBatchNote(null);
    try {
      const res = await fetch('/api/employer-review/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, entityIds: [...selected] }),
      });
      const data = (await res.json().catch(() => null)) as
        | { results?: BatchResult[]; summary?: { succeeded: number; failed: number } }
        | null;
      if (!res.ok || !data?.results) {
        setBatchNote('The batch could not be processed. No decisions were recorded silently — try again.');
        return;
      }
      const byEntity: Record<string, BatchResult> = {};
      for (const result of data.results) byEntity[result.entityId] = result;
      setOutcomes((prev) => ({ ...prev, ...byEntity }));
      setSelected(new Set());
      setBatchNote(
        `${ACTION_LABEL[action]}: ${data.summary?.succeeded ?? 0} recorded, ${data.summary?.failed ?? 0} failed closed. Each candidate has its own audit event.`,
      );
      loadQueue();
    } catch {
      setBatchNote('The batch could not be processed. No decisions were recorded silently — try again.');
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '28px 24px 96px', display: 'grid', gap: 16 }}>
      <header>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, color: 'var(--vt-text-primary)' }}>Review queue</h1>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--vt-text-secondary)' }}>
          {payload?.scope
            ? `Clinicians who shared their evidence with ${payload.scope.organizationName}.`
            : 'Clinicians who shared their evidence with your organization.'}
        </p>
      </header>

      {state === 'loading' && <Note title="Loading your queue…" body="Fetching live shares for your organization." />}
      {state === 'signed-out' && (
        <Note title="Sign in to see your review queue" body="The queue is scoped to your organization's account." />
      )}
      {state === 'no-org' && (
        <Note
          title="No employer organization on this account"
          body="Complete employer setup first — the queue is always bound to your own registered organization."
        />
      )}
      {state === 'error' && (
        <Note title="Queue is temporarily unavailable" body="This is a system state — nothing about your candidates changed. Try again shortly." />
      )}
      {state === 'ready' && (payload?.candidates.length ?? 0) === 0 && (
        <Note title="No live shares yet" body="When a clinician shares an apply bundle with your organization, they appear here." />
      )}

      {state === 'ready' && (payload?.candidates.length ?? 0) > 0 && (
        <>
          {/* Batch action bar */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 10,
              padding: '12px 14px',
              border: '1px solid var(--vt-border, #E2E8E6)',
              borderRadius: 12,
              background: 'var(--vt-surface, #fff)',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--vt-text-primary)' }}>
              {selected.size} of {selectable.length} selected
            </span>
            {(Object.keys(ACTION_LABEL) as BatchAction[]).map((action) => (
              <button
                key={action}
                type="button"
                disabled={selected.size === 0 || submitting !== null}
                onClick={() => runBatch(action)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: selected.size === 0 || submitting ? 'not-allowed' : 'pointer',
                  opacity: selected.size === 0 || submitting ? 0.5 : 1,
                  border: '1px solid var(--vt-border, #D6DED9)',
                  background: action === 'accept' ? 'var(--vt-accent, #0A7B7F)' : 'var(--vt-surface, #fff)',
                  color: action === 'accept' ? '#fff' : 'var(--vt-text-primary)',
                }}
              >
                {submitting === action ? 'Recording…' : ACTION_LABEL[action]}
              </button>
            ))}
            <p style={{ margin: 0, flexBasis: '100%', fontSize: 11, color: 'var(--vt-text-muted)' }}>
              Every candidate gets its own audit event. Blocked candidates fail closed individually — the batch never
              overrides a blocked readiness state.
            </p>
          </div>

          {batchNote && (
            <div
              role="status"
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                fontSize: 13,
                border: '1px solid var(--vt-border, #D6DED9)',
                background: 'var(--vt-surface, #fff)',
                color: 'var(--vt-text-primary)',
              }}
            >
              {batchNote}
            </div>
          )}

          {/* Candidate rows */}
          <div style={{ display: 'grid', gap: 12 }}>
            {payload!.candidates.map((candidate) => {
              const outcome = candidate.entityId ? outcomes[candidate.entityId] : undefined;
              const levelColor = candidate.readiness ? (LEVEL_COLORS[candidate.readiness.level] ?? 'var(--vt-text-muted)') : 'var(--vt-text-muted)';
              const checked = candidate.entityId ? selected.has(candidate.entityId) : false;
              return (
                <div
                  key={`${candidate.npi}-${candidate.sharedAt}`}
                  style={{
                    display: 'grid',
                    gap: 10,
                    padding: 16,
                    borderRadius: 14,
                    border: '1px solid var(--vt-border, #E2E8E6)',
                    background: 'var(--vt-surface, #fff)',
                  }}
                >
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
                    <input
                      type="checkbox"
                      aria-label={`Select NPI ${candidate.npi}`}
                      checked={checked}
                      disabled={!candidate.reviewable || !candidate.entityId}
                      onChange={() => candidate.entityId && toggle(candidate.entityId)}
                      style={{ width: 18, height: 18 }}
                    />
                    <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--vt-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                      NPI {candidate.npi}
                    </span>
                    {candidate.readiness ? (
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          padding: '4px 10px',
                          borderRadius: 999,
                          color: levelColor,
                          border: `1px solid color-mix(in srgb, ${levelColor} 30%, transparent)`,
                          background: `color-mix(in srgb, ${levelColor} 10%, transparent)`,
                        }}
                      >
                        {candidate.readiness.level} · {candidate.readiness.score}/100
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--vt-text-muted)' }}>Readiness unavailable</span>
                    )}
                    {candidate.alreadyAccepted ? (
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--vt-status-resolved, #2E7D45)' }}>
                        Accepted {new Date(candidate.alreadyAccepted.acceptedAt).toLocaleDateString()}
                      </span>
                    ) : null}
                    <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--vt-text-muted)' }}>
                      Shared {new Date(candidate.sharedAt).toLocaleString()} · {candidate.purposeOfUse}
                    </span>
                  </div>

                  {/* Head start — honest wording comes from the acceptance-history service */}
                  {candidate.headStart?.hasPriorAcceptances ? (
                    <div
                      style={{
                        padding: '8px 12px',
                        borderRadius: 10,
                        fontSize: 12,
                        border: '1px solid color-mix(in srgb, var(--vt-accent, #0A7B7F) 25%, transparent)',
                        background: 'color-mix(in srgb, var(--vt-accent, #0A7B7F) 7%, transparent)',
                        color: 'var(--vt-text-primary)',
                      }}
                    >
                      <strong>Head start:</strong> {candidate.headStart.headline}. A soft signal — your organization still
                      decides.
                      {candidate.headStart.trustCopy ? (
                        <span style={{ display: 'block', marginTop: 4, color: 'var(--vt-text-secondary)' }}>
                          {candidate.headStart.trustCopy}
                        </span>
                      ) : null}
                    </div>
                  ) : null}

                  {candidate.readiness && candidate.readiness.topBlockers.length > 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--vt-risk-medium, #A05C00)' }}>
                      Open items: {candidate.readiness.topBlockers.join(' · ')}
                    </div>
                  ) : null}

                  {outcome ? (
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: outcome.ok ? 'var(--vt-status-resolved, #2E7D45)' : 'var(--vt-risk-high, #8C2A2A)',
                      }}
                    >
                      {outcome.ok
                        ? 'Recorded — audit event written.'
                        : `Failed closed: ${outcome.error_description ?? outcome.error ?? 'not recorded'}`}
                    </div>
                  ) : null}

                  <div>
                    {candidate.reviewPath ? (
                      <a
                        href={candidate.reviewPath}
                        style={{ fontSize: 13, fontWeight: 600, color: 'var(--vt-accent, #0A7B7F)', textDecoration: 'none' }}
                      >
                        Open full review →
                      </a>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--vt-text-muted)' }}>
                        Identity not yet resolved — this share can&rsquo;t be reviewed yet.
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <p style={{ margin: 0, fontSize: 11, color: 'var(--vt-text-muted)', lineHeight: 1.5 }}>{payload!.readinessNote}</p>
        </>
      )}
    </div>
  );
}

function Note({ title, body }: { title: string; body: string }) {
  return (
    <div
      style={{
        background: 'var(--vt-surface, #fff)',
        border: '1px solid var(--vt-border, #E2E8E6)',
        borderRadius: 16,
        padding: 24,
        textAlign: 'center',
      }}
    >
      <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--vt-text-primary)' }}>{title}</p>
      <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--vt-text-secondary)' }}>{body}</p>
    </div>
  );
}
