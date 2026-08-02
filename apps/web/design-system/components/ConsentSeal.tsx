import { cn } from '@/lib/utils';

/**
 * ConsentSeal — what a clinician agreed to share, with whom, for how long, and
 * how to stop it.
 *
 * Reference: Dock Labs, measured 2026-08-01
 * (`docs/design/reference-experience-atlas.md` §R4). Dock treats expiration and
 * revocation as first-class product surface rather than an edge case, and
 * proves by standards conformance rather than by percentage. Both are adopted.
 *
 * What is deliberately NOT adopted: **the word "wallet"**, which appears 8–11
 * times on every Dock marketing page. It is on CD-13's kill list AND in the
 * shipped `BUYER_BANNED_STRINGS` array in
 * `apps/web/__tests__/buyer-proof-page.test.tsx` alongside `blockchain`,
 * `ledger` and `zero-knowledge`. The directive's `DeviceWalletFrame` fails on
 * its name alone; this component and {@link PacketHandoff} carry its intent
 * without its vocabulary. Worth noting Dock has already dropped `blockchain`
 * and `DID` to zero on its own business pages — market confirmation, not
 * licence to adopt what they retired.
 *
 * A seal that cannot be revoked is not consent, so `revocable` is required and
 * the revocation route is stated in the artifact rather than buried in settings.
 */
export interface ConsentSealProps {
  /** Who the evidence was shared with. Named, never "an employer". */
  grantedTo: string;
  /** Exactly what was shared. Enumerated — no "full profile". */
  scope: string[];
  /** ISO date or plain date. Rendered mono; it is a machine fact (CD-8). */
  grantedAt: string;
  /** When it lapses. `null` is rendered as an explicit "does not expire". */
  expiresAt: string | null;
  /** How to withdraw. Required — consent without a stated exit is not consent. */
  revocationRoute: string;
  className?: string;
}

export function ConsentSeal({
  grantedTo,
  scope,
  grantedAt,
  expiresAt,
  revocationRoute,
  className,
}: ConsentSealProps) {
  return (
    <section
      aria-label={`Consent granted to ${grantedTo}`}
      className={cn(
        // CD-10 document radius, hairline rule, no shadow (CD-12).
        'rounded-[3px] border border-[var(--vt-border)] bg-[var(--vt-surface)] p-[var(--vt-space-16)]',
        className,
      )}
    >
      <p className="m-0 font-[var(--vt-font-mono,ui-monospace)] text-[0.6875rem] uppercase tracking-[0.08em] text-[var(--vt-text-muted)]">
        Consent
      </p>

      <p className="mt-[var(--vt-space-8)] mb-0 text-[0.9375rem] leading-[1.55] text-[var(--vt-text-primary)]">
        Shared with{' '}
        <span className="font-[var(--vt-font-mono,ui-monospace)]">{grantedTo}</span>
      </p>

      <ul className="mt-[var(--vt-space-12)] mb-0 list-none border-t border-[var(--vt-border)] p-0">
        {scope.map((item) => (
          <li
            key={item}
            className="border-b border-[var(--vt-border)] py-[var(--vt-space-8)] font-[var(--vt-font-mono,ui-monospace)] text-[0.8125rem] leading-[1.5] text-[var(--vt-text-primary)]"
          >
            {item}
          </li>
        ))}
      </ul>

      <dl className="mt-[var(--vt-space-12)] mb-0 grid grid-cols-[minmax(0,12ch)_1fr] gap-x-[var(--vt-space-12)] gap-y-[var(--vt-space-4)]">
        <dt className="text-[0.75rem] text-[var(--vt-text-secondary)]">Granted</dt>
        <dd className="m-0 font-[var(--vt-font-mono,ui-monospace)] text-[0.75rem] tabular-nums text-[var(--vt-text-primary)]">
          {grantedAt}
        </dd>

        <dt className="text-[0.75rem] text-[var(--vt-text-secondary)]">Expires</dt>
        <dd className="m-0 font-[var(--vt-font-mono,ui-monospace)] text-[0.75rem] tabular-nums text-[var(--vt-text-primary)]">
          {/* An absent expiry is stated, never left blank. A blank field reads
              as "unknown"; this is a known, deliberate "no expiry". */}
          {expiresAt ?? 'Does not expire'}
        </dd>
      </dl>

      <p className="mt-[var(--vt-space-12)] mb-0 max-w-[62ch] text-[0.8125rem] leading-[1.5] text-[var(--vt-text-secondary)]">
        {revocationRoute}
      </p>
    </section>
  );
}
