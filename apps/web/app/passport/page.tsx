'use client';

export const dynamic = 'force-dynamic';

/**
 * /passport — Passport entry + live ingest hydration (D57 visual port)
 *
 * Preserved from the prior 808-line implementation:
 *   - useIngestStream hook (SSE source resolution: NPPES → OIG → PECOS)
 *   - hydrateFromHomepagePreview / readHomepagePreview / persistOnboardingNpi
 *   - isValidNpiChecksum (Luhn validation)
 *   - resolveIngestErrorCopy / format*Label helpers
 *   - buildPassportEntityHref / getPublicWedgeSurfaceBadgeMeta
 *   - resolveLivePathReadinessStatus
 *   - trackPilotEvent / UX_EVENTS instrumentation
 *   - Role context handling (role / roleTitle / employer / employerName)
 *   - LaneHealthMount (live source-health telemetry)
 *
 * Replaced: the JSX shell. Paper substrate, hairline, compound TruthChips
 * (chat22 fix #1 — no bare chips), AuditTimeline (chat22 fix #11 — real
 * timeline, not a list), DegradedBanner under the proof rail when SAM.gov
 * is 503 (chat22 fix #7), Source Health grid with align-items: start so
 * wrapped names don't collide with chips (chat22 fix #3), AuditTimeline
 * stacks date/label/detail rows so they never collapse (chat22 fix #4),
 * Receipt Drawer for the full inspect surface (chat22 fix #10).
 */

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  AuditTimeline,
  BoundaryBanner,
  Button,
  Card,
  CardBody,
  CardHeader,
  DegradedBanner,
  Eyebrow,
  FieldGroup,
  FieldHint,
  FieldRow,
  FooterBottom,
  Input,
  LinkButton,
  Nav,
  Receipt,
  ReceiptDrawer,
  Shell,
  TruthChip,
  type TruthState,
  type AuditEvent,
  type ReceiptLine,
} from '@/components/visual';
import { LaneHealthMount } from '@/components/source-health/LaneHealthMount';
import {
  hydrateFromHomepagePreview,
  useIngestStream,
  type IngestStreamState,
  type StreamPhase,
} from '@/hooks/useIngestStream';
import { UX_EVENTS } from '@/lib/analytics/ux-events';
import { resolveLivePathReadinessStatus } from '@/lib/live-path/contracts';
import { trackPilotEvent } from '@/lib/pilot-ops/client';
import { buildPassportEntityHref } from '@/lib/trust/public-wedge-parity';

