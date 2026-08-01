'use client';

/**
 * Wave 1501 · hero + segmented NPI + wallet mock (DG-7.1–7.4).
 * Ports the hero half of `wave1501/hp-hero.jsx`.
 *
 * Three deliberate departures from the handoff, all load-bearing:
 *
 * 1. VALIDATION. The handoff carries its own `npiChecksumOk` (Luhn over
 *    '80840' + digits). That is the same algorithm this repo already exposes as
 *    `checkNpi` in lib/vital/npi, which is the canonical rule shared with
 *    Passport. Porting the handoff's copy verbatim would re-introduce the
 *    second implementation that was deliberately collapsed into one.
 *
 * 2. THE BUTTON DOES SOMETHING. The handoff's submit is
 *    `onClick={(e) => e.preventDefault()}` — it is a prototype. Here it drives
 *    the real lookup.
 *
 * 3. LANE STATES. The handoff's wallet marks OIG LEIE "Checked · 2h ago" and
 *    CMS PECOS "gated · requires enrollment agreement". Neither survives
 *    lib/trust/sourceLanes.ts: OIG is an `active` MONTHLY snapshot and PECOS is
 *    an `active` QUARTERLY one — real reads, just not per-request. The lane
 *    that is genuinely access-gated is state licensure, which the handoff's
 *    wallet omitted. So the rows carry their true cadence, and the design's
 *    teaching point ("a gated source never gets a checkmark") moves to the lane
 *    where it is actually true.
 */

import * as React from 'react';

import { checkNpi } from '@/lib/vital/npi';
import {
  FreshnessStamp,
  HonestyLabel,
  PaperCard,
  PrimaryButton,
  ReadinessRing,
  SourceRow,
  StateChip,
  TrustGlyph,
} from './primitives';
import { Reveal, useReducedMotion } from './shared';

/* ---------- Segmented 10-digit NPI field (DG-7.2) ---------- */

export const NpiSegmented = ({
  value,
  onChange,
  onSubmit,
  submitting,
}: {
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  submitting?: boolean;
}) => {
  const [focused, setFocused] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const digits = value.replace(/\D/g, '').slice(0, 10);
  const complete = digits.length === 10;
  const check = checkNpi(digits);
  const valid = check.validity === 'valid';
  const error = complete && !valid;
  const activeIdx = focused && !complete ? digits.length : -1;

  return (
    <div style={{ maxWidth: 520 }}>
      <div
        className={`npi-cells${error ? ' error' : ''}`}
        onClick={() => inputRef.current?.focus()}
      >
        <input
          ref={inputRef}
          className="npi-real"
          value={digits}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          aria-label="National Provider Identifier, 10 digits"
          aria-invalid={error}
          data-testid="home-npi-input"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 10))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && valid) onSubmit();
          }}
        />
        {Array.from({ length: 10 }).map((_, i) => (
          <span
            key={i}
            aria-hidden="true"
            className={`npi-cell${digits[i] ? ' filled' : ''}${i === activeIdx ? ' active' : ''}`}
          >
            {digits[i] || ''}
          </span>
        ))}
      </div>
      <div className="npi-meta">
        <span className={`npi-count${valid ? ' done' : ''}`} aria-live="polite">
          {digits.length}/10{valid ? ' · format OK' : ''}
        </span>
        <span className="npi-micro">No account required · public sources only</span>
        <span style={{ flex: 1 }} />
        <PrimaryButton disabled={!valid || submitting} onClick={onSubmit} data-testid="home-npi-submit">
          Check readiness
        </PrimaryButton>
      </div>
      {error ? (
        <div className="npi-err" role="alert">
          <span style={{ flexShrink: 0, marginTop: 1 }}>
            <TrustGlyph state="p0" size={12} />
          </span>
          <span>CHECKSUM FAILED — these ten digits don&rsquo;t validate as an NPI. Check for a typo.</span>
        </div>
      ) : null}
    </div>
  );
};

/* ---------- Wallet mock (DG-7.3/7.4) ---------- */

