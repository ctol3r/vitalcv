'use client';

/**
 * Z1 first slice — the primary NPI activation control.
 *
 * A real product interaction over a SIMULATED resolution: the input, the
 * states and the record swap are genuine UI, but no lookup leaves the page and
 * the surface says so. Demo data is never represented as live verification —
 * the record face itself carries "Illustrative — not a live result", and the
 * chips are labelled "Simulated".
 *
 * States: empty · focused · resolving · found · invalid · organization ·
 * unavailable. Validity is the real NPI check digit (Luhn over 80840 + 9),
 * so a mistyped number gets the same answer the product would give. What is
 * simulated is only what happens AFTER a well-formed number: resolution
 * always lands on the fictional demo clinician, or on the state a chip chose.
 *
 * The record faces arrive as pre-rendered HTML strings from the server page —
 * the canonical faces module renders them, this island only swaps them. It
 * never builds record markup of its own, so it cannot drift from the approved
 * object.
 */

import { useEffect, useRef, useState } from 'react';

export type ActivationState =
  | 'empty' | 'focused' | 'resolving' | 'found' | 'invalid' | 'organization' | 'unavailable';

interface Props {
  faces: { blank: string; writing: string; resolving: string; returned: string };
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
    body: 'NPIs are ten digits with a checksum. Re-enter the number as it appears on your CMS letter or in the NPPES registry.',
  },
  organization: {
    title: 'That looks like an organization NPI.',
    body: 'A Type 2 NPI names a practice or facility. VitalCV records are for individual clinicians — enter your personal Type 1 NPI.',
  },
  unavailable: {
    title: 'Sources are temporarily unavailable.',
    body: 'Nothing was checked and nothing was recorded. Try again shortly — an unread lane stays marked exactly as unread.',
  },
};

export function NpiActivation({ faces }: Props) {
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
    // Reduced motion still sees RESOLVING — the state is part of the argument,
    // so it holds long enough to read instead of animating through.
    timer.current = setTimeout(() => setState(outcome), reduced.current ? 700 : 1100);
  };

  const submit = (outcome?: 'organization' | 'unavailable') => {
    if (outcome) { resolve(outcome); return; }
    if (digits.length !== 10 || !isValidNpi(digits)) { setState('invalid'); return; }
    resolve('found');
  };

  const face =
    state === 'resolving' ? faces.resolving
    : state === 'found' ? faces.returned
    : digits.length > 0 ? faces.writing
    : faces.blank;

  const message = MESSAGES[state];

  return (
    <div className="z1-activation" data-state={state}>
      <form
        className="z1-npi"
        onSubmit={(e) => { e.preventDefault(); submit(); }}
      >
        <label className="z1-npi-label" htmlFor="z1-npi-input">Start with your NPI</label>
        <div className="z1-npi-row">
          <input
            id="z1-npi-input"
            className="z1-npi-input"
            inputMode="numeric"
            autoComplete="off"
            placeholder="10-digit NPI"
            value={digits}
            onFocus={() => { if (state === 'empty') setState('focused'); }}
            onChange={(e) => {
              setRaw(e.target.value);
              if (state === 'invalid' || state === 'organization' || state === 'unavailable' || state === 'found') {
                setState('focused');
              }
            }}
            aria-describedby={message ? 'z1-npi-message' : undefined}
          />
          <button className="z1-npi-submit" type="submit" disabled={state === 'resolving'}>
            {state === 'resolving' ? 'Checking…' : 'Start with your NPI'}
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

      {/* The demo boundary, stated on the surface — not buried in a tooltip. */}
      <p className="z1-demo-note" role="note">
        Simulated resolution — this preview queries no source and shows a fictional
        record. Try:{' '}
        <button type="button" className="z1-chip" onClick={() => { setRaw('1234567893'); resolve('found'); }}>clinician found</button>{' '}
        <button type="button" className="z1-chip" onClick={() => submit('organization')}>organization NPI</button>{' '}
        <button type="button" className="z1-chip" onClick={() => submit('unavailable')}>source unavailable</button>
      </p>

      <div
        className="z1-record"
        data-face={state === 'resolving' ? 'resolving' : state === 'found' ? 'returned' : digits.length > 0 ? 'writing' : 'blank'}
        // The canonical faces module is the only producer of this markup.
        dangerouslySetInnerHTML={{ __html: face }}
      />
    </div>
  );
}
