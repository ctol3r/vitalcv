import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { EvidenceInput } from '@/components/home/ask/EvidenceInput';
import {
  deriveEvidenceInputState,
  isLabelFloating,
  type DeriveArgs,
} from '@/components/home/ask/evidenceInputState';

/**
 * Wave 2 — the evidence field.
 *
 * The state model is tested as a pure function; the markup is tested through
 * the server render, which is also the no-JS reading of the page.
 */

const VALID = '1234567893'; // passes CMS 80840 + Luhn
const BAD_CHECKSUM = '1234567890'; // ten digits, wrong check digit

const derive = (args: Partial<DeriveArgs> = {}) =>
  deriveEvidenceInputState({ raw: '', focused: false, ...args });

const render = (props: Partial<React.ComponentProps<typeof EvidenceInput>> = {}) =>
  renderToStaticMarkup(
    React.createElement(EvidenceInput, {
      value: '',
      onValueChange: () => undefined,
      onSubmit: () => undefined,
      ...props,
    }),
  );

describe('evidence input state model', () => {
  it('names every state the field can be in', () => {
    expect(derive().state).toBe('idle');
    expect(derive({ focused: true }).state).toBe('focused-empty');
    expect(derive({ raw: '123', focused: true }).state).toBe('editing');
    expect(derive({ raw: VALID }).state).toBe('valid');
    expect(derive({ raw: BAD_CHECKSUM }).state).toBe('invalid');
    expect(derive({ raw: VALID, submitting: true }).state).toBe('submitting');
    expect(derive({ raw: VALID, disabled: true }).state).toBe('disabled');
  });

  it('normalises to digits and caps at ten', () => {
    expect(derive({ raw: 'a1b2c3' }).digits).toBe('123');
    expect(derive({ raw: '12345678901234' }).digits).toBe('1234567890');
    expect(derive({ raw: '  ' }).digits).toBe('');
  });

  it('treats an unfinished number as progress, not as an error', () => {
    const partial = derive({ raw: '12345', focused: true });
    expect(partial.validity).toBe('partial');
    expect(partial.errorMessage).toBeNull();
    expect(partial.canSubmit).toBe(false);
  });

  it('reports a complete-but-wrong number as invalid, with the precise reason', () => {
    const bad = derive({ raw: BAD_CHECKSUM });
    expect(bad.validity).toBe('invalid');
    // Never a generic "Invalid input" when checkNpi knows the real reason.
    expect(bad.errorMessage).toBe('That is 10 digits but not a valid NPI — check for a typo.');
    expect(bad.errorMessage).not.toMatch(/invalid input/i);
  });

  it('explains a short number only once a submit has been attempted', () => {
    expect(derive({ raw: '123' }).errorMessage).toBeNull();
    expect(derive({ raw: '123', submitAttempted: true }).errorMessage).toBe(
      'An NPI is 10 digits — 3 so far.',
    );
  });

  it('lets the owner raise its own error', () => {
    expect(derive({ raw: VALID, externalError: 'Something else went wrong' }).errorMessage).toBe(
      'Something else went wrong',
    );
  });

  it('permits submit only on a valid, enabled, settled field', () => {
    expect(derive({ raw: VALID }).canSubmit).toBe(true);
    expect(derive({ raw: BAD_CHECKSUM }).canSubmit).toBe(false);
    expect(derive({ raw: VALID, disabled: true }).canSubmit).toBe(false);
    expect(derive({ raw: VALID, submitting: true }).canSubmit).toBe(false);
  });

  it('floats the label on focus or on content, never otherwise', () => {
    expect(isLabelFloating(derive(), false)).toBe(false);
    expect(isLabelFloating(derive({ focused: true }), true)).toBe(true);
    expect(isLabelFloating(derive({ raw: '1' }), false)).toBe(true);
  });

  it('knows nothing about a lookup — resolving belongs to the result', () => {
    const source = readFileSync(
      join(__dirname, '..', 'components', 'home', 'ask', 'evidenceInputState.ts'),
      'utf8',
    );
    const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
    for (const forbidden of ['fetch(', 'NPPES', 'trust-state', 'bootstrap', 'resolving']) {
      expect(code).not.toContain(forbidden);
    }
  });
});

