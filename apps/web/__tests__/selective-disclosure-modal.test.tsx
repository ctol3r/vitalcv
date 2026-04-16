import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SelectiveDisclosureModal } from '@/components/clinician/SelectiveDisclosureModal';

vi.mock('@/components/clinician/BiometricPrompt', () => ({
  BiometricPrompt: () => null,
}));

const CREDENTIALS = [
  {
    id: 'cred-1',
    type: 'STATE_LICENSE',
    name: 'California Medical License',
    issuer: 'Medical Board of California',
    status: 'ACTIVE' as const,
    claimLevel: 'L3' as const,
    issueDate: '2026-01-01',
    expirationDate: '2027-01-01',
    licenseId: 'CA-12345',
    psvSnapshotHash: 'hash-1',
    verifierDid: 'did:web:vitalcv.test:issuer',
    methodologyVersion: 'VCV-PSV-2026.1',
  },
  {
    id: 'cred-2',
    type: 'BOARD_CERTIFICATION',
    name: 'Internal Medicine Board Certification',
    issuer: 'ABIM',
    status: 'ACTIVE' as const,
    claimLevel: 'L2' as const,
    issueDate: '2026-01-01',
    expirationDate: '2027-01-01',
    licenseId: 'ABIM-4444',
    methodologyVersion: 'VCV-PSV-2026.1',
  },
];

describe('SelectiveDisclosureModal', () => {
  it('shows explicit visible and locked fields in proof mode without using a fake verified label', () => {
    const markup = renderToStaticMarkup(
      <SelectiveDisclosureModal
        open
        onClose={() => {}}
        credentials={CREDENTIALS}
        initialDisclosureLevel="proof"
      />,
    );

    expect(markup).toContain('Visible fields');
    expect(markup).toContain('Locked fields');
    expect(markup).toContain('Receipt attached');
    expect(markup).toContain('Receipt missing');
    expect(markup).toContain('blur-[2px]');
    expect(markup).not.toContain('Verified');
  });
});
