import type { Metadata } from 'next';
import '../../../styles/visual-qa.css';

export const metadata: Metadata = {
  title: 'Visual QA · VitalCV UI upgrade · D57',
  description:
    'Visual QA audit of the VitalCV UI design canon. Eight routes, fourteen components, eight trust states. LIMITED PASS pending nine required fixes.',
};

const SHOT = '/design/qa-shots';

export default function VisualQaPage() {
  return (
    <div className="vqa-root">
      <main className="page">
        <section className="qa-hd">
          <div className="eyebrow">
            <span className="tag">Visual QA · v1</span>
            <span className="ln" />
            <span>VitalCV UI upgrade · D57 · 8 routes · 2026·05·26</span>
          </div>
          <span className="qa-status" style={{ marginTop: '20px' }}>
            <span className="dot" />LIMITED PASS · ship after required fixes
          </span>
          <h1 className="h-display" style={{ fontSize: '52px', marginTop: '10px' }}>
            The visual direction is right. The trust grammar is right. Two surfaces and three components are still drafted, not finished.
          </h1>
          <p className="lede" style={{ marginTop: '18px' }}>
            Eight routes implemented and reviewed against the design brief: NPI-first hero, paper-substrate aesthetic, eight-state trust vocabulary, institution review boundary, source attribution, connector matrix, passwordless auth with disclosure. Premium and calm. Two routes (Receipt Drawer, Evidence Packet) are not yet present as surfaces; one (Audit Timeline) is partially rendered; one (Connector Health Matrix) needs a grid variant beside the table.
          </p>

          <div className="scoreboard">
            <div>
              <span className="k">Routes built</span>
              <span className="v pass">7 of 8</span>
              <span className="sub">+ /contact bonus · /status reviewer flow partial</span>
            </div>
            <div>
              <span className="k">Components shipped</span>
              <span className="v lim">10 of 14</span>
              <span className="sub">4 in spec, not yet rendered</span>
            </div>
            <div>
              <span className="k">Trust states distinct</span>
              <span className="v pass">8 of 8</span>
              <span className="sub">all paired with source + time</span>
            </div>
            <div>
              <span className="k">Banned phrases found</span>
              <span className="v pass">0</span>
              <span className="sub">no bare Verified · no Cleared · no HIPAA claim</span>
            </div>
            <div>
              <span className="k">Required fixes</span>
              <span className="v lim">9</span>
              <span className="sub">3 visual · 6 component-completeness</span>
            </div>
          </div>

          <div className="toc">
            <a href="#status">1 · Status</a>
            <a href="#wins">2 · Wins</a>
            <a href="#gaps">3 · Gaps</a>
            <a href="#screens">4 · Screen-by-screen</a>
            <a href="#components">5 · Components</a>
            <a href="#motion">6 · Motion · interaction</a>
            <a href="#mobile">7 · Mobile</a>
            <a href="#risks">8 · Aesthetic risks</a>
            <a href="#fixes">9 · Required fixes</a>
            <a href="#verdict">10 · Final call</a>
          </div>
        </section>

        {/* ─────── 1 VISUAL QA STATUS ─────── */}
        <section className="qa-section" id="status">
          <div className="eyebrow"><span className="tag">01</span><span className="ln" /><span>Visual QA status</span></div>
          <h2 style={{ marginTop: '14px' }}>LIMITED PASS</h2>
          <p className="lede">
            The design system holds. The paper substrate, ink, hairline, single accent, and eight-state truth grammar are consistently applied across all built routes. Hierarchy is calm, monospace metadata is used appropriately, and the institution review boundary is visible on every relevant surface. Three classes of work remain before this is unconditional <strong>PASS</strong>:
          </p>
          <ul className="body-list">
            <li><strong>Component completeness</strong> — four primitives from the brief (Receipt Drawer, Audit Timeline, Connector Health Matrix as grid, Evidence Packet Preview) are spec&apos;d or partially rendered but not yet finished surfaces.</li>
            <li><strong>Responsive polish</strong> — between 980px and 1180px the nav-status pill crowds the auth buttons and a few labels wrap inside chips/tabs. Strict 1240+ enterprise width is clean.</li>
            <li><strong>Interaction states</strong> — hover and focus are wired; loading, degraded-source, and auth-required states need explicit rendering so the engineering handoff is unambiguous.</li>
          </ul>
        </section>

        {/* ─────── 2 TOP VISUAL WINS ─────── */}
        <section className="qa-section" id="wins">
          <div className="eyebrow"><span className="tag">02</span><span className="ln" /><span>Top visual wins</span></div>
          <h2 style={{ marginTop: '14px' }}>What the implementation got right.</h2>
          <p className="lede">Six things that earn the &ldquo;state-of-the-art&rdquo; descriptor and that the team should not regress on.</p>

          <div className="qa-card-grid" style={{ marginTop: '24px' }}>
            <div className="win-card">
              <span className="num">W·01</span>
              <h4>The Truth Chip — two-segment, never bare.</h4>
              <p>Every state chip pairs an ink state (&ldquo;SOURCE-BACKED&rdquo;) with its source and timestamp (&ldquo;ABMS · 14d&rdquo;) inside one capsule, separated by a hairline rule. This is the single most important visual decision in the system — no fact ever floats without its citation.</p>
            </div>
            <div className="win-card">
              <span className="num">W·02</span>
              <h4>Paper substrate, ink content, hairline structure.</h4>
              <p>Warm off-white substrate, near-black ink, 1px hairlines instead of cards-within-cards. The product reads like an issued document on every route — sign-in, passport, status, trust register all share the same visual vocabulary at the pixel level.</p>
            </div>
            <div className="win-card">
              <span className="num">W·03</span>
              <h4>The eight trust states are mutually distinct.</h4>
              <p>Source-backed (cool green), Pending (warm amber), Source unavailable (neutral gray), Self-reported (cool blue), Institution must review (ink-indigo, the accent), Sanction (dampened red), Sources disagree (purple), Not asserted (dashed). Each is recognizable from across the room.</p>
            </div>
            <div className="win-card">
              <span className="num">W·04</span>
              <h4>The institution review boundary is loud without being alarming.</h4>
              <p>An accent-washed banner on every passport, a dedicated step on the proof rail labeled &ldquo;REVIEW BOUNDARY&rdquo;, a literal block in the right rail listing what institutions must read themselves. Calm, persistent, impossible to miss.</p>
            </div>
            <div className="win-card">
              <span className="num">W·05</span>
              <h4>Sign-in / sign-up explains the why before the form.</h4>
              <p>The left panel of both auth pages is a disclosure stack — why sign-in matters, what it isn&apos;t, how authentication works — rather than a marketing hero. Restraint with substance.</p>
            </div>
            <div className="win-card">
              <span className="num">W·06</span>
              <h4>The /status connector matrix is genuinely enterprise-grade.</h4>
              <p>Tabular layout with per-source truth chips, 24h sparkline, median latency, last-error column, per-row action. Reads like a Stripe API status page. The SAM.gov degraded row (503 · 02h · Force retry) demonstrates how degraded states render without blaming anyone.</p>
            </div>
          </div>
        </section>

        {/* ─────── 3 TOP VISUAL GAPS ─────── */}
        <section className="qa-section" id="gaps">
          <div className="eyebrow"><span className="tag">03</span><span className="ln" /><span>Top visual gaps</span></div>
          <h2 style={{ marginTop: '14px' }}>What&apos;s missing or unfinished.</h2>
          <p className="lede">Six gaps between the brief and what&apos;s shipped — none break the system, all should land before this is unconditional PASS.</p>

          <div className="qa-card-grid" style={{ marginTop: '24px' }}>
            <div className="gap-card">
              <span className="num">G·01</span>
              <h4>No Receipt Drawer yet.</h4>
              <p>Receipts render inline (on the passport aside and on the verdict block of /trust), but there&apos;s no slide-in drawer surface for replaying a full receipt with the signed payload, request/response codes, and the raw response trail. The brief lists this as a primary component.</p>
            </div>
            <div className="gap-card">
              <span className="num">G·02</span>
              <h4>No Evidence Packet Preview.</h4>
              <p>The /passport CTA &ldquo;Send to institution&rdquo; jumps directly to send. The user should first see what fields, what scope, what TTL, and what receipt the recipient will see — as a preview panel before commit.</p>
            </div>
            <div className="gap-card">
              <span className="num">G·03</span>
              <h4>Audit Timeline is rendered as a list, not a timeline.</h4>
              <p>The passport&apos;s &ldquo;Source timeline&rdquo; right-rail is a vertical text list. The brief asks for a true timeline component with scrubable nodes and a now-marker. Functional today, not the spec.</p>
            </div>
            <div className="gap-card">
              <span className="num">G·04</span>
              <h4>Connector Health Matrix needs a grid variant.</h4>
              <p>/status renders the matrix as a tall table — excellent for detail. The brief also wants a compact source-by-state grid (rows = sources, cols = states / freshness buckets) for at-a-glance reading on the home page nav-status pill.</p>
            </div>
            <div className="gap-card">
              <span className="num">G·05</span>
              <h4>Role doors don&apos;t open into role-specific screens yet.</h4>
              <p>The three doors on / point at the same passport URL with different query params. They should open into three distinct surfaces: clinician (add self-report), institution reviewer (with reconcile + attest controls disabled until evidence ready), operator (status dashboard). Sign-up has a role selector but no role-specific second step.</p>
            </div>
            <div className="gap-card">
              <span className="num">G·06</span>
              <h4>No designed loading or auth-required states.</h4>
              <p>The system never spins. But when a passport is being read for the first time, or when a route requires sign-in, the user needs a calm rendered state — not a flash of empty page. These are not yet drawn.</p>
            </div>
          </div>
        </section>

        {/* ─────── 4 SCREEN-BY-SCREEN QA ─────── */}
        <section className="qa-section" id="screens">
          <div className="eyebrow"><span className="tag">04</span><span className="ln" /><span>Screen-by-screen QA</span></div>
          <h2 style={{ marginTop: '14px' }}>Eight routes · rendered &amp; reviewed.</h2>
          <p className="lede" style={{ marginBottom: '24px' }}>Each screen below pairs a live capture with its specific wins, gaps, and required fixes.</p>

          {/* / */}
          <ScreenQa
            route="/"
            title="Landing · NPI-first hero · role doors · passport preview · eight states"
            verdict="pass"
            shots={[
              { src: `${SHOT}/01-landing.png`, alt: 'Landing hero' },
              { src: `${SHOT}/02-landing.png`, alt: 'Proofs + cmd pill' },
              { src: `${SHOT}/03-landing.png`, alt: 'Role doors + passport preview' },
              { src: `${SHOT}/04-landing.png`, alt: 'Eight states' },
            ]}
            wins={[
              'NPI input is the unmistakable primary affordance — large mono input, accent CTA, eyebrow label “NPI · NPPES PUBLIC REGISTRY” floating off the card edge.',
              'The display headline uses Fraunces italic for “source-backed” — a single emotional accent in an otherwise restrained page.',
              'Role doors are three columns at desktop with role label, name, plain-prose description, three use cases as mono bullets, accent CTA below a hairline.',
              'Passport preview shows real Truth Chips with real sources — the user understands the product before clicking anything.',
              'Eight-state grid at the bottom is a designed glossary, not buried documentation.',
            ]}
            gaps={[
              'The four “proofs” tiles (Fields read · Public sources · Self-reported · Review boundary) repeat data shown two scrolls down. Either lift them above the hero or remove.',
              'Role doors all point at the same passport URL — should differ.',
            ]}
            reqs={[
              'Tighten nav-status pill so it doesn’t crowd auth buttons between 980–1180px.',
              'Resolve role doors to three distinct surfaces.',
            ]}
          />

          {/* /passport */}
          <ScreenQa
            route="/passport?npi=1699264564"
            title="Passport · header · proof rail · field rows · review boundary · receipt"
            verdict="pass"
            shots={[
              { src: `${SHOT}/01-passport.png`, alt: 'Passport header' },
              { src: `${SHOT}/02-passport.png`, alt: 'Field rows with truth chips' },
              { src: `${SHOT}/03-passport.png`, alt: 'Sanction + review boundary' },
              { src: `${SHOT}/04-passport.png`, alt: 'Receipt + timeline' },
            ]}
            wins={[
              'Header reads like a printed page: name, mono NPI, last-read timestamp, three actions (Print, Share scoped view, Send to institution) where Send is the only primary.',
              'The Proof Continuity Rail (Self-asserted → Public sources → Reconciled → Institution review) sits below the header with the current step accented and the institution-review step explicitly tagged “REVIEW BOUNDARY”.',
              <>Field rows are atomic: monospace label, sans value, monospace source line, trailing two-segment Truth Chip. <strong>Sources disagree</strong> chip surfaces real contradiction on the practice-address row.</>,
              'Sanction & exclusion block is honest — OIG returns no record (literal), SAM.gov is unavailable (system-side calm), NPDB is institution-only (boundary visible).',
              'The right-aside Receipt panel reads as a printable document with subject, sources, time, ed25519 signature.',
            ]}
            gaps={[
              'Source timeline in right rail is a text list — should be a true Audit Timeline component with dots, lines, and a now-marker.',
              '“Send to institution” jumps directly — needs an Evidence Packet Preview drawer between intent and commit.',
              'No degraded-source banner at top when SAM.gov is offline; only the affected field row says so. Add a slim banner.',
            ]}
            reqs={[
              'Replace Source Timeline list with a real Audit Timeline component.',
              'Add Evidence Packet Preview drawer behind the Send CTA.',
            ]}
          />

          {/* /sign-in */}
          <ScreenQa
            route="/sign-in"
            title="Sign in · split-panel · disclosure left · passwordless right"
            verdict="pass"
            shots={[
              { src: `${SHOT}/01-signin.png`, alt: 'Sign in top' },
              { src: `${SHOT}/02-signin.png`, alt: 'Sign in scrolled' },
            ]}
            wins={[
              <>Black left panel with Fraunces italic accent (&ldquo;<em>source-backed</em>&rdquo;) and three plain-language disclosures: why sign in matters, what it is not, how authentication works.</>,
              'Role-aware segmented control selects Clinician/Reviewer/Operator before login — the role door extends into auth.',
              'Passwordless OTP code is shown mono with tracked letter-spacing — feels like a receipt, not a password field.',
              'Review-boundary banner is repeated in the right form, just above the submit — the user can’t sign in without seeing it.',
            ]}
            gaps={[
              'Role tabs (“My passport”) wrap to two lines at narrow viewport — labels should stay single-line.',
              'No “code sent · waiting” state rendered between email and OTP — the form jumps both fields at once.',
            ]}
            reqs={[
              'Single-line role tab labels.',
              'Render a sent-OTP confirmation state.',
            ]}
          />

          {/* /sign-up */}
          <ScreenQa
            route="/sign-up"
            title={'Sign up · "Three things a passport gives you. Nothing it claims about you."'}
            verdict="pass"
            shots={[
              { src: `${SHOT}/01-signup.png`, alt: 'Sign up top' },
              { src: `${SHOT}/02-signup.png`, alt: 'Sign up bottom' },
            ]}
            wins={[
              'Headline does the disclosure work in two sentences: what a passport gives you, what it never claims. No marketing tone.',
              'Four-row Auth Disclosure Card: what you get, what you control, what it never claims, accreditation scope (explicit “no HIPAA / SOC 2 / NCQA” line).',
              'NPI is the first field — same affordance as the landing hero. Continuity.',
              'By-creating-this-passport confirmation block before submit, with the boundary banner inline.',
            ]}
            gaps={[
              'No second-step preview (“This is what your passport will look like in 60s”) before commit.',
              '“You are” segment has only two options — clinician / reviewer — but the role door triad on / lists three. Reconcile.',
            ]}
            reqs={[
              'Add Operator door OR remove the third door on / to match.',
            ]}
          />

          {/* /trust */}
          <ScreenQa
            route="/trust"
            title="Trust register · what VitalCV reads · what it doesn't · who reviews"
            verdict="pass"
            shots={[
              { src: `${SHOT}/01-trust.png`, alt: 'Trust hero' },
              { src: `${SHOT}/02-trust.png`, alt: 'Trust register table' },
              { src: `${SHOT}/03-trust.png`, alt: 'Trust primitives' },
              { src: `${SHOT}/04-trust.png`, alt: 'Banned phrases' },
            ]}
            wins={[
              'Display headline declares the architecture in one line: “A reusable reader. A visible boundary. A receipt for every fact.”',
              <>Trust register table has the bravest column in the product: <strong>&ldquo;What it never does&rdquo;</strong> — adjacent to &ldquo;What VitalCV does&rdquo;, per category.</>,
              'Three trust primitives below (Source attribution · Review boundary · Read receipts) render the corresponding component live.',
              'Explicit banned-words section in two columns: never-on-a-clinician (Cleared, Approved, Verified-bare, Eligible to practice…) and never-about-VitalCV (HIPAA-certified, SOC 2 Type II, NCQA-accredited, real-time…).',
            ]}
            gaps={[
              'No anchor links from the register table rows to the matching /trust/attribution sections — should be clickable cross-references.',
            ]}
            reqs={[
              'Wire register-row category names as cross-links to attribution.',
            ]}
          />

          {/* /trust/attribution */}
          <ScreenQa
            route="/trust/attribution"
            title="Source attribution · per source · what we read · what we don't"
            verdict="pass"
            shots={[
              { src: `${SHOT}/01-attribution.png`, alt: 'Attribution top' },
              { src: `${SHOT}/02-attribution.png`, alt: 'NPPES + ABMS blocks' },
              { src: `${SHOT}/03-attribution.png`, alt: 'State + OIG blocks' },
              { src: `${SHOT}/04-attribution.png`, alt: 'NPDB institution-only' },
            ]}
            wins={[
              'Per source: logo + name + URL + truth chip (state + last read), 2×2 grid of Type/Auth/Refresh/Freshness, then dl-list of Fields read / Not read / What we do / What we never claim.',
              'NPDB block is treated as a deliberate exception — accent-washed callout, “we do not read this” stated literally, with the institution-must-read attribution chip.',
              'SAM.gov block surfaces current 503 status inline — the attribution page itself is honest about live source health.',
            ]}
            gaps={[
              'Left nav rail loses its sticky positioning at narrow viewport and collapses to a flat list — fine, but a single sticky table-of-contents row at the top would help scrolling.',
            ]}
            reqs={[
              'Add a sticky thin TOC bar that activates below 1100px width.',
            ]}
          />

          {/* /status */}
          <ScreenQa
            route="/status"
            title="Status · connector matrix · read history · operational scope"
            verdict="pass"
            shots={[
              { src: `${SHOT}/01-status.png`, alt: 'Status top' },
              { src: `${SHOT}/02-status.png`, alt: 'Connector matrix' },
              { src: `${SHOT}/03-status.png`, alt: 'Read history' },
              { src: `${SHOT}/04-status.png`, alt: 'Operational scope' },
            ]}
            wins={[
              'Sparkline-per-row, median latency, last-error column. SAM.gov degraded row shows diminishing sparkline ending in a stub — calm, legible degraded state.',
              'Read history log uses mono throughout: timestamp, response chip, source, action, latency. Reads like a tail of a healthy production log.',
              'Operational scope card explicitly states “None claimed” for HIPAA / SOC 2 / NCQA — and reserves space for citation if procured.',
              'A “Reading note” banner under the matrix repeats the system-side calm principle: source 503 ≠ clinician failure.',
            ]}
            gaps={[
              'No compact at-a-glance Connector Health Matrix grid variant — only the deep table.',
              'No real-time refresh indicator — the “auto-refresh 30s” claim has no visible heartbeat.',
            ]}
            reqs={[
              'Add compact grid variant of the matrix above the table.',
              'Add a quiet auto-refresh tick (no animation; mono countdown).',
            ]}
          />

          {/* Nav / Footer */}
          <ScreenQa
            route="nav · footer"
            title="Global chrome · cross-route consistency"
            verdict="limit"
            singleShot={{ src: `${SHOT}/05-landing.png`, alt: 'Footer + truth row' }}
            wins={[
              'Footer carries the brand blob + scope note (public-source reader, review-bounded · not a credentialing body), product/account/sources columns, and a bottom row with current truth-state pill (“3 of 4 sources responding”) and Receipt id.',
              'Disclaimer paragraph at the very bottom states no-HIPAA / no-SOC 2 / no-NCQA outright in mono.',
            ]}
            gaps={[
              'Nav crowds between 980–1180px: nav-status pill, two buttons, and nav links all compete for horizontal space.',
              'No visible cmd palette (⌘K) on most pages — the cmd-pill on /passport implies it’s there; needs to render on all routes.',
            ]}
            reqs={[
              'Tighten nav at intermediate widths; collapse nav-status to a single dot indicator that expands on hover.',
              'Make ⌘K palette globally available; render cmd-pill in nav on every route.',
            ]}
          />
        </section>

        {/* ─────── 5 COMPONENT QA ─────── */}
        <section className="qa-section" id="components">
          <div className="eyebrow"><span className="tag">05</span><span className="ln" /><span>Component QA</span></div>
          <h2 style={{ marginTop: '14px' }}>Fourteen components in the brief · ten shipped.</h2>
          <p className="lede">Per-component status with notes on what&apos;s right and what&apos;s missing.</p>

          <div className="card" style={{ marginTop: '18px' }}>
            <table className="component-tbl">
              <thead>
                <tr>
                  <th>Component</th>
                  <th>Status</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                <ComponentRow
                  name="NPI Lookup Hero" sub="landing + sign-up" status="shipped"
                  notes="Floating “NPI · NPPES public registry” label, mono input, accent CTA, mono hint list of fields we read, disclaimer below dashed rule. Used twice with consistent treatment."
                />
                <ComponentRow
                  name="Role Door Card" sub="landing" status="shipped"
                  notes="Three cards: serif-italic letter icon, mono role label, sans name, plain description, three use-case bullets, accented CTA with arrow on a hairline. Should resolve to distinct surfaces."
                />
                <ComponentRow
                  name="Passport Header" sub="passport top" status="shipped"
                  notes="64px avatar, name + specialty, mono NPI / institution / passport-draft id, last-read tile + action row (Print · Share scoped view · Send to institution). Four-tile summary band below."
                />
                <ComponentRow
                  name="Truth-State Chip" sub="everywhere" status="shipped"
                  notes="Two-segment compound: state + source/timestamp. Eight variants (source-backed, pending-source, source-unavailable, self-reported, review-needed, sanction, contradicted, not-asserted). Never bare."
                />
                <ComponentRow
                  name="Source Row" sub="passport aside + attribution sticky" status="shipped"
                  notes="Serif-italic letter icon, source name + sub-line, status chip, age. Used in passport right rail and attribution left nav."
                />
                <ComponentRow
                  name="Connector Matrix" sub="status" status="partial"
                  notes="Deep table variant is excellent. Needs a compact grid variant (rows = sources, cols = state buckets) for at-a-glance use on landing & in nav."
                />
                <ComponentRow
                  name="Proof Continuity Rail" sub="passport" status="shipped"
                  notes="Four-step rail: Self-asserted → Public sources → Reconciled → Institution review. Current step accent-topped; last step labeled “REVIEW BOUNDARY”."
                />
                <ComponentRow
                  name="Institution Review Panel" sub="passport" status="shipped"
                  notes="Accent-washed block listing items the institution must read or attest. Bulleted, not checkboxed (VitalCV never marks complete)."
                />
                <ComponentRow
                  name="Auth Disclosure Card" sub="sign-in + sign-up" status="shipped"
                  notes="Left-panel stacked disclosures with icon + key + value. Three to four entries per page, each one mono caption + sans body."
                />
                <ComponentRow
                  name="Trust Register Table" sub="trust" status="shipped"
                  notes="Five-column table with what-we-do / what-we-never-do adjacency. Each row carries its own state chip."
                />
                <ComponentRow
                  name="Status Matrix" sub="status" status="shipped"
                  notes="Per-source rows with sparkline, last-read, latency, last-error, action button. See gap on compact grid variant above."
                />
                <ComponentRow
                  name="Receipt Drawer" sub="brief" status="not-shipped"
                  notes="Inline Receipt component is shipped, but the slide-in drawer surface for replaying a full receipt with response trail is not. Brief requires."
                />
                <ComponentRow
                  name="Audit Timeline" sub="brief" status="partial"
                  notes="Rendered as a vertical text list on the passport right rail. Brief asks for a proper timeline with dots, lines, now-marker, and (eventually) scrub."
                />
                <ComponentRow
                  name="Footer Trust Row" sub="everywhere" status="shipped"
                  notes="Per-route truth-row pill (“3 of 4 sources responding · 09:14 UTC”) + receipt id + disclaimer paragraph. Persistent and consistent."
                />
              </tbody>
            </table>
          </div>
        </section>

        {/* ─────── 6 MOTION / INTERACTION QA ─────── */}
        <section className="qa-section" id="motion">
          <div className="eyebrow"><span className="tag">06</span><span className="ln" /><span>Motion · interaction QA</span></div>
          <h2 style={{ marginTop: '14px' }}>Motion is restrained on purpose. A few states still need to be drawn.</h2>

          <div className="qa-card-grid" style={{ marginTop: '24px' }}>
            <div className="win-card">
              <span className="num">M·01</span>
              <h4>Hover lifts the hairline, not a shadow.</h4>
              <p>Buttons, doors, table rows, and source rows all transition border-color and background-warm on hover at 120ms ease — no shadow blooms, no card jumps. This is the right call.</p>
            </div>
            <div className="win-card">
              <span className="num">M·02</span>
              <h4>Focus reveals the accent wash.</h4>
              <p>Inputs show a 4px outer ring at <code>oklch(94% .025 274)</code> on focus — a quiet halo, the only place the indigo accent appears outside of primary CTAs.</p>
            </div>
            <div className="gap-card">
              <span className="num">M·03</span>
              <h4>Loading is not drawn.</h4>
              <p>No spinners (correct), but no skeleton or read-in-progress surface either. The passport should show a calm &ldquo;Reading sources…&rdquo; state on first load with progressive Truth Chips populating as each source returns.</p>
            </div>
            <div className="gap-card">
              <span className="num">M·04</span>
              <h4>Auth-required state is not drawn.</h4>
              <p>When a deep link to /passport requires sign-in, the page should not redirect — it should render the read-only public view with an inline sign-in prompt over the protected fields. Not yet built.</p>
            </div>
            <div className="gap-card">
              <span className="num">M·05</span>
              <h4>Degraded-source needs a slim banner.</h4>
              <p>Today the affected row says &ldquo;Source unavailable&rdquo; but the page header is silent. A slim hairline-bordered banner (&ldquo;SAM.gov offline · 02h · 1 field affected&rdquo;) should sit just under the proof rail when any required source is down.</p>
            </div>
            <div className="win-card">
              <span className="num">M·06</span>
              <h4>Source-backed state reads at a glance.</h4>
              <p>Cool green ink + cool green wash + green dot + mono source + age. Across all eight states the differentiation is high enough that a reviewer can scan a 30-row table in under five seconds.</p>
            </div>
          </div>
        </section>

        {/* ─────── 7 MOBILE QA ─────── */}
        <section className="qa-section" id="mobile">
          <div className="eyebrow"><span className="tag">07</span><span className="ln" /><span>Mobile QA</span></div>
          <h2 style={{ marginTop: '14px' }}>Mobile is functional but not yet designed.</h2>
          <p className="lede">The current implementation collapses to single column below 860px and is readable. It is not yet optimized — and for an enterprise tool used primarily on desktop, that&apos;s defensible for v1. A short list of mobile-specific decisions to make before any mobile rollout:</p>

          <div className="risk-list" style={{ marginTop: '24px' }}>
            <div className="risk">
              <span className="lvl med">Mobile · Med</span>
              <h5>Field rows collapse to one column — Truth Chip ends up below the value.</h5>
              <p>At &lt;860px the 200px label + value + meta grid stacks. The Truth Chip lands beneath its own value, which is OK, but the source line above it duplicates the chip&apos;s content. Pick one.</p>
            </div>
            <div className="risk">
              <span className="lvl med">Mobile · Med</span>
              <h5>Proof Continuity Rail wraps to 2×2 on mobile, loses linear motion.</h5>
              <p>Acceptable; not great. A horizontal-scroll variant (with a 1px hairline guide) would preserve the metaphor.</p>
            </div>
            <div className="risk">
              <span className="lvl low">Mobile · Low</span>
              <h5>Nav links hide entirely on mobile; no hamburger.</h5>
              <p>Brand + Sign-in button only at &lt;860px. Add a slide-down menu sheet (paper substrate, hairline borders) — not a dropdown.</p>
            </div>
            <div className="risk">
              <span className="lvl high">Mobile · High</span>
              <h5>Status connector matrix has horizontal overflow on mobile.</h5>
              <p>7-column table is unscaled. Either accept horizontal scroll with a sticky first column, or render the compact grid variant (gap G·04 above) on mobile.</p>
            </div>
          </div>
        </section>

        {/* ─────── 8 AESTHETIC RISKS ─────── */}
        <section className="qa-section" id="risks">
          <div className="eyebrow"><span className="tag">08</span><span className="ln" /><span>Aesthetic risk list</span></div>
          <h2 style={{ marginTop: '14px' }}>What will degrade the system if left unattended.</h2>

          <div className="risk-list" style={{ marginTop: '24px' }}>
            <div className="risk">
              <span className="lvl high">High</span>
              <h5>Accent creep.</h5>
              <p>Today ink-indigo accent is used only for primary CTAs and the review boundary. The day a future PR introduces an accent-colored chart, an accent-colored chip, or an accent-tinted nav, the system loses its weight. Keep the rule: <strong>one accent per screen, used surgically</strong>.</p>
            </div>
            <div className="risk">
              <span className="lvl high">High</span>
              <h5>Truth Chip dilution.</h5>
              <p>If anyone ever ships a single-segment chip that says just &ldquo;VERIFIED&rdquo;, we have lied to the user. The two-segment form (state + source/time) must be enforceable in code — make it impossible to render <code>&lt;TruthChip&gt;</code> without a source prop.</p>
            </div>
            <div className="risk">
              <span className="lvl med">Med</span>
              <h5>Density drift on dashboards.</h5>
              <p>The /status table is dense in a calm way. Future &ldquo;operator&rdquo; surfaces will tempt the team toward Tailwind-default padding, larger radii, and softer shadows. Lock down spacing tokens; don&apos;t allow more than the 4–8–12–16–24–32 scale.</p>
            </div>
            <div className="risk">
              <span className="lvl med">Med</span>
              <h5>Serif italic overuse.</h5>
              <p>Fraunces italic is used in three places: hero word (&ldquo;source-backed&rdquo;), passport name italic on the passport id chip, source-row icon glyph. If it shows up in body copy or button labels, it stops being an accent.</p>
            </div>
            <div className="risk">
              <span className="lvl low">Low</span>
              <h5>Receipt block decoration drift.</h5>
              <p>The diagonal-stripe top border on the Receipt block is the only ornamental flourish in the system. Keep it; don&apos;t add more (no seals, no QR codes, no certificates).</p>
            </div>
            <div className="risk">
              <span className="lvl low">Low</span>
              <h5>Dark mode unplanned.</h5>
              <p>Earlier wave 5 had dark-mode tokens. The new system is light-only. Decide explicitly: light-only forever, or build a paper-inverse dark mode that keeps the document feel.</p>
            </div>
          </div>
        </section>

        {/* ─────── 9 REQUIRED FIXES ─────── */}
        <section className="qa-section" id="fixes">
          <div className="eyebrow"><span className="tag">09</span><span className="ln" /><span>Required fixes</span></div>
          <h2 style={{ marginTop: '14px' }}>Nine items to clear before unconditional PASS.</h2>
          <p className="lede">Priorities are sequenced — F·01 lands first, F·09 lands last. Each maps to a specific surface; no fix touches more than two files.</p>

          <div className="fix-list" style={{ marginTop: '24px' }}>
            <div className="fix-row head">
              <span>Priority</span>
              <span>What ships</span>
              <span>Where</span>
              <span>Scope</span>
            </div>
            <FixRow
              pri="F·01 · P0"
              what="Receipt Drawer"
              detail="Slide-in panel for replaying a full receipt: subject, sources, response codes, signed payload, raw response trail."
              where="/passport · /trust · global ⌘K result"
              scope="new component"
            />
            <FixRow
              pri="F·02 · P0"
              what="Evidence Packet Preview"
              detail="Show fields · scope · TTL · recipient view before commit, behind “Send to institution”."
              where="/passport → modal"
              scope="new surface"
            />
            <FixRow
              pri="F·03 · P0"
              what="Audit Timeline as a real timeline"
              detail="Replace the text-list with a left-rail timeline component (dots + lines + now-marker + scrub)."
              where="/passport right rail"
              scope="component upgrade"
            />
            <FixRow
              pri="F·04 · P1"
              what="Connector Health Matrix · compact grid"
              detail="Rows = sources, columns = freshness buckets, cells colored by truth state. Lives above the deep table on /status and is summarized in the nav."
              where="/status · nav"
              scope="new variant"
            />
            <FixRow
              pri="F·05 · P1"
              what="Loading + auth-required states"
              detail="Read-in-progress passport (chips populate progressively). Auth-required overlay (read-only beneath, sign-in prompt over the protected fields)."
              where="/passport · gated routes"
              scope="interaction states"
            />
            <FixRow
              pri="F·06 · P1"
              what="Nav responsive polish"
              detail="Collapse nav-status pill to a single dot indicator that expands on hover between 980–1180px. Render ⌘K cmd-pill in nav on every route."
              where="global nav"
              scope="CSS polish"
            />
            <FixRow
              pri="F·07 · P1"
              what="Degraded-source banner"
              detail="Slim hairline banner under the proof rail when any required source is down: “SAM.gov offline · 02h · 1 field affected · See /status”."
              where="/passport"
              scope="component"
            />
            <FixRow
              pri="F·08 · P2"
              what="Role doors resolve to distinct surfaces"
              detail="Clinician (add self-report flow), Reviewer (reconcile + attest, disabled until evidence ready), Operator (status console)."
              where="role-specific routes"
              scope="routes"
            />
            <FixRow
              pri="F·09 · P2"
              what="Mobile pass"
              detail="Hamburger nav sheet, horizontal-scroll proof rail, sticky-first-column status table or grid variant, dedupe field-row source line vs Truth Chip below 860px."
              where="global · < 860px"
              scope="responsive"
            />
          </div>
        </section>

        {/* ─────── 10 FINAL CALL ─────── */}
        <section className="qa-section" id="verdict">
          <div className="eyebrow"><span className="tag">10</span><span className="ln" /><span>Final design call</span></div>

          <div className="verdict-box" style={{ marginTop: '18px' }}>
            <div className="eyebrow">
              <span>Visual QA</span>
              <span className="ln" />
              <span>2026·05·26 · Design</span>
            </div>
            <h2><em>LIMITED PASS.</em> Ship after the nine required fixes.</h2>
            <p>The visual system is right: paper substrate, ink, hairline, single accent, eight trust states, every fact paired with its source and time, institution review boundary visible on every relevant surface. None of the banned phrases appear. No source is paraphrased. No clinician is blamed for a source outage. The /status connector matrix and the /passport proof rail are state-of-the-art on their own.</p>
            <p style={{ marginTop: '14px' }}>What remains is component completeness — Receipt Drawer, Evidence Packet Preview, real Audit Timeline, compact Connector Health Matrix — plus three interaction states (loading, auth-required, degraded banner) and a small responsive pass. None of it requires rethinking the system; all of it composes from the primitives already in tokens. <strong>Build in the order on §9. Hold the line on §08. Do not invent a second accent.</strong></p>
            <div className="sig">
              <span className="av">VQ</span>
              <span>Visual QA v1 · D57 · Approved with fixes</span>
              <span style={{ marginLeft: 'auto' }}>RECEIPT · VQ‑D57‑0001 · ed25519</span>
            </div>
          </div>
        </section>

        {/* In-page footer strip (matches canon footer-bottom; sits inside the page so the global Footer still renders below) */}
        <footer className="footer">
          <div className="footer-bottom">
            <span className="truth-row">
              <span className="dot" style={{ background: 'var(--src-pending)' }} />
              Visual QA · LIMITED PASS · 9 required fixes
            </span>
            <span className="sp" />
            <span>VitalCV Visual QA · D57 · 2026·05·26 · QA receipt VQ‑D57‑0001</span>
          </div>
        </footer>
      </main>
    </div>
  );
}

