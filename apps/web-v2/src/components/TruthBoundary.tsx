/**
 * TruthBoundary — single institutional truth surface.
 *
 * Compliance-officer-facing page. Target: a hospital compliance
 * officer understands the trust boundary in under 10 seconds.
 *
 * Doctrine (inherits #323 tokens):
 *   - Monochrome, infrastructure-grade typography.
 *   - One-line-per-fact density.
 *   - Explicit lists: VERIFIED / NOT VERIFIED / OPERATIONAL STATE /
 *     LIMITATIONS / STATE MATRIX.
 *   - No marketing copy. No hedging language. Every claim is a
 *     verbatim fact about the system as built, NOT aspirational.
 *
 * If you find yourself adding marketing prose, soft language
 * ("typically", "usually", "in most cases"), or a single hedged
 * claim, you're off-doctrine. Compliance officers reading this surface
 * are evaluating a contract; ambiguity here is a deal-breaker.
 */

import * as React from 'react';
import { colors, space, type, trustGlyph, type TrustGlyphState } from '../lib/design-tokens';

/**
 * 7-state verification matrix per the brief. Maps to the underlying
 * trust glyph palette (still 4 visual states; the 7 below are
 * semantic refinements that share visual treatment).
 */
export const VERIFICATION_STATES = [
  {
    id: 'verified',
    label: 'Source-verified',
    glyph: 'ok',
    meaning:
      'Checked against a federal or state authority of record at the time shown. Source response was machine-parseable and unambiguous.',
  },
  {
    id: 'source-linked',
    label: 'Source-linked',
    glyph: 'ok',
    meaning:
      'Identifier resolved to a public source record but the underlying claim is not source-checked. Use as identity binding, NOT as verification of the claim itself.',
  },
  {
    id: 'self-attested',
    label: 'Self-attested',
    glyph: 'ambiguous',
    meaning:
      'Provided by the clinician or an authorized actor. Not source-checked. Treat as unverified evidence until cross-referenced.',
  },
  {
    id: 'unavailable',
    label: 'Unavailable',
    glyph: 'failed',
    meaning:
      'No source check was attempted because the source is not yet integrated, or because the source returned no record. The absence of a record is NOT a clean signal.',
  },
  {
    id: 'revoked',
    label: 'Revoked',
    glyph: 'failed',
    meaning:
      'The source authority has explicitly revoked this credential. History is append-only (see Revocation panel).',
  },
  {
    id: 'expired',
    label: 'Expired',
    glyph: 'ambiguous',
    meaning:
      'The credential was source-verified at issue but its validity window has elapsed. Re-verification required before reliance.',
  },
  {
    id: 'degraded-state',
    label: 'Degraded — source unreachable',
    glyph: 'ambiguous',
    meaning:
      'Last known state is shown but the source authority was unreachable on the most recent check. Treat as last-known-good; re-verify before reliance.',
  },
] as const;

export interface TruthBoundaryProps {
  /**
   * What VitalCV actively verifies today. Each entry must reference a
   * real source authority — no aspirational entries. Order matters:
   * highest-confidence first.
   */
  readonly verified: readonly { readonly claim: string; readonly source: string }[];

  /**
   * What VitalCV does NOT verify. Explicit list of categories the
   * compliance officer should NOT assume coverage on. Each entry
   * states the gap and the reason for the gap.
   */
  readonly notVerified: readonly {
    readonly claim: string;
    readonly reason: string;
    readonly state: 'unavailable' | 'self-attested' | 'gated';
  }[];

  /**
   * Live operational state. Same panel discipline as TrustStateConsole
   * (#323). Compliance officer reads this to know which systems are
   * currently degraded.
   */
  readonly operationalState: {
    readonly replayLineage: { readonly state: TrustGlyphState; readonly detail: string };
    readonly revocation: { readonly state: TrustGlyphState; readonly detail: string };
    readonly jwks: { readonly state: TrustGlyphState; readonly detail: string };
    readonly auditExport: { readonly state: TrustGlyphState; readonly detail: string };
  };

