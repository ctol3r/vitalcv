/**
 * VitalCV · Trust Surfaces · Primitives v1
 *
 * Shared primitives used by every trust-surface route. The visual
 * canon lives in apps/web/styles/trust.css; these components are the
 * minimal React/TSX surface that the routes compose. Each primitive
 * is intentionally small — when a route needs a richer rendering it
 * composes primitives rather than reaching back into trust.css.
 *
 * No "Verified" labels (bare or quoted). No banned phrases. No live
 * source claims. Every consumer must render a demo banner.
 */

import * as React from 'react';

/** Tiny class-name concatenator (no dependency on `clsx`). */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/* ───────────────────────────────────────────────────────────────────
 * SectionHeader — labels every numbered section on a trust surface.
 * Renders as a controlled-document section header, never as a
 * marketing eyebrow.
 * ─────────────────────────────────────────────────────────────────── */
export interface SectionHeaderProps {
  /** Section number, two-digit string ("01", "02", …). */
  n: string;
  /** Section title. */
  title: string;
  /** Eyebrow strapline below the title; kept short. */
  ey?: string;
  /** Optional right-aligned slot for inline citations / stamps. */
  right?: React.ReactNode;
}

export function SectionHeader({ n, title, ey, right }: SectionHeaderProps) {
  return (
    <header
      className="t-section"
      data-testid="trust-section-header"
      data-section={n}
    >
      <div className="t-section-l">
        <span className="t-section-n mono">{n}</span>
        <div>
          <h2 className="t-section-title">{title}</h2>
          {ey && <p className="t-section-ey">{ey}</p>}
        </div>
      </div>
      {right && <div className="t-section-r">{right}</div>}
    </header>
  );
}

/* ───────────────────────────────────────────────────────────────────
 * StateStamp — preview / snapshot / signed badge.
 * Uses the `.t-stamp[data-state="…"]` CSS canon directly. Preview is
 * dashed (never opacity); signed uses the inverted dark surface
 * reserved for crypto planes.
 * ─────────────────────────────────────────────────────────────────── */
export interface StateStampProps {
  state: 'preview' | 'snapshot' | 'signed';
  /** Optional label override. Defaults to the state name uppercased. */
  label?: string;
  /** Short prefix shown above the value (e.g. "stage"). */
  caption?: string;
}

export function StateStamp({ state, label, caption = 'stage' }: StateStampProps) {
  return (
    <span
      className="t-stamp"
      data-state={state}
      data-testid="trust-state-stamp"
    >
      <span className="lb">{caption}</span>
      <span className="v">{label ?? state.toUpperCase()}</span>
    </span>
  );
}

/* ───────────────────────────────────────────────────────────────────
 * OwnershipBadge — explicit subject / delegated / unbound rendering.
 *
 * Doctrine: every trust surface must render one of these three
 * values explicitly. There is no default. This component is what
 * the lineage-order test asserts.
 * ─────────────────────────────────────────────────────────────────── */
export interface OwnershipBadgeProps {
  state: 'subject' | 'delegated' | 'unbound';
}

export function OwnershipBadge({ state }: OwnershipBadgeProps) {
  return (
    <span
      className="t-ownership"
      data-ownership={state}
      data-testid="trust-ownership-badge"
    >
      <span className="mono t-ownership-label">{state}</span>
    </span>
  );
}

/* ───────────────────────────────────────────────────────────────────
 * DemoBanner — required on every trust surface that consumes a
 * fixture. The brief explicitly requires the literal disclaimer
 * "Demo data — not a real credentialing decision." to appear on
 * every surface.
 * ─────────────────────────────────────────────────────────────────── */
export interface DemoBannerProps {
  /** Optional extra context shown after the canonical sentence. */
  extra?: string;
}

export function DemoBanner({ extra }: DemoBannerProps) {
  return (
    <aside
      className="t-demo-banner"
      role="status"
      data-testid="trust-demo-banner"
    >
      <span className="t-demo-banner-pill mono">DEMO</span>
      <span className="t-demo-banner-copy">
        Demo data — not a real credentialing decision.
        {extra ? ` ${extra}` : ''}
      </span>
    </aside>
  );
}

/* ───────────────────────────────────────────────────────────────────
 * Mono — wraps any identifier-shaped value in the mono + tabular
 * numeral class set the canon prescribes. Used heavily for run_id,
 * receipt ids, NPI, and timestamps.
 * ─────────────────────────────────────────────────────────────────── */
export function Mono({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <span className={cn('mono', className)}>{children}</span>;
}

/* ───────────────────────────────────────────────────────────────────
 * Cite — inline standards reference. Renders the "ref · " prefix
 * automatically via CSS.
 * ─────────────────────────────────────────────────────────────────── */
export function Cite({ children }: { children: React.ReactNode }) {
  return <span className="t-cite">{children}</span>;
}
