// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DecisionActions } from '@/app/p/[slug]/DecisionActions';

const { refreshMock, toastSuccessMock, toastErrorMock } = vi.hoisted(() => ({
  refreshMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: refreshMock,
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function clickByText(container: HTMLElement, text: string) {
  const button = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
    .find((node) => node.textContent?.includes(text));

  if (!button) {
    throw new Error(`Unable to find button containing "${text}"`);
  }

  await act(async () => {
    button.click();
  });
  await flush();
}

function textContent(container: HTMLElement): string {
  return container.textContent ?? '';
}

describe('DecisionActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('fetch', vi.fn());
  });

  it('resets back to the canonical labels after refreshed server data arrives', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn(async () => ({ success: true })),
    } as never);

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);

    try {
      await act(async () => {
        root.render(<DecisionActions npi="1234567890" refreshKey="before" />);
      });
      await flush();

      await clickByText(container, 'Accept as head start');

      expect(textContent(container)).toContain('Saved');
      expect(textContent(container)).toContain('Action confirmed');
      expect(textContent(container)).toContain('Accepted as head start');
      expect(refreshMock).toHaveBeenCalledTimes(1);
      expect(toastSuccessMock).toHaveBeenCalledWith('Head start saved');

      await act(async () => {
        root.render(<DecisionActions npi="1234567890" refreshKey="after" />);
      });
      await flush();

      expect(textContent(container)).toContain('Accept as head start');
      expect(textContent(container)).not.toContain('Saved');
    } finally {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    }
  });
});
