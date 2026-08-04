// Wave 1505 · w1505-legal.jsx — one prose template, four documents
// (DG-12.3). 65ch Geist body, Fraunces headings, mono "Last updated"
// stamp, sticky TOC ≥1024px, anchor links.

const LEGAL_DOCS = {
  privacy: {
    title: 'Privacy notice',
    updated: '2026-07-01', version: 'v1.2',
    sections: [
      { id: 'what-we-read', h: 'What we read', body: (
        <React.Fragment>
          <p>VitalCV reads public, primary sources about licensed clinicians — NPPES, state medical
            board registries, the OIG exclusion list, and, where a clinician authorizes it, CMS PECOS.
            Every read is initiated by a person: the clinician, or an anonymous visitor entering an NPI
            on the preview plane.</p>
          <p>We record what the source said, when we read it, and through which channel. That lineage
            is visible on every surface that shows the data.</p>
        </React.Fragment>
      ) },
      { id: 'what-we-store', h: 'What we store', body: (
        <React.Fragment>
          <p>For account holders: your snapshots, your Recognitions, your share links and their
            revocations, and the audit trail of checks you ran. For anonymous previews: the check
            result is cached briefly and is not tied to you.</p>
          <div className="mono-note">NOT PHI · VitalCV stores no patient data, no clinical records,
            no claims data. The record is about the clinician's credentials, never their patients.</div>
        </React.Fragment>
      ) },
      { id: 'what-we-never-do', h: 'What we never do', body: (
        <ul>
          <li>We never sell your data, in any definition of "sell".</li>
          <li>We never show an employer anything you didn't explicitly share.</li>
          <li>We never alter what a source said — contradictions are shown, not resolved silently.</li>
          <li>We never use your record to train models or build advertising profiles.</li>
        </ul>
      ) },
      { id: 'sharing', h: 'Sharing and revocation', body: (
        <p>A share link exposes exactly the snapshot you chose, to whoever holds the link, until you
          revoke it. Revocation is immediate and logged. Employers see a revoked page that says the
          holder revoked access — nothing softer, nothing vaguer.</p>
      ) },
      { id: 'retention', h: 'Retention', body: (
        <p>Snapshots are kept while your account exists. Delete your account and snapshots are purged
          within 30 days; the fact that a Recognition once occurred remains in the counterparty's
          records, as it does in any exchange of documents. Anonymous preview caches expire within
          24 hours.</p>
      ) },
      { id: 'your-rights', h: 'Your rights', body: (
        <p>Export everything, correct what's wrong at the source (we link you to the source's own
          correction process — we can't edit their records), delete your account, or object to a
          read. Write to <a href="#/contact">privacy@vitalcv.com</a> — a person answers within two
          business days.</p>
      ) },
    ],
  },
  terms: {
    title: 'Terms of service',
    updated: '2026-07-01', version: 'v1.1',
    sections: [
      { id: 'the-service', h: 'The service', body: (
        <p>VitalCV compiles source-backed evidence about clinician credentials into a passport the
          clinician owns and shares. Free for clinicians. Employers use it to start — not finish —
          their own review.</p>
      ) },
      { id: 'decision-boundary', h: 'The decision boundary', body: (
        <React.Fragment>
          <p>VitalCV output is a head start for employer review, not a credentialing decision.
            It is not primary-source verification under NCQA or Joint Commission standards unless a
            surface explicitly says so, and no surface currently does.</p>
          <div className="mono-note">HARD RULE · Anything marked "Not decision-grade" or
            "Self-attested" must not be the basis of an employment or privileging decision.</div>
        </React.Fragment>
      ) },
      { id: 'acceptable-use', h: 'Acceptable use', body: (
        <ul>
          <li>Don't probe NPIs at scale — the preview plane is rate-limited and monitored.</li>
          <li>Don't re-publish share pages or represent a snapshot as newer than its timestamp.</li>
          <li>Don't attempt to use VitalCV data for patient-facing or marketing purposes.</li>
        </ul>
      ) },
      { id: 'availability', h: 'Availability', body: (
        <p>Sources go down; when they do, we say so on the surface and on <a href="../wave1504/index.html#/status">/status</a>.
          We target high availability but sell no SLA outside a signed pilot or enterprise agreement.</p>
      ) },
      { id: 'liability', h: 'Liability', body: (
        <p>We stand behind the lineage: what we show is what the source said at the recorded time,
          through the recorded channel. We are not liable for source errors themselves, for decisions
          made against the stated boundary, or for indirect damages. Statutory rights remain.</p>
      ) },
      { id: 'changes', h: 'Changes', body: (
        <p>Material changes are announced by email and on this page 30 days before they take effect.
          The version stamp above changes every time this document does.</p>
      ) },
    ],
  },
  dpa: {
    title: 'Data processing addendum',
    updated: '2026-07-01', version: 'v1.0',
    sections: [
      { id: 'roles', h: 'Roles', body: (
        <p>For employer pilot data (reviewer accounts, packet decisions), the employer is the
          controller and VitalCV the processor. For clinician passports, VitalCV is the controller —
          clinicians deal with us directly under the <a href="#/legal/privacy">privacy notice</a>.</p>
      ) },
      { id: 'scope', h: 'Scope of processing', body: (
        <p>Processing is limited to compiling, storing, and presenting credential evidence and its
          lineage. No PHI is processed under this addendum, and no BAA is offered because none is
          needed: the record is about clinicians, not patients.</p>
      ) },
      { id: 'subprocessors', h: 'Subprocessors', body: (
        <React.Fragment>
          <p>Current subprocessors, each under a written agreement mirroring these terms:</p>
          <table className="lg-table">
            <thead><tr><th scope="col">Provider</th><th scope="col">Purpose</th><th scope="col">Region</th></tr></thead>
            <tbody>
              <tr><td className="mono">Railway</td><td>Application hosting</td><td className="mono">US</td></tr>
              <tr><td className="mono">Neon</td><td>Postgres database</td><td className="mono">US</td></tr>
              <tr><td className="mono">Clerk</td><td>Authentication</td><td className="mono">US</td></tr>
              <tr><td className="mono">Resend</td><td>Transactional email</td><td className="mono">US</td></tr>
            </tbody>
          </table>
          <p>Changes are announced 30 days in advance; controllers may object in writing.</p>
        </React.Fragment>
      ) },
      { id: 'security', h: 'Security measures', body: (
        <ul>
          <li>Encryption in transit and at rest; keys rotated on the published schedule (see key history on the trust register).</li>
          <li>Access on least-privilege; production access logged and reviewed.</li>
          <li>Signed artifacts: institutional receipts are verifiable against published keys.</li>
        </ul>
      ) },
      { id: 'incidents', h: 'Incidents', body: (
        <p>Confirmed incidents affecting controller data are notified without undue delay and within
          72 hours, with what we know, what we don't, and what happens next — the same fail-closed
          honesty the product uses.</p>
      ) },
      { id: 'deletion', h: 'Return and deletion', body: (
        <p>On termination, controller data is exported on request and deleted within 30 days, with
          written confirmation. Audit lineage that references the controller (e.g. Recognitions
          issued to clinicians) survives as the clinician's record.</p>
      ) },
    ],
  },
  cookies: {
    title: 'Cookie notice',
    updated: '2026-07-01', version: 'v1.0',
    sections: [
      { id: 'stance', h: 'Our stance', body: (
        <p>No advertising cookies, no cross-site tracking, no analytics that require a banner.
          The short table below is the complete list — if it grows, this page changes first.</p>
      ) },
      { id: 'the-list', h: 'The complete list', body: (
        <table className="lg-table">
          <thead><tr><th scope="col">Cookie</th><th scope="col">Purpose</th><th scope="col">Lifetime</th></tr></thead>
          <tbody>
            <tr><td className="mono">__session</td><td>Clerk authentication — keeps you signed in.</td><td className="mono">7 days</td></tr>
            <tr><td className="mono">__client_uat</td><td>Clerk session freshness check.</td><td className="mono">session</td></tr>
            <tr><td className="mono">vcv_prefs</td><td>Interface preferences (e.g. dismissed banners).</td><td className="mono">6 months</td></tr>
          </tbody>
        </table>
      ) },
      { id: 'no-banner', h: 'Why there is no cookie banner', body: (
        <p>Everything above is strictly necessary for a service you asked for, which is why you
          don't see a consent banner. If we ever add a category that requires consent, the banner
          will be designed to house rules — and this notice updated 30 days before.</p>
      ) },
      { id: 'controls', h: 'Your controls', body: (
        <p>Clear cookies in your browser at any time; you'll be signed out and preferences reset.
          Nothing about your passport or snapshots lives in cookies.</p>
      ) },
    ],
  },
};

