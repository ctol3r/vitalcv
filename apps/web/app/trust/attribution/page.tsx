import type { Metadata } from 'next';
import * as React from 'react';
import {
  Eyebrow,
  Footer,
  LinkButton,
  Nav,
  Shell,
  TruthChip,
  type TruthState,
} from '@/components/visual';
import { getTrustRegisterSnapshot, type TrustRegisterSnapshot } from '@/lib/trust/register';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Source attribution — VitalCV',
  description:
    'Every source VitalCV reads — and exactly what we read from it. Per-source type, auth, refresh, freshness, and the fields we extract.',
};

/**
 * /trust/attribution — ported from D57 vitalcv-app/trust-attribution.html.
 *
 * Per-source detail page. Sticky left-nav (TOC) + a right column of source
 * blocks each containing: header, 4-cell meta grid (type/auth/refresh/freshness),
 * and a kv-list of fields read / not read / what we do / what we never claim.
 *
 * The page is intentionally honest about sources we do NOT read (NPDB,
 * MSO attestations) — they get their own blocks with an "institution-only"
 * chip and a paragraph explaining why we stop.
 */

type SourceBlock = {
  id: string;
  letter: string;
  title: string;
  url: string;
  state: TruthState;
  stateLabel: string;
  stateSource: string;
  meta: { type: string; auth: string; refresh: string; freshness: string };
  kv: Array<{ k: string; v: React.ReactNode }>;
  /** Set when this source has a callout style (e.g. NPDB institution-only). */
  callout?: boolean;
  /** Body content overrides the kv table for the callout variant. */
  body?: React.ReactNode;
};

const PUBLIC_SOURCES: SourceBlock[] = [
  {
    id: 'nppes',
    letter: 'N',
    title: 'NPPES · CMS public registry',
    url: 'npiregistry.cms.hhs.gov · NPI Registry public API · keyed by 10-digit NPI',
    state: 'source-backed',
    stateLabel: 'Reading',
    stateSource: 'read 14m ago',
    meta: {
      type: 'Federal public',
      auth: 'None · public',
      refresh: 'Every 12h · on demand',
      freshness: '24h',
    },
    kv: [
      {
        k: 'Fields read',
        v: 'Legal name · NPI · taxonomy code · primary & secondary practice address · enumeration date · deactivation reason if present.',
      },
      { k: 'Not read', v: 'Anything not present in the public NPPES record. We do not infer.' },
      {
        k: 'What we do',
        v: 'Compare NPPES against ABMS and self-report. Surface contradictions; never auto-merge.',
      },
      {
        k: 'What we never claim',
        v: 'That NPPES presence implies licensure, board certification, or fitness to practice.',
      },
    ],
  },
  {
    id: 'abms',
    letter: 'A',
    title: 'ABMS · American Board of Medical Specialties',
    url: 'certificationmatters.org · ABMS Solutions partner API · keyed by NPI + name',
    state: 'source-backed',
    stateLabel: 'Reading',
    stateSource: 'read 14d ago',
    meta: {
      type: 'Industry registry',
      auth: 'Partner key',
      refresh: 'Every 30d · on demand',
      freshness: '60d',
    },
    kv: [
      {
        k: 'Fields read',
        v: 'Board · subspecialty · initial cert date · recert window expiration · MOC status.',
      },
      { k: 'Not read', v: 'Score history, examination details, or any restricted data.' },
      {
        k: 'What we do',
        v: 'Show recert date and remaining window. Surface "approaching recert" in the institution review panel.',
      },
      {
        k: 'What we never claim',
        v: 'That ABMS certification implies hospital privileges or current state licensure.',
      },
    ],
  },
  {
    id: 'state',
    letter: 'S',
    title: 'State medical boards',
    url: 'Per-state public lookup · CA · NY · TX · IL · WA · MA — others on request',
    state: 'pending-source',
    stateLabel: 'Partial',
    stateSource: '2 of 50 states',
    meta: {
      type: 'State public',
      auth: 'None · public',
      refresh: 'Per state policy',
      freshness: '30d',
    },
    kv: [
      {
        k: 'Fields read',
        v: 'License number · status · issue date · expiration · disciplinary actions where the board publishes them.',
      },
      { k: 'Not read', v: 'Closed cases, sealed records, or any state-specific protected content.' },
      {
        k: 'What we do',
        v: 'Currently read CA and NY directly. Other states are queued — surfaced as "Pending source" until reachable.',
      },
      {
        k: 'What we never claim',
        v: 'That an active state license implies fitness to practice or absence of malpractice history.',
      },
    ],
  },
];

