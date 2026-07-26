'use client';

/**
 * Wave 1501 · design-reference island.
 *
 * Mounted at /design/wave1501, following the /design/wave1505 precedent: a
 * noindex reference surface that carries its own chrome, so the design can be
 * judged as designed before any of it is argued onto the live homepage.
 *
 * Scoping is the whole safety story. Everything renders inside `.w1501`, and
 * `wave1501-home.css` publishes wave1500's token vocabulary ONLY under that
 * class. That matters because eight `--vt-*` names collide with the app's own
 * with different meanings — `--vt-focus-ring` is a colour in this app and a
 * box-shadow list in wave1500, so leaking it either direction silently breaks
 * focus indication everywhere.
 *
 * The nav and footer below exist ONLY on this route. `/design` is in
 * OPS_SURFACE_PREFIXES, so the global Navbar/Footer are absent here and the
 * page would otherwise have no chrome at all. They must NOT travel to `/`,
 * where three liquid-menu e2e tests pin the real global header.
 */

import * as React from 'react';
import Link from 'next/link';

import '@/styles/wave1501-home.css';

import { HeroSection } from './Hero';
import { SkySection } from './Sky';
import { DoorsSection, HowSection, MatchaSection, WhoSection, WhySection } from './sections';
import { HonestyLabel, SecondaryButton } from './primitives';
import { scrollToId, useArmEntranceMotion } from './shared';

/* ---------- chrome (reference route only) ---------- */

const HpNav = () => (
  <header className="hp-nav">
    <div className="hp-container hp-nav-inner">
      <a
        className="hp-brand"
        href="#top"
        onClick={(e) => {
          e.preventDefault();
          window.scrollTo({ top: 0 });
        }}
      >
        VitalCV
      </a>
      <nav className="hp-nav-links" aria-label="Primary">
        <a
          className="hp-nav-hide"
          href="#how"
          onClick={(e) => {
            e.preventDefault();
            scrollToId('how');
          }}
        >
          How it works
        </a>
        <a
          className="hp-nav-hide"
          href="#roles"
          onClick={(e) => {
            e.preventDefault();
            scrollToId('roles');
          }}
        >
          For your role
        </a>
        <Link className="hp-nav-hide" href="/sign-in">
          Sign in
        </Link>
        <SecondaryButton size="sm" onClick={() => scrollToId('npi')}>
          Check readiness
        </SecondaryButton>
      </nav>
    </div>
  </header>
);

const FOOT_COLS: { h: string; links: { label: string; href: string }[] }[] = [
  {
    h: 'Product',
    links: [
      { label: 'Readiness check', href: '/get-ready' },
      { label: 'Career passport', href: '/passport' },
      { label: 'Source coverage', href: '/status' },
      { label: 'Evidence network', href: '/evidence-network' },
    ],
  },
  {
    h: 'Roles',
    links: [
      { label: 'Clinicians', href: '/clinicians' },
      { label: 'Verifiers', href: '/verify' },
      { label: 'Employers', href: '/employers' },
      { label: 'Issuers', href: '/issuers' },
    ],
  },
  {
    h: 'Trust',
    links: [
      { label: 'How reading works', href: '/trust' },
      { label: 'Source attribution', href: '/trust/attribution' },
      { label: 'Status', href: '/status' },
      { label: 'Contact', href: '/contact' },
    ],
  },
];

const HpFooter = () => (
  <footer className="hp-foot" data-screen-label="Footer">
    <div className="hp-container">
      <div className="foot-grid">
        <div>
          <span className="hp-brand" style={{ fontSize: 22 }}>
            VitalCV
          </span>
          <p
            style={{
              margin: '10px 0 0',
              fontSize: 13,
              lineHeight: 1.6,
              color: 'var(--vt-text-secondary)',
              maxWidth: '30ch',
            }}
          >
            The Provider Career Evidence Network. Find the opportunity, prove the career once, start
            faster.
          </p>
        </div>
        {/* The handoff stubbed every footer link with preventDefault. A footer
            of dead links is not a design decision worth porting, so these point
            at the routes that actually exist. */}
        {FOOT_COLS.map((c) => (
          <div className="foot-col" key={c.h}>
            <h4>{c.h}</h4>
            <ul>
              {c.links.map((l) => (
                <li key={l.label}>
                  <Link href={l.href}>{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="foot-base">
        <span className="foot-copy vt-num">© 2026 VITALCV · PAPER+INK · W1501</span>
        <HonestyLabel>Illustrative product preview · not a final credentialing decision</HonestyLabel>
      </div>
    </div>
  </footer>
);

/* ---------- island ---------- */

export function Wave1501Client() {
  useArmEntranceMotion();
  const [npi, setNpi] = React.useState('');

  return (
    <div className="w1501">
      <a
        href="#top"
        className="sr-only"
        onClick={(e) => {
          e.preventDefault();
          scrollToId('top');
        }}
      >
        Skip to content
      </a>

      {/* Design-reference strip — this surface is a mock, and says so before
          anything else on the page. Mirrors the wave1505 DesignRefNote. */}
      <div
        data-design-ref-note=""
        style={{
          borderBottom: '1px solid var(--vt-rule)',
          background: 'var(--vt-surface-sunken)',
          padding: '8px 0',
        }}
      >
        <div
          className="hp-container"
          style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}
        >
          <span className="vt-eyebrow">Design reference · wave 1501</span>
          <HonestyLabel>
            Illustrative fixture data · nothing here is a live result
          </HonestyLabel>
        </div>
      </div>

      <HpNav />
      <main>
        <HeroSection
          npi={npi}
          onNpiChange={setNpi}
          /* Reference surface: the lookup is deliberately not wired. Firing a
             real read from a mock page would put live source results next to
             fixture rows with no way to tell them apart. */
          onSubmit={() => undefined}
        />
        <HowSection />
        <WhySection />
        <MatchaSection />
        <SkySection />
        <DoorsSection />
        <WhoSection />
      </main>
      <HpFooter />
    </div>
  );
}
