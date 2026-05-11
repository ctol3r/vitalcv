/**
 * TrustStateConsole — institutional dashboard surface.
 *
 * Pure render component. Accepts all data via props; no fetches, no
 * fixtures, no fake certainty. Renders an at-a-glance operational
 * console for one clinician's trust state across:
 *   - Identity (subject + NPI verification state)
 *   - Replay lineage (digest, comprehensiveness, event count)
 *   - Credential issuance (manifest schema + signed state)
 *   - Revocation (status + history count)
 *   - JWKS / signing health
 *   - Audit export continuity
 *
 * Doctrine:
 *   - Monochrome. Trust states encoded via glyph + ink density.
 *   - Monospace for IDs / digests / NPIs. Sans for prose.
 *   - Strong hierarchy: one page heading, panel heads at sizeXl,
 *     row labels at sizeXxs mono uppercase.
 *   - No icons, no charts, no decorative borders.
 *   - Truncation is explicit (digest shows first 16 chars + …).
 */

import * as React from 'react';
import { colors, space, type, radius, trustGlyph, type TrustGlyphState } from '../lib/design-tokens';

export interface TrustStateConsoleProps {
  readonly subject: {
    readonly npi: string | null;
    readonly displayName: string | null;
    readonly entityType: string | null;
  };
  readonly identity: { readonly state: TrustGlyphState; readonly detail: string };
  readonly lineage: {
    readonly state: TrustGlyphState;
    readonly digest: string | null;
    readonly eventCount: number;
    readonly comprehensive: boolean;
  };
  readonly manifest: {
    readonly state: TrustGlyphState;
    readonly schema: string | null;
    readonly signed: boolean;
    readonly kid: string | null;
  };
  readonly revocation: {
    readonly state: TrustGlyphState;
    readonly revoked: boolean;
    readonly historyCount: number;
  };
  readonly jwks: {
    readonly state: TrustGlyphState;
    readonly status: 'ok' | 'not-configured' | 'malformed-env' | 'invalid-jwk';
  };
  readonly exports: {
    readonly state: TrustGlyphState;
    readonly count: number;
    readonly latestDigest: string | null;
  };
}

function truncDigest(d: string | null): string {
  if (!d) return '—';
  if (d.length <= 24) return d;
  return d.slice(0, 16) + '…';
}

function StateBadge({ state }: { state: TrustGlyphState }) {
  const g = trustGlyph[state];
  return (
    <span
      role="img"
      aria-label={g.label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: space['2'],
        color: g.color,
        fontFamily: type.fontMono,
        fontSize: type.sizeXs,
        fontWeight: type.weightMedium,
      }}
    >
      <span aria-hidden="true" style={{ fontSize: '12px', lineHeight: 1 }}>
        {g.glyph}
      </span>
      <span style={{ textTransform: 'uppercase', letterSpacing: type.trackingMono }}>{g.label}</span>
    </span>
  );
}

function Label({ children }: { children: React.ReactNode }) {
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

function Mono({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontFamily: type.fontMono, fontSize: type.sizeSm, color: colors.ink }}>
      {children}
    </span>
  );
}

function Panel({
  title,
  state,
  children,
}: {
  title: string;
  state: TrustGlyphState;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        border: `1px solid ${colors.border}`,
        borderRadius: radius.sharp,
        background: colors.surface,
        padding: space['5'],
      }}
      data-testid={`panel-${title.toLowerCase().replace(/\s+/g, '-')}`}
      data-state={state}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: space['4'],
        }}
      >
        <h2
          style={{
            fontFamily: type.fontSans,
            fontSize: type.sizeLg,
            fontWeight: type.weightSemibold,
            letterSpacing: type.trackingTight,
            color: colors.ink,
            margin: 0,
          }}
        >
          {title}
        </h2>
        <StateBadge state={state} />
      </header>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: space['2'] }}>
        {children}
      </div>
    </section>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '160px 1fr',
        gap: space['4'],
        alignItems: 'baseline',
        fontSize: type.sizeSm,
        lineHeight: type.leadingBody,
      }}
    >
      <Label>{k}</Label>
      <span style={{ color: colors.ink }}>{v}</span>
    </div>
  );
}

export function TrustStateConsole(props: TrustStateConsoleProps): React.ReactElement {
  return (
    <main
      style={{
        background: colors.bg,
        color: colors.ink,
        fontFamily: type.fontSans,
        minHeight: '100vh',
        padding: `${space['6']} ${space['5']}`,
      }}
      data-testid="trust-state-console"
    >
      <header style={{ maxWidth: '960px', margin: '0 auto', marginBottom: space['6'] }}>
        <div style={{ marginBottom: space['2'] }}>
          <Label>Clinician Trust State</Label>
        </div>
        <h1
          style={{
            fontFamily: type.fontSans,
            fontSize: type.size2xl,
            fontWeight: type.weightSemibold,
            letterSpacing: type.trackingTight,
            margin: 0,
          }}
        >
          {props.subject.displayName ?? 'Unknown subject'}
        </h1>
        <div
          style={{
            marginTop: space['2'],
            display: 'flex',
            gap: space['5'],
            color: colors.inkSub,
            fontSize: type.sizeSm,
          }}
        >
          <span>
            <Label>NPI</Label>{' '}
            <Mono>{props.subject.npi ?? '—'}</Mono>
          </span>
          <span>
            <Label>Type</Label>{' '}
            <Mono>{props.subject.entityType ?? '—'}</Mono>
          </span>
        </div>
      </header>

      <div
        style={{
          maxWidth: '960px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
          gap: space['4'],
        }}
      >
        <Panel title="Identity" state={props.identity.state}>
          <Row k="State" v={props.identity.detail} />
        </Panel>

        <Panel title="Replay lineage" state={props.lineage.state}>
          <Row k="Event digest" v={<Mono>{truncDigest(props.lineage.digest)}</Mono>} />
          <Row k="Events recorded" v={<Mono>{props.lineage.eventCount}</Mono>} />
          <Row
            k="Coverage"
            v={props.lineage.comprehensive ? 'Comprehensive' : 'Partial (gaps recorded)'}
          />
        </Panel>

        <Panel title="Credential manifest" state={props.manifest.state}>
          <Row k="Schema" v={<Mono>{props.manifest.schema ?? '—'}</Mono>} />
          <Row
            k="Signed"
            v={props.manifest.signed ? 'Source-backed signature' : 'Unsigned (digest only)'}
          />
          <Row k="kid" v={<Mono>{props.manifest.kid ?? '—'}</Mono>} />
        </Panel>

        <Panel title="Revocation" state={props.revocation.state}>
          <Row
            k="State"
            v={props.revocation.revoked ? 'Revoked (history-locked)' : 'Active'}
          />
          <Row k="History entries" v={<Mono>{props.revocation.historyCount}</Mono>} />
        </Panel>

        <Panel title="JWKS / signing" state={props.jwks.state}>
          <Row k="Endpoint state" v={<Mono>{props.jwks.status}</Mono>} />
        </Panel>

        <Panel title="Audit exports" state={props.exports.state}>
          <Row k="Total issued" v={<Mono>{props.exports.count}</Mono>} />
          <Row k="Latest digest" v={<Mono>{truncDigest(props.exports.latestDigest)}</Mono>} />
        </Panel>
      </div>
    </main>
  );
}
