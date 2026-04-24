// @vitest-environment jsdom

import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApplyWithVitalCV } from '@/components/passport/ApplyWithVitalCV';

const { authState, pushMock } = vi.hoisted(() => ({
  authState: {
    isLoaded: true,
    isSignedIn: true,
    userId: 'user_123',
  },
  pushMock: vi.fn(),
}));

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => authState,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock('@/lib/auth/clerkConfig', () => ({
  CLERK_PROVIDER_ENABLED: true,
  CLERK_SIGN_IN_URL: '/sign-in',
}));

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function renderNode(node: React.ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(node);
  });
  await flush();

  return {
    container,
    async unmount() {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
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
}

describe('passport ApplyWithVitalCV', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('React', React);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn(async () => ({ bundleId: 'bundle-123' })),
    }));
    authState.isLoaded = true;
    authState.isSignedIn = true;
    authState.userId = 'user_123';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('creates a real apply bundle and routes to the immutable bundle view', async () => {
    const fetchMock = vi.mocked(fetch);
    const view = await renderNode(<ApplyWithVitalCV npi="1234567890" />);

    await clickByText(view.container, 'Apply with VitalCV');
    await flush();

    expect(fetchMock).toHaveBeenCalledWith('/api/apply/bundle', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-clerk-user-id': 'user_123',
      },
      body: JSON.stringify({ npi: '1234567890' }),
    });
    expect(pushMock).toHaveBeenCalledWith('/apply/bundle-123');

    await view.unmount();
  });

  it('shows visible snapshot progress while the employer review bundle is being created', async () => {
    let resolveResponse: ((value: unknown) => void) | null = null;
    vi.stubGlobal('fetch', vi.fn(() => new Promise((resolve) => {
      resolveResponse = resolve;
    })));

    const view = await renderNode(<ApplyWithVitalCV npi="1234567890" />);

    await clickByText(view.container, 'Apply with VitalCV');

    expect(view.container.textContent).toContain('Preparing employer review…');
    expect(view.container.textContent).toContain('Creating a fixed employer review link from this passport and opening the employer decision view.');

    resolveResponse?.({
      ok: true,
      json: vi.fn(async () => ({ bundleId: 'bundle-123' })),
    });
    await flush();

    await view.unmount();
  });
});