  /**
   * Known operational limitations. Each entry is a known gap (NOT a
   * temporary outage). Sourced from the doctrine docs — see
   * docs/ops/{passport,crypto,credential-status}-stack-audit.md.
   */
  readonly limitations: readonly string[];
}

function MonoLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontFamily: type.fontMono,
        fontSize: type.sizeXxs,
        textTransform: 'uppercase',
        letterSpacing: type.trackingMono,
        color: colors.inkMuted,
      }}
    >
      {children}
    </span>
  );
}

function SectionHead({ kicker, title }: { kicker: string; title: string }) {
  return (
    <header style={{ marginBottom: space['4'] }}>
      <div style={{ marginBottom: space['1'] }}>
        <MonoLabel>{kicker}</MonoLabel>
      </div>
      <h2
        style={{
          fontFamily: type.fontSans,
          fontSize: type.sizeLg,
          fontWeight: type.weightSemibold,
          letterSpacing: type.trackingTight,
          margin: 0,
          color: colors.ink,
        }}
      >
        {title}
      </h2>
    </header>
  );
}

function Glyph({ state }: { state: TrustGlyphState }) {
  const g = trustGlyph[state];
  return (
    <span
      role="img"
      aria-label={g.label}
      style={{
        fontFamily: type.fontMono,
        fontSize: '12px',
        color: g.color,
        flexShrink: 0,
        width: '14px',
        display: 'inline-block',
      }}
    >
      {g.glyph}
    </span>
  );
}

function FactRow({
  state,
  primary,
  secondary,
}: {
  state: TrustGlyphState;
  primary: string;
  secondary: string;
}) {
  return (
    <li
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        gap: space['3'],
        padding: `${space['2']} 0`,
        borderBottom: `1px solid ${colors.surfaceSub}`,
        alignItems: 'baseline',
      }}
    >
      <Glyph state={state} />
      <div>
        <div style={{ color: colors.ink, fontSize: type.sizeSm, lineHeight: type.leadingBody }}>
          {primary}
        </div>
        <div style={{ color: colors.inkMuted, fontSize: type.sizeXs, marginTop: space['1'] }}>
          {secondary}
        </div>
      </div>
    </li>
  );
}

const NOT_VERIFIED_STATE_MAP: Record<
  'unavailable' | 'self-attested' | 'gated',
  TrustGlyphState
> = {
  unavailable: 'failed',
  'self-attested': 'ambiguous',
  gated: 'ambiguous',
};

