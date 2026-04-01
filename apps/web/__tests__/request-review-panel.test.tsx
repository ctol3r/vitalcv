// @vitest-environment jsdom

import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RequestReviewPanel } from '@/components/employer/RequestReviewPanel';

const { roleContextValue } = vi.hoisted(() => ({
  roleContextValue: {
    isLoaded: true,
    isSignedIn: true,
    isEmployer: true,
  },
}));

vi.mock('@/components/auth/RoleContext', () => ({
  useRoleContext: () => roleContextValue,
}));

vi.mock('@/lib/auth/clerkConfig', () => ({
  CLERK_PROVIDER_ENABLED: false,
  CLERK_SIGN_IN_URL: '/sign-in',
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string | { pathname?: string };
    children: React.ReactNode;
  }) => (
    <a href={typeof href === 'string' ? href : href.pathname ?? '#'} {...props}>
      {children}
    </a>
  ),
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

function textContent(container: HTMLElement): string {
  return container.textContent ?? '';
}

async function setInputValue(
  container: HTMLElement,
  selector: string,
  value: string,
) {
  const input = container.querySelector<HTMLInputElement>(selector);
  if (!input) {
    throw new Error(`Unable to find input for selector "${selector}"`);
  }

  await act(async () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    );
    descriptor?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

async function clickByText(
  container: HTMLElement,
  text: string,
  selector = 'button, a',
) {
  const element = Array.from(container.querySelectorAll<HTMLElement>(selector))
    .find((node) => node.textContent?.includes(text));

  if (!element) {
    throw new Error(`Unable to find clickable element containing "${text}"`);
  }

  await act(async () => {
    element.click();
  });
}

function hrefForText(container: HTMLElement, text: string): string | null {
  const link = Array.from(container.querySelectorAll<HTMLAnchorElement>('a'))
    .find((node) => node.textContent?.includes(text));
  return link?.getAttribute('href') ?? null;
}

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn(async () => body),
  };
}

describe('request review panel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('React', React);
    vi.stubGlobal('fetch', vi.fn());
    roleContextValue.isLoaded = true;
    roleContextValue.isSignedIn = true;
    roleContextValue.isEmployer = true;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('renders loading copy while the review context is being created', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(() => new Promise(() => {}) as never);

    const view = await renderNode(<RequestReviewPanel />);

    await setInputValue(view.container, '#employer-npi', '1234567890');
    await clickByText(view.container, 'Create review context');
    await flush();

    expect(textContent(view.container)).toContain('Creating review context…');
    expect(textContent(view.container)).toContain('Resolving NPI and registering context.');
    expect(textContent(view.container)).not.toContain('Review context created');

    await view.unmount();
  });

  it('renders the review link success state with the canonical review destination', async () => {
    const reviewUrl = 'http://localhost/review/entity-1?contextId=ctx-1';
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({
      contextId: 'ctx-1',
      entityId: 'entity-1',
      reviewUrl,
      npi: '1234567890',
      displayName: 'Ada Lovelace, MD',
      status: 'PENDING',
    }) as never);

    const view = await renderNode(<RequestReviewPanel />);

    await setInputValue(view.container, '#employer-npi', '1234567890');
    await clickByText(view.container, 'Create review context');
    await flush();

    expect(textContent(view.container)).toContain('Review context created');
    expect(textContent(view.container)).toContain('Clinician NPI 1234567890');
    expect(textContent(view.container)).not.toContain('Ada Lovelace, MD');
    expect(textContent(view.container)).toContain('Review link');
    expect(textContent(view.container)).toContain('Copy review link');
    expect(hrefForText(view.container, 'Open review')).toBe(reviewUrl);
    expect(hrefForText(view.container, 'Open review')).toContain('/review/');
    expect(hrefForText(view.container, 'Open review')).not.toContain('/pilot');
    expect(textContent(view.container)).not.toContain('verified review');

    await view.unmount();
  });

  it('surfaces the request failure copy without fabricating a success state', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockRejectedValueOnce(new Error('network down'));

    const view = await renderNode(<RequestReviewPanel />);

    await setInputValue(view.container, '#employer-npi', '1234567890');
    await clickByText(view.container, 'Create review context');
    await flush();

    expect(textContent(view.container)).toContain('Request failed. Check your connection and try again.');
    expect(textContent(view.container)).toContain('Create review context');
    expect(textContent(view.container)).not.toContain('Review context created');

    await view.unmount();
  });
});
