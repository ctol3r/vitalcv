/**
 * TrustContainerPanel — verifier-facing rendering of the hidden trust
 * container issuance status.
 *
 * Design rules (overclaim-safe):
 *   - Never imply the container replaces primary source verification.
 *   - Never imply a partial proof becomes decision-grade because a
 *     container entry exists.
 *   - Mock/dev containers are always labelled as such.
 *   - Missing metadata renders a neutral fallback, not a claim.
 *   - Guard against unsupported overclaim language.
 */

import * as React from 'react';
import {
  sanitizeTrustContainerDisplayText,
  type TrustContainerIssuanceStatus,
  type TrustContainerManifestView,
  type TrustContainerProofStatus,
  type TrustContainerProofTier,
} from '@/lib/trust/trust-container-view';

export type {
  TrustContainerEnvironment,
  TrustContainerIssuanceStatus,
  TrustContainerManifestView,
  TrustContainerProofStatus,
  TrustContainerProofTier,
  TrustContainerProviderKind,
} from '@/lib/trust/trust-container-view';

export interface TrustContainerPanelProps {
  entry: TrustContainerManifestView | null | undefined;
  className?: string;
  /**
   * If true, show the always-on overclaim-safe copy block even when the
   * entry is missing. Callers that mount this subordinate to a larger
   * proof panel can leave this off so the fallback stays compact.
   */
  verbose?: boolean;
}

const HEADLINE_BY_STATUS: Record<TrustContainerIssuanceStatus, string> = {
  issued: 'Credential container: issued',
  not_issued: 'Credential container: skipped',
  failed: 'Credential container: issuance failed',
};

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  return new Date(ms).toISOString().replace('T', ' ').replace('.000Z', 'Z');
}

function Field({
  label,
  value,
  mono,
  testId,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
  testId?: string;
}) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5" data-testid={testId}>
      <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/40">
        {label}
      </span>
      <span
        className={
          mono
            ? 'font-mono text-[11px] text-foreground/70 break-all'
            : 'text-sm text-foreground/70'
        }
      >
        {value}
      </span>
    </div>
  );
}

function RecordedField({
  label,
  recorded,
  testId,
}: {
  label: string;
  recorded: boolean;
  testId: string;
}) {
  if (!recorded) return null;
  return (
    <div className="flex flex-col gap-0.5" data-testid={testId}>
      <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/40">
        {label}
      </span>
      <span className="text-sm text-foreground/70">Recorded in manifest</span>
    </div>
  );
}

function downgradeWhenLimited<T extends TrustContainerProofTier | TrustContainerProofStatus>(
  value: T | null,
  hasLimitations: boolean,
): T | 'PARTIAL' | null {
  if (!value) return null;
  if (hasLimitations && value === 'DECISION_GRADE') return 'PARTIAL';
  return value;
}

const OVERCLAIM_SAFE_COPY = [
  'This container records the evidence packet’s credential envelope and artifact hash.',
  'It does not replace primary source verification.',
  'It does not upgrade partial evidence to decision-grade.',
  'Limitations shown here remain controlling.',
] as const;

const MOCK_DEV_NOTE = 'Mock/dev containers are not production credentials.';

