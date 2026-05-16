import { afterEach, describe, expect, it } from 'vitest';
import { resolveDeploymentBackendBase, SURVIVAL_PUBLIC_API_BASE } from '@/lib/deployment/backend-base';

const ORIGINAL_ENV = {
  BACKEND_URL: process.env.BACKEND_URL,
  NEXT_PUBLIC_API_BASE: process.env.NEXT_PUBLIC_API_BASE,
  NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL,
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  CF_PAGES: process.env.CF_PAGES,
  VERCEL: process.env.VERCEL,
  NODE_ENV: process.env.NODE_ENV,
};

function restoreEnvVar(key: keyof typeof ORIGINAL_ENV) {
  const value = ORIGINAL_ENV[key];
  if (typeof value === 'undefined') {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

afterEach(() => {
  restoreEnvVar('BACKEND_URL');
  restoreEnvVar('NEXT_PUBLIC_API_BASE');
  restoreEnvVar('NEXT_PUBLIC_BACKEND_URL');
  restoreEnvVar('NEXT_PUBLIC_API_URL');
  restoreEnvVar('CF_PAGES');
  restoreEnvVar('VERCEL');
  restoreEnvVar('NODE_ENV');
});

describe('resolveDeploymentBackendBase', () => {
  it('uses localhost for local development when no deployment env is present', () => {
    delete process.env.BACKEND_URL;
    delete process.env.NEXT_PUBLIC_API_BASE;
    delete process.env.NEXT_PUBLIC_BACKEND_URL;
    delete process.env.NEXT_PUBLIC_API_URL;
    delete process.env.CF_PAGES;
    delete process.env.VERCEL;
    process.env.NODE_ENV = 'development';

    expect(resolveDeploymentBackendBase()).toBe('http://localhost:4000');
  });

  it('uses the canonical API origin in deployed environments without an explicit base', () => {
    delete process.env.BACKEND_URL;
    delete process.env.NEXT_PUBLIC_API_BASE;
    delete process.env.NEXT_PUBLIC_BACKEND_URL;
    delete process.env.NEXT_PUBLIC_API_URL;
    process.env.CF_PAGES = '1';
    process.env.NODE_ENV = 'production';

    expect(resolveDeploymentBackendBase()).toBe(SURVIVAL_PUBLIC_API_BASE);
  });

  it('normalizes explicit overrides', () => {
    process.env.BACKEND_URL = 'https://api.vitalcv.com/';
    delete process.env.NEXT_PUBLIC_API_BASE;
    delete process.env.NEXT_PUBLIC_BACKEND_URL;
    delete process.env.NEXT_PUBLIC_API_URL;
    delete process.env.CF_PAGES;
    delete process.env.VERCEL;
    process.env.NODE_ENV = 'production';

    expect(resolveDeploymentBackendBase()).toBe('https://api.vitalcv.com');
  });
});
