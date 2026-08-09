/**
 * D-02 — the scene primitives' contract.
 *
 * The gate: the primary action no longer needs green, and every primitive has
 * an accessible name and honest states. Colour VALUES are pinned by
 * scene-token-contract.test.ts against the token file; this suite pins what
 * the components DO with those tokens:
 *
 *  - VitalAction/VitalGhostAction render exactly one interactive element and
 *    cannot contain another (label is a string by type — asserted here so a
 *    future children-typed refactor fails loudly).
 *  - No primitive references a state hue. Green appearing in an action is the
 *    exact defect D-01A removed from three islands.
 *  - Pending is a state: aria-busy, disabled, caller-supplied wording.
 *  - Disabled is real: the attribute, not a class.
 *  - The glow is opt-in, single, aria-hidden, and never wraps a control.
 */
import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  VitalAction,
  VitalFrostPanel,
  VitalGhostAction,
  VitalPill,
  VitalProofRow,
  VitalSceneFrame,
} from '@/components/vital';
import { EvidenceRow } from '@/components/vital/EvidenceRow';

const STATE_HUE_TOKENS = [
  '--vt-scene-state-source-confirmed',
  '--vt-scene-state-needs-person',
  '--vt-scene-state-waiting',
  '--vt-state-source-confirmed',
  '--ezh-work',
  '#4ade97',
  '#2e9e6b',
];

describe('vital scene primitives (D-02)', () => {
  it('the primary action is paper, not green — in both registers and all states', () => {
    for (const register of ['scene', 'paper'] as const) {
      const html = renderToStaticMarkup(
        <>
          <VitalAction label="Start with your NPI" register={register} />
          <VitalAction label="Start" register={register} disabled />
          <VitalAction label="Start" register={register} pending pendingLabel="Checking the registry…" />
          <VitalGhostAction label="Check another NPI" register={register} />
        </>,
      );
      expect(html).toContain('--vt-action-primary');
      for (const hue of STATE_HUE_TOKENS) {
        expect(html, `state hue ${hue} reached an action (register: ${register})`).not.toContain(hue);
      }
    }
  });

  it('actions render exactly one interactive element and a string label', () => {
    const button = renderToStaticMarkup(<VitalAction label="Approve" />);
    expect((button.match(/<(button|a)\b/g) ?? []).length).toBe(1);
    expect(button).toContain('>Approve</button>');

    const link = renderToStaticMarkup(<VitalAction label="Keep this record" href="/onboarding" />);
    expect((link.match(/<(button|a)\b/g) ?? []).length).toBe(1);
    expect(link).toContain('href="/onboarding"');

    // The nested-interactive defect is unrepresentable: label is a string at
    // the type level. If someone widens it to ReactNode this stops compiling
    // meaningfully — so pin the runtime shape too.
    // @ts-expect-error — label must be a string, not an element
    const widened: Parameters<typeof VitalAction>[0] = { label: <a href="/x">nested</a> };
    void widened;
  });

  it('pending is an honest state: aria-busy, disabled, caller wording', () => {
    const html = renderToStaticMarkup(
      <VitalAction label="Start with your NPI" pending pendingLabel="Checking the registry…" />,
    );
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('disabled');
    expect(html).toContain('Checking the registry…');
    expect(html).not.toContain('>Start with your NPI<');

    // pending WITHOUT wording does not enter the pending presentation — the
    // caller must say what is happening; the control still disables.
    const missing = renderToStaticMarkup(<VitalAction label="Start" pending />);
    expect(missing).not.toContain('aria-busy');
    expect(missing).toContain('disabled');
  });

  it('disabled and pending never render as a link', () => {
    for (const props of [{ disabled: true }, { pending: true, pendingLabel: 'Working…' }]) {
      const html = renderToStaticMarkup(<VitalAction label="Go" href="/onboarding" {...props} />);
      expect(html).not.toContain('<a ');
      expect(html).toContain('<button');
      expect(html).toContain('disabled');
    }
  });

  it('the pill is toneless — it has no colour prop and no state hue', () => {
    const html = renderToStaticMarkup(<VitalPill label="NPPES" />);
    for (const hue of STATE_HUE_TOKENS) expect(html).not.toContain(hue);
    expect(html).toContain('NPPES');
    // @ts-expect-error — a pill must not accept a tone/colour
    const toned: Parameters<typeof VitalPill>[0] = { label: 'x', tone: 'green' };
    void toned;
  });

  it('the frost panel is material only: hairline + translucency, no shadow', () => {
    const html = renderToStaticMarkup(
      <VitalFrostPanel as="figure" aria-label="How VitalCV works">
        <p>content</p>
      </VitalFrostPanel>,
    );
    expect(html).toContain('<figure');
    expect(html).toContain('aria-label="How VitalCV works"');
    expect(html).toContain('--vt-frost-bg');
    expect(html).toContain('--vt-frost-border');
    expect(html).toContain('backdrop-blur');
    expect(html).not.toContain('shadow-');
  });

  it('the scene glow is opt-in, single, decorative, and never a control wrapper', () => {
    const off = renderToStaticMarkup(<VitalSceneFrame>content</VitalSceneFrame>);
    expect(off).not.toContain('data-vital-scene-glow');

    const on = renderToStaticMarkup(
      <VitalSceneFrame glow>
        <VitalAction label="Start" />
      </VitalSceneFrame>,
    );
    expect((on.match(/data-vital-scene-glow/g) ?? []).length).toBe(1);
    expect(on).toContain('aria-hidden="true"');
    // the glow layer is a span with no children — it can never wrap a control
    expect(on).toMatch(/<span[^>]*data-vital-scene-glow[^>]*><\/span>/);
  });

  it('VitalProofRow IS EvidenceRow — no fork', () => {
    expect(VitalProofRow).toBe(EvidenceRow);
  });
});
