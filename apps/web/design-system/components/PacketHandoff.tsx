import { cn } from '@/lib/utils';

/**
 * PacketHandoff — evidence handed to a named recipient, with a scope, an expiry,
 * and a stated limit.
 *
 * This absorbs the intent of the directive's `DeviceWalletFrame` without its
 * vocabulary. "Wallet" is on CD-13's kill list and in the shipped
 * `BUYER_BANNED_STRINGS` array (`apps/web/__tests__/buyer-proof-page.test.tsx`),
 * so that component fails on its name; the behaviour it describes — issue,
 * hold, present — is legitimate and lives here.
 *
 * The choreography is Dock's issue → store → recognise sequence, measured
 * 2026-08-01. **The important finding: Dock never draws a node-link graph.**
 * Across all five of its marketing pages the issuer/holder/verifier model is a
 * NUMBERED SEQUENCE — "1. Digital ID issuance / 2. Digital ID storage /
 * 3. Cross-domain recognition". That matters here because `R1` in
 * `scripts/check-design-lint.ts` is an ERROR-mode rule banning graph vocabulary
 * and node/edge drawing (`.lineTo(`, `.moveTo(`, `constellation`, `forceGraph`),
 * and CD-13 retires node-link diagrams outright. An ordered list is not a
 * compromise for a graph — it is what the reference actually ships.
 *
 * `doesNotDecide` is required. A packet that does not state its limit is the
 * over-claim CD-1 forbids, and it is the difference between our artifact and a
 * competitor's percentage.
 */
export interface HandoffStep {
  /** What happened. Prose → sans. */
  label: string;
  /** Who did it — issuer, holder, verifier. Mono; it is a named party (CD-8). */
  actor: string;
  /** When. Mono, tabular. `null` renders as not-yet-occurred, never as blank. */
  at: string | null;
}

export interface PacketHandoffProps {
  /** The named recipient. Never "an employer". */
  recipient: string;
  /** Ordered sequence — NOT a graph (R1, CD-13). */
  steps: HandoffStep[];
  /** What the packet explicitly does not decide. Required. */
  doesNotDecide: string;
  expiresAt?: string | null;
  className?: string;
}

export function PacketHandoff({
  recipient,
  steps,
  doesNotDecide,
  expiresAt,
  className,
}: PacketHandoffProps) {
  return (
    <section
      aria-label={`Evidence packet handed to ${recipient}`}
      className={cn(
        'rounded-[3px] border border-[var(--vt-border)] bg-[var(--vt-surface)] p-[var(--vt-space-16)]',
        className,
      )}
    >
      <p className="m-0 font-[var(--vt-font-mono,ui-monospace)] text-[0.6875rem] uppercase tracking-[0.08em] text-[var(--vt-text-muted)]">
        Handed to
      </p>
      <p className="mt-[var(--vt-space-4)] mb-[var(--vt-space-12)] font-[var(--vt-font-mono,ui-monospace)] text-[0.9375rem] leading-[1.4] text-[var(--vt-text-primary)]">
        {recipient}
      </p>

      {/* An ordered list, semantically and visually. The number is the sequence,
          not decoration — CD-13 retires `01–06` step numbering as a device, and
          this is `<ol>` semantics doing the work instead of a styled label. */}
      <ol className="m-0 list-none border-t border-[var(--vt-border)] p-0">
        {steps.map((step, i) => (
          <li
            key={`${step.actor}-${step.label}`}
            className="grid grid-cols-[2ch_1fr] gap-x-[var(--vt-space-12)] border-b border-[var(--vt-border)] py-[var(--vt-space-12)]"
          >
            <span
              aria-hidden="true"
              className="font-[var(--vt-font-mono,ui-monospace)] text-[0.75rem] tabular-nums text-[var(--vt-text-muted)]"
            >
              {i + 1}
            </span>
            <span className="flex flex-col gap-[var(--vt-space-4)]">
              <span className="text-[0.875rem] leading-[1.5] text-[var(--vt-text-primary)]">
                {step.label}
              </span>
              <span className="font-[var(--vt-font-mono,ui-monospace)] text-[0.6875rem] leading-[1.4] tracking-[0.04em] text-[var(--vt-text-muted)]">
                {step.actor} · {step.at ?? 'not yet'}
              </span>
            </span>
          </li>
        ))}
      </ol>

      {expiresAt !== undefined ? (
        <p className="mt-[var(--vt-space-12)] mb-0 font-[var(--vt-font-mono,ui-monospace)] text-[0.75rem] tabular-nums text-[var(--vt-text-secondary)]">
          Expires {expiresAt ?? 'never'}
        </p>
      ) : null}

      <p className="mt-[var(--vt-space-12)] mb-0 max-w-[62ch] text-[0.8125rem] leading-[1.5] text-[var(--vt-text-secondary)]">
        <span className="font-[var(--vt-font-mono,ui-monospace)] text-[0.6875rem] uppercase tracking-[0.08em] text-[var(--vt-text-muted)]">
          Does not decide
        </span>
        <br />
        {doesNotDecide}
      </p>
    </section>
  );
}
