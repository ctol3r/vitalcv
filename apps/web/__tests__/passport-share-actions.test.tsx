import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import PassportShareActions from '@/components/passport/PassportShareActions';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('PassportShareActions', () => {
  it('explains the shared passport as a preview and keeps decision-grade boundaries explicit', () => {
    const markup = renderToStaticMarkup(
      <PassportShareActions npi="1234567890" name="Ada Lovelace" />,
    );

    expect(markup).toContain('Share Passport Preview');
    expect(markup).toContain('Share a public preview of your current VitalCV passport.');
    expect(markup).toContain('Signed-in employer review is still required before anyone treats the share as decision-grade.');
    expect(markup).toContain('Copy Preview Link');
    expect(markup).toContain('current passport preview');
  });
});