const SANCTION_SOURCES: SourceBlock[] = [
  {
    id: 'oig',
    letter: 'O',
    title: 'OIG LEIE · List of Excluded Individuals and Entities',
    url: 'oig.hhs.gov/exclusions · monthly database · keyed by NPI + name',
    state: 'source-backed',
    stateLabel: 'Reading',
    stateSource: 'read 14m ago',
    meta: {
      type: 'Federal public',
      auth: 'None · public',
      refresh: 'Monthly database snapshot',
      freshness: '30d',
    },
    kv: [
      {
        k: 'Fields read',
        v: 'Exclusion type · exclusion date · reinstatement date if any · the verbatim record.',
      },
      { k: 'Not read', v: 'Anything not in the published exclusion record.' },
      {
        k: 'What we do',
        v: 'Surface the literal OIG record. Empty result is itself a result and is reported as "no record returned, read on YYYY·MM·DD".',
      },
      {
        k: 'What we never claim',
        v: 'That absence of an OIG record clears a clinician of past conduct.',
      },
    ],
  },
  {
    id: 'sam',
    letter: '$',
    title: 'SAM.gov · System for Award Management',
    url: 'sam.gov · exclusion API · keyed by NPI + name + tax id',
    state: 'source-unavailable',
    stateLabel: 'Unavailable',
    stateSource: '503 · 02h ago',
    meta: {
      type: 'Federal public',
      auth: 'API key',
      refresh: 'On demand · circuit-broken',
      freshness: '14d',
    },
    kv: [
      {
        k: 'Status now',
        v: 'SAM.gov returned 503 at 09:12 UTC; VitalCV is retrying every 30 minutes. The clinician has not failed — the source is offline.',
      },
      {
        k: 'Fields read',
        v: 'Exclusion type, debarment dates, awarding agency, the verbatim record.',
      },
      {
        k: 'What we do',
        v: 'Show "Source unavailable · 02h" until a 200 returns. Never block the clinician for a source outage.',
      },
    ],
  },
  {
    id: 'dea',
    letter: 'D',
    title: 'DEA Diversion Control',
    url: 'apps.deadiversion.usdoj.gov · controlled-substance registration · keyed by DEA number',
    state: 'pending-source',
    stateLabel: 'Pending source',
    stateSource: 'retry 02:14',
    meta: {
      type: 'Federal public',
      auth: 'None · public',
      refresh: 'Every 30d',
      freshness: '60d',
    },
    kv: [
      {
        k: 'Fields read',
        v: 'DEA registration number · schedule authority · expiration · suspension status.',
      },
      {
        k: 'Status now',
        v: 'Queued for read after clinician self-reports a DEA number. VitalCV does not search for DEA numbers without the clinician\'s claim.',
      },
    ],
  },
];

const GATED_SOURCES: SourceBlock[] = [
  {
    id: 'npdb',
    letter: '!',
    title: 'NPDB · National Practitioner Data Bank',
    url: 'npdb.hrsa.gov · institution-gated · we do not read this on a clinician\'s behalf',
    state: 'review-needed',
    stateLabel: 'Institution-only',
    stateSource: 'out of scope',
    meta: { type: '', auth: '', refresh: '', freshness: '' },
    kv: [],
    callout: true,
    body: (
      <p style={{ margin: 0, color: 'var(--vs-ink)', fontSize: 14, lineHeight: 1.6 }}>
        <strong>VitalCV does not read NPDB.</strong> The Healthcare Quality Improvement Act
        restricts who may query the data bank. The institution itself must perform this read
        directly. VitalCV surfaces &quot;Institution must read&quot; on every passport — never an
        empty checkmark.
      </p>
    ),
  },
  {
    id: 'mso',
    letter: 'M',
    title: 'MSO attestations · Hospital medical staff offices',
    url: 'Per-institution · not a public registry · institution-gated',
    state: 'review-needed',
    stateLabel: 'Institution-only',
    stateSource: 'attestation',
    meta: { type: '', auth: '', refresh: '', freshness: '' },
    kv: [],
    body: (
      <p className="vs-muted" style={{ fontSize: 14, lineHeight: 1.6 }}>
        VitalCV accepts an institution&apos;s signed attestation as a source, when the institution
        chooses to attest. We never paraphrase the attestation, and we never solicit one without
        the clinician&apos;s explicit consent.
      </p>
    ),
  },
];

