'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

type Mode = 'clinician' | 'employer' | 'issuer';

const MODES: { key: Mode; label: string; blurb: string }[] = [
  { key: 'clinician', label: 'Clinician', blurb: 'Carry your verified artifacts anywhere.' },
  { key: 'employer', label: 'Employer / Verifier', blurb: 'Validate faster without repeating PSV.' },
  { key: 'issuer', label: 'Issuer', blurb: 'Issue trusted records that travel cleanly.' },
];

export default function AcceptanceNetwork() {
  const [mode, setMode] = useState<Mode>('clinician');

  const content = useMemo(() => {
    switch (mode) {
      case 'clinician':
        return {
          title: 'The Acceptance Network',
          subtitle:
            'VitalCV is a credential wallet that gets stronger every time an employer accepts an artifact.',
          steps: [
            { h: 'Upload once', p: 'Keep your credential record current in one place.' },
            { h: 'Generate artifacts', p: 'Audit-ready bundles with timestamps and provenance.' },
            { h: 'Share anywhere', p: 'Employers accept or independently cross-check.' },
          ],
          proof: [
            'Portable credential artifacts',
            'Share links with controlled visibility',
            'Acceptance receipts build trust over time',
          ],
        };
      case 'employer':
        return {
          title: 'The Acceptance Network',
          subtitle:
            'Stop restarting verification. Validate artifacts, request gaps, and accelerate time-to-start.',
          steps: [
            { h: 'Receive artifact', p: 'Candidate shares a verifier-ready bundle.' },
            { h: 'Validate instantly', p: 'Check authenticity, timestamps, and provenance.' },
            { h: 'Accept or request', p: 'Accept, conditionally accept, or request missing items.' },
          ],
          proof: [
            'Less redundant PSV',
            'Cleaner audit narrative per credential',
            'Faster onboarding decisions',
          ],
        };
      case 'issuer':
        return {
          title: 'The Acceptance Network',
          subtitle:
            'Issuers create records that can be validated and reused—without rework across every employer.',
          steps: [
            { h: 'Issue record', p: 'Structured credential records with clear provenance.' },
            { h: 'Attach to artifacts', p: 'Issued records appear inside portable bundles.' },
            { h: 'Verifier acceptance', p: 'Employers validate without manual back-and-forth.' },
          ],
          proof: [
            'Cleaner issuance workflows',
            'Reduced downstream confusion',
            'Higher trust with less friction',
          ],
        };
      default:
        return null;
    }
  }, [mode]);

  if (!content) return null;

  return (
    <section className="px-6 py-24">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <h2 className="text-4xl md:text-5xl font-semibold tracking-tight">
              {content.title}
            </h2>
            <p className="mt-4 text-lg md:text-xl text-muted-foreground">
              {content.subtitle}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 justify-start md:justify-end">
            {MODES.map((m) => (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                className={[
                  'px-4 py-2 rounded-full border text-sm transition',
                  mode === m.key ? 'bg-foreground text-background' : 'hover:bg-muted',
                ].join(' ')}
                aria-pressed={mode === m.key}
                title={m.blurb}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-12 grid md:grid-cols-3 gap-6">
          {content.steps.map((s) => (
            <div key={s.h} className="p-8 rounded-3xl border hover:shadow-xl transition">
              <div className="text-2xl font-semibold">{s.h}</div>
              <div className="mt-3 text-muted-foreground text-lg">{s.p}</div>
            </div>
          ))}
        </div>

        <div className="mt-12 grid md:grid-cols-2 gap-6">
          <div className="p-8 rounded-3xl border bg-muted/50">
            <div className="text-xl font-semibold">Why this becomes a moat</div>
            <ul className="mt-4 space-y-2 text-lg text-muted-foreground">
              {content.proof.map((p) => (
                <li key={p}>• {p}</li>
              ))}
            </ul>
          </div>

          <div className="p-8 rounded-3xl border">
            <div className="text-xl font-semibold">Do something now</div>
            <div className="mt-4 flex flex-col sm:flex-row gap-3">
              <a
                href="#pilot"
                className="px-6 py-3 rounded-2xl bg-primary text-primary-foreground text-lg font-medium hover:opacity-90 transition text-center"
              >
                Request Pilot
              </a>
              <Link
                href="/verifier"
                className="px-6 py-3 rounded-2xl border text-lg font-medium hover:bg-muted transition text-center"
              >
                Open Verifier Portal
              </Link>
            </div>
            <p className="mt-4 text-muted-foreground">
              The network grows when verifiers accept artifacts instead of restarting verification.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
