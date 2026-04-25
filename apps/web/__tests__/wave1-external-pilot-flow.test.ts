import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Wave 1 — External Pilot Flow P0 Closure
 *
 * These are deliberately source-level assertions rather than full component
 * renders. The ReviewClient surface has too many trust-state/identity/authority
 * dependencies to hydrate cleanly in a unit test, so we validate that the
 * load-bearing guards and test hooks the follow-up UAT / smoke tests rely on
 * are actually present in the source before we ship the external pilot link.
 *
 * Each `expect(...).toContain(...)` pin is paired with a comment explaining
 * WHICH observable behavior it enforces, so later refactors can safely move
 * the hook elsewhere without silently breaking the pilot flow.
 */

const WEB_ROOT = path.resolve(__dirname, '..');

function readWeb(relativePath: string): string {
  return fs.readFileSync(path.join(WEB_ROOT, relativePath), 'utf8');
}

describe('Wave 1 external pilot flow — ReviewClient P0 hooks', () => {
  const reviewClient = readWeb('components/review/ReviewClient.tsx');

  it('hoists confirm-start out of the action-done branch so returning reviewers can record start', () => {
    // The bug this test guards against: nesting confirm-start inside the
    // just-accepted TrustStateCard meant that whenever the reviewer re-opened
    // a previously-accepted review, the form disappeared. The hoisted panel
    // is gated on `hasAcceptedAction`, which derives from EITHER the in-session
    // accept OR the persisted action state.
    expect(reviewClient).toContain('const hasAcceptedAction =');
    expect(reviewClient).toContain("persistedActionState?.action === 'accept'");
    expect(reviewClient).toContain('data-testid="confirm-start-panel"');
    expect(reviewClient).toContain('data-testid="confirm-start-success"');
  });

  it('gates confirm-start on both canPersistActions AND hasAcceptedAction', () => {
    // If either guard is missing the form leaks into disallowed states.
    expect(reviewClient).toContain('canPersistActions && hasAcceptedAction');
  });

  it('surfaces the exact blocker list when the decision posture is BLOCKED', () => {
    // External-pilot reviewers must see the full set of blockers preventing
    // acceptance — the old truncated "first 3 + …" rendered was ambiguous for
    // a reviewer encountering the product for the first time.
    expect(reviewClient).toContain('data-testid="blocker-list"');
    expect(reviewClient).toContain('data-testid="blocker-item"');
    // The compact summary is kept for non-blocked states.
    expect(reviewClient).toContain('data-testid="blocker-summary"');
  });

  it('prevents a BLOCKED accept at the UI layer, not just the API layer', () => {
    // The Accept button must carry both the disabled attribute and a
    // `data-blocked="true"` affordance so external testers can assert
    // without needing to read the disabled attribute semantics.
    expect(reviewClient).toContain('data-testid="employer-accept-button"');
    expect(reviewClient).toContain('data-blocked={isAcceptBlockedDecisionPosture(decisionPosture.status)');
    expect(reviewClient).toContain('Acceptance blocked — resolve blockers first');
    // Belt-and-suspenders: handleAccept also no-ops for BLOCKED so programmatic
    // clicks can't bypass the disabled attribute.
    expect(reviewClient).toContain('if (isAcceptBlockedDecisionPosture(passport.decisionPosture?.status');
  });

  it('gives unauthenticated reviewers an explicit sign-in CTA, not fine-print', () => {
    // Preview-only used to render as muted 10px font — external pilot viewers
    // had no obvious path to persist. The CTA card is the lightweight access
    // step called out in the Wave 1 task doc.
    expect(reviewClient).toContain('data-testid="employer-action-preview-only"');
    expect(reviewClient).toContain('data-testid="employer-action-preview-signin"');
    expect(reviewClient).toContain('Sign in to persist decisions');
  });

  it('validates confirm-start inputs before calling the backend', () => {
    // Trim-aware client-side validation prevents whitespace-only strings from
    // reaching the audit endpoint (which would fail server-side anyway, but
    // the reviewer deserves an immediate error message).
    expect(reviewClient).toContain(
      'Start date, role, and facility are required before the audit record can close.',
    );
    expect(reviewClient).toContain('confirmStartFields.startedAt.trim()');
    expect(reviewClient).toContain('confirmStartFields.role.trim()');
    expect(reviewClient).toContain('confirmStartFields.facility.trim()');
  });
});

describe('Wave 1 external pilot flow — share-token review path', () => {
  const reviewPage = readWeb('app/review/[entityId]/ReviewPageClient.tsx');

  it('detects share tokens by the chk_ prefix and fixed length', () => {
    // External pilot invites use `chk_<43 url-safe chars>` tokens. Any other
    // shape is treated as an opaque entityId and falls through to the passport
    // lookup — this keeps short marketing links working.
    expect(reviewPage).toContain('/^chk_[A-Za-z0-9_-]{43}$/');
  });

  it('renders a safe unresolved state for missing/expired share tokens', () => {
    // Both 410 (expired) and other resolution failures must render the
    // TrustStateCard — never a raw 500 page. Tests downstream will look for
    // the `share-token-unresolved` data-testid.
    expect(reviewPage).toContain('data-testid="share-token-unresolved"');
    expect(reviewPage).toContain('data-share-token-status={isExpired');
    expect(reviewPage).toContain('This review link has expired');
    expect(reviewPage).toContain('no longer maps to an active packet');
  });

  it('preserves the review context on the retry link', () => {
    // retryHref must forward contextId/bundleId/from so the reviewer lands
    // back on the same review scope after hitting Try again.
    expect(reviewPage).toContain('buildRetryHref');
    expect(reviewPage).toContain('...(input.contextId ? { contextId: input.contextId } : {})');
    expect(reviewPage).toContain('...(input.from ? { from: input.from } : {})');
  });
});
