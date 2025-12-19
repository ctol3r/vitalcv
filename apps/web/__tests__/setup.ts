import { afterAll, afterEach, beforeAll, jest } from '@jest/globals';
import '@testing-library/jest-dom';
import 'cross-fetch/polyfill';
import { ReadableStream, TransformStream, WritableStream } from 'stream/web';
import { TextDecoder, TextEncoder } from 'util';
import { BroadcastChannel } from 'worker_threads';
(globalThis as any).TextEncoder = (globalThis as any).TextEncoder || TextEncoder;
(globalThis as any).TextDecoder = (globalThis as any).TextDecoder || TextDecoder;
(globalThis as any).TransformStream = (globalThis as any).TransformStream || TransformStream;
(globalThis as any).ReadableStream = (globalThis as any).ReadableStream || ReadableStream;
(globalThis as any).WritableStream = (globalThis as any).WritableStream || WritableStream;
(globalThis as any).BroadcastChannel = (globalThis as any).BroadcastChannel || BroadcastChannel;

// next/server's NextResponse.json delegates to Response.json. Ensure it exists in tests.
if (typeof (globalThis as any).Response?.json !== 'function') {
  (globalThis as any).Response.json = (body: any, init?: ResponseInit) => {
    const HeadersCtor = (globalThis as any).Headers;
    const headers = new HeadersCtor(init?.headers || {});
    if (!headers.has('content-type')) headers.set('content-type', 'application/json');
    return new (globalThis as any).Response(JSON.stringify(body), { ...init, headers });
  };
}

// MSW requires TextEncoder at import-time, so load it after polyfills.
const { server } = require('./mocks/server') as typeof import('./mocks/server');

// Establish API mocking before all tests
beforeAll(() => server.listen());

// Reset any request handlers that we may add during the tests,
// so they don't affect other tests
afterEach(() => server.resetHandlers());

// Clean up after the tests are finished
afterAll(() => server.close());

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(),
  }),
  usePathname: () => '/test',
}));

// Mock useToast hook
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

// Common browser APIs missing in JSDOM
(globalThis as any).URL.createObjectURL =
  (globalThis as any).URL.createObjectURL || jest.fn(() => 'mocked-url');
(globalThis as any).URL.revokeObjectURL = (globalThis as any).URL.revokeObjectURL || jest.fn();

Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn(() => Promise.resolve()),
  },
});
class MockIntersectionObserver {
  observe = jest.fn();
  disconnect = jest.fn();
  unobserve = jest.fn();
  constructor(_callback: any) {}
}
class MockResizeObserver {
  observe = jest.fn();
  disconnect = jest.fn();
  unobserve = jest.fn();
  constructor(_callback: any) {}
}

(globalThis as any).IntersectionObserver = MockIntersectionObserver;
(globalThis as any).ResizeObserver = MockResizeObserver;
(globalThis as any).matchMedia =
  (globalThis as any).matchMedia ||
  ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }));
