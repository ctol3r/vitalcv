// Wave 1505 · w1505-pricing.jsx — /pricing per pricing doctrine
// (DG-13.3). Paper/ink presentation; every illustrative number carries
// the designed HonestyLabel; no fake logos, no "as seen in", no
// invented customer counts, no ROI guarantees.

const PIncRow = ({ inc, children }) => (
  <div className={`pr-row ${inc ? 'inc' : 'exc'}`}>
    <TrustGlyph state={inc ? 'checked' : 'unavailable'} size={13} />
    <span>{children}</span>
  </div>
);

const PricingRoute = () => (
  <S5Page eyebrow="DG-13.3 · Pricing" title={<span>Plain terms, <span className="vt-accent-i">stated</span> — not teased.</span>}
    lede="Three ways to use VitalCV. The only numbers on this page are labeled for exactly what they are."
    label="Pricing">
    <S5Section first>
      <div className="pr-grid">
        <div className="pr-card" data-comment-anchor="pricing-clinicians">
          <span className="pr-aud">Clinicians</span>
          <div className="pr-price">
            <span className="amt vt-num">$0</span>
            <span className="per">FREE · ALWAYS · NO CARD</span>
          </div>
          <p className="pr-desc">Your credentials are your record. Charging you to hold it would be a
            conflict of interest we don't want.</p>
          <div className="pr-rows">
            <PIncRow inc>Passport with source-backed checks and lineage</PIncRow>
            <PIncRow inc>Share links with instant revocation</PIncRow>
            <PIncRow inc>Recognitions from accepting employers</PIncRow>
            <PIncRow inc>Refresh on stale sources, anytime</PIncRow>
          </div>
          <div className="pr-cta"><SecondaryButton size="lg" onClick={() => { window.location.href = '../wave1503/index.html#/get-ready'; }}>Check your readiness</SecondaryButton></div>
        </div>

        <div className="pr-card lead" data-comment-anchor="pricing-pilot">
          <span className="pr-aud">Employer pilot</span>
          <div className="pr-price">
            <span className="amt vt-num">$1,500<span style={{ fontSize: 18, fontWeight: 480 }}>/mo</span></span>
            <span className="per">PER FACILITY · 90-DAY PILOT</span>
          </div>
          <HonestyLabel>Illustrative figure — actual pilot pricing is set in the signed pilot scope, not on this page.</HonestyLabel>
          <p className="pr-desc">A bounded pilot with written scope: which lanes, which sources, what
            "accepted as head start" means on your side.</p>
          <div className="pr-rows">
            <PIncRow inc>Reviewer surface for your credentialing team</PIncRow>
            <PIncRow inc>Packet requests + Recognition issuing</PIncRow>
            <PIncRow inc>Named contact, two-business-day answers</PIncRow>
            <PIncRow>No primary-source verification service — your review stays yours</PIncRow>
          </div>
          <div className="pr-cta"><PrimaryButton size="lg" onClick={() => { window.location.hash = '#/contact'; }}>Start a pilot conversation</PrimaryButton></div>
        </div>

        <div className="pr-card" data-comment-anchor="pricing-network">
          <span className="pr-aud">Networks &amp; systems</span>
          <div className="pr-price">
            <span className="amt">In the agreement</span>
            <span className="per">MULTI-FACILITY · SIGNED SCOPE</span>
          </div>
          <p className="pr-desc">Priced per signed scope — facilities, lanes, integration depth. If we
            can't state it plainly in the agreement, we don't sell it.</p>
          <div className="pr-rows">
            <PIncRow inc>Everything in the pilot, across facilities</PIncRow>
            <PIncRow inc>DPA + subprocessor commitments (<a href="#/legal/dpa">read it first</a>)</PIncRow>
            <PIncRow inc>Uptime terms in writing</PIncRow>
            <PIncRow>No exclusivity — clinicians stay free either way</PIncRow>
          </div>
          <div className="pr-cta"><SecondaryButton size="lg" onClick={() => { window.location.hash = '#/contact'; }}>Talk to us</SecondaryButton></div>
        </div>
      </div>
    </S5Section>

    <S5Section eyebrow="Doctrine" title="What this page will never claim">
      <div className="s5-twocol">
        <div className="pr-never">
          <span className="vt-eyebrow">Prohibited on /pricing — lint-enforced</span>
          <ul>
            <li><TrustGlyph state="p0" size={12} />No invented customer counts or "trusted by 500+ organizations".</li>
            <li><TrustGlyph state="p0" size={12} />No "as seen in" strips, no logos we didn't earn in writing.</li>
            <li><TrustGlyph state="p0" size={12} />No ROI guarantees, payback math, or "cheapest" claims.</li>
            <li><TrustGlyph state="p0" size={12} />No unlabeled illustrative metrics — every example number carries the HonestyLabel.</li>
            <li><TrustGlyph state="p0" size={12} />No countdown timers, seat scarcity, or launch-pricing pressure.</li>
          </ul>
        </div>
        <div className="pr-faq">
          <h3 style={{ fontSize: 16, marginBottom: 6 }}>Asked plainly, answered plainly</h3>
          <details>
            <summary><span className="m" aria-hidden="true"></span>Why is the pilot number "illustrative"?</summary>
            <p>Because real pilot pricing depends on facilities and lanes, and pretending otherwise
              would make the page dishonest. The number shows the shape of the cost; the signed scope
              carries the real one.</p>
          </details>
          <details>
            <summary><span className="m" aria-hidden="true"></span>Will clinicians ever be charged?</summary>
            <p>No. If that ever changed it would be announced 90 days ahead, and existing passports
              would stay free. The business is employer-side, on purpose.</p>
          </details>
          <details>
            <summary><span className="m" aria-hidden="true"></span>Is there a discount for annual commitment?</summary>
            <p>Sometimes, in the agreement, where it can be stated exactly. We don't advertise
              percentages we'd have to caveat.</p>
          </details>
          <details>
            <summary><span className="m" aria-hidden="true"></span>What happens when the pilot ends?</summary>
            <p>It ends. Data is exported or deleted per the DPA, Recognitions already issued remain
              with the clinicians who earned them, and renewal is a new signed scope — never an
              auto-rollover.</p>
          </details>
        </div>
      </div>
    </S5Section>
  </S5Page>
);

Object.assign(window, { PricingRoute });