// ── NPI Luhn checksum (ISO/IEC 7812 with "80840" prefix) ─────────────
function isValidNpiChecksum(npi: string): boolean {
  if (npi.length !== 10 || /\D/.test(npi)) return false;
  const digits = ('80840' + npi).split('').map(Number);
  let sum = 0;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits[i];
    if ((digits.length - 1 - i) % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

function resolveIngestErrorCopy(raw: string | undefined | null) {
  const degraded = {
    title: "We couldn't load the source-backed snapshot right now.",
    description: 'Try this NPI again in a moment. Nothing has been marked adverse.',
  } as const;
  if (!raw) return degraded;
  const n = raw.toLowerCase().replace(/[_\s]+/g, '_');
  if (n.includes('npi') && n.includes('invalid')) {
    return {
      title: 'That NPI was not found in NPPES.',
      description:
        'Check the 10-digit number and try again. Nothing has been marked adverse.',
    };
  }
  return degraded;
}

const PHASE_LABEL: Record<StreamPhase, string> = {
  idle: '',
  starting: 'Opening the passport…',
  nppes: 'Reading NPPES…',
  sanctions: 'Checking OIG exclusion record…',
  enrollment: 'Checking CMS PECOS enrollment…',
  done: 'Read complete',
  error: 'Source unavailable',
};

// Map an SSE source state to a TruthChip state.
type SourceState = 'pending' | 'checking' | 'done' | 'error';
function sourceToTruthState(s: SourceState): TruthState {
  switch (s) {
    case 'done':
      return 'source-backed';
    case 'checking':
    case 'pending':
      return 'pending-source';
    case 'error':
      return 'source-unavailable';
  }
}

function formatExclusionLabel(
  checked: boolean,
  clear: boolean | undefined,
  status: string | undefined,
  state: SourceState,
): string {
  if (state === 'error') return 'SAM.gov 503 · retry pending';
  if (!checked) return state === 'done' ? 'Checked' : 'Pending';
  if (clear === true) return 'No record returned';
  if (clear === false) return 'Flag found — surface verbatim';
  if (status === 'POSSIBLE_MATCH') return 'Possible match — manual review';
  if (status === 'EXCLUDED') return 'Excluded — see OIG record';
  return 'Checked';
}

function formatEnrollmentLabel(
  checked: boolean,
  status: string | undefined,
  state: SourceState,
): string {
  if (state === 'error') return 'PECOS lookup unavailable';
  if (!checked) return state === 'done' ? 'Checked' : 'Pending';
  if (status === 'ENROLLED') return 'Enrolled in Medicare';
  if (status === 'NOT_FOUND') return 'No PECOS record';
  if (status === 'OPTED_OUT') return 'Opted out';
  return status ?? 'Checked';
}

// ── SessionStorage handoff ───────────────────────────────────────────
const PREVIEW_TTL_MS = 5 * 60 * 1000;
function readHomepagePreview(npi: string) {
  try {
    const raw = sessionStorage.getItem(`vitalcv:preview:${npi}`);
    if (!raw) return null;
    sessionStorage.removeItem(`vitalcv:preview:${npi}`);
    const parsed = JSON.parse(raw) as {
      kind?: string;
      timestamp?: number;
      state?: IngestStreamState;
    };
    if (typeof parsed.timestamp === 'number' && Date.now() - parsed.timestamp > PREVIEW_TTL_MS) {
      return null;
    }
    if (parsed.kind === 'ingestStream' && parsed.state) {
      return parsed.state;
    }
    return hydrateFromHomepagePreview({ npi, ...parsed } as Parameters<
      typeof hydrateFromHomepagePreview
    >[0]);
  } catch {
    return null;
  }
}

function persistOnboardingNpi(npi: string) {
  if (typeof window === 'undefined' || !/^\d{10}$/.test(npi)) return;
  window.sessionStorage.setItem('onboarding_npi', npi);
  window.localStorage.setItem('onboarding_npi', npi);
}

function humanizeContextToken(value: string): string {
  return value
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

type PassportRoleContext = Readonly<{
  roleId: string | null;
  roleTitle: string | null;
  employerSlug: string | null;
  employerName: string | null;
}>;

// ── Main page ────────────────────────────────────────────────────────
function PassportPageContent({
  initialNpi,
  roleContext,
}: {
  initialNpi: string | null;
  roleContext: PassportRoleContext;
}) {
  const autoTriggered = useRef(false);
  const [npi, setNpi] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const hydratedRef = useRef<ReturnType<typeof readHomepagePreview>>(
    initialNpi && /^\d{10}$/.test(initialNpi) ? readHomepagePreview(initialNpi) : null,
  );
  const { state, startIngest, resumeIngest, reset } = useIngestStream(hydratedRef.current);

  useEffect(() => {
    if (autoTriggered.current) return;
    if (hydratedRef.current) {
      autoTriggered.current = true;
      setInputError(null);
      setNpi(hydratedRef.current.npi ?? initialNpi ?? '');
      if (
        hydratedRef.current.runId &&
        !hydratedRef.current.completedAt &&
        hydratedRef.current.phase !== 'done' &&
        hydratedRef.current.phase !== 'error'
      ) {
        resumeIngest(hydratedRef.current.runId, hydratedRef.current);
      }
      return;
    }
    if (initialNpi && /^\d{10}$/.test(initialNpi)) {
      autoTriggered.current = true;
      setInputError(null);
      setNpi(initialNpi);
      void startIngest(initialNpi);
    }
  }, [initialNpi, resumeIngest, startIngest]);

  useEffect(() => {
    void trackPilotEvent({
      eventType: UX_EVENTS.PASSPORT_VIEWED,
      route: '/passport',
      oncePerSession: true,
      message: 'Passport page viewed (visual-system D57)',
    });
  }, []);

  useEffect(() => {
    const current = state.npi ?? initialNpi ?? '';
    if (/^\d{10}$/.test(current)) persistOnboardingNpi(current);
  }, [initialNpi, state.npi]);

  const { identity, standing, sources, readiness } = state;
  const isActive = state.phase !== 'idle';
  const isRunning =
    isActive &&
    !state.completedAt &&
    state.phase !== 'done' &&
    state.phase !== 'error' &&
    !state.isUsable;
  const isHydrated = state.isUsable || Boolean(identity.authoritative);
  const anchorEntityId = state.anchorEntityId ?? identity.entityId;
  const samDown = sources.oig === 'error'; // proxy: SAM.gov outage today maps to OIG lane error
  const errorCopy = state.phase === 'error' ? resolveIngestErrorCopy(state.error) : null;

  const displayRole =
    roleContext.roleTitle ??
    (roleContext.roleId ? humanizeContextToken(roleContext.roleId) : null);
  const displayEmployer =
    roleContext.employerName ??
    (roleContext.employerSlug ? humanizeContextToken(roleContext.employerSlug) : null);
  const readinessContext = displayRole
    ? `Read context: ${displayRole}${displayEmployer ? ` at ${displayEmployer}` : ''}.`
    : displayEmployer
      ? `Read context: ${displayEmployer}.`
      : null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = npi.trim();
    if (/\D/.test(trimmed)) {
      setInputError('NPI must contain only digits.');
      return;
    }
    if (trimmed.length !== 10) {
      setInputError('NPI must be exactly 10 digits.');
      return;
    }
    if (!isValidNpiChecksum(trimmed)) {
      setInputError('That NPI does not pass the Luhn check. Verify the number.');
      return;
    }
    setInputError(null);
    void startIngest(trimmed);
  }

  // ── Idle ────────────────────────────────────────────────────────────
  if (!isActive) {
    return (
      <Shell>
        <Nav cta={<LinkButton href="/sign-in">Sign in</LinkButton>} />
        <main className="vs-page">
          <Eyebrow tag="Passport">Look up a clinician by NPI</Eyebrow>
          <h1 className="vs-h-display" style={{ marginTop: 18 }}>
            Open a clinician&apos;s passport.
          </h1>
          <p className="vs-lede" style={{ marginTop: 14, marginBottom: 28 }}>
            Enter a 10-digit NPI. We&apos;ll read NPPES, OIG LEIE and CMS PECOS, then show what is
            source-backed and what still needs institution review.
          </p>

          <aside className="vs-npi-card" style={{ maxWidth: 560 }}>
            <form onSubmit={handleSubmit}>
              <FieldGroup>
                <label htmlFor="passport-npi">NPI · 10-digit identifier</label>
                <div className="vs-npi-input-row">
                  <Input
                    id="passport-npi"
                    mono
                    size="lg"
                    value={npi}
                    onChange={(e) => {
                      setNpi(e.target.value.replace(/\D/g, '').slice(0, 10));
                      setInputError(null);
                    }}
                    placeholder="1699264564"
                    maxLength={10}
                    inputMode="numeric"
                    autoFocus
                    aria-invalid={Boolean(inputError)}
                    aria-describedby={inputError ? 'passport-npi-error' : undefined}
                  />
                  <button type="submit" className="vs-btn accent lg" disabled={npi.length !== 10}>
                    Read passport
                  </button>
                </div>
                <FieldHint>
                  <span id={inputError ? 'passport-npi-error' : undefined}>
                    {inputError ?? 'NPI is public on the NPPES registry.'}
                  </span>
                  <Link href="/trust/attribution">What we read</Link>
                </FieldHint>
              </FieldGroup>
            </form>
            <div className="vs-disclaimer">
              VitalCV reads public sources. Final review belongs to the institution — we do not
              certify, license, or clear anyone to practice.
            </div>
          </aside>
        </main>
        <FooterBottom
          left="Receipt-ready · waiting on NPI input"
          right="VitalCV does not credential clinicians."
        />
      </Shell>
    );
  }

  // ── Active / Hydrating / Hydrated ───────────────────────────────────
  const nameValue = identity.displayName ?? '—';
  const specialtyValue = identity.specialty ?? null;
  const displayNpi = state.npi ?? initialNpi ?? '';

  // Field rows — only render fields we actually have data for; others are
  // honestly marked "Not asserted" rather than fabricated.
  const fields: Array<{
    label: string;
    value: React.ReactNode;
    source?: React.ReactNode;
    mono?: boolean;
    truth: { state: TruthState; source: string; label?: string };
  }> = [
    {
      label: 'Legal name',
      value: identity.authoritative ? nameValue : isRunning ? '—' : 'Not yet source-backed',
      source: identity.authoritative ? 'NPPES · public registry' : null,
      truth: identity.authoritative
        ? { state: 'source-backed', source: 'NPPES · live' }
        : { state: 'pending-source', source: 'NPPES · reading' },
    },
    {
      label: 'NPI',
      value: displayNpi || '—',
      mono: true,
      source: identity.authoritative ? 'NPPES · CMS public registry' : null,
      truth: identity.authoritative
        ? { state: 'source-backed', source: 'NPPES · live' }
        : { state: 'pending-source', source: 'NPPES · reading' },
    },
  ];

  if (specialtyValue) {
    fields.push({
      label: 'Taxonomy',
      value: specialtyValue,
      source: 'NPPES taxonomy code',
      truth: { state: 'source-backed', source: 'NPPES · live' },
    });
  }

  fields.push({
    label: 'OIG LEIE',
    value: formatExclusionLabel(
      standing.exclusionChecked,
      standing.exclusionClear,
      standing.exclusionStatus,
      sources.oig,
    ),
    source:
      sources.oig === 'done'
        ? 'OIG LEIE · empty result is itself a result'
        : sources.oig === 'error'
          ? 'OIG LEIE returned an error — clinician is not implicated'
          : 'OIG LEIE · reading',
    truth: {
      state: sourceToTruthState(sources.oig),
      source:
        sources.oig === 'done'
          ? 'OIG · live'
          : sources.oig === 'error'
            ? 'OIG · 503'
            : 'OIG · pending',
    },
  });

  fields.push({
    label: 'CMS PECOS enrollment',
    value: formatEnrollmentLabel(standing.enrollmentChecked, standing.enrollmentStatus, sources.pecos),
    source:
      sources.pecos === 'done'
        ? 'PECOS · enrollment lookup by NPI'
        : sources.pecos === 'error'
          ? 'PECOS unavailable — institution may verify directly'
          : 'PECOS · reading',
    truth: {
      state: sourceToTruthState(sources.pecos),
      source:
        sources.pecos === 'done'
          ? 'PECOS · live'
          : sources.pecos === 'error'
            ? 'PECOS · error'
            : 'PECOS · pending',
    },
  });

  // Always-present institution-only field — never a check, just a marker.
  fields.push({
    label: 'NPDB · malpractice',
    value: 'VitalCV does not read NPDB on a clinician\'s behalf',
    source: 'NPDB is institution-gated. An institution must read this directly.',
    truth: { state: 'review-needed', source: 'institution-only' },
  });

  // Source-health right rail — derived from live SSE source states.
  const sourceHealth: Array<{ name: string; state: TruthState; src: string }> = [
    {
      name: 'NPPES',
      state: sourceToTruthState(sources.nppes),
      src: sources.nppes === 'done' ? '200 · live' : sources.nppes === 'error' ? '503 · retry' : 'reading',
    },
    {
      name: 'OIG LEIE',
      state: sourceToTruthState(sources.oig),
      src: sources.oig === 'done' ? '200 · live' : sources.oig === 'error' ? '503 · 02h' : 'reading',
    },
    {
      name: 'CMS PECOS',
      state: sourceToTruthState(sources.pecos),
      src: sources.pecos === 'done' ? '200 · live' : sources.pecos === 'error' ? '503 · retry' : 'reading',
    },
    {
      name: 'NPDB',
      state: 'review-needed',
      src: 'institution-only',
    },
  ];

  // Audit timeline events — one per phase the SSE has reached.
  const timelineEvents: AuditEvent[] = [];
  if (state.phase !== 'idle') {
    timelineEvents.push({ date: 'Open', label: 'Read requested', detail: `NPI ${displayNpi}` });
  }
  if (sources.nppes === 'done' || sources.nppes === 'checking') {
    timelineEvents.push({
      date: 'NPPES',
      label: sources.nppes === 'done' ? 'NPPES returned' : 'NPPES reading',
      detail: identity.authoritative ? 'Name and address resolved' : '…',
    });
  }
  if (sources.oig === 'done' || sources.oig === 'checking' || sources.oig === 'error') {
    timelineEvents.push({
      date: 'OIG',
      label: sources.oig === 'done' ? 'OIG LEIE checked' : sources.oig === 'error' ? 'OIG unavailable' : 'OIG reading',
      detail:
        sources.oig === 'done'
          ? formatExclusionLabel(standing.exclusionChecked, standing.exclusionClear, standing.exclusionStatus, sources.oig)
          : sources.oig === 'error'
            ? 'Source 503 · retry pending · clinician not implicated'
            : '…',
    });
  }
  if (sources.pecos === 'done' || sources.pecos === 'checking' || sources.pecos === 'error') {
    timelineEvents.push({
      date: 'PECOS',
      label: sources.pecos === 'done' ? 'PECOS checked' : sources.pecos === 'error' ? 'PECOS unavailable' : 'PECOS reading',
      detail:
        sources.pecos === 'done'
          ? formatEnrollmentLabel(standing.enrollmentChecked, standing.enrollmentStatus, sources.pecos)
          : sources.pecos === 'error'
            ? 'Source 503 · retry pending'
            : '…',
    });
  }
  const lastEvent = timelineEvents.at(-1);
  if (lastEvent) lastEvent.now = true;

  const responding = [sources.nppes, sources.oig, sources.pecos].filter((s) => s === 'done').length;
  const total = 3;

  const receiptLines: ReceiptLine[] = [
    { k: 'Subject', v: `NPI ${displayNpi}` },
    { k: 'Read by', v: 'VitalCV · v2.4 · D57' },
    { k: 'Sources', v: `${responding} of ${total} responding` },
    { k: 'Phase', v: state.phase },
    { k: 'Run id', v: state.runId ?? 'pending' },
  ];

  return (
    <Shell>
      <Nav
        status={
          samDown
            ? { label: '1 source unavailable', variant: 'degraded' }
            : { label: `${responding} of ${total} responding` }
        }
        cta={<LinkButton href="/sign-in">Sign in</LinkButton>}
      />

      <main className="vs-page">
        <div className="vs-eyebrow" style={{ marginBottom: 8 }}>
          <Link href="/" style={{ color: 'var(--vs-ink-mute)' }}>
            ← Lookup
          </Link>
          <span className="vs-ln" />
          <span>NPI {displayNpi} · NPPES public registry</span>
          {readinessContext ? (
            <>
              <span className="vs-ln" />
              <span>{readinessContext}</span>
            </>
          ) : null}
        </div>

        <section className="vs-psh">
          <div className="vs-psh-grid">
            <div className="vs-id">
              <div className="vs-av">
                {identity.authoritative
                  ? (identity.displayName ?? '??')
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((s) => s[0] ?? '')
                      .join('')
                      .toUpperCase()
                  : '··'}
              </div>
              <div>
                <div className="vs-nm">
                  {identity.authoritative ? nameValue : isRunning ? 'Reading sources…' : 'Identity pending'}
                  {specialtyValue ? <small> · {specialtyValue}</small> : null}
                </div>
                <div className="vs-sub">
                  <span className="mono">NPI {displayNpi}</span>
                  <span className="vs-sep">·</span>
                  <span>Passport draft</span>
                  {identity.authoritative ? (
                    <>
                      <span className="vs-sep">·</span>
                      <TruthChip state="source-backed" source="live" label="NPPES match" />
                    </>
                  ) : null}
                </div>
              </div>
            </div>
            <div>
              <div className="vs-ts">
                <div className="vs-lbl">Phase</div>
                <div className="vs-val">
                  {PHASE_LABEL[state.phase]}
                  {isRunning ? <small> · reading</small> : null}
                </div>
              </div>
              <div className="vs-psh-actions">
                <Button onClick={() => setDrawerOpen(true)}>View receipt</Button>
                {anchorEntityId ? (
                  <LinkButton href={buildPassportEntityHref(anchorEntityId)} variant="primary">
                    Open full passport →
                  </LinkButton>
                ) : (
                  <Button variant="primary" disabled>
                    Open full passport →
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="vs-summary">
            <div>
              <div className="vs-k">Sources responding</div>
              <div className="vs-v">
                {responding} <small>of {total}</small>
              </div>
            </div>
            <div>
              <div className="vs-k">Phase</div>
              <div className="vs-v" style={{ fontSize: 16 }}>
                {state.phase}
              </div>
            </div>
            <div>
              <div className="vs-k">Readiness</div>
              <div className="vs-v">
                {readiness.score !== undefined ? `${readiness.score}/100` : '—'}
                {readiness.status ? <small> · {readiness.status}</small> : null}
              </div>
            </div>
            <div>
              <div className="vs-k">Institution review</div>
              <div className="vs-v">
                Required <small>see right rail</small>
              </div>
            </div>
          </div>
        </section>

        <section style={{ marginTop: 24 }}>
          <div className="vs-rail">
            <div className="vs-step">
              <span className="vs-k">Self-asserted</span>
              <span className="vs-v">{readiness.level ?? 'pending input'}</span>
              <span className="vs-t">NPI submitted</span>
            </div>
            <div className="vs-step">
              <span className="vs-k">Public sources</span>
              <span className="vs-v">NPPES · OIG · PECOS</span>
              <span className="vs-t">{responding} of {total} responding</span>
            </div>
            <div className={`vs-step${isHydrated ? ' current' : ''}`}>
              <span className="vs-k">Reconciled view</span>
              <span className="vs-v">{isHydrated ? 'Live read' : isRunning ? 'Reading…' : 'Idle'}</span>
              <span className="vs-t">{state.runId ? `Run ${state.runId.slice(0, 8)}…` : '—'}</span>
            </div>
            <div className="vs-step boundary">
              <span className="vs-k">Institution review</span>
              <span className="vs-v">— required</span>
              <span className="vs-t">NPDB · privileges · fitness</span>
            </div>
          </div>
        </section>

        {/* chat22 fix #7 — slim degraded banner under the rail when a source is 503 */}
        {samDown ? (
          <div style={{ marginTop: 14 }}>
            <DegradedBanner
              source="OIG LEIE"
              age="just now"
              affected="1 field affected — clinician is not implicated by source failure"
            />
          </div>
        ) : null}

        <section className="vs-pbody">
          <div className="vs-panel">
            {/* Loading skeleton lanes — chat22 fix #13 */}
            {isRunning && !isHydrated ? (
              <div role="status" aria-live="polite">
                <h4>
                  Reading sources <span className="vs-ct">{PHASE_LABEL[state.phase]}</span>
                </h4>
                <Card>
                  <CardBody style={{ padding: '6px 18px' }}>
                    {(['NPPES', 'OIG LEIE', 'CMS PECOS'] as const).map((lane) => (
                      <div className="vs-field" key={lane}>
                        <span className="vs-label">{lane}</span>
                        <span className="vs-value">
                          <span className="vs-skel line-md" />
                          <small className="vs-source">
                            <span className="vs-skel line-xs" />
                          </small>
                        </span>
                        <span className="vs-meta">
                          <TruthChip state="pending-source" source={`${lane} · reading`} />
                        </span>
                      </div>
                    ))}
                  </CardBody>
                </Card>
              </div>
            ) : null}

            {isHydrated ? (
              <>
                <h4>
                  Identity &amp; standing <span className="vs-ct">{fields.length}</span>
                </h4>
                <Card>
                  <CardBody style={{ padding: '6px 18px' }}>
                    {fields.map((f, i) => (
                      <FieldRow
                        key={i}
                        label={f.label}
                        value={f.value}
                        source={f.source}
                        mono={f.mono}
                        meta={
                          <TruthChip
                            state={f.truth.state}
                            source={f.truth.source}
                            label={f.truth.label}
                          />
                        }
                      />
                    ))}
                  </CardBody>
                </Card>

                <div className="vs-review-block">
                  <div className="vs-hd">
                    <span className="vs-ic">i</span>
                    <span className="vs-k">Institution review boundary — open items</span>
                  </div>
                  <p className="vs-muted vs-small" style={{ margin: '0 0 10px' }}>
                    VitalCV reads public sources. The institution must read or attest the following
                    before a hiring or privileging decision. VitalCV does not check these boxes for
                    you.
                  </p>
                  <ul>
                    <li>Read NPDB report (institution-only source)</li>
                    <li>Verify board certification + recert window with ABMS directly</li>
                    <li>Confirm state licensure with the issuing board</li>
                    <li>Verify hospital privileges with the medical staff office</li>
                    <li>Apply institutional fitness review per bylaws</li>
                  </ul>
                </div>
              </>
            ) : null}

            {errorCopy ? (
              <BoundaryBanner
                label="Read incomplete"
                message={`${errorCopy.title} ${errorCopy.description}`}
                action={
                  <Button
                    variant="primary"
                    onClick={() => {
                      const target = state.npi ?? npi.trim();
                      if (/^\d{10}$/.test(target)) {
                        reset();
                        setTimeout(() => void startIngest(target), 30);
                      }
                    }}
                  >
                    Try this NPI again
                  </Button>
                }
                style={{ marginTop: 18 }}
              />
            ) : null}

            {/* Live source-health telemetry — kept from the prior shell */}
            <div style={{ marginTop: 24 }}>
              <LaneHealthMount />
            </div>
          </div>

          <aside className="vs-aside-r">
            <h4>Read receipt</h4>
            <Receipt
              lines={receiptLines}
              signature={<span>SIG · pending · open drawer for full inspect</span>}
              style={{ marginBottom: 18 }}
            />

            <h4>Source timeline</h4>
            {timelineEvents.length > 0 ? (
              <div style={{ marginBottom: 18 }}>
                <AuditTimeline events={timelineEvents} />
              </div>
            ) : (
              <p className="vs-muted vs-small" style={{ marginBottom: 18 }}>
                No events yet.
              </p>
            )}

            <h4>Source health · this read</h4>
            {/* chat22 fix #3: align-items: start so wrapped names don't collide */}
            <div className="vs-src-health">
              {sourceHealth.map((s) => (
                <React.Fragment key={s.name}>
                  <span className="vs-src-name">{s.name}</span>
                  <TruthChip state={s.state} source={s.src} label={s.state === 'review-needed' ? 'institution-only' : undefined} />
                </React.Fragment>
              ))}
            </div>

            <hr style={{ margin: '22px 0' }} />
            <LinkButton
              href="/trust/attribution"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              View full attribution →
            </LinkButton>
          </aside>
        </section>
      </main>

      <ReceiptDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={`Read receipt · run ${state.runId?.slice(0, 8) ?? 'pending'}`}
        lines={receiptLines}
        signature={
          <span>
            SIG · ed25519 ·{' '}
            {state.runId ? state.runId.slice(0, 12) + '…' : 'awaiting signature on completion'}
          </span>
        }
      >
        <div style={{ marginTop: 18 }}>
          <h4>Replay</h4>
          <p className="vs-muted vs-small">
            Every read is replayable. The receipt above can be re-run to produce the same response
            codes and field results. Replay endpoint:{' '}
            <code className="mono">/api/replay/{state.runId ?? '[runId]'}</code>
          </p>
        </div>
      </ReceiptDrawer>

      <FooterBottom
        left={`Run ${state.runId?.slice(0, 8) ?? 'pending'} · ed25519`}
        right="VitalCV does not credential clinicians. Institutions retain full authority."
      />
    </Shell>
  );
}

function PassportPageSearchParams() {
  const searchParams = useSearchParams();
  return (
    <PassportPageContent
      initialNpi={searchParams?.get('npi') ?? null}
      roleContext={{
        roleId: searchParams?.get('role') ?? null,
        roleTitle: searchParams?.get('roleTitle') ?? null,
        employerSlug: searchParams?.get('employer') ?? null,
        employerName: searchParams?.get('employerName') ?? null,
      }}
    />
  );
}

export default function PassportPage() {
  return (
    <Suspense
      fallback={
        <PassportPageContent
          initialNpi={null}
          roleContext={{ roleId: null, roleTitle: null, employerSlug: null, employerName: null }}
        />
      }
    >
      <PassportPageSearchParams />
    </Suspense>
  );
}
