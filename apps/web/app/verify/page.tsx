/**
 * /verify — Verifier inspectability surface (Wave 9 partial).
 *
 * A hospital verifier or independent auditor lands here with an NPI in
 * hand (typically as `?npi=1346053246`) and gets a single page that
 * exposes every trust-bearing field the backend knows about, in the
 * canonical institutional order: OBJECT → OWNERSHIP → CHECKED_AT →
 * CHANNEL → REPLAY → RUN_ID.
 *
 * Composition:
 *  - <TrustHeader>          institutional reading order
 *  - <TrustStateBand>       decision-readiness band (GREEN/YELLOW/RED)
 *  - <TierBadge>            per-credential T1–T4 tier
 *  - <CheckedAtStamp>       per-source freshness
 *  - <DegradedStateBanner>  for any source not in `checked` state
 *  - <ReplayLineage>        replay continuity (with current-snapshot
 *                            entry; prior-check enumeration is Wave 6
 *                            scope)
 *  - <IssuerAttribution>    when trustContainer manifest is present
 *
 * Data source: the entity-shape backend endpoint that already exists
 * (`/api/passport/npi/:npi`). No new backend endpoint is introduced
 * here; this page is purely an inspector layout over the existing
 * canonical PassportData contract.
 *
 * Server component — fetches at request time, no client hydration
 * needed for the read-only inspector view. An NPI input form is
 * provided as a small client island for verifier navigation.
 */
import type { Metadata } from 'next';
import { BACKEND_URL } from '@/lib/backend-url';
import { assertPassportData } from '@/lib/trust/passport-contract';
import type { PassportData } from '@/lib/trust/passport-contract';
import {
  CheckedAtStamp,
  DegradedStateBanner,
  IssuerAttribution,
  type DegradedStateCode,
  ReplayLineage,
  RunIdentity,
  TierBadge,
  TrustHeader,
  TrustStateBand,
  type TrustStateBandValue,
} from '@/components/trust';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const metadata: Metadata = {
  title: 'Verify · VitalCV',
  description: 'Independent trust inspection for a clinician passport.',
};

async function fetchPassport(npi: string): Promise<{ ok: true; passport: PassportData } | { ok: false; status: number; error: string }> {
  if (!/^\d{10}$/.test(npi)) {
    return { ok: false, status: 400, error: 'NPI must be a 10-digit string.' };
  }

  const url = `${BACKEND_URL}/api/passport/npi/${encodeURIComponent(npi)}`;
  let res: Response;
  try {
    res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
  } catch (err) {
    return { ok: false, status: 503, error: `Upstream unreachable: ${String(err)}` };
  }

  if (!res.ok) {
    return { ok: false, status: res.status, error: `Backend returned ${res.status}.` };
  }

  const payload = await res.json().catch(() => null);
  let passport: PassportData;
  try {
    passport = assertPassportData(payload);
  } catch (err) {
    return { ok: false, status: 502, error: `Invalid upstream payload: ${String(err)}` };
  }
  return { ok: true, passport };
}

function mapBandToCanonical(band: string): TrustStateBandValue {
  const upper = band.toUpperCase();
  if (upper === 'GREEN' || upper === 'YELLOW' || upper === 'RED') return upper;
  return 'UNKNOWN';
}

function mapVerificationLevelToTier(level: string | undefined): 'T1' | 'T2' | 'T3' | 'T4' {
  const v = (level ?? '').toUpperCase();
  if (v === 'CRYPTOGRAPHIC' || v === 'SIGNED' || v === 'PSV_SIGNED') return 'T4';
  if (v === 'PRIMARY_SOURCE' || v === 'SOURCE_VERIFIED' || v === 'PSV') return 'T3';
  if (v === 'INFERRED' || v === 'CROSS_CHECKED') return 'T2';
  return 'T1';
}

function inferDegradedCode(state: string, sourceId: string): DegradedStateCode | null {
  const s = state.toLowerCase();
  if (s === 'checked') return null; // no banner needed
  if (s === 'unavailable') return 'A';
  if (s === 'gated' || s === 'accessrequired' || s === 'access_required') return 'B';
  if (s === 'pending' || s === 'reviewrequired' || s === 'review_required') return 'B';
  if (s === 'notdecisiongrade' || s === 'not_decision_grade') return 'B';
  // No specific upstream code → fall through. Issuer-related sources flagged as E.
  if (sourceId.toLowerCase().includes('issuer')) return 'E';
  return null;
}

