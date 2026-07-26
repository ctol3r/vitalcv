// VitalCV · Trust Surfaces · Consolidated primitives
// Canon v1 · §05 — these 8 components are the only renderers for trust tokens.
// Importing this once gives surface authors everything they need.

import * as React from "react";
import type {
  ChipVariant,
  OwnerState,
  ReplayState,
  TrustTier,
  Verdict,
} from "@/lib/trust/types";

// =============== TrustChip ===============
export function TrustChip({
  children,
  variant = "outline",
}: {
  children: React.ReactNode;
  variant?: ChipVariant;
}) {
  return (
    <span className="t-chip" data-variant={variant}>
      <span className="d" />
      {children}
    </span>
  );
}

// =============== TierBadge ===============
export function TierBadge({ tier }: { tier: TrustTier }) {
  return <span className="t-tier">{tier}</span>;
}

// =============== IdRender ===============
export function IdRender({
  value,
  tone = "light",
  title,
}: {
  value: string;
  tone?: "light" | "inverted";
  title?: string;
}) {
  return (
    <code className="t-id" data-tone={tone} title={title ?? value}>
      {value}
    </code>
  );
}

// =============== CheckedAt ===============
export function CheckedAt({
  iso,
  relative,
}: {
  iso: string;
  relative: string;
}) {
  return (
    <span className="t-when">
      {iso}
      <span className="sub">{relative}</span>
    </span>
  );
}

// =============== OwnershipBadge ===============
export function OwnershipBadge({ state }: { state: OwnerState }) {
  const label = state === "subject" ? "Subject" : state === "delegated" ? "Delegated" : "Unbound";
  return (
    <span className="t-own" data-state={state}>
      <span className="d" />
      {label}
    </span>
  );
}

// =============== ReplayChip ===============
export function ReplayChip({ state }: { state: ReplayState }) {
  if (state === "none") return null;
  const variant: ChipVariant = state === "anchored" ? "outline" : "dotted";
  return <TrustChip variant={variant}>{state}</TrustChip>;
}

// =============== VerdictBar ===============
export function VerdictBar({ verdict }: { verdict: Verdict }) {
  return (
    <div className="t-verdict" role="status" aria-live="polite">
      <div className="v">
        <span className="d" />
        Verdict · {verdict.headline}
      </div>
      <div className="b">
        {verdict.facts.map((f, i) => (
          <React.Fragment key={i}>
            <span>{f}</span>
            {i < verdict.facts.length - 1 && <span className="pipe">|</span>}
          </React.Fragment>
        ))}
      </div>
      {verdict.readTime && (
        <div className="a">
          <strong>Read time · {verdict.readTime}</strong>
          Then verify offline.
        </div>
      )}
    </div>
  );
}

// =============== SectionHeader ===============
export function SectionHeader({
  n,
  title,
  ey,
}: {
  n: string;
  title: string;
  ey?: string;
}) {
  return (
    <div className="t-sh">
      <span className="n">{n}</span>
      <h2>{title}</h2>
      {ey && <span className="ey">{ey}</span>}
    </div>
  );
}