export function TrustContainerPanel(props: TrustContainerPanelProps): React.ReactElement {
  const { entry, className, verbose } = props;
  const baseClass =
    'rounded-2xl border border-white/8 bg-white/[0.02] px-5 py-4 text-foreground';
  const rootClass = className ? `${baseClass} ${className}` : baseClass;

  // Missing-metadata fallback. Neutral; does not claim anything.
  if (!entry) {
    return (
      <section
        className={rootClass}
        data-testid="trust-container-panel"
        data-state="missing"
        aria-label="Credential container status"
      >
        <h3 className="text-sm font-semibold text-foreground/80">
          Credential container: not available
        </h3>
        <p className="mt-2 text-sm text-foreground/50">
          No trust-container metadata was attached to this review. Primary source
          verification remains the authoritative evidence.
        </p>
        {verbose ? <OverclaimSafeCopy /> : null}
      </section>
    );
  }

  const isMockDev = entry.mock === true || entry.environment === 'mock-dev';
  const hasLimitations = entry.limitationNotes.length > 0;
  const proofTier = downgradeWhenLimited(entry.proofTier, hasLimitations);
  const proofStatus = downgradeWhenLimited(entry.proofStatus, hasLimitations);
  const skipReason = entry.skipReason
    ? sanitizeTrustContainerDisplayText(entry.skipReason)
    : null;
  const limitationNotes = entry.limitationNotes.map(sanitizeTrustContainerDisplayText);

  return (
    <section
      className={rootClass}
      data-testid="trust-container-panel"
      data-state={entry.status}
      data-mock={isMockDev ? 'true' : 'false'}
      aria-label="Credential container status"
    >
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-foreground/80">{HEADLINE_BY_STATUS[entry.status]}</h3>
        {isMockDev ? (
          <p
            className="text-[11px] uppercase tracking-[0.18em] text-amber-200/70"
            data-testid="trust-container-mock-label"
          >
            Mock/dev credential container
          </p>
        ) : entry.environment === 'vitalcv-signed' ? (
          <p
            className="text-[11px] uppercase tracking-[0.18em] text-foreground/60"
            data-testid="trust-container-signed-label"
          >
            {sanitizeTrustContainerDisplayText(entry.label)}
          </p>
        ) : null}
      </div>

      {skipReason ? (
        <p
          className="mt-2 text-sm text-foreground/60"
          data-testid="trust-container-skip-reason"
        >
          {skipReason}
        </p>
      ) : null}

      {entry.status === 'issued' ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Field
            label="Provider"
            value={entry.provider ?? null}
            testId="trust-container-provider"
          />
          <Field
            label="Environment"
            value={entry.environment ?? null}
            testId="trust-container-environment"
          />
          <Field
            label="Proof tier"
            value={proofTier}
            testId="trust-container-proof-tier"
          />
          <Field
            label="Proof status"
            value={proofStatus}
            testId="trust-container-proof-status"
          />
          <Field
            label="Issued at"
            value={formatDate(entry.issuedAt)}
            testId="trust-container-issued-at"
          />
          <Field
            label="Schema version"
            value={entry.schemaVersion || null}
            testId="trust-container-schema-version"
          />
          <RecordedField
            label="Container reference"
            recorded={Boolean(entry.trustContainerId)}
            testId="trust-container-id"
          />
          <RecordedField
            label="Credential envelope"
            recorded={Boolean(entry.credentialEnvelopeId)}
            testId="trust-container-envelope-id"
          />
          <RecordedField
            label="Artifact binding"
            recorded={Boolean(entry.artifactHash)}
            testId="trust-container-artifact-hash"
          />
          <RecordedField
            label="Audit binding"
            recorded={Boolean(entry.auditHash)}
            testId="trust-container-audit-hash"
          />
        </div>
      ) : null}

      {limitationNotes.length > 0 ? (
        <div className="mt-4" data-testid="trust-container-limitations">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/40">
            Limitations
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-foreground/70">
            {limitationNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <OverclaimSafeCopy includeMockNote={isMockDev} />
    </section>
  );
}

function OverclaimSafeCopy({
  includeMockNote = false,
}: {
  includeMockNote?: boolean;
}): React.ReactElement {
  return (
    <ul
      className="mt-4 space-y-1 text-[12px] text-foreground/50"
      data-testid="trust-container-disclaimers"
    >
      {OVERCLAIM_SAFE_COPY.map((line) => (
        <li key={line}>{line}</li>
      ))}
      {includeMockNote ? <li key="mock">{MOCK_DEV_NOTE}</li> : null}
    </ul>
  );
}

export default TrustContainerPanel;
