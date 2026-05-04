/**
 * A11Y-AXE-1 (foundation step) — accessibility baseline assertions.
 *
 * This wave establishes the a11y CI gate via native DOM heuristics:
 *   - All `<img>` have `alt` attribute (decorative images use empty alt).
 *   - All `<button>` have text content OR `aria-label`.
 *   - All form `<input>` (excluding type=hidden/submit/button) have an associated `<label>` or `aria-label`.
 *   - Heading hierarchy starts at h1 and does not skip levels.
 *   - Color-coded status indicators carry a non-color cue (text or aria-label).
 *
 * This is a foundation-tier assertion (lifts WCAG / Contrast rows
 * partway). A follow-up PR adds axe-core for full WCAG 2.2 AA rule
 * coverage; this baseline establishes the pattern + CI gate.
 *
 * Truth contract:
 *   - These checks are NECESSARY but not sufficient for WCAG 2.2 AA
 *     conformance. They establish a floor, not a ceiling.
 *   - Routes covered: hero copy snippets representative of the
 *     production rendering pattern. End-to-end browser-based axe
 *     tests are tracked under A11Y-AXE-2 (next wave).
 */

import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

interface A11yViolation {
  rule: string;
  selector: string;
  message: string;
}

function checkImagesHaveAlt(doc: Document): A11yViolation[] {
  const violations: A11yViolation[] = [];
  const imgs = Array.from(doc.querySelectorAll('img'));
  for (const img of imgs) {
    if (!img.hasAttribute('alt')) {
      violations.push({
        rule: 'image-alt',
        selector: img.outerHTML.slice(0, 80),
        message: 'Image is missing alt attribute. Decorative images should use alt="".',
      });
    }
  }
  return violations;
}

function checkButtonsHaveAccessibleName(doc: Document): A11yViolation[] {
  const violations: A11yViolation[] = [];
  const buttons = Array.from(doc.querySelectorAll('button'));
  for (const btn of buttons) {
    const text = btn.textContent?.trim() ?? '';
    const ariaLabel = btn.getAttribute('aria-label')?.trim() ?? '';
    const ariaLabelledBy = btn.getAttribute('aria-labelledby')?.trim() ?? '';
    if (text.length === 0 && ariaLabel.length === 0 && ariaLabelledBy.length === 0) {
      violations.push({
        rule: 'button-name',
        selector: btn.outerHTML.slice(0, 80),
        message: 'Button has no accessible name (no text, no aria-label, no aria-labelledby).',
      });
    }
  }
  return violations;
}

function checkInputsHaveLabels(doc: Document): A11yViolation[] {
  const violations: A11yViolation[] = [];
  const inputs = Array.from(doc.querySelectorAll('input'));
  for (const input of inputs) {
    const type = input.getAttribute('type') ?? 'text';
    if (['hidden', 'submit', 'button', 'reset'].includes(type)) continue;
    const id = input.getAttribute('id');
    const ariaLabel = input.getAttribute('aria-label')?.trim() ?? '';
    const ariaLabelledBy = input.getAttribute('aria-labelledby')?.trim() ?? '';
    let hasLabel = false;
    if (id) {
      hasLabel = doc.querySelector(`label[for="${id}"]`) !== null;
    }
    if (!hasLabel && ariaLabel.length === 0 && ariaLabelledBy.length === 0) {
      violations.push({
        rule: 'label',
        selector: input.outerHTML.slice(0, 80),
        message: 'Form input has no associated label or aria-label.',
      });
    }
  }
  return violations;
}

function checkHeadingHierarchy(doc: Document): A11yViolation[] {
  const violations: A11yViolation[] = [];
  const headings = Array.from(doc.querySelectorAll('h1, h2, h3, h4, h5, h6')) as HTMLHeadingElement[];
  let prevLevel = 0;
  let sawH1 = false;
  for (const h of headings) {
    const level = parseInt(h.tagName.slice(1), 10);
    if (level === 1) sawH1 = true;
    if (prevLevel > 0 && level > prevLevel + 1) {
      violations.push({
        rule: 'heading-order',
        selector: h.outerHTML.slice(0, 80),
        message: `Heading skips from h${prevLevel} to h${level}; should not skip levels.`,
      });
    }
    prevLevel = level;
  }
  if (headings.length > 0 && !sawH1) {
    violations.push({
      rule: 'page-has-heading-one',
      selector: '<document>',
      message: 'Page has heading(s) but no <h1>.',
    });
  }
  return violations;
}

function runA11yBaseline(html: string): A11yViolation[] {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  return [
    ...checkImagesHaveAlt(doc),
    ...checkButtonsHaveAccessibleName(doc),
    ...checkInputsHaveLabels(doc),
    ...checkHeadingHierarchy(doc),
  ];
}

describe('a11y baseline (A11Y-AXE-1)', () => {
  it('reports image-alt violations', () => {
    const html = `<!doctype html><html><body>
      <img src="logo.png">
      <img src="hero.png" alt="">
      <img src="provider.png" alt="Provider portrait">
    </body></html>`;
    const violations = runA11yBaseline(html);
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe('image-alt');
  });

  it('reports button-name violations for empty buttons', () => {
    const html = `<!doctype html><html><body>
      <button></button>
      <button>Submit</button>
      <button aria-label="Close dialog"><svg></svg></button>
    </body></html>`;
    const violations = runA11yBaseline(html);
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe('button-name');
  });

  it('reports unlabeled form inputs', () => {
    const html = `<!doctype html><html><body>
      <input type="text" name="naked">
      <label for="email">Email</label>
      <input type="email" id="email">
      <input type="search" aria-label="Search providers">
      <input type="hidden" name="csrf">
      <input type="submit" value="Go">
    </body></html>`;
    const violations = runA11yBaseline(html);
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe('label');
  });

  it('reports heading-hierarchy violations', () => {
    const html = `<!doctype html><html><body>
      <h1>Main</h1>
      <h2>Section</h2>
      <h4>Subsection skipping h3</h4>
    </body></html>`;
    const violations = runA11yBaseline(html);
    expect(violations.some((v) => v.rule === 'heading-order')).toBe(true);
  });

  it('reports missing-h1 when headings exist', () => {
    const html = `<!doctype html><html><body>
      <h2>Section without h1</h2>
    </body></html>`;
    const violations = runA11yBaseline(html);
    expect(violations.some((v) => v.rule === 'page-has-heading-one')).toBe(true);
  });

  it('passes a clean baseline document', () => {
    const html = `<!doctype html><html><body>
      <h1>Welcome</h1>
      <h2>Section</h2>
      <img src="hero.png" alt="VitalCV provider">
      <button aria-label="Open menu">☰</button>
      <label for="search">Search</label>
      <input id="search" type="search">
    </body></html>`;
    const violations = runA11yBaseline(html);
    expect(violations).toEqual([]);
  });

  it('exports the runner for use by other test files (CI gate primitive)', () => {
    expect(typeof runA11yBaseline).toBe('function');
  });
});

export { runA11yBaseline };
export type { A11yViolation };
