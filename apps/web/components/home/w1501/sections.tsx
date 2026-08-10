'use client';

/**
 * Wave 1501 · How it works / Why this compounds / MATCHA / By role / Who buys in.
 * Ports `hp-how.jsx`, `hp-why.jsx`, `hp-matcha.jsx`, `hp-roles.jsx`.
 *
 * Copy is the handoff's, except where a claim contradicts the repo's own
 * source-lane truth. Those deviations are marked `TRUTH:` inline with the
 * reason — the design is dated 2026-07-12 and predates the lane-cadence split,
 * and the standing rule is that guards win where they conflict.
 */

import * as React from 'react';
import Link from 'next/link';

import { HonestyLabel, PaperCard, StateChip, type CoverageState } from './primitives';
import { CanonicalPath, Reveal, RoleGlyph, SecHead, type RoleKey } from './shared';

/* ---------- How it works (DG-7.5) ---------- */

const HOW_STEPS = [
  { n: '1', t: 'Enter your NPI', b: 'Ten digits, no account. The check runs against public primary sources.' },
  {
    n: '2',
    t: 'Sources are read',
    // TRUTH: the handoff said "NPPES and OIG LEIE read directly". Only NPPES is
    // read per request; OIG/LEIE is a monthly snapshot and PECOS a quarterly
    // one (lib/trust/sourceLanes.ts). Saying both "read directly" is the exact
    // overclaim #822 removed from this page.
    b: 'NPPES is read live. Snapshot sources say how old they are, and gated sources say so — no checkmark until a source is actually read.',
  },
  { n: '3', t: 'Claim your snapshot', b: 'One claim makes the readiness picture yours — to keep, refresh, and carry between roles.' },
  { n: '4', t: 'Share a scoped view', b: 'Grant a verifier exactly the fields they need, each with its source, freshness, and state.' },
  { n: '5', t: 'Start sooner', b: 'Employers accept the snapshot as a head start. Credentialing committees still make the decision.' },
];

export const HowSection = () => (
  <section className="hp-section" id="how" data-screen-label="How it works">
    <div className="hp-container">
      <SecHead
        eyebrow="How it works"
        title={
          <>
            Five steps, <span className="vt-accent-i">nothing hidden.</span>
          </>
        }
        lede="The same honest states you see on this page are the ones verifiers see. That is the point."
      />
      <div className="how-grid">
        {HOW_STEPS.map((s, i) => (
          <Reveal key={s.n} delay={i * 60} className="how-step">
            <span className="how-num" aria-hidden="true">
              {s.n}
            </span>
            <h3>{s.t}</h3>
            <p>{s.b}</p>
          </Reveal>
        ))}
      </div>
    </div>
  </section>
);

/* ---------- Why this compounds (DG-7.6) ---------- */

const WHY_CARDS = [
  {
    key: 'recognition',
    eyebrow: 'Recognition',
    t: 'Recognition you keep',
    b: 'Every clean read from a primary source becomes recognition attached to your record — not to one employer’s filing cabinet.',
  },
  {
    key: 'acceptance',
    eyebrow: 'Acceptance',
    t: 'Acceptance that spreads',
    b: 'Each organization that accepts your snapshot as a head start makes the next acceptance easier. Org by org — never all at once.',
  },
  {
    key: 'start',
    eyebrow: 'Start',
    t: 'Starts that arrive sooner',
    b: 'As re-collection drops out of the path, the distance from signed offer to first shift shrinks.',
  },
] as const;

export const WhySection = () => (
  <section className="hp-section" id="why" data-screen-label="Why this compounds">
    <div className="hp-container">
      <SecHead
        eyebrow="Why this compounds"
        title={
          <>
            Proof, made <span className="vt-accent-i">portable.</span>
          </>
        }
        lede="A career is a sequence of checks passed. VitalCV keeps each one, so the sequence adds up instead of starting over."
      />
      <div className="why-grid">
        {WHY_CARDS.map((c, i) => (
          <Reveal key={c.key} delay={i * 60}>
            <PaperCard lift style={{ height: '100%', boxSizing: 'border-box' }} className="why-card">
              <span
                className="cpath-label"
                style={{
                  fontSize: 10,
                  letterSpacing: '0.2em',
                  color: c.key === 'recognition' ? 'var(--vt-brand)' : 'var(--vt-text-faint)',
                }}
              >
                <span className={`cpath-dot ${c.key}`} />
                {c.eyebrow.toUpperCase()}
              </span>
              <h3>{c.t}</h3>
              <p>{c.b}</p>
            </PaperCard>
          </Reveal>
        ))}
      </div>
      <Reveal delay={180}>
        <CanonicalPath />
      </Reveal>
    </div>
  </section>
);

/* ---------- Try matching (DG-7.7) ---------- */

type Qa = { id: string; q: string; a: string; chips: [CoverageState, string][] };

const MATCHA_QA: Qa[] = [
  {
    id: 'ready',
    q: 'What does 72% readiness mean?',
    a: 'Readiness is the share of a role’s evidence checklist that already reads clean from primary sources. 72% means most sources read clean; the rest are gated, stale, or waiting on access — and each one says which.',
    chips: [
      ['checked', 'NPPES'],
      ['stale', 'OIG LEIE'],
      ['accessRequired', 'State boards'],
    ],
  },
  {
    id: 'licensure',
    // TRUTH: the handoff's second question was "Why is PECOS shown as gated?",
    // answered with "CMS PECOS requires an enrollment agreement before it can
    // be read." That is no longer true — PECOS reads a real CMS dataset on a
    // quarterly snapshot. State licensure is the lane that is genuinely
    // access-gated, so the question is re-pointed rather than deleted: it
    // still teaches "a gated source never gets a checkmark", using a lane
    // where that is actually the case.
    q: 'Why are state licences not checked?',
    a: 'State boards are access-gated — VitalCV does not read them without an agreement in place. They show as access-required instead of pretending to be checked, because a source that was not read never gets a checkmark.',
    chips: [['accessRequired', 'State boards']],
  },
  {
    id: 'verifier',
    q: 'What can a verifier see?',
    a: 'Only the scoped view you grant: named fields, each carrying its source, freshness, and coverage state. No browsing, no full record, and the grant is yours to revoke.',
    chips: [['previewOnly', 'Scoped view']],
  },
  {
    id: 'replace',
    q: 'Do you replace credentialing?',
    a: 'No. Employers accept a claimed snapshot as a head start, and re-check what their process requires. Credentialing committees still make the decision — VitalCV never replaces them.',
    chips: [['notDecisionGrade', 'Not a decision']],
  },
];

