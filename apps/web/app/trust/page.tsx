import type { Metadata } from 'next';
import Link from 'next/link';
import * as React from 'react';
import {
  Card,
  CardBody,
  Eyebrow,
  Footer,
  LinkButton,
  Nav,
  Receipt,
  Section,
  Shell,
  TruthChip,
  type TruthState,
} from '@/components/visual';
import { getTrustRegisterSnapshot, type TrustRegisterSnapshot } from '@/lib/trust/register';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Trust — VitalCV',
  description:
    'What VitalCV reads, what it doesn\'t, who reviews. The register that holds the public-source reader and the institution reviewer apart.',
};

/**
 * /trust — ported from D57 vitalcv-app/trust.html.
 *
 * Preserved: getTrustRegisterSnapshot() server fetch. The connector
 * state chips in the trust register table are derived from snapshot.sources
 * lifecycle data so the page tells the truth about what's live right now.
 *
 * chat22 fix #2: the "What VitalCV will not say" banned-words section uses
 * the vs-banned-list grid component — labels and parenthetical qualifiers
 * stack vertically inside each row, never overlapping.
 */
export default async function TrustPage() {
  const snapshot = await getTrustRegisterSnapshot();
  const stateBySource = buildSourceStateMap(snapshot);

  return (
    <Shell>
      <Nav
        cta={<LinkButton href="/sign-in">Sign in</LinkButton>}
      />

      <main className="vs-page">
        <section style={{ padding: '36px 0 24px', borderBottom: '1px solid var(--vs-hairline)' }}>
          <Eyebrow tag="Trust">What VitalCV reads · what it doesn&apos;t · who reviews</Eyebrow>
          <h1 className="vs-h-display" style={{ marginTop: 18 }}>
            A reusable reader. A visible boundary. A receipt for every fact.
          </h1>
          <p className="vs-lede" style={{ marginTop: 18 }}>
            VitalCV is a public-source reader. The institution is the reviewer. This page is the
            register that holds those two roles apart — what we read, what we don&apos;t, what we
            never claim.
          </p>
          <div className="vs-row" style={{ marginTop: 18 }}>
            <LinkButton href="/trust/attribution" variant="primary">
              See per-field attribution →
            </LinkButton>
            <LinkButton href="/status">Connector status</LinkButton>
          </div>
        </section>

        <Section num="01" title="Trust register" aside="Per category · what VitalCV does">
          <Card>
            <table className="vs-tbl">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>What VitalCV does</th>
                  <th>What it never does</th>
                  <th>Who reviews</th>
                  <th>State</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <strong>Identity &amp; address</strong>
                    <span className="vs-who">
                      <span className="vs-sub" style={{ margin: '2px 0 0' }}>NPPES public registry</span>
                    </span>
                  </td>
                  <td>Reads NPPES name, taxonomy, and practice address; surfaces contradictions with self-report.</td>
                  <td>Does not confirm a clinician is who they say they are.</td>
                  <td>Institution onboarding</td>
                  <td>
                    <TruthChip
                      state={stateBySource('nppes', 'source-backed')}
                      source={chipSourceLabel('NPPES', stateBySource('nppes', 'source-backed'))}
                      label="Reading"
                    />
                  </td>
                </tr>
                <tr>
                  <td>
                    <strong>Board certification</strong>
                    <span className="vs-who">
                      <span className="vs-sub" style={{ margin: '2px 0 0' }}>ABMS</span>
                    </span>
                  </td>
                  <td>Reads board, subspecialty, and recert window date.</td>
                  <td>Does not certify or recertify; does not contact ABMS on behalf of a clinician.</td>
                  <td>Institution privileging</td>
                  <td>
                    <TruthChip
                      state={stateBySource('abms', 'source-backed')}
                      source={chipSourceLabel('ABMS · 14d', stateBySource('abms', 'source-backed'))}
                      label="Reading"
                    />
                  </td>
                </tr>
                <tr>
                  <td>
                    <strong>State licensure</strong>
                    <span className="vs-who">
                      <span className="vs-sub" style={{ margin: '2px 0 0' }}>State medical boards</span>
                    </span>
                  </td>
                  <td>Reads license number, status, and expiration where the board exposes a public API.</td>
                  <td>Does not license, suspend, or restore licensure.</td>
                  <td>State board · institution renewal</td>
                  <td>
                    <TruthChip
                      state="pending-source"
                      source="2 of 50 states"
                      label="Partial"
                    />
                  </td>
                </tr>
                <tr>
                  <td>
                    <strong>Sanction &amp; exclusion</strong>
                    <span className="vs-who">
                      <span className="vs-sub" style={{ margin: '2px 0 0' }}>OIG LEIE · SAM.gov</span>
                    </span>
                  </td>
                  <td>Reads federal exclusion lists by NPI. Surfaces the literal record verbatim.</td>
                  <td>Does not interpret, contest, or remove sanctions.</td>
                  <td>Federal source of record</td>
                  <td>
                    <TruthChip
                      state="source-unavailable"
                      source="SAM · 02h"
                      label="1 unavailable"
                    />
                  </td>
                </tr>
                <tr>
                  <td>
                    <strong>Malpractice · NPDB</strong>
                    <span className="vs-who">
                      <span className="vs-sub" style={{ margin: '2px 0 0' }}>National Practitioner Data Bank</span>
                    </span>
                  </td>
                  <td>—</td>
                  <td>Does not read NPDB on a clinician&apos;s behalf. NPDB is institution-gated.</td>
                  <td>Institution directly</td>
                  <td>
                    <TruthChip state="review-needed" source="out of scope" label="Institution-only" />
                  </td>
                </tr>
                <tr>
                  <td>
                    <strong>Privileging &amp; MSO</strong>
                    <span className="vs-who">
                      <span className="vs-sub" style={{ margin: '2px 0 0' }}>Hospital medical staff offices</span>
                    </span>
                  </td>
                  <td>—</td>
                  <td>Does not grant, modify, or revoke clinical privileges.</td>
                  <td>Institution medical staff office</td>
                  <td>
                    <TruthChip state="review-needed" source="attestation needed" label="Institution-only" />
                  </td>
                </tr>
                <tr>
                  <td>
                    <strong>Fitness &amp; conduct</strong>
                    <span className="vs-who">
                      <span className="vs-sub" style={{ margin: '2px 0 0' }}>Institutional bylaws</span>
                    </span>
                  </td>
                  <td>—</td>
                  <td>
                    Does not assess fitness to practice. Surfaces sanction records literally where
                    public.
                  </td>
                  <td>Institution per bylaws</td>
                  <td>
                    <TruthChip state="review-needed" source="bylaw-defined" label="Out of scope" />
                  </td>
                </tr>
                <tr>
                  <td>
                    <strong>Accreditation claims</strong>
                    <span className="vs-who">
                      <span className="vs-sub" style={{ margin: '2px 0 0' }}>VitalCV itself</span>
                    </span>
                  </td>
                  <td>Publishes scope, source list, and connector status openly.</td>
                  <td>Does not assert HIPAA, SOC 2, or NCQA certification of its own product.</td>
                  <td>Independent audit if procured</td>
                  <td>
                    <TruthChip state="not-asserted" source="no audit cited" label="Not claimed" />
                  </td>
                </tr>
              </tbody>
            </table>
          </Card>
        </Section>

        <Section
          num="02"
          title="Trust primitives"
          aside="Three things make VitalCV legible"
        >
          <div className="vs-grid-3">
            <Card>
              <CardBody>
                <span className="vs-micro">01 · Source attribution</span>
                <h3 className="vs-h2" style={{ marginTop: 10 }}>
                  Every field cites its source and the time it was read.
                </h3>
                <p className="vs-muted vs-small" style={{ marginTop: 10, lineHeight: 1.6 }}>
                  No bare assertions. The string and the source travel together. If the source
                  went offline, the field says so — not the clinician.
                </p>
                <div style={{ marginTop: 14 }}>
                  <TruthChip state="source-backed" source="ABMS · 14d" />
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <span className="vs-micro">02 · Review boundary</span>
                <h3 className="vs-h2" style={{ marginTop: 10 }}>
                  The institution is the only party that reviews a clinician.
                </h3>
                <p className="vs-muted vs-small" style={{ marginTop: 10, lineHeight: 1.6 }}>
                  VitalCV reads. The institution reviews. This boundary is visible in the UI:
                  every passport ends with an &quot;institution must review&quot; block, never a green
                  checkmark.
                </p>
                <div style={{ marginTop: 14 }}>
                  <TruthChip state="review-needed" source="6 items open" />
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <span className="vs-micro">03 · Read receipts</span>
                <h3 className="vs-h2" style={{ marginTop: 10 }}>
                  Every read produces a signed, replayable receipt.
                </h3>
                <p className="vs-muted vs-small" style={{ marginTop: 10, lineHeight: 1.6 }}>
                  Receipts include subject, source list, response codes, time read, and an ed25519
                  signature. Anyone can replay a receipt to see what VitalCV saw.
                </p>
                <Receipt
                  lines={[
                    { k: 'Receipt', v: '0142‑88‑21‑3a' },
                    { k: 'Sig', v: `${snapshot.keyAlgorithm} · ${snapshot.signingKeyId ?? 'kid pending'}` },
                  ]}
                  style={{ marginTop: 14, fontSize: 11, padding: '8px 10px' }}
                />
              </CardBody>
            </Card>
          </div>
        </Section>

        <Section
          num="03"
          title="What VitalCV will not say about a clinician"
          aside="Banned words · enforced in copy"
        >
          <p className="vs-lede" style={{ marginBottom: 18 }}>
            A short list. If a future surface uses any of these, the surface is wrong.
          </p>

          {/* chat22 fix #2 — banned-words two-column grid that never overlaps.
              Each <li> is its own grid with label + qualifier stacking vertically. */}
          <div className="vs-grid-2">
            <Card>
              <div className="vs-card-hd">
                <span className="vs-ttl">Never on a clinician</span>
              </div>
              <CardBody>
                <ul className="vs-banned-list">
                  <BannedItem term="Cleared" />
                  <BannedItem term="Approved" />
                  <BannedItem term="Credentialed" />
                  <BannedItem term="Accepted" />
                  <BannedItem term="Verified" qual="(without source &amp; time)" />
                  <BannedItem term="Eligible to practice" />
                  <BannedItem term="Trustworthy / safe / risk-free" />
                </ul>
              </CardBody>
            </Card>
            <Card>
              <div className="vs-card-hd">
                <span className="vs-ttl">Never about VitalCV itself</span>
              </div>
              <CardBody>
                <ul className="vs-banned-list">
                  <BannedItem term="HIPAA-certified" />
                  <BannedItem term="SOC 2 Type II" qual="(unless externally attested &amp; cited)" />
                  <BannedItem term="NCQA-accredited" />
                  <BannedItem term="The source of truth" qual="(we read sources, we are not one)" />
                  <BannedItem term="Real-time" qual="(reads are dated; freshness is shown)" />
                  <BannedItem term="Live connection" qual="(use response code &amp; age)" />
                </ul>
              </CardBody>
            </Card>
          </div>

          <p
            className="vs-muted vs-small"
            style={{ marginTop: 18, fontFamily: 'var(--vs-mono)' }}
          >
            See full doctrine →{' '}
            <Link
              href="/trust/doctrine"
              style={{
                color: 'var(--vs-accent-ink)',
                textDecoration: 'underline',
                textDecorationColor: 'var(--vs-accent)',
                textUnderlineOffset: 2,
              }}
            >
              Zenlike UI Doctrine
            </Link>
          </p>
        </Section>
      </main>

      <Footer
        receipt={`VS-D57-0001 · ${snapshot.keyAlgorithm}`}
        lastRead={`Trust register · D57 · doctrine ${snapshot.doctrineVersion}`}
      />
    </Shell>
  );
}