export const WalletMock = () => {
  const reduced = useReducedMotion();
  const [ring, setRing] = React.useState(reduced ? 72 : 0);
  React.useEffect(() => {
    if (reduced) {
      setRing(72);
      return;
    }
    const t = setTimeout(() => setRing(72), 260); /* ring sweeps once */
    return () => clearTimeout(t);
  }, [reduced]);

  return (
    <div>
      <PaperCard style={{ padding: 0, overflow: 'hidden' }} data-screen-label="Wallet mock">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 20px',
            borderBottom: '1px solid var(--vt-rule)',
            background: 'var(--vt-surface-sunken)',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--vt-text-secondary)',
            }}
          >
            Readiness snapshot
          </span>
          <StateChip state="previewOnly" size="sm" />
        </div>
        <div style={{ padding: '18px 20px 8px', display: 'flex', gap: 18, alignItems: 'center' }}>
          <ReadinessRing value={ring} size={88} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>Example clinician</span>
            <span
              className="vt-num"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10.5,
                color: 'var(--vt-text-muted)',
                letterSpacing: '0.06em',
              }}
            >
              SAMPLE RECORD · Family Medicine
            </span>
            <FreshnessStamp rel="Illustrative figures" />
          </div>
        </div>
        <div style={{ padding: '4px 20px 16px' }}>
          <SourceRow
            label="Identity"
            source="NPPES"
            state="checked"
            chipLabel="Source-backed"
            freshness="Read live"
          />
          <SourceRow label="Exclusions" source="OIG LEIE" state="checked" freshness="Monthly snapshot" />
          <SourceRow label="Enrollment" source="CMS PECOS" state="checked" freshness="Quarterly snapshot" />
          <SourceRow label="Licensure" source="State boards" state="accessRequired" />
          <div style={{ paddingTop: 14 }}>
            <HonestyLabel>Illustrative example · not a real clinician</HonestyLabel>
          </div>
        </div>
      </PaperCard>
      {/* Reads primary sources — honest states; the access-gated lane never
          gets a checkmark (DG-7.4). */}
      <div className="src-reads">
        <span className="vt-eyebrow" style={{ fontSize: 9 }}>
          Reads primary sources
        </span>
        <StateChip state="checked" size="sm" label="NPPES" source="NPPES · identity, read per request" />
        <StateChip state="checked" size="sm" label="OIG LEIE" source="OIG LEIE · exclusions, monthly snapshot" />
        <StateChip state="checked" size="sm" label="CMS PECOS" source="CMS PECOS · enrollment, quarterly snapshot" />
        <StateChip
          state="accessRequired"
          size="sm"
          label="State boards"
          source="State licensure — access-gated; not read without an agreement"
        />
      </div>
    </div>
  );
};

/* ---------- Hero (DG-7.1) ---------- */

export const HeroSection = ({
  npi,
  onNpiChange,
  onSubmit,
  submitting,
  result,
}: {
  npi: string;
  onNpiChange: (next: string) => void;
  onSubmit: () => void;
  submitting?: boolean;
  result?: React.ReactNode;
}) => (
  <section className="hp-hero" id="top" data-screen-label="Hero">
    <div className="hp-container hp-hero-grid">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <Reveal>
          <span className="vt-eyebrow">The Provider Career Evidence Network</span>
        </Reveal>
        <Reveal delay={60}>
          <h1>
            Find the opportunity. Prove your career once.{' '}
            <span className="vt-accent-i">Start from evidence.</span>
          </h1>
        </Reveal>
        <Reveal delay={120}>
          <p className="lede">
            Enter your NPI and VitalCV reads primary sources into a readiness snapshot you own —
            every source shown in its honest state. Employers accept it as a head start; their
            committees still decide.
          </p>
        </Reveal>
        <Reveal delay={180} id="npi" style={{ scrollMarginTop: 84 }}>
          <NpiSegmented value={npi} onChange={onNpiChange} onSubmit={onSubmit} submitting={submitting} />
        </Reveal>
      </div>
      <Reveal delay={160}>{result ?? <WalletMock />}</Reveal>
    </div>
  </section>
);
