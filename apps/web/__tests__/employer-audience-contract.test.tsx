import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import EmployersPage from '@/app/employers/page';

/**
 * MB1 dual-audience contract for /employers.
 *
 * Asserted against the ROUTE, not the component. A guard that names
 * `EmployerAudienceSection` would go quietly green the moment the page stopped
 * rendering it — the orphaned-guard failure mode this repo has hit before. This
 * renders the actual page export and inspects what a visitor receives.
 */
const markup = renderToStaticMarkup(<EmployersPage />);
/** Visible text: strip tags, then decode the entities React escapes on the way out. */
const text = markup
  .replace(/<[^>]*>/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&rsquo;|&#x27;|&apos;/g, "'")
  .replace(/&nbsp;/g, ' ')
  .replace(/\s+/g, ' ');

describe('/employers is a page, not a redirect', () => {
  it('renders real page markup', () => {
    // A redirect() page throws at render; reaching here means the surface exists.
    expect(markup.length).toBeGreaterThan(2000);
    expect(markup).toContain('data-employer-audience');
  });

  it('leads with the hiring experience, with evidence beneath it as proof', () => {
    // REVISION 2 (founder visual gate, 2026-08-07): the previous pin here was
    // "Start clinicians from source-backed evidence" — an H1 that sold the
    // trust machinery as the product. The canonical employer direction leads
    // with what the employer accomplishes; attribution enters immediately
    // after as the reason it can be trusted. Both halves are pinned so
    // neither the experience lead nor the proof line can quietly vanish.
    expect(text).toContain('Move a clinician hire from interest to start');
    expect(text).toContain('the hiring decision stays yours');
    expect(text).toContain('named to their public source');
  });

  it('installs the exact employer category without displacing incumbent authority', () => {
    expect(text).toContain('VitalCV is the Clinician Hire-to-Start Platform');
    expect(text).toContain('employer-confirmed first day');
    expect(text).toContain('Keep your ATS and your credentialing platform');
    expect(text).toContain(
      'each institution retains final credentialing, privileging, and hiring authority',
    );
  });

  it('frames organization access as the doorway, not the proposition', () => {
    expect(text).toContain('Organization access is the doorway');
  });

  // This assertion replaces one named "still leads with the employer speed
  // promise", which required the H1 to read "Start clinicians faster". The
  // brand split (2026-07-26) retired that claim — "faster" is a promise about
  // time-to-start and no pilot has measured it — so the test was holding the
  // page to a rule the doctrine had already withdrawn. A guard that outlives
  // its ruling stops protecting the product and starts protecting the bug.
  it('does not promise speed anywhere on the buyer doorway', () => {
    expect(text).not.toContain('Start clinicians faster');
    expect(text).not.toContain('faster');
  });
});

describe('W10 — the daily user is addressed by title', () => {
  // §9.3: every modern credentialing vendor pitches upward and omits these people.
  const requiredTitles = [
    'medical staff services professional (MSP)',
    'credentialing specialist',
    'privileging coordinator',
    'provider enrollment staff',
    'recruiter',
    'onboarding coordinator',
  ];

  it.each(requiredTitles)('names %s', (title) => {
    expect(text.toLowerCase()).toContain(title.toLowerCase());
  });

  it('names all three buying teams', () => {
    expect(text).toContain('Credentialing & medical staff services');
    expect(text).toContain('Recruitment & talent acquisition');
    expect(text).toContain('HR & onboarding');
  });
});

describe('W11 — organization size is segmented, and each band has a way in', () => {
  it('addresses the single practice, the group, and the health system', () => {
    expect(text).toContain('Single practice or clinic');
    expect(text).toContain('Provider group, staffing firm, MSO or DSO');
    expect(text).toContain('Hospital or health system');
  });

  it('states the small-practice situation that no competitor addresses', () => {
    expect(text.toLowerCase()).toContain('the office manager is the credentialing team');
  });

  it('routes self-serve bands to the access-request route and systems to the pilot', () => {
    expect(markup).toContain('href="/employers/request-access"');
    expect(markup).toContain('href="/pilot"');
  });
});

describe('honesty rails survive the addition', () => {
  it('keeps the committee boundary explicit in the audience section', () => {
    expect(markup).toContain('data-employer-audience-boundary');
    expect(text.toLowerCase()).toContain('is not a credentialing decision');
    expect(text.toLowerCase()).toContain('the appointment decision stays yours');
  });

  it('keeps the page-level limits block', () => {
    expect(markup).toContain('data-employer-limits');
    expect(text.toLowerCase()).toContain('vitalcv is not a credentialing service');
  });

  it('carries no banned truth-contract string', () => {
    const banned = [
      'automatically verified',
      'guaranteed verification',
      'complete credentialing',
      'instant credentialing',
      'legally accepted',
      'risk transferred',
      'final verification without review',
      'source confirmed before response',
      'certified compliant',
      'hipaa compliant',
      'soc2 certified',
    ];
    const lower = text.toLowerCase();

    for (const phrase of banned) {
      expect(lower).not.toContain(phrase);
    }
  });

  it('asserts no metric, percentage, or outcome number in the audience section', () => {
    // The study's dominant competitor failure mode is the unattached number.
    const audience = markup.slice(markup.indexOf('data-employer-audience'));
    expect(audience).not.toMatch(/\d+\s?%/);
    expect(audience.toLowerCase()).not.toContain('faster than');
    expect(audience.toLowerCase()).not.toContain('days saved');
  });
});
