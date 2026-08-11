/**
 * Recording a start must not create a charge.
 *
 * VCD-00 found two wired start writers:
 *
 *   POST /api/hiring/start                              — apiKeyAuth (machine)
 *   POST /api/employer-review/:entityId/confirm-start   — Clerk actor + RBAC
 *
 * Both wrote a `StartAttestation` and a `START_ATTESTED` `AuditEvent`
 * atomically. Only the first also wrote a `BillingEvent` and fired
 * `recordSuccessfulHire()`, which creates a Stripe InvoiceItem for
 * $37.99 USD against the employer's customer record — finalised immediately
 * when `STRIPE_AUTO_INVOICE=true`, otherwise accumulating on their next
 * invoice.
 *
 * So the same business fact billed or did not bill depending on which door it
 * came through, and the door employers actually use in the UI was the one that
 * did not. Closing that asymmetry the other way — by making the UI path bill —
 * would invoice pilot participants who never agreed a price.
 *
 * Founder ruling (2026-08-11): take billing off the start path entirely until
 * there is a signed commercial scope to bill against. The billing machinery is
 * deliberately left intact and unreferenced (`services/billing/stripeClient.ts`,
 * the `BillingEvent` model) so re-introduction behind a real commercial gate is
 * a small, explicit change — not a rebuild.
 *
 * WHAT THIS ASSERTS AND WHY IT IS A SOURCE-LEVEL CHECK
 * A behavioural assertion would need a live Postgres and a Stripe key to be
 * meaningful, and would pass vacuously in any environment lacking either — the
 * exact conditions under which a billing regression would go unnoticed. So this
 * reads the served route module and asserts the coupling is absent at the
 * source: no `BillingEvent` persistence, and no call into the Stripe client.
 *
 * If billing is deliberately reintroduced, this test is supposed to fail. Put
 * it behind an explicit commercial gate, then rewrite this to assert that gate
 * — do not simply delete it.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROUTES = join(__dirname, '..');

function sourceOf(file: string): string {
  return readFileSync(join(ROUTES, file), 'utf8');
}

// Comments legitimately discuss billing (this change is explained in them), so
// strip them before asserting on what the code actually does.
function codeWithoutComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('the start path does not bill', () => {
  it.each([
    ['hiring.ts', 'POST /api/hiring/start'],
    ['employerActions.ts', 'POST /api/employer-review/:entityId/confirm-start'],
  ])('%s (%s) persists no BillingEvent', (file) => {
    const code = codeWithoutComments(sourceOf(file));

    expect(code).not.toMatch(/billingEvent\s*\.\s*(create|update|upsert)/);
    expect(code).not.toMatch(/\btx\s*\.\s*billingEvent\b/);
  });

  it.each([['hiring.ts'], ['employerActions.ts']])(
    '%s does not reach the Stripe client',
    (file) => {
      const code = codeWithoutComments(sourceOf(file));

      expect(code).not.toMatch(/recordSuccessfulHire/);
      expect(code).not.toMatch(/services\/billing\/stripeClient/);
    },
  );

  it('leaves the billing machinery in place for a later, gated reintroduction', () => {
    // The point of the ruling is "not yet", not "never" — so the module the
    // future gate will call must still exist. If this fails, someone deleted
    // the machinery rather than unwiring it.
    const stripeClient = join(ROUTES, '..', 'services', 'billing', 'stripeClient.ts');
    expect(() => readFileSync(stripeClient, 'utf8')).not.toThrow();
    expect(readFileSync(stripeClient, 'utf8')).toMatch(/recordSuccessfulHire/);
  });
});