export const MatchaSection = () => {
  const [sel, setSel] = React.useState(MATCHA_QA[0].id);
  const cur = MATCHA_QA.find((x) => x.id === sel) ?? MATCHA_QA[0];
  return (
    <section className="hp-section" id="matcha" data-screen-label="Try matching">
      <div className="hp-container">
        <SecHead
          brand
          eyebrow="Matching · Try it"
          title="Ask the record a hard question."
          lede="Matching answers from the snapshot’s honest states — the same chips you see everywhere on this page."
        />
        <Reveal>
          <div className="mt-panel">
            <div className="mt-chips" role="group" aria-label="Sample questions">
              {MATCHA_QA.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  className="mt-chip"
                  aria-pressed={sel === x.id}
                  onClick={() => setSel(x.id)}
                >
                  {x.q}
                </button>
              ))}
            </div>
            <div className="mt-answer" key={cur.id} aria-live="polite">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    background: 'var(--vt-brand)',
                    flexShrink: 0,
                    borderRadius: 'var(--radius-1)',
                  }}
                />
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: '0.16em',
                    color: 'var(--vt-brand)',
                  }}
                >
                  Matching
                </span>
              </div>
              <p>{cur.a}</p>
              <div className="chips">
                {cur.chips.map(([st, lb]) => (
                  <StateChip key={lb} state={st} size="sm" label={lb} />
                ))}
              </div>
              <HonestyLabel>Scripted demo · answers are illustrative</HonestyLabel>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
};

/* ---------- By role (DG-7.9) ---------- */

const DOORS: { role: RoleKey; name: string; href: string; b: string; cta: string }[] = [
  {
    role: 'clinician',
    name: 'Clinician',
    href: '/clinicians',
    b: 'Claim your snapshot, keep it current, and walk into the next role with evidence in hand.',
    cta: 'Start with your NPI',
  },
  {
    role: 'verifier',
    name: 'Verifier',
    href: '/verify' /* must NOT link to "/" */,
    b: 'Read a shared snapshot: every field carries its source, freshness, and coverage state.',
    cta: 'Open a shared view',
  },
  {
    role: 'employer',
    name: 'Employer',
    href: '/employers',
    b: 'Accept a claimed snapshot as a head start. Your credentialing committee keeps the decision.',
    cta: 'See the pipeline view',
  },
  {
    role: 'issuer',
    name: 'Issuer',
    href: '/issuers',
    b: 'Sign artifacts once — they travel with the clinician as portable, checkable proof.',
    cta: 'Issue signed records',
  },
];

export const DoorsSection = () => (
  <section className="hp-section" id="roles" data-screen-label="By role">
    <div className="hp-container">
      <SecHead
        eyebrow="By role"
        title="Four doors into the same record."
        lede="Everyone reads the same honest states — what differs is what you can do with them."
      />
      <div className="door-grid">
        {DOORS.map((d, i) => (
          <Reveal key={d.role} delay={i * 60} style={{ display: 'grid' }}>
            {/* The handoff stubbed every door with preventDefault. These are
                real routes in this app, so they navigate. */}
            <Link className="door" href={d.href} aria-label={`${d.name}: ${d.cta}`}>
              <span style={{ color: 'var(--vt-text)' }}>
                <RoleGlyph role={d.role} />
              </span>
              <h3>{d.name}</h3>
              <p>{d.b}</p>
              <span className="door-cta">
                {d.cta} <span aria-hidden="true">→</span>
              </span>
            </Link>
          </Reveal>
        ))}
      </div>
    </div>
  </section>
);

/* ---------- Who buys in (DG-7.10) ---------- */

const WHO = [
  {
    dt: 'The clinician',
    dd: 'Proves the career once, keeps the record, and grants access on their own terms — instead of re-assembling a packet for every application.',
  },
  {
    dt: 'The medical staff office',
    dd: 'Starts from a claimed snapshot instead of a blank file. Re-checks what its process requires; stops re-collecting what already reads clean at the source.',
  },
  {
    dt: 'The recruiter',
    dd: 'Screens against a readiness picture with sources attached, not a resume’s claims — and sees exactly which items are gated or stale.',
  },
  {
    dt: 'The issuing institution',
    dd: 'Answers each attestation request once, as a signed artifact that keeps working after it leaves the building.',
  },
];

export const WhoSection = () => (
  <section className="hp-section" id="who" data-screen-label="Who buys in">
    <div className="hp-container">
      <SecHead
        eyebrow="Who buys in"
        title="Built for the people who carry the work."
        lede="Adoption starts where the re-collection burden lives today."
      />
      <dl className="who-dl">
        {WHO.map((x, i) => (
          <Reveal key={x.dt} delay={i * 60} className="who-item" as="div">
            <dt>{x.dt}</dt>
            <dd>{x.dd}</dd>
          </Reveal>
        ))}
      </dl>
    </div>
  </section>
);