const LEGAL_ORDER = [
  { key: 'privacy', label: 'Privacy' },
  { key: 'terms', label: 'Terms' },
  { key: 'dpa', label: 'DPA' },
  { key: 'cookies', label: 'Cookies' },
];

const LegalRoute = ({ doc }) => {
  const d = LEGAL_DOCS[doc] || LEGAL_DOCS.privacy;
  return (
    <div className="s5-fade" data-screen-label={`Legal · ${d.title}`}>
      <div className="s5-container" style={{ paddingTop: 'var(--space-10)', paddingBottom: 'var(--space-4)' }}>
        <span className="vt-eyebrow">DG-12.3 · Legal</span>
        <nav className="lg-tabs" aria-label="Legal documents" style={{ marginTop: 12 }}>
          {LEGAL_ORDER.map((t) => (
            <a key={t.key} className="lg-tab" href={`#/legal/${t.key}`}
              aria-current={doc === t.key ? 'page' : undefined}>{t.label}</a>
          ))}
        </nav>
        <div className="lg-layout">
          <aside className="lg-toc" aria-label="On this page">
            <span className="lg-toc-label">On this page</span>
            {d.sections.map((s, i) => (
              <a key={s.id} href={`#/legal/${doc}`} onClick={(e) => {
                e.preventDefault();
                const el = document.getElementById(s.id);
                if (el) { const y = el.getBoundingClientRect().top + window.pageYOffset - 72; window.scrollTo(0, y); }
              }}>
                <span className="n vt-num">{String(i + 1).padStart(2, '0')}</span>{s.h}
              </a>
            ))}
          </aside>
          <article>
            <header className="lg-head">
              <h1>{d.title}</h1>
              <span className="lg-stamp vt-num">
                <span>Last updated {d.updated}</span>
                <span>{d.version}</span>
                <span>vitalcv.com/legal/{doc}</span>
              </span>
            </header>
            <div className="lg-prose">
              {d.sections.map((s, i) => (
                <section key={s.id} id={s.id}>
                  <h2><span className="n vt-num">{String(i + 1).padStart(2, '0')}</span><a className="anchor" href={`#/legal/${doc}`} onClick={(e) => e.preventDefault()}>{s.h}</a></h2>
                  {s.body}
                </section>
              ))}
            </div>
          </article>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { LegalRoute, LEGAL_DOCS, LEGAL_ORDER });