interface VerifyPageProps {
  searchParams: Promise<{ npi?: string }>;
}

export default async function VerifyPage({ searchParams }: VerifyPageProps) {
  const params = await searchParams;
  const npi = (params.npi ?? '').trim();

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 space-y-6">
      <header className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          VitalCV · verify
        </p>
        <h1 className="text-2xl font-semibold leading-tight">Trust inspection</h1>
        <p className="text-sm text-muted-foreground max-w-xl">
          Inspect the trust posture for a clinician&apos;s NPI. Renders the
          canonical institutional reading order — object, ownership,
          checked_at, channel, replay, run_id — using the same canonical
          primitives the passport surface uses, with every field
          rendered visibly (no aria-only, no tooltip-only).
        </p>
      </header>

      <form method="get" action="/verify" className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-4 py-3">
        <label className="font-mono text-xs uppercase tracking-wide text-muted-foreground" htmlFor="verify-npi">
          npi
        </label>
        <input
          id="verify-npi"
          name="npi"
          defaultValue={npi}
          pattern="\d{10}"
          inputMode="numeric"
          placeholder="1346053246"
          className="font-mono text-sm border border-border rounded-md px-3 py-1.5 bg-background w-44"
        />
        <button type="submit" className="font-mono text-xs uppercase tracking-wide rounded-md border border-border bg-background px-3 py-1.5 hover:bg-muted">
          Inspect
        </button>
      </form>

      {!npi && (
        <p className="text-sm text-muted-foreground italic">
          Enter a 10-digit NPI above to inspect its passport.
        </p>
      )}

      {npi && <VerifyResult npi={npi} />}
    </main>
  );
}