describe('evidence input markup', () => {
  it('carries a real label that is present in every state', () => {
    const idle = render();
    expect(idle).toContain('<label');
    expect(idle).toContain('for="npi-input"');
    expect(idle).toContain('Enter your 10-digit NPI');

    // Floating: still a real label, still associated, different words.
    const filled = render({ value: '12345' });
    expect(filled).toContain('for="npi-input"');
    expect(filled).toContain('NPI number');
  });

  it('never uses a placeholder as the label', () => {
    const html = render();
    expect(html).not.toContain('placeholder=');
  });

  it('shows an inert digit guide while empty, and never mistakes it for the label', () => {
    const empty = render();
    expect(empty).toContain('evidence-field__guide');
    // The guide sits inside an aria-hidden span, so it reaches no screen reader.
    expect(empty).toMatch(/evidence-field__guide"[^>]*aria-hidden="true"/);
    // …and it goes away the moment there are real digits to show.
    expect(render({ value: '1' })).not.toContain('evidence-field__guide');
    // The real label is still the accessible name in both states.
    expect(empty).toContain('Enter your 10-digit NPI');
  });

  it('exposes its state through stable attributes, not through CSS inference', () => {
    expect(render()).toContain('data-evidence-input-state="idle"');
    expect(render({ value: VALID })).toContain('data-evidence-input-state="valid"');
    expect(render({ value: VALID })).toContain('data-evidence-input-validity="valid"');
    expect(render({ value: BAD_CHECKSUM })).toContain('data-evidence-input-state="invalid"');
    expect(render({ value: '123' })).toContain('data-evidence-input-validity="partial"');
  });

  it('keeps the contracts the e2e suite pins', () => {
    const html = render();
    expect(html).toContain('id="npi-input"');
    expect(html).toContain('id="ask-hint"');
    expect(html).toContain('class="ask-field evidence-field"');
    expect(html).toContain('data-home-primary-cta');
    expect(html).toContain('0/10 digits');
    // React 19 serialises these attributes in camelCase; HTML parses attribute
    // names case-insensitively, so match the same way rather than pinning the
    // renderer's spelling.
    expect(html).toMatch(/inputmode="numeric"/i);
    expect(html).toMatch(/pattern="\[0-9\]\*"/);
  });

  it('keeps the message band present in both states so the description never dangles', () => {
    expect(render()).toContain('id="ask-hint"');
    expect(render({ value: BAD_CHECKSUM })).toContain('id="ask-hint"');
    expect(render()).toContain('aria-describedby="ask-hint"');
    expect(render({ value: BAD_CHECKSUM })).toContain('aria-describedby="ask-hint"');
  });

  it('announces a correction and marks the field invalid', () => {
    const html = render({ value: BAD_CHECKSUM });
    expect(html).toContain('role="alert"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('check for a typo');
    expect(render()).toContain('aria-invalid="false"');
  });

  it('never communicates state by colour alone — the mark is decorative, the text is not', () => {
    const invalid = render({ value: BAD_CHECKSUM });
    // Every glyph is hidden from assistive tech and paired with real text.
    const marks = invalid.match(/<svg[^>]*class="evidence-field__mark"[^>]*>/g) ?? [];
    expect(marks.length).toBeGreaterThan(0);
    for (const mark of marks) expect(mark).toContain('aria-hidden="true"');
    expect(invalid).toMatch(/check for a typo/);
  });

  it('disables the action until the number is actually valid', () => {
    expect(render()).toMatch(/<button[^>]*disabled/);
    expect(render({ value: '123' })).toMatch(/<button[^>]*disabled/);
    expect(render({ value: BAD_CHECKSUM })).toMatch(/<button[^>]*disabled/);
    expect(render({ value: VALID })).not.toMatch(/<button[^>]*disabled/);
  });

  it('keeps the settled primary label and invents no stronger claim', () => {
    const html = render({ value: VALID });
    // The CURLY apostrophe (U+2019), rendered literally — React escapes ASCII
    // quotes but not this one. homepage-degradation.spec.ts matches the
    // character literally, so a straight-quote swap silently breaks it.
    expect(html).toContain('Check what\u2019s ready');
    const lower = html.toLowerCase();
    for (const forbidden of [
      'verified',
      'verify now',
      'instant',
      'guaranteed',
      'credential',
      'approved',
    ]) {
      expect(lower).not.toContain(forbidden);
    }
  });

  it('asserts no source result before anything has been submitted', () => {
    const html = render({ value: VALID }).toLowerCase();
    for (const forbidden of ['nppes', 'oig', 'pecos', 'licensure', 'source-backed', 'no match']) {
      expect(html).not.toContain(forbidden);
    }
  });

  it('adds no raw lucide import (LINT-02 is a ratchet)', () => {
    const source = readFileSync(
      join(__dirname, '..', 'components', 'home', 'ask', 'EvidenceInput.tsx'),
      'utf8',
    );
    expect(source).not.toMatch(/from\s+['"]lucide-react['"]/);
  });
});

describe('evidence input stylesheet', () => {
  const css = readFileSync(join(__dirname, '..', 'styles', 'evidence-input.css'), 'utf8');
  /** Declarations only. A comment that DOCUMENTS a rule must not trip it —
   *  the same reason check-design-lint.ts strips comments before matching. */
  const declarations = css.replace(/\/\*[\s\S]*?\*\//g, '');

  it('keeps the focus-within contract ask-home.spec.ts reads', () => {
    const rule = css.split('\n').join(' ');
    expect(rule).toMatch(/\.ask-field\.evidence-field:focus-within[^}]*(?:outline|border-bottom-color)/);
  });

  it('reserves the label band and the status slot so nothing shifts while typing', () => {
    expect(css).toMatch(/\.evidence-field__label\s*\{[^}]*height:/);
    expect(css).toMatch(/\.evidence-field__status\s*\{[^}]*width:/);
    expect(css).toMatch(/\.evidence-field__message\s*\{[^}]*min-height:/);
  });

  it('does not claim source-confirmed green for a passing check digit', () => {
    // CD-3: green means a named source returned a match. Arithmetic is not
    // evidence, and this is the file where that lie would be easiest to tell.
    expect(declarations).not.toContain('--vt-state-source-confirmed');
  });

  it('uses tokens only — no raw colour, z-index, shadow or font literal', () => {
    expect(declarations).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\b(?:oklch|rgba?|hsla?)\(/);
    expect(declarations).not.toMatch(/z-index\s*:\s*-?\d/);
    for (const shadow of declarations.match(/box-shadow\s*:\s*[^;]+/g) ?? []) {
      expect(shadow).toMatch(/box-shadow\s*:\s*(?:none|var\()/);
    }
    for (const font of declarations.match(/font-family\s*:\s*[^;]+/g) ?? []) {
      expect(font).toMatch(/font-family\s*:\s*var\(/);
    }
  });

  it('keeps motion finite, reduced-motion-safe, and incapable of moving the page', () => {
    expect(css).toContain('@media (prefers-reduced-motion: no-preference)');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(declarations).not.toMatch(/animation[^;]*\binfinite\b/);
    expect(declarations).not.toContain('@keyframes');
    expect(css).not.toContain('scroll-snap-type');
    // The cue moves inside the button; it may not animate a layout property.
    const noPreference = css.split('@media (prefers-reduced-motion: no-preference)')[1] ?? '';
    expect(noPreference).not.toMatch(/transition:\s*(?:width|height|margin|padding|top|left)/);
  });
});
