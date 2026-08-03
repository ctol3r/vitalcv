'use client';

/**
 * Z1 hero — the NPI activation instrument and the product story it drives.
 *
 * The five-second test governs this component: a first-time visitor should
 * understand "an NPI becomes a reusable clinician profile, the profile applies
 * to an opportunity, the employer receives the information, the clinician
 * starts sooner" from the VISUALS alone. So the right side of the hero is not
 * a paragraph and not a lone evidence record — it is the transformation
 * itself, four connected product objects on one spine:
 *
 *   NPI → clinician profile → opportunity + Apply with VitalCV
 *       → employer receives the packet → start sooner
 *
 * The story reacts to the real control: it sits ghosted until a number
 * resolves, then populates. The evidence layer appears where it truthfully
 * belongs — the employer-packet stage renders the canonical SEALED face
 * ("Permission recorded · scope: this application"), passed in as a
 * pre-rendered string from the canonical faces module. This island never
 * builds record markup of its own.
 *
 * Resolution is SIMULATED and labelled: no lookup leaves the page, the
 * profile is a fictional clinician, and the surface says so. Validity is the
 * real NPI check digit, so a mistyped number gets the product's true answer.
 * States: empty · focused · resolving · found · invalid · organization ·
 * unavailable.
 */

import { useEffect, useRef, useState } from 'react';

export type ActivationState =
  | 'empty' | 'focused' | 'resolving' | 'found' | 'invalid' | 'organization' | 'unavailable';

interface Props {
  /** Canonical SEALED face at packet scale — the employer-handoff proof. */
  sealedFace: string;
}

/** Real NPI check digit: Luhn over the 80840 issuer prefix + 9 digits. */
export function isValidNpi(npi: string): boolean {
  if (!/^\d{10}$/.test(npi)) return false;
  const digits = `80840${npi}`.split('').map(Number);
  const check = digits.pop() as number;
  let sum = 0;
  digits.reverse().forEach((d, i) => {
    const v = i % 2 === 0 ? d * 2 : d;
    sum += v > 9 ? v - 9 : v;
  });
  return (10 - (sum % 10)) % 10 === check;
}

const MESSAGES: Partial<Record<ActivationState, { title: string; body: string }>> = {
  invalid: {
    title: 'That number fails the NPI check digit.',
    body: 'Re-enter it as it appears in the NPPES registry.',
  },
  organization: {
    title: 'That looks like an organization NPI.',
    body: 'Enter your personal Type 1 NPI — records are for individual clinicians.',
  },
  unavailable: {
    title: 'Sources are temporarily unavailable.',
    body: 'Nothing was checked and nothing was recorded. Try again shortly.',
  },
};

