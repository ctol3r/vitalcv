/**
 * Import Guard Tests
 *
 * Ensures critical components export both named and default exports
 * to prevent Vercel build failures.
 */

import { describe, it, expect } from '@jest/globals';

describe('Import Guards - Component Exports', () => {
  it('should export ClaimWizardPane as named export', async () => {
    const module = await import('@/components/claim/ClaimWizardPane');
    expect(module.ClaimWizardPane).toBeDefined();
    expect(typeof module.ClaimWizardPane).toBe('function');
  });

  it('should export ClaimWizardPane as default export', async () => {
    const module = await import('@/components/claim/ClaimWizardPane');
    expect(module.default).toBeDefined();
    expect(typeof module.default).toBe('function');
  });

  it('should export ClaimStatusBadge as named export', async () => {
    const module = await import('@/components/status/ClaimStatusBadge');
    expect(module.ClaimStatusBadge).toBeDefined();
    expect(typeof module.ClaimStatusBadge).toBe('function');
  });

  it('should allow named import of ClaimWizardPane in consuming files', async () => {
    // This test ensures the pattern used in app/npi/[npi]/page.tsx works
    const { ClaimWizardPane } = await import('@/components/claim/ClaimWizardPane');
    expect(ClaimWizardPane).toBeDefined();
    expect(typeof ClaimWizardPane).toBe('function');
  });

  it('should allow named import of ClaimStatusBadge in consuming files', async () => {
    // This test ensures the pattern used in components/NpiPublicCard.tsx works
    const { ClaimStatusBadge } = await import('@/components/status/ClaimStatusBadge');
    expect(ClaimStatusBadge).toBeDefined();
    expect(typeof ClaimStatusBadge).toBe('function');
  });
});

describe('Import Guards - Page Exports', () => {
  it('should export viewport configuration from analytics page', async () => {
    const module = await import('@/app/analytics/page');
    expect(module.viewport).toBeDefined();
    expect(module.viewport).toHaveProperty('themeColor');
    expect(module.viewport).toHaveProperty('width');
    expect(module.viewport).toHaveProperty('initialScale');
  });

  it('should export viewport configuration from login page', async () => {
    const module = await import('@/app/login/page');
    expect(module.viewport).toBeDefined();
    expect(module.viewport).toHaveProperty('themeColor');
  });

  it('should export viewport configuration from onboarding page', async () => {
    const module = await import('@/app/onboarding/page');
    expect(module.viewport).toBeDefined();
    expect(module.viewport).toHaveProperty('themeColor');
  });

  it('should export viewport configuration from dashboard page', async () => {
    const module = await import('@/app/dashboard/page');
    expect(module.viewport).toBeDefined();
    expect(module.viewport).toHaveProperty('themeColor');
  });

  it('should export viewport and dynamic config from graph page', async () => {
    const module = await import('@/app/graph/page');
    expect(module.viewport).toBeDefined();
    expect(module.viewport).toHaveProperty('themeColor');
    expect(module.dynamic).toBe('force-dynamic');
    expect(module.revalidate).toBe(0);
  });
});

