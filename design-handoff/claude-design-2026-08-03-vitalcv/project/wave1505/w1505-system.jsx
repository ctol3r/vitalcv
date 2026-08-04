// Wave 1505 · w1505-system.jsx — 404, error, offline pattern, empty-state
// gallery (DG-12.2). Fail-closed honesty: error states never claim success;
// empty states never fake data.

/* ---------- 404 (full page) ---------- */
const Sys404 = ({ requested }) => (
  <div className="sys-page s5-fade" data-screen-label="System · 404">
    <div className="sys-top"><VtLogo size={18} /></div>
    <main className="sys-mid">
      <div className="sys-block">
        <div className="sys-echo vt-num" aria-label="Request echo">
          GET {requested || '/passport/old-share-link'}<br />
          <span className="code">→ 404 · NOT FOUND</span> · nothing at this address
        </div>
        <h1>This page isn't part of the record.</h1>
        <p className="body">The address may have changed, or it never existed. Nothing was deleted
          silently — if a share link stopped working, its holder revoked it, and that revocation is logged.</p>
        <div className="sys-ctas">
          <PrimaryButton size="lg" onClick={() => { window.location.href = '../wave1501/index.html'; }}>Back to vitalcv.com</PrimaryButton>
          <QuietButton onClick={() => { window.location.href = '../wave1504/index.html#/status'; }}>Check system status</QuietButton>
        </div>
      </div>
    </main>
    <p className="sys-foot">© 2026 VitalCV · a partial proof stays partial</p>
    <ProtoBar viewing={{ href: '#/404', label: '/404' }} />
  </div>
);

/* ---------- error / global-error (full page) ---------- */
const SysError = () => (
  <div className="sys-page s5-fade" data-screen-label="System · error">
    <div className="sys-top"><VtLogo size={18} /></div>
    <main className="sys-mid">
      <div className="sys-block" role="alert">
        <div className="sys-echo vt-num" aria-label="Failure reference">
          run_2026-07-12_0812Z · <span className="code">FAILED</span> · err_a41f<br />
          reference logged — include it if you write in
        </div>
        <h1>Something failed on our side.</h1>
        <p className="body">Nothing was recorded as successful. If you were mid-request, it did not
          complete — no partial result was saved, and no source was marked checked. Retry when ready.</p>
        <div className="sys-ctas">
          <PrimaryButton size="lg" onClick={() => window.location.reload()}>Try again</PrimaryButton>
          <QuietButton onClick={() => { window.location.hash = '#/contact'; }}>Write to us</QuietButton>
        </div>
      </div>
    </main>
    <p className="sys-foot">© 2026 VitalCV · errors are stated, never dressed up</p>
    <ProtoBar viewing={{ href: '#/error', label: '/error' }} />
  </div>
);

/* ---------- empty-state gallery data (DG-12.2.4) ---------- */
const EMPTIES = [
  {
    ctx: 'Passport · /passport', glyph: 'pending',
    title: 'No sources checked yet.',
    why: 'Your passport starts empty on purpose — it only ever shows what a source actually said.',
    action: 'Enter an NPI to run the first check',
  },
  {
    ctx: 'Reviewer queue · /review', glyph: 'reviewRequired',
    title: 'Nothing waiting for review.',
    why: 'Every submitted packet has been decided. New requests appear here the moment they arrive.',
    action: 'View decided packets', secondary: true,
  },
  {
    ctx: 'Recognitions · /passport#recognitions', glyph: 'checked',
    title: 'No Recognitions yet.',
    why: 'A Recognition is recorded when an employer accepts your packet as a head start. Sharing your passport is how they happen.',
    action: 'Share your passport',
  },
  {
    ctx: 'Opportunities · /opportunities', glyph: 'previewOnly',
    title: 'No matched opportunities right now.',
    why: 'Matches come from employer lanes that fit your license states and specialty — none fit today. We don\u2019t pad this list.',
    action: 'Review your lane preferences', secondary: true,
  },
];