export function NpiActivation({ sealedFace }: Props) {
  const [state, setState] = useState<ActivationState>('empty');
  const [raw, setRaw] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, []);

  const digits = raw.replace(/\D/g, '').slice(0, 10);

  const resolve = (outcome: 'found' | 'organization' | 'unavailable') => {
    if (timer.current) clearTimeout(timer.current);
    setState('resolving');
    timer.current = setTimeout(() => setState(outcome), reduced.current ? 700 : 1100);
  };

  const submit = (outcome?: 'organization' | 'unavailable') => {
    if (outcome) { resolve(outcome); return; }
    if (digits.length !== 10 || !isValidNpi(digits)) { setState('invalid'); return; }
    resolve('found');
  };

  const message = MESSAGES[state];
  const lit = state === 'found';
  const busy = state === 'resolving';
  /* The NPI node echoes the typed number, masked the way the record masks. */
  const echo = digits.length
    ? `${digits.slice(0, 2)}${'•'.repeat(Math.max(0, digits.length - 2))}`
    : '··········';

  return (
    <div className="z1-activation" data-state={state}>
      <form className="z1-npi" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <div className="z1-npi-bar">
          <label className="sr-only" htmlFor="z1-npi-input">Your 10-digit NPI</label>
          <input
            id="z1-npi-input"
            className="z1-npi-input"
            inputMode="numeric"
            autoComplete="off"
            placeholder="Your 10-digit NPI"
            value={digits}
            onFocus={() => { if (state === 'empty') setState('focused'); }}
            onChange={(e) => {
              setRaw(e.target.value);
              if (['invalid', 'organization', 'unavailable', 'found'].includes(state)) setState('focused');
            }}
            aria-describedby={message ? 'z1-npi-message' : undefined}
          />
          <button className="z1-npi-submit" type="submit" disabled={busy}>
            {busy ? 'Checking…' : 'Start with your NPI'}
          </button>
        </div>
        {message ? (
          <p id="z1-npi-message" className="z1-npi-message" role="status">
            <strong>{message.title}</strong> {message.body}
          </p>
        ) : (
          <p className="z1-npi-hint">Free for clinicians · No account required</p>
        )}
      </form>

      <p className="z1-demo-note" role="note">
        Simulated preview · fictional data · no source is queried. Try:{' '}
        <button type="button" className="z1-chip" onClick={() => { setRaw('1234567893'); resolve('found'); }}>clinician found</button>{' '}
        <button type="button" className="z1-chip" onClick={() => submit('organization')}>organization NPI</button>{' '}
        <button type="button" className="z1-chip" onClick={() => submit('unavailable')}>source unavailable</button>
      </p>

      {/* ---- the story: one persistent object moving through the product --
          Interface objects carry the meaning; connector words are 11px mono
          subordinates. The SAME profile object recurs: it forms from the NPI,
          rides inside the opportunity card as an attached token, becomes the
          employer's sealed packet, and stays with the clinician at the end. */}
      <div className="z1-story" data-lit={lit ? '' : undefined} aria-label="How VitalCV works">

        {/* 1 · the number, as a real field echo */}
        <div className="z1-node z1-npi-node" data-on={digits.length > 0 || lit ? '' : undefined}>
          <span className="z1-field-label">NPI</span>
          <span className="z1-npi-echo">{busy ? 'Querying sources…' : echo}</span>
        </div>

        <div className="z1-link" aria-hidden="true">becomes</div>

        {/* 2 · the reusable clinician profile — THE persistent object.
            Dormant, it is a profile-shaped silhouette assembling: dashed
            identity mark, unresolved name bars, six hollow evidence lanes —
            "ready to become a profile", never an empty box. */}
        <div className="z1-node z1-profile" data-on={lit ? '' : undefined}>
          <div className="z1-profile-head">
            <span className="z1-avatar" aria-hidden="true">{lit ? 'KO' : ''}</span>
            <div className="z1-profile-id">
              {lit ? (
                <>
                  <p className="z1-profile-name">K. Osei, PA-C</p>
                  <p className="z1-profile-meta">Emergency medicine · 8 years</p>
                </>
              ) : (
                <>
                  <span className="z1-sil z1-sil--name" />
                  <span className="z1-sil z1-sil--meta" />
                </>
              )}
            </div>
            <span className="z1-profile-badge">{lit ? 'Reusable profile' : 'Your profile'}</span>
          </div>
          <div className="z1-lanes" role="img" aria-label={lit ? 'Evidence: 4 of 6 sources answered' : 'Six evidence lanes, none read yet'}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <span key={i} className="z1-lane" data-f={lit && i < 4 ? '' : undefined} />
            ))}
          </div>
          <p className="z1-profile-evidence">
            {lit ? 'Evidence record attached · 4 of 6 sources answered · Illustrative — not a live result'
                 : 'Six evidence lanes · filled as sources answer'}
          </p>
        </div>

        <div className="z1-link" aria-hidden="true">travels to</div>

        {/* 3 · the opportunity, with the SAME profile riding along and the
            travel action prominent. */}
        <div className="z1-node z1-opp" data-on={lit ? '' : undefined}>
          <div className="z1-opp-main">
            <p className="z1-opp-role">Emergency Medicine PA</p>
            <p className="z1-opp-org">Cascade Regional Medical Center · Full-time</p>
            <span className="z1-opp-attach">
              <span className="z1-avatar z1-avatar--mini" aria-hidden="true">{lit ? 'KO' : ''}</span>
              {lit ? 'Your profile is attached' : 'Applies with your profile'}
            </span>
          </div>
          <span className="z1-apply">Apply with VitalCV →</span>
        </div>

        <div className="z1-link" aria-hidden="true">the employer receives</div>

        {/* 4 · the sealed packet (the canonical record — the proof layer) and
            the outcome the whole page argues for. */}
        <div className="z1-node z1-packet" data-on={lit ? '' : undefined}>
          <div className="z1-packet-frame">
            <p className="z1-packet-head">Employer view · permissioned</p>
            <div className="z1-packet-record" dangerouslySetInnerHTML={{ __html: sealedFace }} />
          </div>
          <p className="z1-outcome"><strong>Start sooner.</strong> The record stays yours.</p>
        </div>
      </div>
    </div>
  );
}