/* ── Sub-components ───────────────────────────────────────────── */

interface Shot {
  src: string;
  alt: string;
}

interface ScreenQaProps {
  route: string;
  title: string;
  verdict: 'pass' | 'limit';
  shots?: Shot[];
  singleShot?: Shot;
  wins: ReadonlyArray<React.ReactNode>;
  gaps: ReadonlyArray<React.ReactNode>;
  reqs: ReadonlyArray<React.ReactNode>;
}

function ScreenQa({ route, title, verdict, shots, singleShot, wins, gaps, reqs }: ScreenQaProps) {
  return (
    <div className="screen-qa">
      <div className="screen-qa-hd">
        <span className="route">{route}</span>
        <h3>{title}</h3>
        <span className={`verdict ${verdict}`}>{verdict === 'pass' ? 'PASS' : 'LIMITED PASS'}</span>
      </div>
      <div className="screen-qa-bd">
        {singleShot ? (
          <div className="screen-qa-shot">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={singleShot.src} alt={singleShot.alt} />
          </div>
        ) : shots ? (
          <div className="shot-stack">
            {shots.map((s) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={s.src} src={s.src} alt={s.alt} />
            ))}
          </div>
        ) : null}
        <div className="screen-qa-notes">
          <h5>Wins</h5>
          <ul>
            {wins.map((w, i) => (
              <li key={`w-${i}`} className="win">{w}</li>
            ))}
          </ul>
          <h5>Gaps</h5>
          <ul>
            {gaps.map((g, i) => (
              <li key={`g-${i}`} className="gap">{g}</li>
            ))}
          </ul>
          <h5>Required fixes</h5>
          <ul>
            {reqs.map((r, i) => (
              <li key={`r-${i}`} className="req">{r}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

interface ComponentRowProps {
  name: string;
  sub: string;
  status: 'shipped' | 'partial' | 'not-shipped';
  notes: string;
}

function ComponentRow({ name, sub, status, notes }: ComponentRowProps) {
  const label =
    status === 'shipped' ? 'Shipped' : status === 'partial' ? 'Partial' : 'Not shipped';
  const truthClass = status === 'shipped' ? 't-backed' : 't-pending';
  return (
    <tr>
      <td>
        <span className="nm">
          {name}
          <small>{sub}</small>
        </span>
      </td>
      <td>
        <span className={`truth ${truthClass}`}>
          <span className="st">
            <span className="glyph" />
            {label}
          </span>
        </span>
      </td>
      <td className="notes">{notes}</td>
    </tr>
  );
}

interface FixRowProps {
  pri: string;
  what: string;
  detail: string;
  where: string;
  scope: string;
}

function FixRow({ pri, what, detail, where, scope }: FixRowProps) {
  return (
    <div className="fix-row">
      <span className="pri">{pri}</span>
      <span className="what">
        {what}
        <small>{detail}</small>
      </span>
      <span className="where">{where}</span>
      <span className="scope">{scope}</span>
    </div>
  );
}