async function VerifyResult({ npi }: { npi: string }) {
  const result = await fetchPassport(npi);

  if (!result.ok) {
    return (
      <DegradedStateBanner
        code={result.status >= 500 ? 'C' : 'A'}
        sourceId="passport"
        recoveryAction={`Retry · status=${result.status}`}
      />
    );
  }

  const { passport } = result;
  const channel = passport.sources?.checked?.[0] ?? 'unknown';
  // Wave 10 (#343) will surface canonical `replay.runId` / `replay.lineageKey`
  // on PassportData; until that lands and this branch rebases on top of it,
  // the verifier sees the entity id as a stable stand-in. The structured
  // ids are visible the moment the upstream contract carries them.
  const replayIdentity = (passport as PassportData & {
    replay?: { runId: string; lineageKey: string; schemeVersion: 'v1' };
  }).replay;
  const runId = replayIdentity?.runId ?? passport.entityId;
  const lineageKey = replayIdentity?.lineageKey ?? passport.entityId;
  const trustBand = mapBandToCanonical(passport.trustPosture.band);

  const degradedRows = passport.sourceCoverage.checks
    .map((check) => ({ check, code: inferDegradedCode(check.state, check.sourceId) }))
    .filter((row): row is { check: typeof row.check; code: DegradedStateCode } => row.code !== null);

  // Replay lineage with a single current-snapshot entry. Prior-check
  // enumeration from history is Wave 6 scope — the primitive renders
  // correctly with `priorChecks: []` until that's available.
  const currentCheckedAt = passport.lastCheckedAt;

  return (
    <section className="space-y-6">
      <TrustHeader
        variant="SNAPSHOT"
        object={{
          id: passport.identity.npi ?? passport.entityId,
          label: passport.identity.displayName,
          kind: passport.identity.entityType.toLowerCase(),
        }}
        ownership={{ state: 'UNCLAIMED', claimant: passport.identity.displayName }}
        checkedAt={currentCheckedAt}
        channel={channel}
        replay={{
          lineageKey,
          priorChecks: [
            { runId, checkedAt: currentCheckedAt, sourceId: channel },
          ],
          replayCount: 1,
        }}
        runId={runId}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TrustStateBand band={trustBand} />
        <div className="flex flex-col gap-1 rounded-lg border border-border px-3 py-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">readiness</span>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-xl">{passport.readiness.score}</span>
            <span className="font-mono text-xs uppercase opacity-70">{passport.readiness.level}</span>
            <span className="font-mono text-xs opacity-60">/{passport.readiness.status}</span>
          </div>
          {passport.readiness.blockers.length > 0 && (
            <ul className="text-[11px] text-rose-700 dark:text-rose-300 list-disc list-inside">
              {passport.readiness.blockers.slice(0, 3).map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <section className="space-y-2" aria-label="Credentials">
        <h2 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">credentials</h2>
        {passport.authority.credentials.length === 0 && (
          <p className="text-sm italic opacity-70">No credentials surfaced.</p>
        )}
        <ul className="space-y-2">
          {passport.authority.credentials.map((cred) => (
            <li
              key={cred.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-3 py-2"
              data-credential-id={cred.id}
            >
              <TierBadge tier={mapVerificationLevelToTier(cred.verificationLevel)} size="sm" />
              <div className="flex flex-col">
                <span className="font-semibold text-sm">{cred.type}</span>
                <span className="font-mono text-[11px] opacity-70">{cred.issuerName ?? cred.sourceId ?? 'issuer unknown'}</span>
              </div>
              <span className="ml-auto font-mono text-[11px] uppercase opacity-80">{cred.status}</span>
              <CheckedAtStamp
                checkedAt={cred.verifiedAt ?? cred.observedAt ?? null}
                label="verified"
                format="long"
              />
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2" aria-label="Source coverage">
        <h2 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">source coverage</h2>
        <ul className="space-y-2">
          {passport.sourceCoverage.checks.map((check) => (
            <li
              key={check.sourceId}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-3 py-2"
              data-source-id={check.sourceId}
              data-source-state={check.state}
            >
              <span className="font-mono text-sm uppercase tracking-wide">{check.sourceId}</span>
              <span className="font-mono text-[11px] opacity-70">state · {check.state}</span>
              <span className="ml-auto">
                <CheckedAtStamp
                  checkedAt={check.checkedAt ?? check.observedAt ?? null}
                  label="checked"
                  format="long"
                />
              </span>
            </li>
          ))}
        </ul>
      </section>

      {degradedRows.length > 0 && (
        <section className="space-y-2" aria-label="Degraded continuity">
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">degraded continuity</h2>
          <div className="space-y-2">
            {degradedRows.map(({ check, code }) => (
              <DegradedStateBanner
                key={check.sourceId}
                code={code}
                sourceId={check.sourceId}
                observedAt={check.observedAt ?? check.checkedAt ?? null}
              />
            ))}
          </div>
        </section>
      )}

      {passport.trustContainer && (
        <section className="space-y-2" aria-label="Issuer attribution">
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">issuer attribution</h2>
          {(() => {
            const tc = passport.trustContainer as unknown as Record<string, unknown>;
            const did = typeof tc.issuerDid === 'string' ? tc.issuerDid : null;
            const signer = typeof tc.issuer === 'string' ? tc.issuer : 'VitalCV PSV Issuer';
            const kid = typeof tc.kid === 'string' ? tc.kid : null;
            const receipt = typeof tc.manifestId === 'string' ? tc.manifestId : null;
            return (
              <IssuerAttribution
                did={did}
                signer={signer}
                keyId={kid}
                receiptId={receipt}
                continuity="ACTIVE"
                lastCheckedAt={currentCheckedAt}
              />
            );
          })()}
        </section>
      )}

      <section className="space-y-2" aria-label="Replay continuity">
        <h2 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">replay continuity</h2>
        <ReplayLineage
          lineageKey={lineageKey}
          priorChecks={[{ runId, checkedAt: currentCheckedAt, sourceId: channel }]}
          replayCount={1}
        />
      </section>

      <footer className="border-t border-border pt-3 flex flex-wrap items-baseline gap-x-6 gap-y-1 text-xs">
        <RunIdentity runId={runId} label="run_id" />
        <span className="font-mono opacity-70" data-lineage-key={lineageKey}>
          lineage · <span>{lineageKey}</span>
        </span>
        <span className="font-mono opacity-70">
          scheme · {replayIdentity?.schemeVersion ?? 'pending-w10'}
        </span>
      </footer>
    </section>
  );
}
