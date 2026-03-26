// @vitest-environment jsdom

import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Accordion } from '@/components/ui/vcv-accordion';

const { trackUxEventMock } = vi.hoisted(() => ({
  trackUxEventMock: vi.fn(),
}));

vi.mock('@/lib/telemetry/ux-tracker', () => ({
  trackUxEvent: trackUxEventMock,
}));

async function renderNode(node: React.ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(node);
  });

  return {
    container,
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe('vcv accordion', () => {
  afterEach(() => {
    trackUxEventMock.mockReset();
    document.body.innerHTML = '';
  });

  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  it('renders trigger buttons with shared trust-safe status labels', async () => {
    const view = await renderNode(
      <Accordion
        items={[
          {
            id: 'identity',
            trigger: 'Identity Verification',
            status: 'checked',
            content: <div>Decision-grade identity note</div>,
          },
          {
            id: 'licensure',
            trigger: 'State Licensure / Authority',
            status: 'access_required',
            content: <div>Institutional source required</div>,
          },
        ]}
      />,
    );

    const buttons = Array.from(view.container.querySelectorAll('button'));
    expect(buttons).toHaveLength(2);
    expect(buttons[0]?.textContent).toContain('Identity Verification');
    expect(buttons[0]?.textContent).toContain('Checked');
    expect(buttons[1]?.textContent).toContain('Access required');

    buttons[0]?.focus();
    expect(document.activeElement).toBe(buttons[0]);

    await view.unmount();
  });

  it('opens a section and emits accordion telemetry once per expansion', async () => {
    const view = await renderNode(
      <Accordion
        telemetryComponentId="homepage_readiness_proof"
        items={[
          {
            id: 'identity',
            trigger: 'Identity Verification',
            status: 'checked',
            content: <div>Decision-grade identity note</div>,
          },
        ]}
      />,
    );

    const button = view.container.querySelector('button');
    expect(button?.getAttribute('data-state')).toBe('closed');

    await act(async () => {
      button?.click();
    });

    expect(button?.getAttribute('data-state')).toBe('open');
    expect(trackUxEventMock).toHaveBeenCalledTimes(1);
    expect(trackUxEventMock).toHaveBeenCalledWith(expect.objectContaining({
      event_name: 'accordion_expand',
      component_id: 'homepage_readiness_proof',
      metadata: expect.objectContaining({
        section_id: 'identity',
      }),
    }));

    await act(async () => {
      button?.click();
    });

    expect(button?.getAttribute('data-state')).toBe('closed');
    expect(trackUxEventMock).toHaveBeenCalledTimes(1);

    await view.unmount();
  });
});