export function TruthBoundary(props: TruthBoundaryProps): React.ReactElement {
  return (
    <main
      data-testid="truth-boundary"
      style={{
        background: colors.bg,
        color: colors.ink,
        fontFamily: type.fontSans,
        minHeight: '100vh',
        padding: `${space['6']} ${space['5']}`,
      }}
    >
      {/* Lede — the 10-second comprehension target lives here. */}
      <header style={{ maxWidth: '800px', margin: '0 auto', marginBottom: space['7'] }}>
        <div style={{ marginBottom: space['2'] }}>
          <MonoLabel>Trust boundary</MonoLabel>
        </div>
        <h1
          style={{
            fontFamily: type.fontSans,
            fontSize: type.size2xl,
            fontWeight: type.weightSemibold,
            letterSpacing: type.trackingTight,
            margin: 0,
            lineHeight: type.leadingTight,
          }}
        >
          What VitalCV verifies — and what it does not.
        </h1>
        <p
          style={{
            marginTop: space['3'],
            color: colors.inkSub,
            fontSize: type.sizeBase,
            lineHeight: type.leadingBody,
            maxWidth: '52ch',
          }}
        >
          This page is the operational contract. Every claim below states what
          the system does today, not what it intends to do. If a claim is
          absent from the "verified" list, treat it as not verified.
        </p>
      </header>

      <div
        style={{
          maxWidth: '800px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: space['7'],
        }}
      >
        {/* ── VERIFIED ─────────────────────────────────────── */}
        <section data-testid="section-verified">
          <SectionHead kicker="What VitalCV verifies" title="Source-verified claims" />
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {props.verified.length === 0 ? (
              <FactRow
                state="failed"
                primary="No source-verified claims to report."
                secondary="VitalCV has not yet completed any source check. Until at least one entry appears here, do not rely on this surface for verification decisions."
              />
            ) : (
              props.verified.map((v) => (
                <FactRow key={v.claim} state="ok" primary={v.claim} secondary={v.source} />
              ))
            )}
          </ul>
        </section>

        {/* ── NOT VERIFIED ─────────────────────────────────── */}
        <section data-testid="section-not-verified">
          <SectionHead
            kicker="What VitalCV does NOT verify"
            title="Out of scope or gated"
          />
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {props.notVerified.map((nv) => (
              <FactRow
                key={nv.claim}
                state={NOT_VERIFIED_STATE_MAP[nv.state]}
                primary={nv.claim}
                secondary={nv.reason}
              />
            ))}
          </ul>
        </section>

        {/* ── OPERATIONAL STATE ────────────────────────────── */}
        <section data-testid="section-operational-state">
          <SectionHead kicker="Operational state" title="Live system posture" />
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            <FactRow
              state={props.operationalState.replayLineage.state}
              primary="Replay lineage"
              secondary={props.operationalState.replayLineage.detail}
            />
            <FactRow
              state={props.operationalState.revocation.state}
              primary="Revocation registry"
              secondary={props.operationalState.revocation.detail}
            />
            <FactRow
              state={props.operationalState.jwks.state}
              primary="JWKS / signing"
              secondary={props.operationalState.jwks.detail}
            />
            <FactRow
              state={props.operationalState.auditExport.state}
              primary="Audit export"
              secondary={props.operationalState.auditExport.detail}
            />
          </ul>
        </section>

        {/* ── LIMITATIONS ──────────────────────────────────── */}
        <section data-testid="section-limitations">
          <SectionHead kicker="Operational limitations" title="Known gaps" />
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {props.limitations.length === 0 ? (
              <FactRow
                state="ambiguous"
                primary="No limitations recorded."
                secondary="The absence of a limitations list does NOT mean the system is complete. Treat as missing-data rather than full-coverage signal."
              />
            ) : (
              props.limitations.map((lim, i) => (
                <FactRow
                  key={i}
                  state="ambiguous"
                  primary={lim}
                  secondary=""
                />
              ))
            )}
          </ul>
        </section>

        {/* ── STATE MATRIX LEGEND ──────────────────────────── */}
        <section data-testid="section-state-matrix">
          <SectionHead
            kicker="Verification state legend"
            title="The 7 trust states"
          />
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {VERIFICATION_STATES.map((s) => (
              <FactRow
                key={s.id}
                state={s.glyph}
                primary={s.label}
                secondary={s.meaning}
              />
            ))}
          </ul>
        </section>

        {/* ── EXPLICIT FOOTER PIN ──────────────────────────── */}
        <footer
          style={{
            paddingTop: space['5'],
            borderTop: `1px solid ${colors.border}`,
            color: colors.inkMuted,
            fontSize: type.sizeXs,
            lineHeight: type.leadingBody,
          }}
          data-testid="truth-boundary-footer"
        >
          <p style={{ margin: 0 }}>
            This surface is generated from real system state at render time.
            If a system is degraded, the corresponding row above shows the
            degraded state — VitalCV never silently substitutes a healthy
            label for a degraded one. To audit the underlying data, follow
            the operational state rows back to the source endpoints
            documented in the verifier quickstart.
          </p>
        </footer>
      </div>
    </main>
  );
}
