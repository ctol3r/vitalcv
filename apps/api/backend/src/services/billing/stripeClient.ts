/**
 * stripeClient.ts — Wave 42: Outcomes Billing Engine
 *
 * Isolated Stripe integration service.
 *
 * BILLING MODEL
 * ─────────────
 * VitalCV charges a flat "Verified Hire" fee of $37.99 (3 799 cents) every
 * time an employer successfully closes the ON Loop — i.e. when a
 * StartAttestation is anchored to the Merkle ledger.
 *
 * Stripe billing flow:
 *   1. Find or create a Stripe Customer keyed by `employerId`
 *      (stored in Customer.metadata.employer_id for idempotent lookup).
 *   2. Create an InvoiceItem on that customer for $37.99.
 *      Items accumulate on the customer's open draft invoice and are
 *      collected on the next billing cycle (or immediately via auto-invoicing
 *      if `STRIPE_AUTO_INVOICE=true`).
 *
 * CONFIGURATION
 * ─────────────
 * STRIPE_SECRET_KEY   — Stripe secret key (sk_live_… or sk_test_…).
 *                       If absent, the service returns null (no-op / SKIPPED).
 * STRIPE_AUTO_INVOICE — Set to "true" to immediately finalize and pay the
 *                       invoice rather than accumulating line items.
 *
 * ISOLATION GUARANTEE
 * ────────────────────
 * All Stripe logic is contained here.  No other module imports from stripe.
 * Callers receive typed result objects; Stripe-specific types don't leak.
 *
 * ERROR CONTRACT
 * ─────────────
 * `recordSuccessfulHire()` throws on Stripe API or network errors.
 * Callers (hiring.ts) catch and write status=ERROR to BillingEvent.
 */

import Stripe from 'stripe';
import { log } from '../../obs/logger';

// ── Constants ──────────────────────────────────────────────────────────────

/** $37.99 per verified hire — in smallest currency unit (cents). */
export const VERIFIED_HIRE_AMOUNT_CENTS = 3_799;
export const VERIFIED_HIRE_CURRENCY     = 'usd' as const;
export const VERIFIED_HIRE_DESCRIPTION  = 'VitalCV Verified Hire — ON Loop closure';

// ── SDK singleton ──────────────────────────────────────────────────────────

let _stripe: Stripe | null = null;

/**
 * Return the Stripe SDK instance, or null if STRIPE_SECRET_KEY is not set.
 * The instance is created once and cached for the process lifetime.
 */
function getStripe(): Stripe | null {
  if (_stripe) return _stripe;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;

  _stripe = new Stripe(key, {
    // Pinned to the SDK's bundled stable version.
    apiVersion: '2026-02-25.clover',
    appInfo: {
      name:    'VitalCV Billing Engine',
      version: '42.0.0',
      url:     'https://vitalcv.ai',
    },
    timeout:  10_000, // 10 s — Stripe calls happen async; still cap them
    maxNetworkRetries: 2,
  });

  return _stripe;
}

/** Reset the cached Stripe instance — for tests only. */
export function _resetStripeClient(): void {
  _stripe = null;
}

// ── Public result type ─────────────────────────────────────────────────────

export interface StripeHireResult {
  /** Stripe customer.id (resolved or newly created). */
  stripeCustomerId:    string;
  /** Stripe invoiceitem.id for this hire event. */
  stripeInvoiceItemId: string;
  /** Fee charged in cents. */
  amountCents:         number;
  currency:            string;
}

// ── Internal helpers ───────────────────────────────────────────────────────

/**
 * Find an existing Stripe Customer for the given employer, or create one.
 *
 * Customers are keyed by `metadata.employer_id` so the lookup is stable
 * across calls even if the employer's display name changes.
 *
 * Uses Stripe's Customer Search API (requires Search feature — enabled on
 * all Stripe accounts since 2022).  Falls back to creating a new customer
 * if the search returns no results.
 */