/* ---------- system overview route ---------- */
const SystemRoute = () => {
  const [offline, setOffline] = React.useState(false);
  return (
    <React.Fragment>
      {offline ? <OfflineBanner onRetry={() => setOffline(false)} /> : null}
      <S5Page eyebrow="DG-12.2 · Error & system states" title={<span>Where trust <span className="vt-accent-i">quietly</span> lives or dies.</span>}
        lede="A default-styled 404 breaks the spell faster than any bug. Every terminal, degraded, and empty state is designed, honest, and calm — with exactly one next action."
        label="System states">
        <S5Section first eyebrow="Terminal states" title="404 · error · loading"
          lede="Full-page states, opened chrome-less as a visitor would meet them.">
          <div className="hub-grid">
            <div className="hub-card">
              <span className="hid">SYS-404</span>
              <h3>Not found</h3>
              <p>Wordmark, mono echo of the requested path, Fraunces headline, one CTA home. Unknown routes in this prototype land here for real.</p>
              <div className="hub-links"><a href="#/404">Open full page</a><a href="#/definitely/not/a/route">Trigger via bad route</a></div>
            </div>
            <div className="hub-card">
              <span className="hid">SYS-ERR</span>
              <h3>Something failed</h3>
              <p>Fail-closed honesty: "Nothing was recorded as successful." A logged reference, a retry, and a path to a person. Never a mascot.</p>
              <div className="hub-links"><a href="#/error">Open full page</a></div>
            </div>
            <div className="hub-card">
              <span className="hid">SYS-LOAD</span>
              <h3>Loading interstitial</h3>
              <p>Wordmark + hairline sweep + one mono line. The skeleton grammar below covers in-page loading; this covers whole-surface waits.</p>
              <div className="hub-links"><a href="#/auth/loading">Open full page</a></div>
            </div>
          </div>
        </S5Section>

        <S5Section eyebrow="Degraded pattern" title="Offline / degraded banner"
          lede="For data surfaces: sticks under the nav at --vt-z-banner, dashed rules carry the degraded semantics, freshness stamps keep telling the truth underneath. role=status, announced politely.">
          <OfflineBanner inline onRetry={() => {}} />
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginTop: 20, flexWrap: 'wrap' }}>
            <SecondaryButton onClick={() => setOffline(!offline)} aria-pressed={offline}>
              {offline ? 'Unpin demo banner' : 'Pin banner under nav (demo)'}
            </SecondaryButton>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--vt-text-muted)', letterSpacing: '0.05em' }}>
              RULE · never a toast; never auto-dismiss; retry is manual
            </span>
          </div>
        </S5Section>

        <S5Section eyebrow="DG-12.2.4" title="Empty-state gallery"
          lede="Honest and calm. Each names the surface, says why it's empty without apology or fake data, and offers ONE next action. Solid rule frames — dashed is reserved for degraded.">
          <div className="empty-grid">
            {EMPTIES.map((e) => (
              <div key={e.ctx}>
                <span className="empty-ctx">{e.ctx}</span>
                <EmptyState glyph={e.glyph} title={e.title} why={e.why} action={e.action} secondary={e.secondary} />
              </div>
            ))}
          </div>
        </S5Section>

        <S5Section eyebrow="Loading grammar" title="The empty · loading · error triad"
          lede="Every data region ships all three, in the same footprint, so the page never jumps or flashes unstyled.">
          <div className="hub-grid">
            <div className="hub-card">
              <span className="hid">Loading</span>
              <div style={{ padding: '10px 0' }}><SkeletonStack /></div>
              <p>Skeleton shimmer — the one allowed infinite animation, static under reduced motion. Skeletons mirror the real layout, never invent rows.</p>
            </div>
            <div className="hub-card">
              <span className="hid">Empty</span>
              <div style={{ padding: '10px 0' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--vt-text-muted)' }}>
                  <TrustGlyph state="pending" size={13} /> No sources checked yet.
                </span>
              </div>
              <p>Inline form for tight regions; the full EmptyState card for primary regions. Same copy voice either way.</p>
            </div>
            <div className="hub-card">
              <span className="hid">Error</span>
              <div style={{ padding: '10px 0' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--vt-state-p0)' }}>
                  <TrustGlyph state="p0" size={13} /> Couldn't load. Nothing recorded. <QuietButton small>Retry</QuietButton>
                </span>
              </div>
              <p>Region-level failure keeps the rest of the page alive. Copy never says "oops" and never claims partial success.</p>
            </div>
          </div>
        </S5Section>
      </S5Page>
    </React.Fragment>
  );
};

Object.assign(window, { Sys404, SysError, SystemRoute, EMPTIES });
