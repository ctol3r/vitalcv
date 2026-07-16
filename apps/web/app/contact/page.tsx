import type { Metadata } from 'next';
import { Suspense } from 'react';

import { PilotIntakeForm } from './PilotIntakeForm';

/**
 * /contact — adopted from the wave1505 contact design (DG-12.4.1): paper/ink,
 * mono eyebrow, Fraunces headline, and a "what to expect" aside. The real
 * PilotIntakeForm (POST /api/pilot-intake, persona preset from ?persona=) is
 * kept intact and restyled to the wave1505 form-kit.
 *
 * Design Handoff Reference:
 *   design-handoff/claude-design-2026-07-12-wave1505/wave1505/w1505-contact.jsx
 */

export const dynamic = 'force-static';
// Bound external shared-cache staleness to 5 min (see app/page.tsx note).
export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Contact — Start a Pilot — VitalCV',
  description:
    'Tell us about your credentialing flow. We typically reply within one business day.',
};

const paper = '#f4f2ec';
const card = '#ffffff';
const ink = '#141414';
const rule = '#dddbd3';
const textSecondary = '#474540';
const textMuted = '#6b6860';
const textFaint = '#8a8780';
const displayFont = "var(--font-display, 'Fraunces', Georgia, serif)";
const monoFont = "var(--font-mono, 'Geist Mono', ui-monospace, monospace)";
const bodyFont = "var(--font-body, 'Geist', ui-sans-serif, system-ui, sans-serif)";

const EXPECT = [
  { t: 'Reviewed within one business day.', d: 'Every message, by a person with authority to act on it.' },
  { t: 'Security disclosures triaged same-day.', d: 'Note the topic and include a run reference if you have one.' },
  { t: 'Data corrections usually belong at the source.', d: 'We’ll tell you which registry to correct, then re-read it once you have.' },
];

export default function ContactPage() {
  return (
    <main
      data-testid="contact-page"
      style={{ background: paper, color: ink, fontFamily: bodyFont, minHeight: '100vh', boxSizing: 'border-box' }}
    >
      <div style={{ maxWidth: 1040, margin: '0 auto', padding: '56px 24px 80px' }}>
        <header style={{ maxWidth: '60ch' }}>
          <span style={{ fontFamily: monoFont, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: textFaint }}>
            Start a pilot
          </span>
          <h1 style={{ fontFamily: displayFont, fontWeight: 560, fontSize: 40, lineHeight: 1.08, letterSpacing: '-0.02em', margin: '10px 0 0', maxWidth: '18ch' }}>
            Tell us about your credentialing flow.
          </h1>
          <p style={{ margin: '14px 0 0', fontSize: 15, lineHeight: 1.6, color: textSecondary }}>
            A short note is enough. We typically reply within one business day. If
            you&rsquo;d rather email, send a note to{' '}
            <a href="mailto:hello@vitalcv.com" style={{ color: ink, textDecoration: 'underline', textUnderlineOffset: 2 }}>hello@vitalcv.com</a>.
          </p>
        </header>

        <div
          style={{
            marginTop: 40,
            display: 'grid',
            gap: 48,
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 320px)',
            alignItems: 'start',
          }}
          className="wv-contact-grid"
        >
          <div style={{ maxWidth: 560 }}>
            <Suspense fallback={null}>
              <PilotIntakeForm />
            </Suspense>
          </div>
          <aside aria-label="What to expect" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ border: `1px solid ${rule}`, background: card, borderRadius: 4, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <span style={{ fontFamily: monoFont, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: textFaint }}>
                What to expect
              </span>
              {EXPECT.map((e) => (
                <div key={e.t}>
                  <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: ink, fontWeight: 600 }}>{e.t}</p>
                  <p style={{ margin: '3px 0 0', fontSize: 12.5, lineHeight: 1.55, color: textSecondary }}>{e.d}</p>
                </div>
              ))}
            </div>
            <div style={{ border: `1px solid ${rule}`, background: card, borderRadius: 4, padding: 20 }}>
              <span style={{ fontFamily: monoFont, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: textFaint }}>
                Prefer email
              </span>
              <p style={{ margin: '10px 0 0', fontFamily: monoFont, fontSize: 12, color: ink }}>hello@vitalcv.com</p>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: textMuted }}>Same inbox, same one-day promise.</p>
            </div>
          </aside>
        </div>
      </div>
      <style
        dangerouslySetInnerHTML={{
          __html: '@media (max-width: 860px){.wv-contact-grid{grid-template-columns:minmax(0,1fr) !important;}}',
        }}
      />
    </main>
  );
}