async function findOrCreateCustomer(
  stripe:     Stripe,
  employerId: string,
): Promise<string> {
  // Escape any special characters in the employer ID for the search query.
  const safeId = employerId.replace(/"/g, '\\"');

  const search = await stripe.customers.search({
    query: `metadata["employer_id"]:"${safeId}"`,
    limit: 1,
  });

  if (search.data.length > 0) {
    const customer = search.data[0];
    log('info', 'billing_stripe_customer_found', {
      customerId: customer.id,
      employerId,
    });
    return customer.id;
  }

  const customer = await stripe.customers.create({
    description: `VitalCV Employer — ${employerId}`,
    metadata: {
      employer_id: employerId,
      source:      'vitalcv-billing-engine-wave42',
    },
  });

  log('info', 'billing_stripe_customer_created', {
    customerId: customer.id,
    employerId,
  });

  return customer.id;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Record a successful hire as a Stripe billing event.
 *
 * Steps:
 *   1. Resolve the Stripe Customer for this employer (find or create).
 *   2. Create an InvoiceItem of $37.99 on that customer.
 *   3. If `STRIPE_AUTO_INVOICE=true`, immediately finalize + pay the invoice.
 *   4. Return structured result for the caller to persist in BillingEvent.
 *
 * Returns `null` (no-op) when `STRIPE_SECRET_KEY` is not configured —
 * allowing the billing engine to run in development without a live key.
 *
 * @param employerId          Domain employer identifier.
 * @param clinicianNpi        10-digit NPI (truncated in Stripe metadata).
 * @param startAttestationId  Wave 41 StartAttestation UUID (audit reference).
 * @throws                    On Stripe API errors or network failures.
 */
export async function recordSuccessfulHire(
  employerId:         string,
  clinicianNpi:       string,
  startAttestationId: string,
): Promise<StripeHireResult | null> {
  const stripe = getStripe();

  if (!stripe) {
    log('warn', 'billing_stripe_skipped', {
      reason:             'STRIPE_SECRET_KEY not configured',
      employerId,
      startAttestationId,
    });
    return null;
  }

  // ── 1. Resolve customer ─────────────────────────────────────────────────
  const customerId = await findOrCreateCustomer(stripe, employerId);

  // ── 2. Create invoice item ──────────────────────────────────────────────
  const invoiceItem = await stripe.invoiceItems.create({
    customer:    customerId,
    amount:      VERIFIED_HIRE_AMOUNT_CENTS,
    currency:    VERIFIED_HIRE_CURRENCY,
    description: VERIFIED_HIRE_DESCRIPTION,
    metadata: {
      employer_id:          employerId,
      start_attestation_id: startAttestationId,
      npi_prefix:           clinicianNpi.slice(0, 4) + '····',
      source:               'vitalcv-on-loop-wave42',
    },
  });

  log('info', 'billing_stripe_invoice_item_created', {
    invoiceItemId:      invoiceItem.id,
    customerId,
    employerId,
    startAttestationId,
    amountCents:        VERIFIED_HIRE_AMOUNT_CENTS,
  });

  // ── 3. Optionally auto-invoice ──────────────────────────────────────────
  if (process.env.STRIPE_AUTO_INVOICE === 'true') {
    const invoice = await stripe.invoices.create({
      customer:       customerId,
      auto_advance:   true,
      collection_method: 'charge_automatically',
      metadata: {
        employer_id:          employerId,
        start_attestation_id: startAttestationId,
      },
    });

    await stripe.invoices.finalizeInvoice(invoice.id);

    log('info', 'billing_stripe_invoice_finalized', {
      invoiceId:   invoice.id,
      customerId,
      employerId,
    });
  }

  return {
    stripeCustomerId:    customerId,
    stripeInvoiceItemId: invoiceItem.id,
    amountCents:         VERIFIED_HIRE_AMOUNT_CENTS,
    currency:            VERIFIED_HIRE_CURRENCY,
  };
}
