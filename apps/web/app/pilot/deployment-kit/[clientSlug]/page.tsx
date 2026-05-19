/**
 * /pilot/deployment-kit/[clientSlug] — print-ready pilot deployment kit
 *
 * Re-implementation of `Pilot Deployment Kit.html` from the Anthropic
 * design handoff. Single-document layout (cover + 6 sections +
 * signature + colophon), Letter-print-ready, parameterised by client
 * cohort via `[clientSlug]` (e.g. `cedar-q2-26`).
 *
 * Server component. The only client-side bit is the chrome (live UTC
 * clock + print button), isolated in `DeploymentKitChrome.tsx`.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import styles from './deployment-kit.module.css';
import { DeploymentKitChrome } from './DeploymentKitChrome';
import { resolveDeploymentKitClient } from './data';

interface PageProps {
  params: Promise<{ clientSlug: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { clientSlug } = await params;
  const client = resolveDeploymentKitClient(clientSlug);
  if (!client) return { title: 'Pilot deployment kit · VitalCV' };
  return {
    title: `VitalCV · Pilot deployment kit · ${client.clientName} · ${client.cohortLabel}`,
    description: `Pilot deployment kit for ${client.clientName} — ${client.scopeNpis} NPIs / ${client.scopeWindowDays} days.`,
    robots: { index: false, follow: false },
  };
}

export default async function PilotDeploymentKitPage({ params }: PageProps) {
  const { clientSlug } = await params;
  const client = resolveDeploymentKitClient(clientSlug);
  if (!client) notFound();

  return (
    <div className={styles.root} data-testid="pilot-deployment-kit">
      <DeploymentKitChrome
        docNumber="D43"
        path={`/ pilot / deployment-kit · ${client.slug}`}
      />

      <article className={styles.doc}>
        <RunningHeader cohortLabel={client.cohortLabel} clientName={client.clientName} />
        <Cover client={client} />
        <SectionOne />
        <SectionTwo />
        <SectionThree />
        <SectionFour client={client} />
        <SectionFive />
        <SectionSix client={client} />
        <Signature client={client} />
        <Colophon docNumber={client.docNumber} revision={client.revision} />
      </article>
    </div>
  );
}

// ─── Running header ─────────────────────────────────────────────────────────

function RunningHeader({
  cohortLabel,
  clientName,
}: {
  cohortLabel: string;
  clientName: string;
}) {
  return (
    <div className={styles.running}>
      <div className="l">
        <strong>VitalCV</strong>
        <span>·</span>
        <span>Pilot Deployment Kit</span>
      </div>
      <div className="r">
        <span>Confidential ·</span> <strong>{clientName}</strong>{' '}
        <span>·</span> {cohortLabel}
      </div>
    </div>
  );
}

// ─── Cover ──────────────────────────────────────────────────────────────────

function Cover({
  client,
}: {
  client: ReturnType<typeof resolveDeploymentKitClient> & object;
}) {
  return (
    <header className={styles.cover}>
      <div className={styles.docNo}>
        <span className="nm">{client.docNumber}</span>
        <span className="rule" />
        <span>{client.revision}</span>
      </div>

      <h1>
        Credentialing by proxy:{' '}
        <em>
          a {client.scopeWindowDays}-day pilot for {numberWord(client.scopeNpis)}{' '}
          clinicians.
        </em>
      </h1>
      <div className={styles.coverSub}>
        A discrete, source-backed verification node for {client.clientName} —
        operating in parallel to your incumbent CVO, scoped to{' '}
        {numberWord(client.scopeNpis)} provisional NPIs, with{' '}
        <strong>no data retention beyond the pilot window</strong> and no
        integration into upstream {client.clientName.split(' ')[0]} systems.
      </div>

      <div className={styles.coverFor}>
        <div className="blk">
          <div className="k">Prepared for</div>
          <div className="v">
            {client.clientName}
            <small>{client.clientAttention}</small>
          </div>
        </div>
        <div className="blk">
          <div className="k">Prepared by</div>
          <div className="v">
            VitalCV, Inc.
            <small>did:web:vitalcv.health · founder@vitalcv.health</small>
          </div>
        </div>
        <div className="blk">
          <div className="k">Scope</div>
          <div className="v">
            {client.scopeNpis} NPIs · {client.scopeWindowDays} days
            <small>federal sources only · state board manual</small>
          </div>
        </div>
        <div className="blk">
          <div className="k">Engagement</div>
          <div className="v">
            Read-only pilot
            <small>no production cutover · no SLA</small>
          </div>
        </div>
      </div>

      <div
        className={styles.coverMetaStrip}
        style={{ marginTop: 48, marginBottom: 0 }}
      >
        <MetaCell k="Class" v="Pilot deployment" />
        <MetaCell k="Touches PHI?" v="No" />
        <MetaCell k="Touches PII?" v="Name · NPI only" />
        <MetaCell k="BAA required?" v="No" />
      </div>

      <div className={styles.coverStamp}>Confidential</div>
    </header>
  );
}

function MetaCell({ k, v }: { k: string; v: string }) {
  return (
    <div className={styles.coverMetaCell}>
      <div className="k">{k}</div>
      <div className="v">{v}</div>
    </div>
  );
}

// ─── Section header helper ──────────────────────────────────────────────────

function SectionHeader({
  no,
  title,
  subtitle,
  ref_,
}: {
  no: string;
  title: string;
  subtitle: string;
  ref_: string;
}) {
  return (
    <div className={styles.sectionHeader}>
      <span className="no">{no}</span>
      <h2>
        {title} <em>— {subtitle}</em>
      </h2>
      <span className="ref">{ref_}</span>
    </div>
  );
}

// ─── 01 · Executive summary ────────────────────────────────────────────────

function SectionOne() {
  return (
    <section className={styles.section}>
      <SectionHeader
        no="01"
        title="Executive summary"
        subtitle="in three paragraphs."
        ref_="D43 · S01"
      />
      <p className={styles.lede}>
        VitalCV is a <strong>read-only verification node</strong>. It does not
        replace a credentialing verification organization. It resolves the eight
        federal primary sources Cedar&rsquo;s CVO already resolves — only
        faster, with a signed, replayable receipt for each clinician — and
        surfaces the boundary where state-level and clinical-privileging work
        remains a manual administrative step.
      </p>
      <p>
        For this pilot, we are proposing a{' '}
        <strong>fixed cohort of ten provisional NPIs</strong>, intake&apos;d
        through Cedar&rsquo;s existing Okta tenant, processed through
        VitalCV&rsquo;s federal resolver, and returned to Cedar as a side-channel
        artifact for comparison against your CVO&rsquo;s output. The pilot
        generates one signed receipt per clinician, hosted at a single revocable
        URL.
      </p>
      <p>
        We are not asking Cedar to change a single line of its credentialing
        workflow during the pilot window. We are asking for thirty days to
        demonstrate that federal-source resolution can be{' '}
        <strong>accelerated by an order of magnitude</strong> without sacrificing
        audit fidelity — and to define, jointly, what a production engagement
        would look like if the receipts hold up.
      </p>
    </section>
  );
}

// ─── 02 · Pilot scope ──────────────────────────────────────────────────────

function SectionTwo() {
  return (
    <section className={styles.section}>
      <SectionHeader
        no="02"
        title="Pilot scope"
        subtitle="what is in, what is explicitly out."
        ref_="D43 · S02"
      />
      <p className={styles.lede}>
        The pilot is bounded on four axes:{' '}
        <strong>cohort, surface, data, time.</strong> Each axis is enumerated
        below. Items in the right column are not deferred — they are
        categorically outside the pilot&rsquo;s responsibility.
      </p>
      <div className={styles.inout}>
        <div className="col">
          <div className="hd">
            <span>In scope</span>
            <strong>10 NPIs / 30 days</strong>
          </div>
          <ul>
            <InOutItem
              dash="+"
              copy={
                <>
                  <strong>Identity resolution</strong> against NPPES and PECOS,
                  returning normalized name, taxonomy, enrollment status.
                </>
              }
            />
            <InOutItem
              dash="+"
              copy={
                <>
                  <strong>Sanction screening</strong> against OIG/LEIE and
                  SAM.gov, returning a binary clear/excluded on intake date.
                </>
              }
            />
            <InOutItem
              dash="+"
              copy={
                <>
                  <strong>DEA registration</strong> resolution with expiration
                  and schedule grants.
                </>
              }
            />
            <InOutItem
              dash="+"
              copy={
                <>
                  <strong>NPDB self-query token</strong> minting, returned to
                  the clinician for verifier proxy.
                </>
              }
            />
            <InOutItem
              dash="+"
              copy={
                <>
                  <strong>One signed receipt</strong> per clinician, resolvable
                  from a Cedar-revocable URL.
                </>
              }
            />
            <InOutItem
              dash="+"
              copy={
                <>
                  <strong>Read-only replay surface</strong> for Cedar&rsquo;s
                  audit team, scoped to the pilot cohort.
                </>
              }
            />
          </ul>
        </div>
        <div className="col">
          <div className="hd">
            <span>Out of scope</span>
            <strong>verifier responsibility</strong>
          </div>
          <ul>
            <InOutItem
              dash="−"
              copy={
                <>
                  <strong>State medical board PSV.</strong> Resolved manually by
                  Cedar&rsquo;s CVO or a partner CVO operating under their own
                  credential.
                </>
              }
            />
            <InOutItem
              dash="−"
              copy={
                <>
                  <strong>Privileging decisions.</strong> No assertion is made
                  about scope of practice or clinical privileges at any Cedar
                  facility.
                </>
              }
            />
            <InOutItem
              dash="−"
              copy={
                <>
                  <strong>Employment eligibility.</strong> I-9, work
                  authorization, OFAC screening remain in Cedar&rsquo;s HRIS
                  workflow.
                </>
              }
            />
            <InOutItem
              dash="−"
              copy={
                <>
                  <strong>Malpractice adjudication.</strong> NPDB query results
                  are the verifier&rsquo;s to read; VitalCV mints the token,
                  never the determination.
                </>
              }
            />
            <InOutItem
              dash="−"
              copy={
                <>
                  <strong>Re-credentialing cycles.</strong> The pilot covers
                  initial verification only; re-credentialing remains in
                  Cedar&rsquo;s CVO cadence.
                </>
              }
            />
            <InOutItem
              dash="−"
              copy={
                <>
                  <strong>
                    Integration with Cedar&rsquo;s EMR, HRIS, or scheduling
                    systems.
                  </strong>{' '}
                  No upstream writes; pilot artifacts are side-channel only.
                </>
              }
            />
          </ul>
        </div>
      </div>
      <p>
        The pilot ends on day 30. On termination, all subject records are{' '}
        <strong>cryptographically deleted</strong> from VitalCV&rsquo;s pilot
        cluster within 72 hours, with a signed deletion receipt issued to Cedar.
        Pilot URLs revoke immediately on Cedar&rsquo;s instruction at any point
        in the window.
      </p>
    </section>
  );
}

function InOutItem({
  dash,
  copy,
}: {
  dash: string;
  copy: React.ReactNode;
}) {
  return (
    <li>
      <span className="dash">{dash}</span>
      <span>{copy}</span>
    </li>
  );
}

// ─── 03 · Security posture ─────────────────────────────────────────────────

function SectionThree() {
  return (
    <section className={styles.section}>
      <SectionHeader
        no="03"
        title="Security posture"
        subtitle="what data is touched, what isn't."
        ref_="D43 · S03"
      />
      <p className={styles.lede}>
        VitalCV&rsquo;s pilot architecture is{' '}
        <strong>structurally incapable</strong> of touching Cedar PHI or Cedar
        HRIS records. The table below enumerates every data class the pilot can
        encounter and the posture under which it is handled.
      </p>
      <table className={styles.posture}>
        <thead>
          <tr>
            <th style={{ width: '24%' }}>Data class</th>
            <th style={{ width: '14%' }}>Touched?</th>
            <th>Handling posture</th>
          </tr>
        </thead>
        <tbody>
          <PostureRow
            label="NPI number"
            touched="Yes"
            handling="Public federal identifier. Stored as the run's subject id. Discarded with cohort at day-30 deletion."
          />
          <PostureRow
            label="Clinician legal name"
            touched="Yes"
            handling="Read from NPPES on resolution; never accepted from Cedar's HRIS. Retained only in the signed receipt during pilot window."
          />
          <PostureRow
            label="Date of birth"
            touched="No"
            touchedNo
            handling="Not requested at intake. Federal sources used in the pilot do not require DOB for resolution."
          />
          <PostureRow
            label="Social Security Number"
            touched="No"
            touchedNo
            handling="Categorically out of scope. VitalCV will refuse SSN if Cedar's HRIS adapter attempts to send it."
          />
          <PostureRow
            label="Patient PHI"
            touched="No"
            touchedNo
            handling="VitalCV does not connect to any Cedar clinical system. PHI cannot reach the pilot cluster by design — no integration surface exists."
          />
          <PostureRow
            label="Cedar HRIS records"
            touched="No"
            touchedNo
            handling="Pilot accepts only the NPI list from Cedar's credentialing team. HRIS connectors are explicitly disabled in the pilot tenant."
          />
          <PostureRow
            label="DEA registration"
            touched="Yes"
            handling="Resolved against the public DEA registration registry; only registration class, status, and expiration retained."
          />
          <PostureRow
            label="NPDB query results"
            touched="No"
            touchedNo
            handling="VitalCV mints the subject's NPDB self-query token. The query result is returned directly to the verifier, never persisted by VitalCV."
          />
        </tbody>
      </table>
      <ol className={styles.rfc}>
        <RfcItem
          h="Issuer key"
          b={
            <>
              All pilot receipts are signed under{' '}
              <strong>did:web:vitalcv.health</strong>, ed25519 key fingerprint{' '}
              <strong>4f2a</strong>, rotated quarterly. Public key resolvable
              from the issuer&rsquo;s well-known endpoint at any time.
            </>
          }
        />
        <RfcItem
          h="Network posture"
          b={
            <>
              Pilot cluster operates on a <strong>single-tenant container</strong>,
              isolated from any production workload, behind a Cloudflare tunnel
              revocable by Cedar with a 5-minute SLA.
            </>
          }
        />
        <RfcItem
          h="Encryption"
          b={
            <>
              All subject records encrypted at rest (AES-256-GCM); transport TLS
              1.3 only. Per-record keys derived from a pilot-cohort master key,
              destroyed on day-30 termination.
            </>
          }
        />
        <RfcItem
          h="Audit"
          b={
            <>
              Every read, write, and signing operation is logged to an
              append-only audit ledger, exportable to Cedar&rsquo;s audit team
              in CSV or JSON-LD on request.
            </>
          }
        />
        <RfcItem
          h="Termination"
          b={
            <>
              Cedar may terminate the pilot at any point. Termination triggers
              immediate revocation of all pilot URLs, followed by cryptographic
              deletion within 72 hours and a signed deletion receipt.
            </>
          }
        />
      </ol>
    </section>
  );
}

function PostureRow({
  label,
  touched,
  touchedNo,
  handling,
}: {
  label: string;
  touched: string;
  touchedNo?: boolean;
  handling: string;
}) {
  return (
    <tr>
      <td className={styles.label}>{label}</td>
      <td className={`${styles.touched} ${touchedNo ? styles.no : ''}`}>
        {touched}
      </td>
      <td>{handling}</td>
    </tr>
  );
}

function RfcItem({ h, b }: { h: string; b: React.ReactNode }) {
  return (
    <li>
      <span className="h">{h}</span>
      <span className="b">{b}</span>
    </li>
  );
}

// ─── 04 · Architecture ─────────────────────────────────────────────────────

function SectionFour({
  client,
}: {
  client: ReturnType<typeof resolveDeploymentKitClient> & object;
}) {
  return (
    <section className={styles.section}>
      <SectionHeader
        no="04"
        title="Architecture"
        subtitle="credentialing by proxy, four columns."
        ref_="D43 · S04"
      />
      <p className={styles.lede}>
        VitalCV is a{' '}
        <strong>typed pipeline between four named parties</strong>. The diagram
        below reads left to right; each column owns its data plane and signs its
        outputs. Cedar reads the right-most column.
      </p>

      <div className={styles.rail}>
        <div className={styles.railHead}>
          <RailHeadCell title="Source" small="federal registries" />
          <RailHeadCell title="Issuer" small="VitalCV" />
          <RailHeadCell title="Subject" small="the clinician" />
          <RailHeadCell title="Verifier" small="Cedar credentialing" />
        </div>
        <div className={styles.railBody}>
          <div className={styles.railCol}>
            <Node k="Registry 01" v="NPPES enumeration" mono="cms.gov/nppes" />
            <Node k="Registry 02" v="PECOS enrollment" mono="cms.gov/pecos" />
            <Node k="Registry 03" v="OIG / LEIE" mono="oig.hhs.gov" />
            <Node k="Registry 04" v="SAM.gov debarment" mono="sam.gov" />
            <Node
              k="Registry 05"
              v="DEA registration"
              mono="deadiversion.usdoj.gov"
            />
            <Node k="Registry 06" v="NPDB · self-query" mono="npdb.hrsa.gov" />
            <Node
              k="Out · 07"
              v="State medical boards"
              mono="CVO channel"
              muted
            />
          </div>
          <div className={styles.railCol}>
            <Node
              k="Service"
              v="Federal resolver"
              mono="pilot tenant · isolated"
            />
            <Node k="Key" v="did:web:vitalcv.health" mono="ed25519 · 4f2a" />
            <Node
              k="Output"
              v="Signed receipt"
              mono="application/jws + json-ld"
            />
            <Node
              k="Audit ledger"
              v="Append-only"
              mono="read/write/sign logged"
            />
            <Node
              k="Retention"
              v="30 days, then cryptographically deleted"
              muted
            />
          </div>
          <div className={styles.railCol}>
            <Node
              k="Identity"
              v={client.cohortSampleNpi.name}
              mono={`npi ${client.cohortSampleNpi.npi}`}
            />
            <Node k="Auth" v="Cedar Okta SSO" mono="existing tenant" />
            <Node
              k="Attestation"
              v="Self-attest on intake"
              mono="signed by subject"
            />
            <Node k="Share" v="Vault-key sharing" mono="subject controls" />
            <Node
              k="Cohort"
              v={`${client.scopeNpis - 1} more NPIs`}
              mono="q2-2026-pilot"
              muted
            />
          </div>
          <div className={styles.railCol}>
            <Node
              k="Read surface"
              v="/verify/r-7a2c-b8d3"
              mono="read-only · signed"
            />
            <Node
              k="Operator"
              v="Cedar credentialing"
              mono="audit team scoped"
            />
            <Node
              k="Action"
              v="Accept · revoke · escalate"
              mono="Cedar discretion"
            />
            <Node k="Audit export" v="CSV · JSON-LD on request" />
            <Node
              k="Manual lane"
              v="State board PSV"
              mono="Cedar CVO retains"
              muted
            />
          </div>
        </div>
        <div className={styles.arrowRow}>
          <ArrowCell lbl="primary fetch" arr="→" />
          <ArrowCell lbl="sign & emit" arr="→" />
          <ArrowCell lbl="deliver" arr="→" />
          <ArrowCell lbl="read · accept" />
        </div>
        <div className={styles.railFoot}>
          <span>
            <strong>
              4 parties · 7 federal sources · 1 signed receipt per clinician
            </strong>
          </span>
          <span>credentialing-by-proxy v1.2</span>
        </div>
      </div>

      <ol className={styles.rfc}>
        <RfcItem
          h="No HRIS write-back"
          b={
            <>
              The pilot is read-only with respect to Cedar systems. VitalCV emits
              artifacts; Cedar reads them. There is no upstream integration to be
              hardened, audited, or rolled back.
            </>
          }
        />
        <RfcItem
          h="Subject-controlled share"
          b={
            <>
              The clinician — not VitalCV, not Cedar — holds the vault key.
              Cedar&rsquo;s access is mediated by the subject&rsquo;s share grant
              and is revocable by either party.
            </>
          }
        />
        <RfcItem
          h="Receipts, not databases"
          b={
            <>
              The unit of trust is the <strong>signed receipt</strong>, not a row
              in our database. Receipts are portable, replayable, and survive
              VitalCV&rsquo;s eventual sunset.
            </>
          }
        />
      </ol>
    </section>
  );
}

function RailHeadCell({ title, small }: { title: string; small: string }) {
  return (
    <div className="cell">
      <span>{title}</span>
      <small>{small}</small>
    </div>
  );
}

function Node({
  k,
  v,
  mono,
  muted,
}: {
  k: string;
  v: string;
  mono?: string;
  muted?: boolean;
}) {
  return (
    <div className={`${styles.nd} ${muted ? styles.ndMuted : ''}`}>
      <div className="k">{k}</div>
      <div className="v">
        {v}
        {mono ? <span className="mono">{mono}</span> : null}
      </div>
    </div>
  );
}

function ArrowCell({ lbl, arr }: { lbl: string; arr?: string }) {
  return (
    <div className={styles.ar}>
      <span className="lbl">{lbl}</span>
      {arr ? <span className="arr">{arr}</span> : null}
    </div>
  );
}

// ─── 05 · 30-day criteria ──────────────────────────────────────────────────

function SectionFive() {
  return (
    <section className={styles.section}>
      <SectionHeader
        no="05"
        title="30-day success criteria"
        subtitle="what we measure, jointly."
        ref_="D43 · S05"
      />
      <p className={styles.lede}>
        Four criteria. Each has an operational target measured against
        Cedar&rsquo;s current CVO baseline. We pass the pilot if we hit three of
        four; we discuss continuation if we hit fewer.
      </p>
      <div className={styles.crit}>
        <CritItem
          n="Criterion 01"
          title="Time-to-receipt"
          v="Median time from intake to signed receipt across the cohort."
          b={
            <>
              Cedar CVO baseline for federal-source resolution:{' '}
              <strong>4–6 business days</strong>. VitalCV pilot target: under
              one hour.
            </>
          }
          target="≤ 1 h"
        />
        <CritItem
          n="Criterion 02"
          title="Source fidelity"
          v="Receipt fields must reconcile to Cedar CVO output on independent review."
          b={
            <>
              Cedar&rsquo;s audit team blind-compares VitalCV receipts to CVO
              records. <strong>Zero substantive discrepancies</strong> across
              the cohort.
            </>
          }
          target="0 / 10"
        />
        <CritItem
          n="Criterion 03"
          title="Operator load"
          v="Minutes of Cedar-team time required to operate the pilot."
          b={
            <>
              Total hands-on minutes from Cedar credentialing across the 30
              days, excluding the audit-comparison work in criterion 02.
            </>
          }
          target="≤ 90 min"
        />
        <CritItem
          n="Criterion 04"
          title="Audit defensibility"
          v="Cedar audit lead can defend the receipt to a regulator on a single read."
          b={
            <>
              Tested on day 28 with a structured walk-through of a randomly
              chosen cohort receipt. Pass criterion:{' '}
              <strong>no follow-up artifacts required</strong>.
            </>
          }
          target="1-shot"
        />
      </div>
      <ol className={styles.rfc}>
        <RfcItem
          h="What we will not measure"
          b={
            <>
              Net Promoter Score. Engagement minutes. &ldquo;Time saved&rdquo;
              estimates without a baseline. We do not run feel-good metrics in a
              credentialing pilot.
            </>
          }
        />
        <RfcItem
          h={"What constitutes a \"no\""}
          b={
            <>
              Cedar passes on continuation if any single criterion drops below
              half its target. We will not negotiate the threshold mid-pilot.
            </>
          }
        />
        <RfcItem
          h={"What constitutes a \"yes\""}
          b={
            <>
              Cedar and VitalCV scope a 90-day production engagement covering
              50–100 NPIs and a joint definition of when state-board PSV moves
              in-platform under a partner CVO umbrella.
            </>
          }
        />
      </ol>
    </section>
  );
}

function CritItem({
  n,
  title,
  v,
  b,
  target,
}: {
  n: string;
  title: string;
  v: string;
  b: React.ReactNode;
  target: string;
}) {
  return (
    <div className={styles.critItem}>
      <div className="k">
        <span>{n}</span>
        <strong>{title}</strong>
      </div>
      <div className="v">{v}</div>
      <div className="b">{b}</div>
      <div className="targ">
        <span className="lbl">Target</span>
        <span className="num">{target}</span>
      </div>
    </div>
  );
}

// ─── 06 · Appendix ─────────────────────────────────────────────────────────

function SectionSix({
  client,
}: {
  client: ReturnType<typeof resolveDeploymentKitClient> & object;
}) {
  return (
    <section className={styles.section}>
      <SectionHeader
        no="06"
        title="Appendix"
        subtitle="references, contacts, glossary."
        ref_="D43 · S06"
      />
      <div className={styles.appx}>
        <AppxBox
          title="Federal sources"
          sub="resolved by pilot"
          lines={[
            ['NPPES', 'National Plan & Provider Enumeration System'],
            ['PECOS', 'Provider Enrollment, Chain & Ownership'],
            ['OIG / LEIE', 'List of Excluded Individuals & Entities'],
            ['SAM.gov', 'Federal procurement debarment'],
            ['DEA', 'Diversion Control Registration'],
            ['NPDB', 'National Practitioner Data Bank · self-query'],
            ['NCCPA', 'PA board certification (where applicable)'],
          ]}
        />
        <AppxBox
          title={`${client.clientName.split(' ')[0]} contacts`}
          sub={`${client.scopeWindowDays}-day window`}
          lines={[
            ['Pilot owner', client.contacts.pilotOwner],
            ['Credentialing lead', client.contacts.credentialingLead],
            ['Audit lead', client.contacts.auditLead],
            ['Security review', client.contacts.securityReview],
            ['Legal contact', client.contacts.legalContact],
            ['VitalCV founder', 'founder@vitalcv.health'],
            ['Escalation', client.contacts.escalation],
          ]}
        />
      </div>
      <ol className={styles.rfc} style={{ marginTop: 18 }}>
        <RfcItem
          h="Glossary · CVO"
          b={
            <>
              Credentials Verification Organization. The entity that resolves a
              clinician&rsquo;s credentials against primary sources.
              Cedar&rsquo;s incumbent CVO continues to operate during the pilot.
            </>
          }
        />
        <RfcItem
          h="Glossary · PSV"
          b={
            <>
              Primary-Source Verification. The act of resolving a credential
              directly against its issuing authority, not a derivative database.
            </>
          }
        />
        <RfcItem
          h="Glossary · Receipt"
          b={
            <>
              A signed, replayable artifact emitted by the issuer (VitalCV) that
              captures the state of a subject&rsquo;s verification at a moment in
              time. Cryptographically verifiable without network access to
              VitalCV.
            </>
          }
        />
        <RfcItem
          h="Glossary · Subject"
          b={
            <>
              The clinician being verified. The subject holds their vault key;
              VitalCV cannot read their record without their grant.
            </>
          }
        />
      </ol>
    </section>
  );
}

function AppxBox({
  title,
  sub,
  lines,
}: {
  title: string;
  sub: string;
  lines: ReadonlyArray<readonly [string, string]>;
}) {
  return (
    <div className={styles.appxBox}>
      <div className="hd">
        <span>{title}</span>
        <span>{sub}</span>
      </div>
      <div>
        {lines.map(([k, v]) => (
          <div key={k} className="ln">
            <div className="k">{k}</div>
            <div className="v">{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Signature ─────────────────────────────────────────────────────────────

function Signature({
  client,
}: {
  client: ReturnType<typeof resolveDeploymentKitClient> & object;
}) {
  return (
    <div className={styles.sig}>
      <div className="blk">
        <div className="k">
          <span>Authorized · {client.signatureRole}</span>
          <strong>execute on signature</strong>
        </div>
        <div className="line" />
        <div className="v">
          {client.signatureAttention}
          <small>{client.signaturePath}</small>
        </div>
      </div>
      <div className="blk">
        <div className="k">
          <span>Authorized · VitalCV</span>
          <strong>issuer</strong>
        </div>
        <div className="line" />
        <div className="v">
          Founder, VitalCV, Inc.
          <small>did:web:vitalcv.health · {client.effectiveDate}</small>
        </div>
      </div>
    </div>
  );
}

// ─── Colophon ──────────────────────────────────────────────────────────────

function Colophon({
  docNumber,
  revision,
}: {
  docNumber: string;
  revision: string;
}) {
  return (
    <div className={styles.colophon}>
      <span>
        Document <strong>{docNumber}</strong> · {revision}
      </span>
      <span>Print-ready · 6 sections · 1 cover · 1 signature page</span>
    </div>
  );
}

// ─── Utility ───────────────────────────────────────────────────────────────

function numberWord(n: number): string {
  const small: Record<number, string> = {
    1: 'one',
    2: 'two',
    3: 'three',
    4: 'four',
    5: 'five',
    6: 'six',
    7: 'seven',
    8: 'eight',
    9: 'nine',
    10: 'ten',
  };
  return small[n] ?? String(n);
}
