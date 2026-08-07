// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';

/**
 * The eyebrow used to exist twice: `components/home/ExpandingEyebrow` shipped on
 * `/` while THIS one — the design-system component — was reachable only from
 * this test. The homepage recovery (#1060) deleted the home copy and kept the
 * design-system implementation, which is the one that meets CD-15's 44px target
 * floor. So the test follows the surviving component rather than the dead path.
 *
 * The API is `{ children, detail?, sticky?, stickyOffset?, className? }` — the
 * label is children, not a `label` prop.
 */
import { ExpandingEyebrow } from '@/design-system/components/ExpandingEyebrow';

const LABEL = 'For clinicians';
const DETAIL = 'Start with one NPI.';

const eyebrow = () => (
  <ExpandingEyebrow detail={DETAIL}>{LABEL}</ExpandingEyebrow>
);

const render = () => renderToStaticMarkup(eyebrow());

async function mount(node: React.ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(node);
  });
  return { container, root };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('ExpandingEyebrow', () => {
  it('keeps its complete orientation cue in the server-rendered document', () => {
    const markup = render();

    expect(markup).toContain(LABEL);
    expect(markup).toContain(DETAIL);
  });

  it('uses a real keyboard-operable disclosure control', () => {
    const markup = render();

    expect(markup).toContain('<button');
    expect(markup).toContain('type="button"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('aria-controls=');
  });

  it('does not turn editorial chrome into a trust claim', () => {
    expect(render().toLowerCase()).not.toMatch(/verified|cleared|approved|credentialed/);
  });

  /**
   * The hydration guard. The collapsed state is `opacity-0`, and `open` can only
   * ever become true through a client event — so without the guard the detail
   * was present in the DOM and invisible on screen for every no-JS visitor.
   *
   * jsdom cannot observe a pre-hydration paint, so what is asserted here is the
   * flag that gates the collapse: absent from the server render, present once
   * effects have run. If the guard is ever dropped, the flag stops appearing and
   * this fails.
   */
  it('does not collapse the detail until hydration has actually happened', async () => {
    expect(render()).not.toContain('data-hydrated');

    const { container } = await mount(eyebrow());

    expect(container.querySelector('[data-hydrated]')).not.toBeNull();
    // The detail never leaves the accessibility tree in either state.
    expect(container.textContent).toContain(DETAIL);
    expect(container.querySelector('[hidden]')).toBeNull();
  });

  it('closes on Escape and returns the trigger to a resting state', async () => {
    const { container } = await mount(eyebrow());
    const trigger = container.querySelector('button')!;

    await act(async () => {
      trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    await act(async () => {
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });
});