/** A single banned-words row: × glyph + term + optional qualifier line.
 *  Inside the grid layout the qualifier wraps to a second line, never on top
 *  of the term — chat22 fix #2. */
function BannedItem({ term, qual }: { term: string; qual?: string }) {
  return (
    <li>
      <span className="vs-x">×</span>
      <span className="vs-content">
        <span className="vs-term">{term}</span>
        {qual ? (
          <span
            className="vs-qual"
            dangerouslySetInnerHTML={{ __html: qual }}
          />
        ) : null}
      </span>
    </li>
  );
}

/** Map a sourceId to a TruthState based on live lifecycle data.
 *  Falls back to the provided default if the source isn't in the snapshot. */
function buildSourceStateMap(snapshot: TrustRegisterSnapshot) {
  const map = new Map<string, TruthState>();
  for (const src of snapshot.sources) {
    let state: TruthState;
    switch (src.lifecycle) {
      case 'active':
        state = 'source-backed';
        break;
      case 'partial':
        state = 'pending-source';
        break;
      case 'planned':
      case 'unintegrated':
      default:
        state = 'not-asserted';
        break;
    }
    map.set(src.sourceId.toLowerCase(), state);
  }
  return (sourceId: string, fallback: TruthState): TruthState =>
    map.get(sourceId.toLowerCase()) ?? fallback;
}

function chipSourceLabel(base: string, state: TruthState): string {
  if (state === 'source-backed') return base;
  if (state === 'pending-source') return `${base} · partial`;
  if (state === 'not-asserted') return 'connector planned';
  return base;
}