export default async function TrustAttributionPage() {
  // The snapshot keeps us honest about live source state. We don't currently
  // override the per-block defaults with live data — the prototype's chips
  // are the doctrine for what the page *says* about each source — but we
  // call the fetch so /trust and /trust/attribution agree on doctrine version.
  const snapshot: TrustRegisterSnapshot = await getTrustRegisterSnapshot();

  return (
    <Shell>
      <Nav cta={<LinkButton href="/sign-in">Sign in</LinkButton>} />

      <main className="vs-page">
        <section style={{ padding: '24px 0' }}>
          <Eyebrow tag="Trust">Source attribution · per source</Eyebrow>
          <h1 className="vs-h1" style={{ marginTop: 12 }}>
            Every source VitalCV reads — and exactly what we read from it.
          </h1>
          <p className="vs-lede" style={{ marginTop: 10 }}>
            No source is paraphrased. Each block below lists the source, what fields we extract,
            how often we re-read, the freshness budget, and the public URL. If a source is
            institution-gated, we say so and stop.
          </p>
        </section>

        <section className="vs-attr-grid">
          <aside className="vs-attr-nav" aria-label="Sources">
            <span className="vs-grp">Public registries</span>
            {PUBLIC_SOURCES.map((src) => (
              <a key={src.id} href={`#${src.id}`}>
                {src.title.split('·')[0]?.trim() ?? src.title}{' '}
                <span className="vs-ag">{src.stateSource.replace('read ', '').replace(' ago', '')}</span>
              </a>
            ))}
            <span className="vs-grp">Sanction lists</span>
            {SANCTION_SOURCES.map((src) => (
              <a key={src.id} href={`#${src.id}`}>
                {src.title.split('·')[0]?.trim() ?? src.title}{' '}
                <span className="vs-ag">{src.stateSource.replace('read ', '').replace(' ago', '')}</span>
              </a>
            ))}
            <span className="vs-grp">Institution-gated · we do not read</span>
            {GATED_SOURCES.map((src) => (
              <a key={src.id} href={`#${src.id}`}>
                {src.title.split('·')[0]?.trim() ?? src.title}{' '}
                <span className="vs-ag">—</span>
              </a>
            ))}
          </aside>

          <div>
            {[...PUBLIC_SOURCES, ...SANCTION_SOURCES, ...GATED_SOURCES].map((src) =>
              src.callout ? (
                <article
                  key={src.id}
                  id={src.id}
                  className="vs-src-block"
                  style={{
                    background: 'var(--vs-accent-wash)',
                    border: '1px solid color-mix(in oklch, var(--vs-accent) 18%, var(--vs-hairline))',
                    borderRadius: 'var(--vs-r-4)',
                    padding: 22,
                    marginBottom: 36,
                  }}
                >
                  <div className="vs-src-hd">
                    <span
                      className="vs-logo"
                      style={{ background: 'var(--vs-paper)', color: 'var(--vs-accent)' }}
                    >
                      {src.letter}
                    </span>
                    <div>
                      <h2 className="vs-h1" style={{ color: 'var(--vs-accent-ink)' }}>
                        {src.title}
                      </h2>
                      <div className="vs-url">{src.url}</div>
                    </div>
                    <TruthChip state={src.state} source={src.stateSource} label={src.stateLabel} />
                  </div>
                  {src.body}
                </article>
              ) : (
                <article key={src.id} id={src.id} className="vs-src-block">
                  <div className="vs-src-hd">
                    <span className="vs-logo">{src.letter}</span>
                    <div>
                      <h2 className="vs-h1">{src.title}</h2>
                      <div className="vs-url">{src.url}</div>
                    </div>
                    <TruthChip state={src.state} source={src.stateSource} label={src.stateLabel} />
                  </div>
                  {src.meta.type ? (
                    <div className="vs-src-meta-grid">
                      <div>
                        <div className="vs-k">Type</div>
                        <div className="vs-v">{src.meta.type}</div>
                      </div>
                      <div>
                        <div className="vs-k">Auth</div>
                        <div className="vs-v">{src.meta.auth}</div>
                      </div>
                      <div>
                        <div className="vs-k">Refresh</div>
                        <div className="vs-v">{src.meta.refresh}</div>
                      </div>
                      <div>
                        <div className="vs-k">Freshness budget</div>
                        <div className="vs-v">{src.meta.freshness}</div>
                      </div>
                    </div>
                  ) : null}
                  {src.body ? (
                    src.body
                  ) : (
                    <dl className="vs-kv-list">
                      {src.kv.map((row) => (
                        <React.Fragment key={String(row.k)}>
                          <dt>{row.k}</dt>
                          <dd>{row.v}</dd>
                        </React.Fragment>
                      ))}
                    </dl>
                  )}
                </article>
              ),
            )}
          </div>
        </section>
      </main>

      <Footer
        receipt={`VS-D57-0001 · ${snapshot.keyAlgorithm}`}
        lastRead={`Attribution register · ${snapshot.sources.length} sources documented`}
      />
    </Shell>
  );
}
