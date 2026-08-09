import { describe, expect, it } from 'vitest';

import { isWorkbenchCaptureSurface } from '@/components/layout/publicSurfaceRoutes';

/**
 * WB-08 — the dock's registry allowlist, pinned.
 *
 * The predicate is fail-closed: a surface gets the capture dock only by
 * deliberate membership. The employer/issuer/admin/ops exclusions are not
 * style — clinician-private notes must never appear near an employer
 * decision screen (knowledge program invariant 10), and the ops-facing
 * investigation workbench shares the customer-facing name (CC-04 M5), so the
 * two must never meet on one surface.
 */

describe('isWorkbenchCaptureSurface', () => {
  it('covers the holder tree (where the dock has always lived)', () => {
    expect(isWorkbenchCaptureSurface('/holder')).toBe(true);
    expect(isWorkbenchCaptureSurface('/holder/home')).toBe(true);
    expect(isWorkbenchCaptureSurface('/holder/opportunities/abc')).toBe(true);
    // /holder/garden mounts per the registry; the dock itself self-suppresses
    // there so the Cursor keeps sole ownership of ⌘K — pinned below.
    expect(isWorkbenchCaptureSurface('/holder/garden/notes')).toBe(true);
  });

  it('covers the clinician namespace (children only — the root mints no URL)', () => {
    expect(isWorkbenchCaptureSurface('/clinician/profile')).toBe(true);
    expect(isWorkbenchCaptureSurface('/clinician')).toBe(false);
  });

  it('covers the designated public research surfaces', () => {
    expect(isWorkbenchCaptureSurface('/explore')).toBe(true);
    expect(isWorkbenchCaptureSurface('/evidence-network')).toBe(true);
  });

  it('NEVER reaches employer, issuer, admin, or ops surfaces', () => {
    for (const path of [
      '/employer/dashboard',
      '/employer/review-queue',
      '/employers',
      '/issuer',
      '/issuer/review/req-1',
      '/admin',
      '/admin/platform',
      '/ops',
      '/ops/engine',
      '/intelligence',
      '/graph',
      '/investigations',
      '/mission-ops',
    ]) {
      expect(isWorkbenchCaptureSurface(path), `${path} must never mount the dock`).toBe(false);
    }
  });

  it('stays off the remaining public and auth surfaces (fail-closed default)', () => {
    for (const path of ['/', '/pricing', '/get-ready', '/onboarding', '/auth/sign-in', '/verify/1234567890', null]) {
      expect(isWorkbenchCaptureSurface(path), `${String(path)} gets no dock by default`).toBe(false);
    }
  });
});
