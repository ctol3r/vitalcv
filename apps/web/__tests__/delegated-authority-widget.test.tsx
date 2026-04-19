/**
 * DelegatedAuthorityWidget — rendering contract tests.
 *
 * Guarantees pinned:
 *   1. When a supervisor is supplied, the widget renders displayName (as-is),
 *      NPI (tabular-nums mono), agreement status chip, and optional logged-at.
 *   2. When supervisor is null and requireSupervisor=false, the widget
 *      renders *nothing* — silent absence, not a placeholder.
 *   3. When supervisor is null and requireSupervisor=true, the widget renders
 *      a clear "No supervising physician on file" state.
 *   4. Malformed NPI (not 10 digits) is flagged as 'malformed' rather than
 *      silently rendered as if valid.
 *   5. Relationship label maps 'collaborator' → 'Collaborating MD', etc.
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { DelegatedAuthorityWidget } from '@/components/passport/DelegatedAuthorityWidget';
import type { SupervisingPhysicianLink } from '@/lib/clinical/privilege-types';

const supervisor: SupervisingPhysicianLink = {
  displayName: 'DR. ROBERT CHEN',
  npi: '1987654321',
  relationship: 'supervisor',
  specialty: 'Internal Medicine · Hospitalist',
  state: 'CA',
  agreementStatus: 'active',
  loggedAt: '2026-03-10T00:00:00.000Z',
};

describe('DelegatedAuthorityWidget', () => {
  it('renders supervisor display name, NPI, and agreement chip', () => {
    const markup = renderToStaticMarkup(
      <DelegatedAuthorityWidget supervisor={supervisor} />,
    );
    expect(markup).toContain('DR. ROBERT CHEN');
    expect(markup).toContain('1987654321');
    expect(markup).toContain('Active &amp; Logged');
    expect(markup).toContain('Supervising MD');
  });

  it('applies tabular-nums to NPI', () => {
    const markup = renderToStaticMarkup(
      <DelegatedAuthorityWidget supervisor={supervisor} />,
    );
    expect(markup).toContain('tabular-nums');
  });

  it('renders nothing when supervisor is null and requireSupervisor=false', () => {
    const markup = renderToStaticMarkup(
      <DelegatedAuthorityWidget supervisor={null} />,
    );
    expect(markup).toBe('');
  });

  it('renders an explicit missing-state when requireSupervisor=true', () => {
    const markup = renderToStaticMarkup(
      <DelegatedAuthorityWidget supervisor={null} requireSupervisor />,
    );
    expect(markup).toContain('No supervising physician is linked');
    expect(markup).toContain('Mid-level providers');
  });

  it('flags a malformed NPI (not 10 digits) as malformed', () => {
    const malformed: SupervisingPhysicianLink = {
      ...supervisor,
      npi: '12345',
    };
    const markup = renderToStaticMarkup(
      <DelegatedAuthorityWidget supervisor={malformed} />,
    );
    expect(markup).toContain('malformed');
  });

  it('maps relationship = collaborator to "Collaborating MD"', () => {
    const collab: SupervisingPhysicianLink = {
      ...supervisor,
      relationship: 'collaborator',
    };
    const markup = renderToStaticMarkup(
      <DelegatedAuthorityWidget supervisor={collab} />,
    );
    expect(markup).toContain('Collaborating MD');
  });

  it('maps relationship = delegate to "Delegate of authority"', () => {
    const delegate: SupervisingPhysicianLink = {
      ...supervisor,
      relationship: 'delegate',
    };
    const markup = renderToStaticMarkup(
      <DelegatedAuthorityWidget supervisor={delegate} />,
    );
    expect(markup).toContain('Delegate of authority');
  });

  it('renders "Expired" agreement chip for expired status', () => {
    const expired: SupervisingPhysicianLink = {
      ...supervisor,
      agreementStatus: 'expired',
    };
    const markup = renderToStaticMarkup(
      <DelegatedAuthorityWidget supervisor={expired} />,
    );
    expect(markup).toContain('Expired');
  });

  it('renders "No agreement on file" for missing status', () => {
    const missing: SupervisingPhysicianLink = {
      ...supervisor,
      agreementStatus: 'missing',
    };
    const markup = renderToStaticMarkup(
      <DelegatedAuthorityWidget supervisor={missing} />,
    );
    expect(markup).toContain('No agreement on file');
  });
});
