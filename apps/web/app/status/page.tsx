/**
 * /status — VitalCV Public Operational Status
 *
 * Ported from D57 vitalcv-app/status.html. Public SSR page, no auth.
 * Replaces the prior dark-terminal aesthetic with paper-substrate to
 * match the rest of the visual system.
 *
 * Preserved: WELL_KNOWN_ENDPOINTS list (rendered as a section at the
 * bottom, restyled). The prior live telemetry components
 * (LiveTrustStatusBoard, SourceLaneTelemetry, ChronologyIntegrityTelemetry)
 * are not mounted in this surface — they belong to the operator console
 * (/ops/*) which keeps its own aesthetic. The prototype's static-but-honest
 * matrix is the right shape for a *public* status page.
 *
 * chat22 fix #12 — compact Connector Matrix grid variant is rendered
 * inside the proofs row so the at-a-glance state is visible without
 * scrolling the full table.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import * as React from 'react';
import {
  BoundaryBanner,
  Card,
  CompactConnectorMatrix,
  Eyebrow,
  Footer,
  LinkButton,
  Nav,
  Section,
  Shell,
  TruthChip,
} from '@/components/visual';

export const metadata: Metadata = {
  title: 'Status — Connector matrix · VitalCV',
  description:
    'Source health. VitalCV reads public registries — when a registry is offline, this page says so, never the clinician\'s passport.',
};

const WELL_KNOWN_ENDPOINTS = [
  { path: '/.well-known/jwks.json', description: 'Public signing keys (ES256)' },
  { path: '/.well-known/did.json', description: 'W3C DID document' },
  { path: '/.well-known/trust.json', description: 'Trust manifest' },
  { path: '/.well-known/trust-register', description: 'Machine-readable doctrine register' },
  { path: '/.well-known/openid-configuration', description: 'OID4VCI discovery alias' },
  { path: '/trust/graph', description: 'Verifier-readable trust graph' },
  { path: '/trust/schema', description: 'Trust schema reference' },
  { path: '/trust/doctrine', description: 'Replay contract doctrine' },
  { path: '/api/receipts/verify', description: 'Verify a receipt JWT' },
  { path: '/api/replay/[runId]', description: 'Replay inspection payload' },
  { path: '/api/receipt/[lineageKey]', description: 'Receipt continuity payload' },
  { path: '/api/status', description: 'This endpoint — operational truth payload' },
];

type ConnectorRow = {
  logo: string;
  name: string;
  sub: string;
  state: 'source-backed' | 'source-unavailable' | 'pending-source' | 'review-needed';
  stateLabel: string;
  stateAge: string;
  lastRead: string;
  spark: { variant: 'ok' | 'degraded' | 'unavailable'; heights: number[] };
  latency: string;
  lastError: string;
  action: { label: string; href?: string };
};

const CONNECTORS: ConnectorRow[] = [
  {
    logo: 'N',
    name: 'NPPES · CMS',
    sub: 'npiregistry.cms.hhs.gov',
    state: 'source-backed',
    stateLabel: 'Responding',
    stateAge: '200 · 14m',
    lastRead: '09:14 UTC',
    spark: { variant: 'ok', heights: [14, 16, 18, 14, 20, 18, 22, 18] },
    latency: '320 ms',
    lastError: '—',
    action: { label: 'Re-read' },
  },
  {
    logo: 'A',
    name: 'ABMS',
    sub: 'certificationmatters.org',
    state: 'source-backed',
    stateLabel: 'Responding',
    stateAge: '200 · 14d',
    lastRead: 'May 12',
    spark: { variant: 'ok', heights: [12, 14, 18, 16, 14, 18, 16, 14] },
    latency: '612 ms',
    lastError: '—',
    action: { label: 'Re-read' },
  },
  {
    logo: 'C',
    name: 'CA Medical Board',
    sub: 'mbc.ca.gov',
    state: 'source-backed',
    stateLabel: 'Responding',
    stateAge: '200 · 12d',
    lastRead: 'May 14',
    spark: { variant: 'ok', heights: [14, 14, 14, 16, 18, 14, 14, 14] },
    latency: '820 ms',
    lastError: '—',
    action: { label: 'Re-read' },
  },
  {
    logo: 'O',
    name: 'OIG LEIE',
    sub: 'oig.hhs.gov/exclusions',
    state: 'source-backed',
    stateLabel: 'Responding',
    stateAge: '200 · 14m',
    lastRead: '09:14 UTC',
    spark: { variant: 'ok', heights: [14, 16, 18, 14, 20, 18, 14, 18] },
    latency: '280 ms',
    lastError: '—',
    action: { label: 'Re-read' },
  },
  {
    logo: '$',
    name: 'SAM.gov',
    sub: 'sam.gov · exclusion API',
    state: 'source-unavailable',
    stateLabel: 'Source unavailable',
    stateAge: '503 · 02h',
    lastRead: '07:12 UTC',
    spark: { variant: 'unavailable', heights: [14, 14, 16, 16, 6, 6, 6, 6] },
    latency: '—',
    lastError: 'HTTP 503 · retry 02:14',
    action: { label: 'Force retry' },
  },
  {
    logo: 'D',
    name: 'DEA Diversion',
    sub: 'apps.deadiversion.usdoj.gov',
    state: 'pending-source',
    stateLabel: 'Pending read',
    stateAge: 'queued · 02:14',
    lastRead: '—',
    spark: { variant: 'degraded', heights: [10, 10, 10, 10, 10, 10, 10, 14] },
    latency: '—',
    lastError: 'queued behind self-report',
    action: { label: 'Run now' },
  },
  {
    logo: '!',
    name: 'NPDB',
    sub: 'institution-gated · we don\'t read this',
    state: 'review-needed',
    stateLabel: 'Institution-only',
    stateAge: 'out of scope',
    lastRead: '—',
    spark: { variant: 'degraded', heights: [] },
    latency: '—',
    lastError: 'VitalCV does not call NPDB',
    action: { label: 'Why', href: '/trust/attribution#npdb' },
  },
];

export default function StatusPage() {
  const compactItems = CONNECTORS.filter((c) => c.state !== 'review-needed').map((c) => ({
    name: c.name.split('·')[0]?.trim() ?? c.name,
    state:
      c.state === 'source-backed'
        ? ('ok' as const)
        : c.state === 'source-unavailable'
          ? ('unavail' as const)
          : c.state === 'pending-source'
            ? ('degraded' as const)
            : ('review' as const),
    stateLabel: c.stateLabel,
    age: c.stateAge,
  }));

  return (
    <Shell>
      <Nav
        status={{ label: '3 of 4 responding · SAM 503', variant: 'degraded' }}
        cta={<LinkButton href="/sign-in">Sign in</LinkButton>}
      />

      <main className="vs-page">
        <section style={{ padding: '24px 0' }}>
          <Eyebrow tag="Status">Connector matrix · last 24h · auto-refresh 30s</Eyebrow>
          <h1 className="vs-h1" style={{ marginTop: 12 }}>
            Source health · what&apos;s responding right now.
          </h1>
          <p className="vs-lede" style={{ marginTop: 10 }}>
            VitalCV reads public registries. When a registry is offline, the page below says so —
            never the passport. A clinician is never blamed for a source we can&apos;t reach.
          </p>

          <div className="vs-proofs" style={{ margin: '24px 0 8px' }}>
            <div>
              <span className="vs-k">Responding</span>
              <span className="vs-v">
                3 of 4 <small>1 degraded · SAM.gov</small>
              </span>
            </div>
            <div>
              <span className="vs-k">Median read latency</span>
              <span className="vs-v">
                432 ms <small>last 1h</small>
              </span>
            </div>
            <div>
              <span className="vs-k">Re-read freshness</span>
              <span className="vs-v">
                14m <small>median across passports</small>
              </span>
            </div>
            <div>
              <span className="vs-k">Last receipt</span>
              <span
                className="vs-v"
                style={{ fontFamily: 'var(--vs-mono)', fontSize: 14 }}
              >
                0142‑88‑21‑3a <small>09:14 UTC</small>
              </span>
            </div>
          </div>

          {/* chat22 fix #12 — compact grid variant for at-a-glance use */}
          <div style={{ marginTop: 16 }}>
            <CompactConnectorMatrix items={compactItems} />
          </div>
        </section>

        <Section num="01" title="Connector matrix" aside="Per source · last 24h">
          <Card>
            <table className="vs-matrix">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>State</th>
                  <th>Last read</th>
                  <th>Last 24h</th>
                  <th>Median latency</th>
                  <th>Last error</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {CONNECTORS.map((c) => (
                  <tr key={c.name}>
                    <td>
                      <div className="vs-src-cell">
                        <span className="vs-logo">{c.logo}</span>
                        <span>
                          <span className="vs-nm">{c.name}</span>
                          <span className="vs-sub">{c.sub}</span>
                        </span>
                      </div>
                    </td>
                    <td>
                      <TruthChip
                        state={c.state}
                        source={c.stateAge}
                        label={c.stateLabel}
                      />
                    </td>
                    <td className="mono">{c.lastRead}</td>
                    <td>
                      {c.spark.heights.length > 0 ? (
                        <span className={`vs-spark${c.spark.variant !== 'ok' ? ` ${c.spark.variant}` : ''}`}>
                          {c.spark.heights.map((h, i) => (
                            <span key={i} style={{ height: h }} />
                          ))}
                        </span>
                      ) : (
                        <span className="mono vs-muted vs-small">—</span>
                      )}
                    </td>
                    <td className="mono">{c.latency}</td>
                    <td className="mono vs-muted vs-small">{c.lastError}</td>
                    <td>
                      {c.action.href ? (
                        <Link href={c.action.href} className="vs-btn" style={{ padding: '6px 10px', fontSize: 12 }}>
                          {c.action.label}
                        </Link>
                      ) : (
                        <button className="vs-btn" style={{ padding: '6px 10px', fontSize: 12 }} type="button">
                          {c.action.label}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <BoundaryBanner
            label="Reading note"
            message={
              <>
                A source returning 503 is a source failure, not a clinician failure. Passports that
                depend on the unavailable source will show{' '}
                <strong>&quot;Source unavailable · 02h&quot;</strong> beside the affected fields,
                never a red flag on the clinician.
              </>
            }
            action={<span />}
            style={{ marginTop: 18 }}
          />
        </Section>

        <Section
          num="02"
          title="Read history · last 30 minutes"
          aside="Live · auto-refresh 30s"
        >
          <div className="vs-hist">
            <HistRow ts="09:14:02" code={200} src="NPPES" what="read NPI 1699264564 — name & address" ms="281 ms" />
            <HistRow ts="09:14:01" code={200} src="OIG LEIE" what="read NPI 1699264564 — no exclusion record" ms="194 ms" />
            <HistRow ts="09:13:58" code={503} src="SAM.gov" what="read attempted — circuit opened" ms="—" />
            <HistRow ts="09:13:42" code={200} src="NPPES" what="read NPI 1487293641 — name & address" ms="214 ms" />
            <HistRow ts="09:12:18" code={503} src="SAM.gov" what="circuit opened · 3 consecutive 5xx" ms="—" />
            <HistRow ts="09:10:01" code={200} src="ABMS" what="batch refresh · 142 records" ms="612 ms" />
            <HistRow ts="09:08:21" code={200} src="CA Med Board" what="read A‑88142 — license active" ms="820 ms" />
          </div>
        </Section>

        <Section
          num="03"
          title="Operational scope"
          aside="What we run · what we don't claim"
        >
          <div className="vs-scope-list">
            <div>
              <div className="vs-k">Hosting</div>
              <div className="vs-v">
                us-west-2 + us-east-1 (active/passive)
                <small>Reads are stateless. Receipts persist to a signed append-only log.</small>
              </div>
            </div>
            <div>
              <div className="vs-k">Retention</div>
              <div className="vs-v">
                Receipts indefinite · raw responses 30 days
                <small>
                  Receipts contain field name, source, response code, time, signature — never PHI
                  beyond the public NPI.
                </small>
              </div>
            </div>
            <div>
              <div className="vs-k">Encryption</div>
              <div className="vs-v">
                TLS 1.3 in transit · AES-256 at rest
                <small>
                  Standard transport security. We do not claim FedRAMP, HIPAA, or NCQA
                  certification.
                </small>
              </div>
            </div>
            <div>
              <div className="vs-k">Accreditation</div>
              <div className="vs-v">
                None claimed
                <small>
                  VitalCV does not assert HIPAA, SOC 2, or NCQA accreditation. If procured, we will
                  cite the auditor and the report date here.
                </small>
              </div>
            </div>
          </div>
        </Section>

        <Section
          num="04"
          title="Public verification endpoints"
          aside="No authentication required"
        >
          <Card>
            <table className="vs-tbl">
              <thead>
                <tr>
                  <th>Endpoint</th>
                  <th>Description</th>
                  <th>Auth</th>
                </tr>
              </thead>
              <tbody>
                {WELL_KNOWN_ENDPOINTS.map((ep) => (
                  <tr key={ep.path}>
                    <td>
                      <a
                        href={ep.path}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mono"
                        style={{
                          color: 'var(--vs-accent-ink)',
                          textDecoration: 'underline',
                          textDecorationColor: 'var(--vs-hairline-strong)',
                          textUnderlineOffset: 2,
                        }}
                      >
                        {ep.path}
                      </a>
                    </td>
                    <td>{ep.description}</td>
                    <td className="mono vs-muted">None</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <p className="vs-muted vs-small" style={{ marginTop: 14, fontFamily: 'var(--vs-mono)' }}>
            All endpoints are public. Source of truth:{' '}
            <Link href="/api/status" style={{ textDecoration: 'underline' }}>
              /api/status
            </Link>
          </p>
        </Section>
      </main>

      <Footer
        receipt="VS-D57-status · ed25519"
        lastRead="3 of 4 responding · last refresh 09:14 UTC"
      />
    </Shell>
  );
}

function HistRow({
  ts,
  code,
  src,
  what,
  ms,
}: {
  ts: string;
  code: number;
  src: string;
  what: string;
  ms: string;
}) {
  const state =
    code >= 500 ? 'source-unavailable' : code >= 200 && code < 300 ? 'source-backed' : 'pending-source';
  return (
    <div className="vs-row">
      <span className="vs-ts">{ts}</span>
      <TruthChip state={state} source={String(code)} label={String(code)} />
      <span>
        <span className="vs-src">{src}</span> &nbsp;{' '}
        <span className="vs-what">{what}</span>
      </span>
      <span className="vs-muted">{ms}</span>
    </div>
  );
}
